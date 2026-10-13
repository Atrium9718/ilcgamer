import { ApiErrorSchema, ContestAdminViewSchema, ContestScreenSchema, ContestViewSchema, type CreateContest, EventAdminViewSchema } from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EventsService } from '../src/events/events.service.ts';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { RetentionService } from '../src/platform/retention.service.ts';
import { RedisService } from '../src/redis/redis.service.ts';
import { person, seedBrands } from './fixtures.ts';
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

type Person = Awaited<ReturnType<typeof person>>;
type Res = { json: () => unknown; statusCode: number; rawPayload: Buffer };
const err = (r: Res) => ApiErrorSchema.parse(r.json()).error;
const HOUR = 3_600_000;

// ── JPEG de prueba (con EXIF y comentario que el servidor debe quitar) ──
const seg = (marker: number, body: Buffer) =>
  Buffer.concat([Buffer.from([0xff, marker]), Buffer.from([(body.length + 2) >> 8, (body.length + 2) & 0xff]), body]);
const jpeg = (tag = 'foto', size = 640) =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'binary')),
    seg(0xe1, Buffer.from('Exif\0\0GPS-LATITUDE-4.5N', 'binary')),
    seg(0xfe, Buffer.from(`secreto-${tag}`)),
    seg(0xc0, Buffer.from([8, size >> 8, size & 0xff, size >> 8, size & 0xff, 1, 1, 0x11, 0])),
    seg(0xda, Buffer.from([1, 1, 0, 0, 63, 0])),
    Buffer.from(tag),
    Buffer.from([0xff, 0xd9]),
  ]);

async function staff() {
  const a = await person(app, db, ['ADMIN_MARCA'], 'Marca A');
  const b = await person(app, db, ['ADMIN_MARCA'], 'Marca B');
  return { a, b };
}

const contestInput = (over: Partial<CreateContest> = {}): CreateContest => ({
  slug: 'disfraces',
  kind: 'DISFRACES',
  title: 'Concurso de disfraces',
  description: 'El mejor disfraz de la feria',
  prize: 'Palco para la feria',
  prizeConditions: 'Se entrega en persona con el código del ganador',
  uploadsCloseAt: new Date(Date.now() + HOUR).toISOString(),
  votingOpensAt: new Date(Date.now() + HOUR).toISOString(),
  votingClosesAt: new Date(Date.now() + 2 * HOUR).toISOString(),
  ...over,
});

/** Evento publicado con un concurso ABIERTO (creado por A, abierto por B). */
async function openContest(t: Awaited<ReturnType<typeof staff>>, over: Partial<CreateContest> = {}) {
  const ev = EventAdminViewSchema.parse(
    (
      await t.a.request('POST', '/admin/events', {
        slug: 'feria-2027',
        title: 'Feria 2027',
        city: 'Manizales',
        startsAt: new Date(Date.now() - HOUR).toISOString(),
        endsAt: new Date(Date.now() + 48 * HOUR).toISOString(),
      })
    ).json(),
  );
  await t.a.request('POST', `/admin/events/${ev.id}/publish`);
  const created = ContestAdminViewSchema.parse((await t.a.request('POST', `/admin/events/${ev.id}/contests`, contestInput(over))).json());
  const opened = await t.b.request('POST', `/admin/contests/${created.id}/open`);
  expect(opened.statusCode).toBe(200);
  return created;
}

/** Cambia las fechas del concurso para ubicarlo en una fase (la fase la calcula el servidor con estas fechas). */
const setPhase = (id: string, phase: 'INSCRIPCION' | 'VOTACION' | 'TERMINADO') => {
  const now = Date.now();
  const dates =
    phase === 'INSCRIPCION'
      ? { uploadsCloseAt: new Date(now + HOUR), votingOpensAt: new Date(now + HOUR), votingClosesAt: new Date(now + 2 * HOUR) }
      : phase === 'VOTACION'
        ? { uploadsCloseAt: new Date(now - 2 * HOUR), votingOpensAt: new Date(now - HOUR), votingClosesAt: new Date(now + HOUR) }
        : { uploadsCloseAt: new Date(now - 3 * HOUR), votingOpensAt: new Date(now - 2 * HOUR), votingClosesAt: new Date(now - HOUR) };
  return db.contest.update({ where: { id }, data: dates });
};

