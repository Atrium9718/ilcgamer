import {
  AnalyticsDashboardSchema,
  ApiErrorSchema,
  MissionStartSchema,
  ProgressSchema,
  ReferralMeSchema,
  ReferralSettingsSchema,
  ReferralSummarySchema,
} from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AnalyticsService } from '../src/analytics/analytics.service.ts';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { RedisService } from '../src/redis/redis.service.ts';
import { claimableCodes, claimCode, DAY, person, seedBrands } from './fixtures.ts';
import { activateModule, team, triviaManifest } from './game-fixtures.ts';
import { browser, createTestApp, resetDatabase, testPrisma } from './helpers.ts';

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
type Person = Awaited<ReturnType<typeof person>>;
const err = (r: Res) => ApiErrorSchema.parse(r.json()).error;
const me = async (p: Person) => ReferralMeSchema.parse((await p.request('GET', '/referrals/me')).json());
const attribute = async (p: Person, code: string) => (await p.request('POST', '/referrals/attribute', { code })).json() as { attributed: boolean };
const balanceOf = async (p: Person) => (await db.ledgerAccount.findUnique({ where: { userId: p.user.id } }))?.balance ?? 0;
const xpOf = async (p: Person) => ProgressSchema.parse((await p.request('GET', '/profile/progress')).json()).xp;
const enable = (admin: Person, over: Record<string, unknown> = {}) =>
  admin.request('PUT', '/admin/referrals/settings', {
    enabled: true,
    referrerPoints: 50,
    referrerXp: 20,
    dailyCap: 5,
    weeklyCap: 20,
    attributionWindowDays: 7,
    ...over,
  });

describe('código y atribución', () => {
  it('cada persona tiene un código estable; sin bonificación activa no se promete nada', async () => {
    const ana = await person(app, db);
    const a = await me(ana);
    expect(a.code).toMatch(/^[2-9A-Z]{8}$/);
    expect(a.linkPath).toBe(`/r/${a.code}`);
    expect(a.rewardText).toBeNull();
    expect((await me(ana)).code).toBe(a.code);
  });

  it('atribuye una sola vez; ignora códigos propios, desconocidos o fuera de ventana sin revelar cuál fue', async () => {
    const ana = await person(app, db);
    const { code } = await me(ana);
    expect(await attribute(ana, code)).toEqual({ attributed: false });
    const bea = await person(app, db);
    expect(await attribute(bea, 'ZZZZZZZZ')).toEqual({ attributed: false });
    expect(await attribute(bea, code)).toEqual({ attributed: true });
    expect(await attribute(bea, code)).toEqual({ attributed: false });
    expect((await me(ana)).joined).toBe(1);
    const old = await person(app, db);
    await db.user.update({ where: { id: old.user.id }, data: { createdAt: new Date(Date.now() - 30 * DAY) } });
    expect(await attribute(old, code)).toEqual({ attributed: false });
    const temp = await person(app, db);
    await db.user.update({ where: { id: temp.user.id }, data: { status: 'TEMPORAL' } });
    expect(err(await temp.request('POST', '/referrals/attribute', { code })).code).toBe('ACCOUNT_REQUIRED');
    expect(err(await bea.request('POST', '/referrals/attribute', { code: 'x' })).fields).toBeDefined();
  });
});

