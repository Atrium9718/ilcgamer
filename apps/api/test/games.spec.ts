import { ApiErrorSchema, GameCatalogSchema, MissionResultSchema, MissionStartSchema, ModuleViewSchema, ProgressSchema } from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { RedisService } from '../src/redis/redis.service.ts';
import { draft, person, publishedCampaign, seedBrands } from './fixtures.ts';
import { activateModule, chaptersManifest, iframeManifest, providerSign, QUESTIONS, team, triviaManifest, wheelManifest } from './game-fixtures.ts';
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
  await db.badge.create({ data: { slug: 'explorador-de-prueba', name: 'Explorador de prueba', icon: 'explore' } });
});

type Res = { json: () => unknown; statusCode: number; body: string };
const err = (r: Res) => ApiErrorSchema.parse(r.json()).error;
const result = (r: Res) => MissionResultSchema.parse(r.json());
const start = (r: Res) => MissionStartSchema.parse(r.json());
let n = 0;
const idem = () => `k${Date.now().toString(36)}${(n++).toString(36)}`.padEnd(20, 'x');
const post = (who: Awaited<ReturnType<typeof person>>, moduleId: string, extra: Record<string, unknown> = {}) =>
  who.request('POST', '/games/start', { moduleId, ...extra }, { 'idempotency-key': idem() });
const setDefaults = (t: Awaited<ReturnType<typeof team>>, modules: string[]) => t.admin.request('PUT', '/admin/games/defaults', { modules });

describe('manifiesto (Guía Técnica §5.4)', () => {
  it('rechaza lo que rompe las reglas de las economías y de la integración', async () => {
    const t = await team(app, db);
    const reg = (manifest: unknown) => t.ti.request('POST', '/admin/games/modules', { manifest });
    expect(err(await reg(triviaManifest({ scoring: { parcheScoreMax: 40, xpMax: 50, attemptsPerDay: 3, maxSeconds: 300 } }))).fields).toHaveProperty([
      'scoring.xpMax',
    ]);
    expect(err(await reg(triviaManifest({ scoring: { parcheScoreMax: 10, xpMax: 0, attemptsPerDay: 3, maxSeconds: 300 } }))).fields).toHaveProperty([
      'scoring.parcheScoreMax',
    ]);
    expect(err(await reg(chaptersManifest({ route: 'A' }))).fields).toBeDefined();
    expect(
      err(await reg(iframeManifest({ delivery: { kind: 'iframe', entryUrl: 'https://otro.co/x', allowedOrigin: 'https://juegos.proveedor-prueba.co' } })))
        .fields,
    ).toHaveProperty(['delivery.entryUrl']);
    expect(
      err(
        await reg(
          iframeManifest({
            delivery: { kind: 'iframe', entryUrl: 'http://juegos.proveedor-prueba.co/x', allowedOrigin: 'https://juegos.proveedor-prueba.co' },
          }),
        ),
      ).fields,
    ).toBeDefined();
    // Un juego no puede declarar Puntos ILC: el esquema es cerrado.
    expect(err(await reg(triviaManifest({ scoring: { parcheScoreMax: 40, xpMax: 0, pointsIlc: 500, attemptsPerDay: 3, maxSeconds: 300 } }))).code).toBe(
      'VALIDATION_FAILED',
    );
    // La insignia debe existir.
    expect(
      err(
        await reg(
          chaptersManifest({
            badge: 'no-existe',
            delivery: { ...chaptersManifest().delivery, config: { ...chaptersManifest().delivery.config, finalBadge: 'no-existe' } },
          }),
        ),
      ).fields,
    ).toHaveProperty(['badge']);
  });
});

