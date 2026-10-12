import { request as httpRequest } from 'node:http';
import { ApiErrorSchema, ClaimResultSchema, type ParcheState, ParcheStateSchema, PIN_MAX_FAILURES } from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { nextLocalTime } from '../src/parche/clock.ts';
import { ParcheService } from '../src/parche/parche.service.ts';
import { RedisService } from '../src/redis/redis.service.ts';
import { claimableCodes, claimCode, draft, person, seedBrands } from './fixtures.ts';
import { createTestApp, resetDatabase, testPrisma } from './helpers.ts';

let app: NestFastifyApplication;
let db: PrismaClient;
let baseUrl: string;

beforeAll(async () => {
  app = await createTestApp();
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
  db = testPrisma();
});
afterAll(async () => {
  await app?.close();
  await db?.$disconnect();
});
beforeEach(async () => {
  await resetDatabase(db);
  const redis = app.get(RedisService);
  await redis.isHealthy();
  await redis.client.flushdb();
  await seedBrands(db);
});

type Res = { json: () => unknown; statusCode: number };
const err = (res: Res) => ApiErrorSchema.parse(res.json()).error;
const st = (res: Res) => ParcheStateSchema.parse(res.json());
const MIN = 60_000;

async function hosted(extra: Record<string, unknown> = {}) {
  const host = await person(app, db, [], 'Ana');
  const s = st(await host.request('POST', '/sessions', { name: 'Los del bosque', alias: 'Ana', ...extra }));
  return { host, s };
}

describe('reloj de cierre (Instrucciones §3.2)', () => {
  it('cierra a la próxima hora local de Colombia', () => {
    // 23:00 de Bogotá (04:00 UTC del día siguiente) → 06:00 de Bogotá = 11:00 UTC.
    expect(nextLocalTime(new Date('2026-10-13T04:00:00Z'), '06:00').toISOString()).toBe('2026-10-13T11:00:00.000Z');
    // 07:00 de Bogotá → 06:00 del día siguiente.
    expect(nextLocalTime(new Date('2026-10-13T12:00:00Z'), '06:00').toISOString()).toBe('2026-10-14T11:00:00.000Z');
  });
});