describe('bonificación con topes y economías separadas', () => {
  it('Ruta A: la primera activación válida del referido da Puntos ILC al referente, una sola vez, y no XP', async () => {
    const { tokens } = await claimableCodes(app, db, 3);
    const admin = await person(app, db, ['ADMIN_MARCA']);
    expect((await enable(admin)).statusCode).toBe(200);
    const ana = await person(app, db);
    const bea = await person(app, db);
    await attribute(bea, (await me(ana)).code);
    expect((await me(ana)).rewardText).toMatch(/50 Puntos ILC.*20 XP.*Máximo 5 bonificaciones por día/);
    expect((await claimCode(bea, tokens[0] as string)).statusCode).toBe(200);
    expect(await balanceOf(ana)).toBe(50);
    expect(await xpOf(ana)).toBe(0);
    const entry = await db.ledgerEntry.findFirstOrThrow({ where: { sourceType: 'referral' } });
    expect(entry).toMatchObject({ type: 'CREDITO', amount: 50, idempotencyKey: `referral:${bea.user.id}` });
    await claimCode(bea, tokens[1] as string);
    expect(await balanceOf(ana)).toBe(50);
    expect((await me(ana)).rewarded).toBe(1);
  });

  it('Ruta B: la primera misión verificada del referido da XP al referente, nunca Puntos ILC', async () => {
    const t = await team(app, db);
    await activateModule(t, triviaManifest());
    await t.admin.request('PUT', '/admin/games/defaults', { modules: ['trivia-prueba'] });
    const admin = await person(app, db, ['ADMIN_MARCA']);
    await enable(admin);
    const ana = await person(app, db);
    const bea = await person(app, db);
    await attribute(bea, (await me(ana)).code);
    const started = MissionStartSchema.parse(
      (await bea.request('POST', '/games/start', { moduleId: 'trivia-prueba' }, { 'idempotency-key': 'm'.repeat(20) })).json(),
    );
    expect((await bea.request('POST', `/missions/${started.missionId}/submit`, { answers: [] })).statusCode).toBe(200);
    expect(await xpOf(ana)).toBe(20);
    expect(await balanceOf(ana)).toBe(0);
    expect((await db.referralAttribution.findFirstOrThrow()).missionRewardedAt).not.toBeNull();
  });

  it('apagado por defecto: sin habilitar no hay bonificación aunque haya atribución', async () => {
    const { tokens } = await claimableCodes(app, db, 1);
    const ana = await person(app, db);
    const bea = await person(app, db);
    await attribute(bea, (await me(ana)).code);
    await claimCode(bea, tokens[0] as string);
    expect(await balanceOf(ana)).toBe(0);
  });

  it('topes por día: la segunda bonificación del mismo día no se paga y queda registrada como tope', async () => {
    const { tokens } = await claimableCodes(app, db, 2);
    const admin = await person(app, db, ['ADMIN_MARCA']);
    await enable(admin, { dailyCap: 1, weeklyCap: 5 });
    const ana = await person(app, db);
    const code = (await me(ana)).code;
    const bea = await person(app, db);
    const cai = await person(app, db);
    await attribute(bea, code);
    await attribute(cai, code);
    await claimCode(bea, tokens[0] as string);
    await claimCode(cai, tokens[1] as string);
    expect(await balanceOf(ana)).toBe(50);
    expect(await db.analyticsEvent.count({ where: { name: 'referral_capped' } })).toBe(1);
    const sum = ReferralSummarySchema.parse((await admin.request('GET', '/admin/referrals/summary')).json());
    expect(sum).toMatchObject({ attributed: 2, rewardedByClaim: 1, capped: 1 });
  });

  it('solo Marca y TI configuran, con validaciones y auditoría', async () => {
    const editor = await person(app, db, ['EDITOR_CONTENIDO']);
    expect((await editor.request('GET', '/admin/referrals/settings')).statusCode).toBe(403);
    const admin = await person(app, db, ['ADMIN_MARCA']);
    expect(err(await enable(admin, { dailyCap: 10, weeklyCap: 5 })).fields).toHaveProperty(['dailyCap']);
    expect(err(await enable(admin, { referrerPoints: 999999 })).fields).toBeDefined();
    expect((await enable(admin)).statusCode).toBe(200);
    expect(ReferralSettingsSchema.parse((await admin.request('GET', '/admin/referrals/settings')).json()).enabled).toBe(true);
    expect(await db.auditEvent.count({ where: { action: 'referral.settings_changed' } })).toBe(1);
  });
});