/** Inscribe a una persona, sube su foto y (si se pide) la aprueba. Devuelve su id de inscripción. */
async function enter(t: Awaited<ReturnType<typeof staff>>, contestId: string, who: Person, title: string, approve = true) {
  const e = await who.request('POST', `/contests/${contestId}/entries`, { title, caption: 'Hecho a mano', consentDisplay: true });
  expect(e.statusCode).toBe(200);
  const up = await who.request('PUT', `/contests/${contestId}/entries/me/photo`, jpeg(title), { 'content-type': 'image/jpeg' });
  expect(up.statusCode).toBe(200);
  const entry = await db.contestEntry.findFirstOrThrow({ where: { contestId, userId: who.user.id } });
  if (approve) expect((await t.a.request('POST', `/admin/contests/${contestId}/entries/${entry.id}/moderate`, { decision: 'APROBADA' })).statusCode).toBe(200);
  return entry.id;
}

describe('gobierno: eventos y concursos', () => {
  it('lo crea y publica Marca; quien crea el concurso no lo abre; una persona común no entra a la consola', async () => {
    const t = await staff();
    const player = await person(app, db);
    expect((await player.request('GET', '/admin/events')).statusCode).toBe(403);
    const ev = EventAdminViewSchema.parse(
      (
        await t.a.request('POST', '/admin/events', {
          slug: 'feria-2027',
          title: 'Feria 2027',
          startsAt: new Date(Date.now() - HOUR).toISOString(),
          endsAt: new Date(Date.now() + 24 * HOUR).toISOString(),
        })
      ).json(),
    );
    expect(ev.status).toBe('BORRADOR');
    expect(err((await t.a.request('POST', '/admin/events', { slug: 'feria-2027', title: 'Otra', startsAt: ev.startsAt, endsAt: ev.endsAt })) as Res).code).toBe(
      'CONFLICT',
    );
    const c = ContestAdminViewSchema.parse((await t.a.request('POST', `/admin/events/${ev.id}/contests`, contestInput())).json());
    expect(c.status).toBe('BORRADOR');
    expect(c.screenPath).toMatch(/^\/pantalla\/[A-Za-z0-9_-]{20,}$/);
    // Fechas incoherentes se rechazan
    const bad = await t.a.request(
      'POST',
      `/admin/events/${ev.id}/contests`,
      contestInput({ slug: 'otro', votingClosesAt: new Date(Date.now() - HOUR).toISOString() }),
    );
    expect(bad.statusCode).toBe(400);
    // Separación de funciones
    expect(err((await t.a.request('POST', `/admin/contests/${c.id}/open`)) as Res).code).toBe('FORBIDDEN');
    // Sin publicar el evento o abrir el concurso, las personas no lo ven
    expect(((await player.request('GET', `/contests/${c.id}`)) as Res).statusCode).toBe(404);
    expect((await t.b.request('POST', `/admin/contests/${c.id}/open`)).statusCode).toBe(200);
    expect(((await player.request('GET', `/contests/${c.id}`)) as Res).statusCode).toBe(404);
    await t.a.request('POST', `/admin/events/${ev.id}/publish`);
    const list = (await player.request('GET', '/events')).json() as Array<{ slug: string; contests: Array<{ phase: string }> }>;
    expect(list[0]?.slug).toBe('feria-2027');
    expect(list[0]?.contests[0]?.phase).toBe('INSCRIPCION');
    expect(ContestViewSchema.parse((await player.request('GET', `/contests/${c.id}`)).json()).phase).toBe('INSCRIPCION');
  });
});

