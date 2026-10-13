import { ApiErrorSchema, defaultPartyManifest, MissionStartSchema, PARTY_GAMES } from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { RedisService } from '../src/redis/redis.service.ts';
import { person, seedBrands } from './fixtures.ts';
import { activateModule, team } from './game-fixtures.ts';
import { createTestApp, resetDatabase, testPrisma } from './helpers.ts';

let app: NestFastifyApplication;
let db: PrismaClient;

beforeAll(async () => {
  app = await createTestApp();
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
const err = (r: Res) => ApiErrorSchema.parse(r.json()).error;
let n = 0;
const key = () => `p${Date.now().toString(36)}${(n++).toString(36)}`.padEnd(20, 'x');

describe('El Impostor exige datos con consentimiento (decidido en el servidor)', () => {
  it('sin cuenta o sin autorización de novedades responde CONSENT_REQUIRED; con ella y tras retirarla, se bloquea de nuevo', async () => {
    const t = await team(app, db);
    const m = defaultPartyManifest('impostor');
    await activateModule(t, m);
    await t.admin.request('PUT', '/admin/games/defaults', { modules: [m.moduleId] });
    const start = (who: { request: (...a: never[]) => Promise<unknown> } & Record<string, unknown>) =>
      (who as never as { request: (m: string, u: string, b?: unknown, h?: Record<string, string>) => Promise<Res> }).request(
        'POST',
        '/games/start',
        { moduleId: m.moduleId },
        { 'idempotency-key': key() },
      );

    // Cuenta temporal (sin guardar progreso)
    const temp = await person(app, db);
    await db.user.update({ where: { id: temp.user.id }, data: { status: 'TEMPORAL' } });
    const noAccount = await start(temp as never);
    expect(noAccount.statusCode).toBe(409);
    expect(ApiErrorSchema.parse(noAccount.json()).error).toMatchObject({ code: 'CONSENT_REQUIRED', fields: { need: ['account'] } });

    // Cuenta activa sin autorización
    const p = await person(app, db);
    const noConsent = await start(p as never);
    expect(ApiErrorSchema.parse(noConsent.json()).error).toMatchObject({ code: 'CONSENT_REQUIRED', fields: { need: ['marketing'] } });
    await p.request('POST', '/consents', { purpose: 'MARKETING', granted: false, noticeVersion: '1.0', source: 'perfil' });
    expect((await start(p as never)).statusCode).toBe(409);

    // Con autorización juega; si la retira, vuelve a bloquearse
    await p.request('POST', '/consents', { purpose: 'MARKETING', granted: true, noticeVersion: '1.0', source: 'perfil' });
    const ok = await start(p as never);
    expect(ok.statusCode, ok.json() as never).toBe(200);
    await p.request('POST', '/consents', { purpose: 'MARKETING', granted: false, noticeVersion: '1.0', source: 'perfil' });
    expect((await start(p as never)).statusCode).toBe(409);
    expect(await db.ledgerEntry.count()).toBe(0);
  });
});

describe('juegos de fiesta (motor propio, sin puntuación)', () => {
  it('las siete plantillas recorren el ciclo normal y se juegan sin recibir ni acreditar nada', async () => {
    const t = await team(app, db);
    // Los juegos disponibles por defecto salen de los ajustes (campaña o plataforma)
    const ids: string[] = [];
    for (const g of PARTY_GAMES) {
      const m = defaultPartyManifest(g);
      await activateModule(t, m);
      ids.push(m.moduleId);
    }
    expect((await t.admin.request('PUT', '/admin/games/defaults', { modules: ids })).statusCode).toBe(200);
    const player = await person(app, db);
    const catalog = (await player.request('GET', '/games')).json() as { games: Array<{ moduleId: string; kind: string }> };
    expect(catalog.games.map((x) => x.moduleId).sort()).toEqual([...ids].sort());
    // El Impostor exige datos con consentimiento: se prueba aparte
    await player.request('POST', '/consents', { purpose: 'MARKETING', granted: true, noticeVersion: '1.0', source: 'perfil' });
    for (const id of ids) {
      const res = await player.request('POST', '/games/start', { moduleId: id }, { 'idempotency-key': key() });
      expect(res.statusCode, `${id}: ${res.body}`).toBe(200);
      const start = MissionStartSchema.parse(res.json());
      expect(start.play.kind).toBe('party');
      // Enviar un resultado no existe para estos juegos
      expect(err((await player.request('POST', `/missions/${start.missionId}/submit`, {})) as Res).code).toBe('CONFLICT');
    }
    // Jugar jamás acredita Puntos ILC, XP ni marcador
    expect(await db.ledgerEntry.count()).toBe(0);
    expect(await db.xpEntry.count()).toBe(0);
  });

  it('el servidor rechaza textos que presionan a consumir alcohol, un girador con botella y puntuación', async () => {
    const t = await team(app, db);
    const bad = defaultPartyManifest('truth-dare');
    (bad.delivery.config as { dares: string[] }).dares = ['Tómate un shot sin manos', 'Baila 30 segundos', 'Canta una canción'];
    const r1 = await t.admin.request('POST', '/admin/games/modules', { manifest: bad });
    expect(r1.statusCode).toBe(400);
    expect(Object.keys(err(r1 as Res).fields ?? {}).some((k) => k.startsWith('delivery.config.dares.0'))).toBe(true);

    const bottle = defaultPartyManifest('spinner');
    (bottle.delivery.config as { spinner: { shape: string } }).spinner.shape = 'botella';
    expect((await t.admin.request('POST', '/admin/games/modules', { manifest: bottle })).statusCode).toBe(400);

    const scored = defaultPartyManifest('headband');
    expect(
      (await t.admin.request('POST', '/admin/games/modules', { manifest: { ...scored, scoring: { ...scored.scoring, parcheScoreMax: 20 } } })).statusCode,
    ).toBe(400);
  });

  it('Marca personaliza un juego de fiesta (nueva versión) pero no registra otros tipos de módulo; cada cambio exige aprobaciones', async () => {
    const t = await team(app, db);
    const v1 = defaultPartyManifest('spinner');
    const r0 = await t.admin.request('POST', '/admin/games/modules', { manifest: v1 });
    expect(r0.statusCode, r0.body).toBe(201);
    // Nueva versión con otros colores y nombre de la marca en el girador
    const v2 = defaultPartyManifest('spinner', { version: '1.1.0' });
    Object.assign((v2.delivery.config as { spinner: object }).spinner, { body: '#112233', labelTop: 'RON VIEJO', labelBottom: 'DE CALDAS' });
    const res = await t.admin.request('POST', '/admin/games/modules', { manifest: v2 });
    expect(res.statusCode, res.body).toBe(201);
    const view = res.json() as { versions: Array<{ version: string; status: string }> };
    expect(view.versions.map((v) => v.version).sort()).toEqual(['1.0.0', '1.1.0']);
    // Sin aprobaciones no se activa
    expect((await t.admin.request('POST', '/admin/games/modules/pico-de-flecha/versions/1.1.0/activate')).statusCode).toBeGreaterThanOrEqual(400);
    // Un revisor no registra; Marca no registra trivia/ruleta/iframe (eso sigue siendo de TI)
    expect((await t.marca.request('POST', '/admin/games/modules', { manifest: defaultPartyManifest('headband') })).statusCode).toBe(403);
    const trivia = {
      ...defaultPartyManifest('headband'),
      delivery: { kind: 'iframe', entryUrl: 'https://juegos.ejemplo.co/x', allowedOrigin: 'https://juegos.ejemplo.co' },
    };
    expect((await t.admin.request('POST', '/admin/games/modules', { manifest: trivia })).statusCode).toBe(403);
  });
});

describe('contactos con autorización de novedades', () => {
  it('solo aparecen quienes la tienen vigente; retirarla los quita; se audita y exige rol', async () => {
    const admin = await person(app, db, ['ADMIN_MARCA'], 'Admin');
    const a = await person(app, db, [], 'Ana');
    const b = await person(app, db, [], 'Beto');
    await db.userPii.create({ data: { userId: a.user.id, email: 'ana@ejemplo.test' } });
    await db.userPii.create({ data: { userId: b.user.id, phone: '3001112233' } });
    const consent = (who: typeof a, granted: boolean) =>
      who.request('POST', '/consents', { purpose: 'MARKETING', granted, noticeVersion: '1.0', source: 'perfil' });
    await consent(a, true);
    await consent(b, true);
    await consent(b, false);
    const res = await admin.request('GET', '/admin/contacts/opt-ins');
    expect(res.statusCode).toBe(200);
    const body = res.json() as { total: number; rows: Array<{ alias: string; email: string | null }> };
    expect(body.total).toBe(1);
    expect(body.rows[0]).toMatchObject({ alias: 'Ana', email: 'ana@ejemplo.test' });
    expect(await db.auditEvent.count({ where: { action: 'contacts.listed' } })).toBe(1);
    expect((await a.request('GET', '/admin/contacts/opt-ins')).statusCode).toBe(403);
  });
});