describe('crear y unirse (Guía Técnica §5.5)', () => {
  it('crea un Parche libre de Ruta B con PIN, invitación firmada, energía y cierre', async () => {
    const before = Date.now();
    const { s } = await hosted();
    expect(s).toMatchObject({
      status: 'ABIERTA',
      route: 'B_EXPERIENCIAL',
      mode: 'MULTI_DISPOSITIVO',
      isHost: true,
      energy: { minutes: 45 },
      score: 0,
      activations: 0,
    });
    expect(s.pin).toMatch(/^\d{4}$/);
    expect(s.invitePath).toMatch(new RegExp(`^/parche/${s.id}/unirse\\?i=[A-Za-z0-9_-]{20,}$`));
    expect(new Date(s.energy.endsAt ?? 0).getTime()).toBeGreaterThanOrEqual(before + 45 * MIN - 1000);
    expect(new Date(s.expiresAt).toISOString()).toMatch(/T11:00:00\.000Z$/);
    // El PIN no se guarda en claro en la base de datos.
    expect((await db.session.findFirstOrThrow()).pinLookup).not.toContain(s.pin as string);
  });

  it('se une con PIN y solo se muestran alias (sin datos personales)', async () => {
    const { s } = await hosted();
    const bea = await person(app, db, [], 'Bea');
    const joined = st(await bea.request('POST', '/sessions/join', { pin: s.pin, alias: 'Bea' }));
    expect(joined.participants.map((p) => [p.alias, p.isHost, p.isYou])).toEqual([
      ['Ana', true, false],
      ['Bea', false, true],
    ]);
    expect(JSON.stringify(joined)).not.toContain(bea.user.id);
    // Reconexión: unirse de nuevo no duplica.
    st(await bea.request('POST', '/sessions/join', { pin: s.pin, alias: 'Bea' }));
    expect(await db.sessionParticipant.count()).toBe(2);
  });

  it('limita los intentos de PIN por persona y luego bloquea aunque acierte', async () => {
    const { s } = await hosted();
    const intruder = await person(app, db, [], 'Ivo');
    const wrong = s.pin === '0000' ? '0001' : '0000';
    for (let i = 1; i < PIN_MAX_FAILURES; i++) {
      const e = err(await intruder.request('POST', '/sessions/join', { pin: wrong, alias: 'Ivo' }));
      expect(e).toMatchObject({ code: 'SESSION_PIN_INVALID' });
      expect(e.message).toMatch(new RegExp(`Te quedan ${PIN_MAX_FAILURES - i}`));
    }
    expect(err(await intruder.request('POST', '/sessions/join', { pin: wrong, alias: 'Ivo' })).code).toBe('SESSION_PIN_LOCKED');
    expect(err(await intruder.request('POST', '/sessions/join', { pin: s.pin, alias: 'Ivo' })).code).toBe('SESSION_PIN_LOCKED');
    expect(await db.securityEvent.count({ where: { type: 'parche.pin_bruteforce' } })).toBe(1);
  });

  it('la invitación del QR solo sirve para su sesión y mientras siga viva', async () => {
    const { host, s } = await hosted();
    const invite = new URL(s.invitePath as string, 'http://x').searchParams.get('i') as string;
    const other = await hosted();
    const bea = await person(app, db, [], 'Bea');
    expect(err(await bea.request('POST', `/sessions/${other.s.id}/join`, { invite, alias: 'Bea' })).code).toBe('SESSION_NOT_FOUND');
    expect(st(await bea.request('POST', `/sessions/${s.id}/join`, { invite, alias: 'Bea' })).participants).toHaveLength(2);
    await host.request('POST', `/sessions/${s.id}/close`);
    const ciro = await person(app, db, [], 'Ciro');
    expect(err(await ciro.request('POST', `/sessions/${s.id}/join`, { invite, alias: 'Ciro' })).code).toBe('SESSION_EXPIRED');
  });

  it('respeta la capacidad incluso con solicitudes simultáneas', async () => {
    const { s } = await hosted();
    await db.session.update({ where: { id: s.id }, data: { capacity: 2 } });
    const [b, c] = await Promise.all([person(app, db, [], 'Bea'), person(app, db, [], 'Ciro')]);
    const res = await Promise.all([b, c].map((p) => p.request('POST', '/sessions/join', { pin: s.pin, alias: 'Invitado' })));
    expect(res.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(await db.sessionParticipant.count({ where: { status: { not: 'SALIO' } } })).toBe(2);
  });

  it('una persona participa en un solo Parche a la vez', async () => {
    const first = await hosted();
    const second = await hosted();
    const bea = await person(app, db, [], 'Bea');
    await bea.request('POST', '/sessions/join', { pin: first.s.pin, alias: 'Bea' });
    await bea.request('POST', '/sessions/join', { pin: second.s.pin, alias: 'Bea' });
    const inFirst = st(await bea.request('GET', `/sessions/${first.s.id}`));
    expect(inFirst.participants.find((p) => p.isYou)?.status).toBe('left');
    expect(inFirst.pin).toBeNull();
  });

  it('nadie fuera del Parche ve su estado', async () => {
    const { s } = await hosted();
    const outsider = await person(app, db, [], 'Out');
    expect(err(await outsider.request('GET', `/sessions/${s.id}`)).code).toBe('SESSION_NOT_FOUND');
  });

  it('modo un dispositivo: jugadores locales sin cuenta y sin uniones por PIN', async () => {
    const { s } = await hosted({ mode: 'UN_DISPOSITIVO', localPlayers: ['Bea', 'Ciro'] });
    expect(s).toMatchObject({ mode: 'UN_DISPOSITIVO', capacity: 3, localPlayers: ['Bea', 'Ciro'], invitePath: null });
    const bea = await person(app, db, [], 'Bea');
    expect(err(await bea.request('POST', '/sessions/join', { pin: s.pin, alias: 'Bea' })).code).toBe('CONFLICT');
  });
});

describe('salir, cerrar y expirar', () => {
  it('si sale el anfitrión, el grupo sigue con otro anfitrión; si salen todos, termina', async () => {
    const { host, s } = await hosted();
    const bea = await person(app, db, [], 'Bea');
    await bea.request('POST', '/sessions/join', { pin: s.pin, alias: 'Bea' });
    expect((await host.request('POST', `/sessions/${s.id}/leave`)).statusCode).toBe(204);
    expect(st(await bea.request('GET', `/sessions/${s.id}`))).toMatchObject({ isHost: true, status: 'ABIERTA' });
    await bea.request('POST', `/sessions/${s.id}/leave`);
    expect((await db.session.findFirstOrThrow()).status).toBe('FINALIZADA');
  });

  it('solo el anfitrión cierra, con auditoría', async () => {
    const { host, s } = await hosted();
    const bea = await person(app, db, [], 'Bea');
    await bea.request('POST', '/sessions/join', { pin: s.pin, alias: 'Bea' });
    expect(err(await bea.request('POST', `/sessions/${s.id}/close`)).code).toBe('FORBIDDEN');
    expect(st(await host.request('POST', `/sessions/${s.id}/close`)).status).toBe('FINALIZADA');
    expect(await db.auditEvent.count({ where: { action: 'parche.closed' } })).toBe(1);
  });

  it('expira a la hora de cierre o por inactividad, sin tocar saldos', async () => {
    const a = await hosted();
    const b = await hosted();
    await db.session.update({ where: { id: b.s.id }, data: { lastActivityAt: new Date(Date.now() - 3 * 60 * MIN) } });
    const parche = app.get(ParcheService);
    expect(await parche.tick()).toBe(1);
    expect((await db.session.findUniqueOrThrow({ where: { id: b.s.id } })).status).toBe('EXPIRADA');
    expect(await parche.tick(new Date(new Date(a.s.expiresAt).getTime() + 1000))).toBe(1);
    expect((await db.session.findUniqueOrThrow({ where: { id: a.s.id } })).status).toBe('EXPIRADA');
  });
});

describe('Ruta A: nace de una activación y la energía se recarga al activar', () => {
  it('crea desde la activación propia y recarga energía con otra activación dentro del Parche', async () => {
    const { tokens } = await claimableCodes(app, db, 2, draft({ rules: { ...draft().rules, energyMinutes: 30 } }));
    const ana = await person(app, db, [], 'Ana');
    const first = ClaimResultSchema.parse((await claimCode(ana, tokens[0] as string)).json());
    const s = st(await ana.request('POST', '/sessions', { name: 'Mesa 4', alias: 'Ana', claimId: first.claimId }));
    expect(s).toMatchObject({ route: 'A_COMERCIAL', activations: 1, energy: { minutes: 30 }, campaign: { slug: 'feria', title: 'Feria de Manizales' } });

    const bea = await person(app, db, [], 'Bea');
    expect(err(await bea.request('POST', '/sessions', { name: 'Ajena', alias: 'Bea', claimId: first.claimId })).code).toBe('NOT_FOUND');
    await bea.request('POST', '/sessions/join', { pin: s.pin, alias: 'Bea' });
    const res = await bea.request('POST', `/campaign-codes/${tokens[1]}/claim`, { sessionId: s.id }, { 'idempotency-key': 'k'.repeat(20) });
    const second = ClaimResultSchema.parse(res.json());
    expect(second).toMatchObject({ points: 500, parcheRecharged: true });
    const after = st(await bea.request('GET', `/sessions/${s.id}`));
    expect(after.activations).toBe(2);
    expect(new Date(after.energy.endsAt ?? 0).getTime()).toBeGreaterThan(new Date(s.energy.endsAt ?? 0).getTime() + 25 * MIN);
    // Los puntos son de cada persona; el Parche no tiene saldo comercial propio.
    expect(await db.ledgerAccount.count({ where: { ownerType: 'SESION' } })).toBe(0);
  });
});

/** Lee eventos SSE del servidor real hasta cumplir la condición. */
function listen(path: string, cookie: string, until: (states: ParcheState[]) => boolean, timeoutMs = 5000) {
  return new Promise<{ states: ParcheState[]; abort: () => void }>((resolve, reject) => {
    const states: ParcheState[] = [];
    const req = httpRequest(`${baseUrl}/api/v1${path}`, { headers: { cookie, accept: 'text/event-stream' } }, (res) => {
      expect(res.headers['content-type']).toMatch(/text\/event-stream/);
      let buffer = '';
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        let i = buffer.indexOf('\n\n');
        while (i >= 0) {
          const block = buffer.slice(0, i);
          buffer = buffer.slice(i + 2);
          const data = block.split('\n').find((l) => l.startsWith('data: '));
          if (data) states.push(ParcheStateSchema.parse(JSON.parse(data.slice(6))));
          i = buffer.indexOf('\n\n');
        }
        if (until(states)) resolve({ states, abort: () => req.destroy() });
      });
    });
    req.on('error', () => undefined);
    setTimeout(() => reject(new Error(`SSE sin la condición esperada; recibido: ${states.length} estados`)), timeoutMs);
    req.end();
  });
}