describe('inscripción y fotos', () => {
  it('exige cuenta guardada, autorización expresa, JPEG válido y quita los metadatos', async () => {
    const t = await staff();
    const c = await openContest(t);
    const temp = await person(app, db, [], 'Temporal');
    await db.user.update({ where: { id: temp.user.id }, data: { status: 'TEMPORAL' } });
    expect(err((await temp.request('POST', `/contests/${c.id}/entries`, { title: 'Mi disfraz', consentDisplay: true })) as Res).code).toBe('ACCOUNT_REQUIRED');

    const p = await person(app, db, [], 'Camila');
    // sin autorización expresa de mostrar la foto
    expect((await p.request('POST', `/contests/${c.id}/entries`, { title: 'Mi disfraz', consentDisplay: false })).statusCode).toBe(400);
    // foto antes de tener inscripción
    expect((await p.request('PUT', `/contests/${c.id}/entries/me/photo`, jpeg(), { 'content-type': 'image/jpeg' })).statusCode).toBe(404);
    expect((await p.request('POST', `/contests/${c.id}/entries`, { title: 'Mi disfraz', consentDisplay: true })).statusCode).toBe(200);
    // no es JPEG / es muy pequeña / no llega como imagen / pesa demasiado
    expect((await p.request('PUT', `/contests/${c.id}/entries/me/photo`, Buffer.from('GIF89a-no-soy-jpeg'), { 'content-type': 'image/jpeg' })).statusCode).toBe(
      400,
    );
    expect((await p.request('PUT', `/contests/${c.id}/entries/me/photo`, jpeg('x', 100), { 'content-type': 'image/jpeg' })).statusCode).toBe(400);
    expect((await p.request('PUT', `/contests/${c.id}/entries/me/photo`, { a: 1 })).statusCode).toBe(400);
    // Una imagen válida pero de más de 2 MB se rechaza por tamaño (la API responde 400 VALIDATION_FAILED, como con cualquier cuerpo excesivo)
    const grande = Buffer.concat([jpeg('grande').subarray(0, -2), Buffer.alloc(2.5 * 1024 * 1024, 7), Buffer.from([0xff, 0xd9])]);
    expect((await p.request('PUT', `/contests/${c.id}/entries/me/photo`, grande, { 'content-type': 'image/jpeg' })).statusCode).toBe(400);
    expect(await db.entryPhoto.count()).toBe(0);
    expect((await p.request('PUT', `/contests/${c.id}/entries/me/photo`, jpeg(), { 'content-type': 'application/octet-stream' })).statusCode).toBe(400);
    expect(await db.entryPhoto.count()).toBe(0);

    const ok = await p.request('PUT', `/contests/${c.id}/entries/me/photo`, jpeg('camila'), { 'content-type': 'image/jpeg' });
    const view = ContestViewSchema.parse(ok.json());
    expect(view.myEntry?.status).toBe('PENDIENTE');
    // La foto guardada no trae EXIF/ubicación ni el comentario
    const stored = await db.entryPhoto.findFirstOrThrow();
    const text = Buffer.from(stored.data).toString('binary');
    expect(text).not.toContain('GPS-LATITUDE');
    expect(text).not.toContain('secreto');
    expect(Buffer.from(stored.data).subarray(0, 2).toString('hex')).toBe('ffd8');
    // La foto llega como image/jpeg y sin sniffing
    const img = (await p.request('GET', `/contests/${c.id}/entries/${view.myEntry?.id}/photo`)) as Res & { headers: Record<string, string> };
    expect(img.statusCode).toBe(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
    expect(img.headers['x-content-type-options']).toBe('nosniff');
  });

  it('nada se ve hasta que Marca lo aprueba; lo aprobado no muestra conteos; rechazar exige motivo', async () => {
    const t = await staff();
    const c = await openContest(t);
    const ana = await person(app, db, [], 'Ana');
    const beto = await person(app, db, [], 'Beto');
    const anaEntry = await enter(t, c.id, ana, 'Ana la pirata', false);
    // Beto no la ve (pendiente), ni su foto
    expect(ContestViewSchema.parse((await beto.request('GET', `/contests/${c.id}`)).json()).entries).toHaveLength(0);
    expect((await beto.request('GET', `/contests/${c.id}/entries/${anaEntry}/photo`)).statusCode).toBe(404);
    // Ana sí ve la suya, con su estado
    expect(ContestViewSchema.parse((await ana.request('GET', `/contests/${c.id}`)).json()).myEntry?.status).toBe('PENDIENTE');
    // Rechazo sin motivo
    expect((await t.a.request('POST', `/admin/contests/${c.id}/entries/${anaEntry}/moderate`, { decision: 'RECHAZADA' })).statusCode).toBe(400);
    expect((await t.a.request('POST', `/admin/contests/${c.id}/entries/${anaEntry}/moderate`, { decision: 'APROBADA' })).statusCode).toBe(200);
    const seen = ContestViewSchema.parse((await beto.request('GET', `/contests/${c.id}`)).json());
    expect(seen.entries).toHaveLength(1);
    expect(JSON.stringify(seen)).not.toMatch(/votes|votos/i);
    expect((await beto.request('GET', `/contests/${c.id}/entries/${anaEntry}/photo`)).statusCode).toBe(200);
    // Editar vuelve a moderación y la oculta de nuevo
    await ana.request('POST', `/contests/${c.id}/entries`, { title: 'Ana la pirata 2', consentDisplay: true });
    expect(ContestViewSchema.parse((await beto.request('GET', `/contests/${c.id}`)).json()).entries).toHaveLength(0);
    // Aprobar sin foto no se puede
    const sinFoto = await person(app, db, [], 'Sin foto');
    await sinFoto.request('POST', `/contests/${c.id}/entries`, { title: 'Sin foto aún', consentDisplay: true });
    const e = await db.contestEntry.findFirstOrThrow({ where: { userId: sinFoto.user.id } });
    expect(err((await t.a.request('POST', `/admin/contests/${c.id}/entries/${e.id}/moderate`, { decision: 'APROBADA' })) as Res).code).toBe('CONFLICT');
  });

  it('la inscripción se cierra con la fecha y se puede retirar', async () => {
    const t = await staff();
    const c = await openContest(t);
    const p = await person(app, db, [], 'Pablo');
    await enter(t, c.id, p, 'Pablo Picapiedra');
    expect((await p.request('DELETE', `/contests/${c.id}/entries/me`)).statusCode).toBe(204);
    expect(await db.contestEntry.count()).toBe(0);
    expect(await db.entryPhoto.count()).toBe(0);
    await setPhase(c.id, 'VOTACION');
    expect(err((await p.request('POST', `/contests/${c.id}/entries`, { title: 'Tarde', consentDisplay: true })) as Res).code).toBe('CONTEST_PHASE_CLOSED');
  });
});

describe('votación', () => {
  it('un voto por cuenta, solo en su fase, nunca por uno mismo ni por algo sin aprobar', async () => {
    const t = await staff();
    const c = await openContest(t);
    const ana = await person(app, db, [], 'Ana');
    const beto = await person(app, db, [], 'Beto');
    const cata = await person(app, db, [], 'Cata');
    const a = await enter(t, c.id, ana, 'Ana pirata');
    const b = await enter(t, c.id, beto, 'Beto robot');
    const pendiente = await enter(t, c.id, await person(app, db, [], 'Pen'), 'Pendiente', false);
    // Aún en inscripción: no se vota
    expect(err((await cata.request('POST', `/contests/${c.id}/votes`, { entryId: a })) as Res).code).toBe('CONTEST_PHASE_CLOSED');
    await setPhase(c.id, 'VOTACION');
    expect(err((await ana.request('POST', `/contests/${c.id}/votes`, { entryId: a })) as Res).code).toBe('FORBIDDEN'); // por sí misma
    expect((await cata.request('POST', `/contests/${c.id}/votes`, { entryId: pendiente })).statusCode).toBe(404); // sin aprobar
    const voted = ContestViewSchema.parse((await cata.request('POST', `/contests/${c.id}/votes`, { entryId: a })).json());
    expect(voted.votedEntryId).toBe(a);
    // Repetir el mismo voto es idempotente; votar por otra inscripción no
    expect((await cata.request('POST', `/contests/${c.id}/votes`, { entryId: a })).statusCode).toBe(200);
    expect(err((await cata.request('POST', `/contests/${c.id}/votes`, { entryId: b })) as Res).code).toBe('CONFLICT');
    expect(await db.contestVote.count({ where: { userId: cata.user.id } })).toBe(1);
    // Cuenta temporal no vota
    const temp = await person(app, db, [], 'Temp');
    await db.user.update({ where: { id: temp.user.id }, data: { status: 'TEMPORAL' } });
    expect(err((await temp.request('POST', `/contests/${c.id}/votes`, { entryId: a })) as Res).code).toBe('ACCOUNT_REQUIRED');
    // Sin sesión no se vota
    expect((await (await import('./helpers.ts')).browser(app).request('POST', `/contests/${c.id}/votes`, { entryId: a })).statusCode).toBe(401);
  });

  it('cinco votos simultáneos de la misma cuenta por inscripciones distintas dejan uno solo', async () => {
    const t = await staff();
    const c = await openContest(t);
    const ids: string[] = [];
    for (const n of ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco']) ids.push(await enter(t, c.id, await person(app, db, [], n), `Disfraz ${n}`));
    await setPhase(c.id, 'VOTACION');
    const voter = await person(app, db, [], 'Votante');
    const res = await Promise.all(ids.map((entryId) => voter.request('POST', `/contests/${c.id}/votes`, { entryId })));
    expect(res.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(await db.contestVote.count({ where: { userId: voter.user.id } })).toBe(1);
  });

  it('la base también impide votar por sí mismo, por algo sin aprobar o por otro concurso, y editar un voto', async () => {
    const t = await staff();
    const c = await openContest(t);
    const ana = await person(app, db, [], 'Ana');
    const a = await enter(t, c.id, ana, 'Ana pirata');
    const pen = await enter(t, c.id, await person(app, db, [], 'Pen'), 'Pendiente', false);
    const otro = await person(app, db, [], 'Otro');
    await expect(db.contestVote.create({ data: { contestId: c.id, entryId: a, userId: ana.user.id } })).rejects.toThrow(/propia inscripción/);
    await expect(db.contestVote.create({ data: { contestId: c.id, entryId: pen, userId: otro.user.id } })).rejects.toThrow(/aprobadas/);
    const ok = await db.contestVote.create({ data: { contestId: c.id, entryId: a, userId: otro.user.id } });
    await expect(db.contestVote.update({ where: { id: ok.id }, data: { entryId: pen } })).rejects.toThrow(/no se editan/);
  });

  it('rechazar una inscripción con votos los libera para que esas personas elijan de nuevo', async () => {
    const t = await staff();
    const c = await openContest(t);
    const a = await enter(t, c.id, await person(app, db, [], 'Ana'), 'Ana pirata');
    const b = await enter(t, c.id, await person(app, db, [], 'Beto'), 'Beto robot');
    await setPhase(c.id, 'VOTACION');
    const v = await person(app, db, [], 'Votante');
    await v.request('POST', `/contests/${c.id}/votes`, { entryId: a });
    expect(
      (await t.a.request('POST', `/admin/contests/${c.id}/entries/${a}/moderate`, { decision: 'RECHAZADA', reason: 'Se ven copas en la foto' })).statusCode,
    ).toBe(200);
    expect(await db.contestVote.count()).toBe(0);
    expect((await v.request('POST', `/contests/${c.id}/votes`, { entryId: b })).statusCode).toBe(200);
  });
});

describe('pantalla pública (sin sesión)', () => {
  it('muestra ranking en vivo solo con alias, título, foto aprobada y conteos; se puede rotar el enlace', async () => {
    const t = await staff();
    const c = await openContest(t);
    const ana = await person(app, db, [], 'Ana');
    const beto = await person(app, db, [], 'Beto');
    const a = await enter(t, c.id, ana, 'Ana pirata');
    const b = await enter(t, c.id, beto, 'Beto robot');
    const pen = await enter(t, c.id, await person(app, db, [], 'Pen'), 'Pendiente', false);
    await setPhase(c.id, 'VOTACION');
    for (const n of ['V1', 'V2', 'V3']) await (await person(app, db, [], n)).request('POST', `/contests/${c.id}/votes`, { entryId: b });
    await (await person(app, db, [], 'V4')).request('POST', `/contests/${c.id}/votes`, { entryId: a });
    const token = c.screenPath.split('/').pop() as string;
    const anon = (await import('./helpers.ts')).browser(app, null);
    const res = await anon.request('GET', `/screens/${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const screen = ContestScreenSchema.parse(res.json());
    expect(screen.totalVotes).toBe(4);
    expect(screen.entries.map((e) => [e.rank, e.title, e.votes])).toEqual([
      [1, 'Beto robot', 3],
      [2, 'Ana pirata', 1],
    ]);
    expect(screen.votePath).toBe(`/concursos/${c.id}`);
    expect(res.body).not.toMatch(/@|email|destination|userId/);
    expect(screen.entries.map((e) => e.id)).not.toContain(pen);
    // Foto aprobada sí; pendiente no; token inválido no
    const photo = await anon.request('GET', screen.entries[0]?.photoUrl?.replace('/api/v1', '').split('?')[0] as string);
    expect(photo.statusCode).toBe(200);
    expect(photo.headers['content-type']).toBe('image/jpeg');
    expect((await anon.request('GET', `/screens/${token}/photos/${pen}`)).statusCode).toBe(404);
    expect((await anon.request('GET', '/screens/token-que-no-existe-0000000000')).statusCode).toBe(404);
    expect((await anon.request('GET', '/screens/x')).statusCode).toBe(404);
    // Rotar invalida el enlace anterior
    const rotated = ContestAdminViewSchema.parse((await t.a.request('POST', `/admin/contests/${c.id}/screen/rotate`)).json());
    expect((await anon.request('GET', `/screens/${token}`)).statusCode).toBe(404);
    expect((await anon.request('GET', rotated.screenPath.replace('/pantalla/', '/screens/'))).statusCode).toBe(200);
  });

  it('un concurso sin abrir o de un evento sin publicar no se proyecta', async () => {
    const t = await staff();
    const ev = EventAdminViewSchema.parse(
      (
        await t.a.request('POST', '/admin/events', {
          slug: 'feria-x',
          title: 'Feria X',
          startsAt: new Date(Date.now() - HOUR).toISOString(),
          endsAt: new Date(Date.now() + 24 * HOUR).toISOString(),
        })
      ).json(),
    );
    const c = ContestAdminViewSchema.parse((await t.a.request('POST', `/admin/events/${ev.id}/contests`, contestInput())).json());
    const anon = (await import('./helpers.ts')).browser(app, null);
    expect((await anon.request('GET', c.screenPath.replace('/pantalla/', '/screens/'))).statusCode).toBe(404);
  });
});

describe('cierre, ganador y entrega del premio', () => {
  it('gana quien tiene más votos; el empate lo decide quien se inscribió primero; el ganador recibe su código', async () => {
    const t = await staff();
    const c = await openContest(t);
    const ana = await person(app, db, [], 'Ana');
    const beto = await person(app, db, [], 'Beto');
    const a = await enter(t, c.id, ana, 'Ana pirata');
    const b = await enter(t, c.id, beto, 'Beto robot');
    await setPhase(c.id, 'VOTACION');
    await (await person(app, db, [], 'V1')).request('POST', `/contests/${c.id}/votes`, { entryId: b });
    await (await person(app, db, [], 'V2')).request('POST', `/contests/${c.id}/votes`, { entryId: a });
    // Aún no termina la votación
    expect(err((await t.a.request('POST', `/admin/contests/${c.id}/close`)) as Res).code).toBe('CONFLICT');
    await setPhase(c.id, 'TERMINADO');
    const closed = ContestAdminViewSchema.parse((await t.a.request('POST', `/admin/contests/${c.id}/close`)).json());
    expect(closed.status).toBe('CERRADO');
    expect(closed.winner?.entryId).toBe(a); // empate 1-1: Ana se inscribió primero
    // Idempotente
    expect(ContestAdminViewSchema.parse((await t.a.request('POST', `/admin/contests/${c.id}/close`)).json()).winner?.entryId).toBe(a);
    const audit = await db.auditEvent.findFirstOrThrow({ where: { action: 'contest.closed' } });
    expect(JSON.stringify(audit.metadata)).toContain('"tieBrokenByRegistration":true');
    // Solo la ganadora ve su código
    const winnerView = ContestViewSchema.parse((await ana.request('GET', `/contests/${c.id}`)).json());
    expect(winnerView.prizeCode).toMatch(/^[0-9A-Z]{8}$/);
    expect(winnerView.winner?.entryId).toBe(a);
    expect(ContestViewSchema.parse((await beto.request('GET', `/contests/${c.id}`)).json()).prizeCode).toBeNull();
    // Entrega con el código, una sola vez
    expect(err((await t.b.request('POST', `/admin/contests/${c.id}/prize/deliver`, { code: 'ZZZZZZZZ' })) as Res).code).toBe('VALIDATION_FAILED');
    const delivered = ContestAdminViewSchema.parse(
      (await t.b.request('POST', `/admin/contests/${c.id}/prize/deliver`, { code: winnerView.prizeCode?.toLowerCase() })).json(),
    );
    expect(delivered.winner?.deliveredAt).not.toBeNull();
    expect(err((await t.b.request('POST', `/admin/contests/${c.id}/prize/deliver`, { code: winnerView.prizeCode })) as Res).code).toBe('CONFLICT');
    // No quedan Puntos ILC ni XP por concursar (economías separadas)
    expect(await db.ledgerEntry.count()).toBe(0);
    expect(await db.xpEntry.count()).toBe(0);
  });

  it('sin votos no hay ganador; el programador cierra solo los concursos vencidos', async () => {
    const t = await staff();
    const c = await openContest(t);
    await enter(t, c.id, await person(app, db, [], 'Ana'), 'Ana pirata');
    await setPhase(c.id, 'TERMINADO');
    expect(await app.get(EventsService).tick()).toBe(1);
    const closed = ContestAdminViewSchema.parse((await t.a.request('GET', `/admin/contests/${c.id}`)).json());
    expect(closed.status).toBe('CERRADO');
    expect(closed.winner).toBeNull();
    expect(await app.get(EventsService).tick()).toBe(0);
    // Ya cerrado: la inscripción y el voto no se mueven
    const p = await person(app, db, [], 'Tarde');
    expect(err((await p.request('POST', `/contests/${c.id}/entries`, { title: 'Muy tarde', consentDisplay: true })) as Res).code).toBe('CONTEST_PHASE_CLOSED');
  });
});

describe('privacidad: borrado y retención', () => {
  it('eliminar la cuenta borra la inscripción, la foto y los votos de esa persona', async () => {
    const t = await staff();
    const c = await openContest(t);
    const ana = await person(app, db, [], 'Ana');
    const beto = await person(app, db, [], 'Beto');
    const a = await enter(t, c.id, ana, 'Ana pirata');
    await enter(t, c.id, beto, 'Beto robot');
    await setPhase(c.id, 'VOTACION');
    await beto.request('POST', `/contests/${c.id}/votes`, { entryId: a });
    expect((await beto.request('DELETE', '/me')).statusCode).toBe(204);
    expect(await db.contestEntry.count({ where: { userId: beto.user.id } })).toBe(0);
    expect(await db.contestVote.count({ where: { userId: beto.user.id } })).toBe(0);
    expect(await db.entryPhoto.count()).toBe(1); // solo queda la de Ana
  });

  it('la depuración elimina las fotos de concursos cerrados hace más de 30 días', async () => {
    const t = await staff();
    const c = await openContest(t);
    await enter(t, c.id, await person(app, db, [], 'Ana'), 'Ana pirata');
    await setPhase(c.id, 'TERMINADO');
    await t.a.request('POST', `/admin/contests/${c.id}/close`);
    const retention = app.get(RetentionService);
    expect((await retention.purge()).contestPhotos).toBe(0);
    expect((await retention.purge(new Date(Date.now() + 31 * 86_400_000))).contestPhotos).toBe(1);
    expect(await db.contestEntry.count()).toBe(1); // el título y el resultado se conservan
  });
});