describe('ciclo de vida del módulo (probar, aprobar, activar, desactivar, revertir)', () => {
  it('exige las aprobaciones sobre el manifiesto exacto, con separación de funciones', async () => {
    const t = await team(app, db);
    const path = (v = '1.0.0') => `/admin/games/modules/trivia-prueba/versions/${v}`;
    expect((await t.admin.request('POST', '/admin/games/modules', { manifest: triviaManifest() })).statusCode).toBe(403);
    expect((await t.ti.request('POST', '/admin/games/modules', { manifest: triviaManifest() })).statusCode).toBe(201);
    expect(err(await t.ti.request('POST', '/admin/games/modules', { manifest: triviaManifest() })).code).toBe('CONFLICT');
    expect(err(await t.admin.request('POST', `${path()}/activate`)).message).toMatch(/aprobada/);

    await t.admin.request('POST', `${path()}/test`);
    expect(err(await t.ti.request('POST', `${path()}/approvals`, { kind: 'MARCA', decision: 'APROBADO' })).message).toMatch(/Quien registra/);
    expect(err(await t.juridica.request('POST', `${path()}/approvals`, { kind: 'MARCA', decision: 'APROBADO' })).code).toBe('FORBIDDEN');
    await t.marca.request('POST', `${path()}/approvals`, { kind: 'MARCA', decision: 'APROBADO' });
    expect(err(await t.admin.request('POST', `${path()}/activate`)).message).toMatch(/aprobada/);
    const done = ModuleViewSchema.parse((await t.juridica.request('POST', `${path()}/approvals`, { kind: 'JURIDICA', decision: 'APROBADO' })).json());
    expect(done.versions[0]).toMatchObject({ status: 'APROBADO' });
    expect(done.versions[0]?.approvals.map((a) => a.status)).toEqual(['approved', 'approved', 'not_required']);

    const active = ModuleViewSchema.parse((await t.admin.request('POST', `${path()}/activate`)).json());
    expect(active.activeVersion).toBe('1.0.0');
    expect(await db.auditEvent.count({ where: { action: { in: ['module.registered', 'module.testing', 'module.approved', 'module.activated'] } } })).toBe(5);
  });

  it('un rechazo devuelve a borrador; Privacidad se exige si recoge datos o pide permisos', async () => {
    const t = await team(app, db);
    const m = triviaManifest({ permissions: ['camera'] });
    const path = '/admin/games/modules/trivia-prueba/versions/1.0.0';
    await t.ti.request('POST', '/admin/games/modules', { manifest: m });
    await t.admin.request('POST', `${path}/test`);
    await t.marca.request('POST', `${path}/approvals`, { kind: 'MARCA', decision: 'APROBADO' });
    await t.juridica.request('POST', `${path}/approvals`, { kind: 'JURIDICA', decision: 'APROBADO' });
    expect(err(await t.admin.request('POST', `${path}/activate`)).code).toBe('CONFLICT');
    const rejected = ModuleViewSchema.parse(
      (await t.privacidad.request('POST', `${path}/approvals`, { kind: 'PRIVACIDAD', decision: 'RECHAZADO', note: 'Pide cámara sin justificación' })).json(),
    );
    expect(rejected.versions[0]?.status).toBe('BORRADOR');
  });

  it('activar otra versión desactiva la anterior; se puede volver a una anterior aprobada y desactivar', async () => {
    const t = await team(app, db);
    await activateModule(t, triviaManifest());
    await activateModule(t, triviaManifest({ version: '1.1.0' }));
    let mod = (await t.admin.request('GET', '/admin/games/modules')).json() as Array<{
      activeVersion: string;
      versions: Array<{ version: string; status: string }>;
    }>;
    expect(mod[0]?.activeVersion).toBe('1.1.0');
    expect(mod[0]?.versions.find((v) => v.version === '1.0.0')?.status).toBe('DESACTIVADO');
    // Volver a 1.0.0 (sus aprobaciones siguen válidas para su manifiesto).
    expect((await t.admin.request('POST', '/admin/games/modules/trivia-prueba/versions/1.0.0/activate')).statusCode).toBe(200);
    expect(err(await t.admin.request('POST', '/admin/games/modules/trivia-prueba/deactivate', { reason: 'x' })).code).toBe('VALIDATION_FAILED');
    expect((await t.admin.request('POST', '/admin/games/modules/trivia-prueba/deactivate', { reason: 'Contenido en revisión' })).statusCode).toBe(200);
    mod = (await t.admin.request('GET', '/admin/games/modules')).json() as typeof mod;
    expect(mod[0]?.activeVersion).toBeNull();
    expect(await db.moduleVersion.count({ where: { status: 'ACTIVO' } })).toBe(0);
  });
});