describe('analítica (Guía Técnica §10)', () => {
  it('los eventos del cliente pasan por lista blanca y esquema; nada de lo extra se guarda', async () => {
    const p = await person(app, db);
    expect((await p.request('POST', '/events', { name: 'share_card_generated', template: 'bosque', target: 'whatsapp', email: 'a@b.co' })).statusCode).toBe(
      204,
    );
    const ev = await db.analyticsEvent.findFirstOrThrow({ where: { name: 'share_card_generated' } });
    expect(ev.properties).toEqual({ template: 'bosque', target: 'whatsapp' });
    expect((await p.request('POST', '/events', { name: 'reward_claimed' })).statusCode).toBe(400);
    expect((await p.request('POST', '/events', { name: 'share_card_generated', template: 'otro', target: 'download' })).statusCode).toBe(400);
    expect((await browser(app).request('POST', '/events', { name: 'share_link_opened', source: 'card' })).statusCode).toBe(401);
  });

  it('emit descarta propiedades no registradas (sin PII posible)', async () => {
    await app.get(AnalyticsService).emit('consent_updated', { properties: { purpose: 'MARKETING', granted: true, email: 'x@y.co', phone: '3001234567' } });
    expect((await db.analyticsEvent.findFirstOrThrow({ where: { name: 'consent_updated' } })).properties).toEqual({ purpose: 'MARKETING', granted: true });
  });

  it('los tableros separan Ruta A, Ruta B y operación con agregados, sin personas', async () => {
    const { tokens } = await claimableCodes(app, db, 2);
    const t = await team(app, db);
    await activateModule(t, triviaManifest());
    await t.admin.request('PUT', '/admin/games/defaults', { modules: ['trivia-prueba'] });
    const player = await person(app, db);
    await claimCode(player, tokens[0] as string);
    await claimCode(player, tokens[1] as string);
    const started = MissionStartSchema.parse(
      (await player.request('POST', '/games/start', { moduleId: 'trivia-prueba' }, { 'idempotency-key': 'd'.repeat(20) })).json(),
    );
    await player.request('POST', `/missions/${started.missionId}/submit`, { answers: [] });
    await player.request('POST', '/games/start', { moduleId: 'trivia-prueba' }, { 'idempotency-key': 'e'.repeat(20) });
    await browser(app).request('GET', '/product-codes/ABCDEFGHJKLM/status');

    const dash = AnalyticsDashboardSchema.parse((await t.admin.request('GET', '/admin/analytics?days=7')).json());
    expect(dash.routeA).toMatchObject({ claims: 2, pointsIssued: 1000, redemptions: 0, staffLinked: 0, reversals: { count: 0, points: 0 } });
    expect(dash.routeA.byDay).toHaveLength(7);
    expect(dash.routeA.byDay.at(-1)?.count).toBe(2);
    expect(dash.routeA.bySku[0]).toMatchObject({ sku: 'RVC-8', claims: 2, points: 1000 });
    expect(dash.routeA.byCampaign[0]).toMatchObject({ slug: 'feria', title: 'Feria de Manizales', claims: 2, points: 1000 });
    expect(dash.routeB).toMatchObject({ missionsStarted: 2, missionsCompleted: 1, completionRate: 0.5 });
    expect(dash.routeB.byModule[0]).toMatchObject({ moduleId: 'trivia-prueba', started: 2, completed: 1 });
    expect(dash.ops.codeChecks.unrecognized).toBe(1);
    expect(dash.ops.campaignsByStatus).toMatchObject({ ACTIVA: 1 });
    expect(dash.ops.ageGate.passed).toBe(0);
    expect(JSON.stringify(dash)).not.toContain(player.user.id);
  });

  it('solo Marca y TI ven los tableros y el período es de una lista fija', async () => {
    const t = await team(app, db);
    expect((await t.marca.request('GET', '/admin/analytics')).statusCode).toBe(403);
    expect((await t.admin.request('GET', '/admin/analytics?days=5')).statusCode).toBe(400);
    expect((await t.ti.request('GET', '/admin/analytics')).statusCode).toBe(200);
  });

  it('ningún evento guardado trae propiedades fuera de su registro ni datos personales', async () => {
    const { tokens } = await claimableCodes(app, db, 1);
    const player = await person(app, db);
    await claimCode(player, tokens[0] as string);
    await player.request('POST', '/consents', { purpose: 'MARKETING', granted: true, noticeVersion: '1.0', source: 'perfil' });
    const events = await db.analyticsEvent.findMany();
    expect(events.length).toBeGreaterThan(2);
    const text = JSON.stringify(events);
    expect(text).not.toMatch(/@|\+57|alias|birth|nacimiento|userId/i);
    expect(events.every((e) => e.schemaVersion === 1)).toBe(true);
  });
});