describe('tiempo real (Guía Técnica §8)', () => {
  it('envía el estado vigente al conectar y cada cambio con versión creciente; la presencia sigue la conexión', async () => {
    const { host, s } = await hosted();
    const cookie = [...host.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const live = listen(`/sessions/${s.id}/events`, cookie, (states) => states.some((x) => x.participants.length === 2));
    await new Promise((r) => setTimeout(r, 300));
    const bea = await person(app, db, [], 'Bea');
    await bea.request('POST', '/sessions/join', { pin: s.pin, alias: 'Bea' });
    const { states, abort } = await live;
    expect(states[0]?.participants).toHaveLength(1);
    const versions = states.map((x) => x.stateVersion);
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);
    expect(states.at(-1)?.participants.map((p) => p.alias)).toEqual(['Ana', 'Bea']);

    abort();
    await new Promise((r) => setTimeout(r, 300));
    const seenByBea = st(await bea.request('GET', `/sessions/${s.id}`));
    expect(seenByBea.participants.find((p) => p.alias === 'Ana')?.status).toBe('reconnecting');
  });

  it('cierra el canal cuando el Parche termina y rechaza a quien no participa', async () => {
    const { host, s } = await hosted();
    const cookie = [...host.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const live = listen(`/sessions/${s.id}/events`, cookie, (states) => states.some((x) => x.status === 'FINALIZADA'));
    await new Promise((r) => setTimeout(r, 300));
    await host.request('POST', `/sessions/${s.id}/close`);
    expect((await live).states.at(-1)?.status).toBe('FINALIZADA');

    const outsider = await person(app, db, [], 'Out');
    expect(err(await outsider.request('GET', `/sessions/${s.id}/events`)).code).toBe('SESSION_NOT_FOUND');
  });
});