describe('contexto y regla de Ruta B (Instrucciones §13.2)', () => {
  it('máximo 2 de Ruta B en la plataforma y en cada campaña', async () => {
    const t = await team(app, db);
    for (const id of ['explora-uno', 'explora-dos', 'explora-tres']) {
      const m = chaptersManifest({ moduleId: id });
      await activateModule(t, m);
    }
    expect(err(await setDefaults(t, ['explora-uno', 'explora-dos', 'explora-tres'])).fields).toHaveProperty(['modules']);
    expect((await setDefaults(t, ['explora-uno', 'explora-dos'])).statusCode).toBe(200);
    expect(err(await setDefaults(t, ['no-existe'])).fields).toHaveProperty(['modules']);

    const editor = await person(app, db, ['EDITOR_CONTENIDO']);
    const tooMany = await editor.request('POST', '/admin/campaigns', {
      slug: 'muchos',
      route: 'B_EXPERIENCIAL',
      draft: draft({ modules: ['explora-uno', 'explora-dos', 'explora-tres'] }),
    });
    expect(err(tooMany).fields).toHaveProperty(['draft.modules']);
  });

  it('el catálogo respeta el contexto: plataforma, campaña y Parche; y un juego inactivo bloquea publicar', async () => {
    const t = await team(app, db);
    await activateModule(t, triviaManifest());
    await activateModule(t, wheelManifest());
    await setDefaults(t, ['trivia-prueba']);
    const player = await person(app, db);
    const free = GameCatalogSchema.parse((await player.request('GET', '/games')).json());
    expect(free.games.map((g) => g.moduleId)).toEqual(['trivia-prueba']);

    await publishedCampaign(app, db, 'feria', draft({ modules: ['ruleta-prueba'] }));
    const inCampaign = GameCatalogSchema.parse((await player.request('GET', '/games?campaignSlug=feria')).json());
    expect(inCampaign).toMatchObject({ campaign: { slug: 'feria' }, games: [{ moduleId: 'ruleta-prueba', kind: 'engine' }] });
    expect(err(await player.request('GET', '/games?campaignSlug=no-existe')).code).toBe('CAMPAIGN_NOT_ACTIVE');

    // Publicar exige que sus juegos estén activos.
    const editor = await person(app, db, ['EDITOR_CONTENIDO']);
    await editor.request('POST', '/admin/campaigns', { slug: 'otra', route: 'A_COMERCIAL', draft: draft({ modules: ['trivia-prueba'] }) });
    await t.admin.request('POST', '/admin/games/modules/trivia-prueba/deactivate', { reason: 'Pausa de prueba' });
    const view = (await editor.request('GET', '/admin/campaigns/otra')).json() as { publish: { missing: string[] } };
    expect(view.publish.missing).toContain('el juego trivia-prueba no está activo');
  });
});

describe('trivia: el servidor decide', () => {
  async function ready() {
    const t = await team(app, db);
    await activateModule(t, triviaManifest());
    await setDefaults(t, ['trivia-prueba']);
    return t;
  }

  it('no envía las claves, puntúa en servidor y es idempotente; solo hay una partida abierta', async () => {
    await ready();
    const player = await person(app, db);
    const res = await post(player, 'trivia-prueba');
    expect(res.body).not.toMatch(/correctIndex|Dato de prueba/);
    const s = start(res);
    expect(s.play.kind).toBe('trivia');
    if (s.play.kind !== 'trivia') return;
    expect(s.play.questions).toHaveLength(4);

    // Otro inicio retoma la misma partida: no se re-sortean preguntas.
    expect(start(await post(player, 'trivia-prueba')).missionId).toBe(s.missionId);

    const key = new Map(QUESTIONS.map((q) => [q.id, q.correctIndex]));
    const answers = s.play.questions.map((q, i) => ({ questionId: q.id, choice: i < 3 ? (key.get(q.id) as number) : ((key.get(q.id) as number) + 1) % 3 }));
    const done = result(await player.request('POST', `/missions/${s.missionId}/submit`, { answers }));
    expect(done).toMatchObject({ status: 'VERIFICADA', summary: '3 de 4 respuestas correctas', xp: 0, parcheScore: 0, pointsEarned: 0 });
    // Repetir la entrega devuelve lo mismo, sin duplicar.
    expect(result(await player.request('POST', `/missions/${s.missionId}/submit`, { answers: [] }))).toEqual(done);
    expect(await db.xpEntry.count()).toBe(0);
    expect(await db.ledgerEntry.count()).toBe(0);
  });

  it('rechaza respuestas ajenas o repetidas, y entregas ajenas', async () => {
    await ready();
    const player = await person(app, db);
    const s = start(await post(player, 'trivia-prueba'));
    expect(err(await player.request('POST', `/missions/${s.missionId}/submit`, { answers: [{ questionId: 'otra', choice: 0 }] })).code).toBe(
      'VALIDATION_FAILED',
    );
    if (s.play.kind !== 'trivia') return;
    const id = s.play.questions[0]?.id as string;
    expect(
      err(
        await player.request('POST', `/missions/${s.missionId}/submit`, {
          answers: [
            { questionId: id, choice: 0 },
            { questionId: id, choice: 1 },
          ],
        }),
      ).code,
    ).toBe('VALIDATION_FAILED');
    const other = await person(app, db);
    expect(err(await other.request('POST', `/missions/${s.missionId}/submit`, { answers: [] })).code).toBe('NOT_FOUND');
  });

  it('el tiempo de la partida lo controla el servidor y hay un tope diario de intentos', async () => {
    await ready();
    const player = await person(app, db);
    const s = start(await post(player, 'trivia-prueba'));
    await db.missionProgress.update({
      where: { id: s.missionId },
      data: {
        state: {
          ...((await db.missionProgress.findUniqueOrThrow({ where: { id: s.missionId } })).state as object),
          deadline: new Date(Date.now() - 60_000).toISOString(),
        },
      },
    });
    expect(err(await player.request('POST', `/missions/${s.missionId}/submit`, { answers: [] })).message).toMatch(/tiempo/);
    // Intentos 2 y 3; el 4.º del día se rechaza (attemptsPerDay = 3).
    for (let i = 0; i < 2; i++) {
      const r = start(await post(player, 'trivia-prueba'));
      await player.request('POST', `/missions/${r.missionId}/submit`, { answers: [] });
    }
    expect(err(await post(player, 'trivia-prueba')).code).toBe('GAME_LIMIT_REACHED');
  });

  it('suma al marcador del Parche solo si la persona sigue dentro, con tope; fuera del Parche no suma', async () => {
    await ready();
    const host = await person(app, db, [], 'Ana');
    const parche = (await host.request('POST', '/sessions', { name: 'Mesa', alias: 'Ana' })).json() as { id: string };
    const alone = await person(app, db);
    expect(err(await post(alone, 'trivia-prueba', { sessionId: parche.id })).code).toBe('SESSION_NOT_FOUND');

    const s = start(await post(host, 'trivia-prueba', { sessionId: parche.id }));
    if (s.play.kind !== 'trivia') return;
    const key = new Map(QUESTIONS.map((q) => [q.id, q.correctIndex]));
    const all = s.play.questions.map((q) => ({ questionId: q.id, choice: key.get(q.id) as number }));
    const done = result(await host.request('POST', `/missions/${s.missionId}/submit`, { answers: all }));
    expect(done.parcheScore).toBe(40);
    expect((await db.session.findFirstOrThrow()).score).toBe(40);

    // Si sale del Parche antes de entregar, el resultado cuenta pero no suma al grupo.
    const s2 = start(await post(host, 'trivia-prueba', { sessionId: parche.id }));
    await host.request('POST', `/sessions/${parche.id}/leave`);
    if (s2.play.kind !== 'trivia') return;
    const done2 = result(
      await host.request('POST', `/missions/${s2.missionId}/submit`, {
        answers: s2.play.questions.map((q) => ({ questionId: q.id, choice: key.get(q.id) as number })),
      }),
    );
    expect(done2.parcheScore).toBe(0);
    expect((await db.session.findFirstOrThrow()).score).toBe(40);
  });
});

describe('ruleta', () => {
  it('el giro lo decide el servidor, una vez por partida, con tope por manifiesto', async () => {
    const t = await team(app, db);
    await activateModule(t, wheelManifest());
    await setDefaults(t, ['ruleta-prueba']);
    const host = await person(app, db, [], 'Ana');
    const parche = (await host.request('POST', '/sessions', { name: 'Mesa', alias: 'Ana' })).json() as { id: string };
    const s = start(await post(host, 'ruleta-prueba', { sessionId: parche.id }));
    expect(s.play).toMatchObject({ kind: 'wheel', segments: [{ label: '+10' }, { label: '+20' }, { label: 'Reto cultural' }, { label: '+5' }] });
    const spin = result(await host.request('POST', `/missions/${s.missionId}/submit`, {}));
    expect(spin.outcome?.label).toBeTruthy();
    expect(spin.parcheScore).toBeLessThanOrEqual(20);
    expect(result(await host.request('POST', `/missions/${s.missionId}/submit`, {})).outcome).toEqual(spin.outcome);
  });
});

describe('explorador (capítulos, Ruta B)', () => {
  async function ready() {
    const t = await team(app, db);
    await activateModule(t, chaptersManifest());
    await setDefaults(t, ['explorador-prueba']);
    return t;
  }
  const answer = (who: Awaited<ReturnType<typeof person>>, id: string, choice: number) => who.request('POST', `/missions/${id}/submit`, { choice });

  it('avanza en orden, permite reintentar sin penalizar, da XP una vez y la insignia al final', async () => {
    await ready();
    const player = await person(app, db);
    const s1 = start(await post(player, 'explorador-prueba'));
    expect(s1.play).toMatchObject({ kind: 'chapters', index: 0, total: 2, chapter: { id: 'c1', xp: 40 } });
    expect(JSON.stringify(s1)).not.toContain('correctIndex');

    const wrong = result(await answer(player, s1.missionId, 0));
    expect(wrong).toMatchObject({ status: 'INICIADA', correct: false, xp: 0 });
    const ok = result(await answer(player, s1.missionId, 1));
    expect(ok).toMatchObject({ status: 'VERIFICADA', correct: true, xp: 40, hasNext: true, completedModule: false, badge: null, pointsEarned: 0 });
    expect(result(await answer(player, s1.missionId, 1))).toEqual(ok);

    const s2 = start(await post(player, 'explorador-prueba'));
    expect(s2.play).toMatchObject({ kind: 'chapters', index: 1, completedIds: ['c1'] });
    const last = result(await answer(player, s2.missionId, 0));
    expect(last).toMatchObject({ xp: 60, completedModule: true, hasNext: false, badge: { slug: 'explorador-de-prueba' } });

    const progress = ProgressSchema.parse((await player.request('GET', '/profile/progress')).json());
    expect(progress.xp).toBe(100);
    expect(progress.badges.find((b) => b.slug === 'explorador-de-prueba')?.earned).toBe(true);
    expect(err(await post(player, 'explorador-prueba')).code).toBe('GAME_NOT_AVAILABLE');
    const catalog = GameCatalogSchema.parse((await player.request('GET', '/games')).json());
    expect(catalog.games[0]?.progress).toEqual({ current: 2, total: 2 });
    // La economía de Puntos ILC no se toca.
    expect(await db.ledgerEntry.count()).toBe(0);
  });

  it('dos entregas correctas simultáneas dan el XP una sola vez', async () => {
    await ready();
    const player = await person(app, db);
    const s = start(await post(player, 'explorador-prueba'));
    const res = await Promise.all([answer(player, s.missionId, 1), answer(player, s.missionId, 1), answer(player, s.missionId, 1)]);
    expect(res.every((r) => r.statusCode === 200)).toBe(true);
    expect(await db.xpEntry.count()).toBe(1);
    expect(await db.missionProgress.count({ where: { status: 'VERIFICADA' } })).toBe(1);
  });

  it('dos partidas en paralelo del mismo capítulo no duplican el XP (índice único)', async () => {
    await ready();
    const player = await person(app, db);
    const s = start(await post(player, 'explorador-prueba'));
    // Se fuerza una segunda misión abierta del mismo capítulo, como si dos dispositivos la hubieran abierto.
    const twin = await db.missionProgress.findUniqueOrThrow({ where: { id: s.missionId } });
    const second = await db.missionProgress.create({
      data: {
        userId: twin.userId,
        moduleVersionId: twin.moduleVersionId,
        moduleId: twin.moduleId,
        chapterId: twin.chapterId,
        status: 'INICIADA',
        idempotencyKey: 'gemela'.padEnd(64, '0'),
        state: twin.state as object,
      },
    });
    const res = await Promise.all([answer(player, s.missionId, 1), answer(player, second.id, 1)]);
    expect(res.every((r) => r.statusCode === 200)).toBe(true);
    expect(await db.xpEntry.count()).toBe(1);
  });

  it('nadie fuera del contexto o sin edad verificada juega', async () => {
    await ready();
    const visitor = (await import('./helpers.ts')).browser(app);
    expect((await visitor.request('POST', '/games/start', { moduleId: 'explorador-prueba' }, { 'idempotency-key': idem() })).statusCode).toBe(401);
    const player = await person(app, db);
    expect(err(await player.request('POST', '/games/start', { moduleId: 'explorador-prueba' })).code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(err(await post(player, 'no-existe')).code).toBe('GAME_NOT_AVAILABLE');
  });
});

describe('pruebas del equipo editorial', () => {
  it('quien edita prueba un módulo en prueba sin que otorgue nada; un jugador no puede', async () => {
    const t = await team(app, db);
    await t.ti.request('POST', '/admin/games/modules', { manifest: chaptersManifest() });
    await t.admin.request('POST', '/admin/games/modules/explorador-prueba/versions/1.0.0/test');
    const player = await person(app, db);
    expect(err(await post(player, 'explorador-prueba', { preview: true })).code).toBe('FORBIDDEN');
    const s = start(await post(t.admin, 'explorador-prueba', { preview: true }));
    expect(s.preview).toBe(true);
    const r = result(await t.admin.request('POST', `/missions/${s.missionId}/submit`, { choice: 1 }));
    expect(r).toMatchObject({ status: 'VERIFICADA', preview: true, xp: 0 });
    expect(await db.xpEntry.count()).toBe(0);
    expect((await player.request('GET', '/games')).json()).toMatchObject({ games: [] });
  });
});

describe('módulo de proveedor (iframe): el proveedor confirma, no el celular', () => {
  const SECRET = 'prueba-secreto-de-al-menos-32-caracteres-xx';
  async function ready() {
    const t = await team(app, db);
    await activateModule(t, iframeManifest());
    await setDefaults(t, ['proveedor-prueba']);
    return t;
  }
  const signed = (body: object, epoch = 1) => ({ 'x-provider-signature': providerSign(SECRET, 'proveedor-prueba', epoch, body) });
  const callback = (body: object, headers: Record<string, string>) =>
    app.getHttpAdapter().getInstance().inject({ method: 'POST', url: '/api/v1/games/provider-callback', payload: body, headers });

  it('"terminé" del navegador solo deja la misión pendiente; la firma del proveedor la verifica con topes', async () => {
    const t = await ready();
    const host = await person(app, db, [], 'Ana');
    const parche = (await host.request('POST', '/sessions', { name: 'Mesa', alias: 'Ana' })).json() as { id: string };
    const s = start(await post(host, 'proveedor-prueba', { sessionId: parche.id }));
    expect(s.play).toMatchObject({ kind: 'iframe', allowedOrigin: 'https://juegos.proveedor-prueba.co' });
    const pending = result(await host.request('POST', `/missions/${s.missionId}/submit`, { choice: 1 }));
    expect(pending).toMatchObject({ status: 'COMPLETADA_PENDIENTE', parcheScore: 0 });
    expect((await db.session.findFirstOrThrow()).score).toBe(0);

    const body = { missionId: s.missionId, issuedAt: new Date().toISOString(), outcome: 'completed' as const, parcheScore: 999, xp: 0 };
    expect((await callback(body, {})).statusCode).toBe(401);
    expect((await callback(body, { 'x-provider-signature': `sha256=${'0'.repeat(64)}` })).statusCode).toBe(401);
    expect((await callback({ ...body, parcheScore: 40 }, signed(body))).statusCode).toBe(401); // cuerpo alterado
    const stale = { ...body, issuedAt: new Date(Date.now() - 20 * 60_000).toISOString() };
    expect((await callback(stale, signed(stale))).statusCode).toBe(401);

    // Firma válida: el puntaje se acota al máximo del manifiesto (50), no a lo que diga el proveedor.
    const ok = await callback(body, signed(body));
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ status: 'VERIFICADA' });
    expect(result(await host.request('GET', `/missions/${s.missionId}`))).toMatchObject({ status: 'VERIFICADA', parcheScore: 50 });
    expect((await db.session.findFirstOrThrow()).score).toBe(50);
    // Repetir la llamada no duplica nada.
    expect((await callback(body, signed(body))).json()).toEqual({ status: 'VERIFICADA' });
    expect((await db.session.findFirstOrThrow()).score).toBe(50);

    // El secreto se revela a TI (auditado) y rotarlo invalida el anterior.
    const secret = (await t.ti.request('POST', '/admin/games/modules/proveedor-prueba/provider-secret')).json() as { secret: string; epoch: number };
    expect(secret.epoch).toBe(1);
    expect(secret.secret).toMatch(/^[0-9a-f]{64}$/);
    await t.ti.request('POST', '/admin/games/modules/proveedor-prueba/provider-secret/rotate');
    const s2 = start(await post(host, 'proveedor-prueba', { sessionId: parche.id }));
    const b2 = { missionId: s2.missionId, issuedAt: new Date().toISOString(), outcome: 'completed' as const, parcheScore: 10, xp: 0 };
    expect((await callback(b2, signed(b2, 1))).statusCode).toBe(401);
    expect((await callback(b2, signed(b2, 2))).statusCode).toBe(200);
    expect(await db.auditEvent.count({ where: { action: { in: ['module.secret_revealed', 'module.secret_rotated'] } } })).toBe(2);
  });

  it('el proveedor puede rechazar un resultado', async () => {
    await ready();
    const p = await person(app, db);
    const s = start(await post(p, 'proveedor-prueba'));
    const body = { missionId: s.missionId, issuedAt: new Date().toISOString(), outcome: 'rejected' as const, parcheScore: 0, xp: 0 };
    expect((await callback(body, signed(body))).json()).toEqual({ status: 'RECHAZADA' });
    expect(result(await p.request('GET', `/missions/${s.missionId}`)).status).toBe('RECHAZADA');
  });
});
