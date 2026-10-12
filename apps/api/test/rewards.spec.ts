import {
  AdminRewardClaimSchema,
  ApiErrorSchema,
  MyRewardClaimSchema,
  RewardAdminViewSchema,
  RewardCatalogSchema,
  RewardClaimResultSchema,
  WalletSchema,
} from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { RedisService } from '../src/redis/redis.service.ts';
import { RewardsService } from '../src/rewards/rewards.service.ts';
import { DAY, person, publishedCampaign, seedBrands } from './fixtures.ts';
import { team } from './game-fixtures.ts';
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
type Person = Awaited<ReturnType<typeof person>>;
const err = (r: Res) => ApiErrorSchema.parse(r.json()).error;
const view = (r: Res) => RewardAdminViewSchema.parse(r.json());
let n = 0;
const idem = () => `r${Date.now().toString(36)}${(n++).toString(36)}`.padEnd(20, 'x');

const input = (over: Record<string, unknown> = {}) => ({
  slug: 'gorra-ilc',
  name: 'Gorra ILC',
  description: 'Gorra de prueba',
  type: 'MERCHANDISING',
  cost: 300,
  conditions: ['Se retira en el punto de entrega'],
  maxPerUser: 1,
  startsAt: new Date(Date.now() - DAY).toISOString(),
  endsAt: new Date(Date.now() + 30 * DAY).toISOString(),
  fulfillment: 'Equipo de Trade Marketing',
  zones: [{ zone: 'Manizales', available: 3, lowStockAlert: 2 }],
  ...over,
});

/** Crea (admin) y activa (otra persona) una recompensa. */
async function liveReward(t: Awaited<ReturnType<typeof team>>, over: Record<string, unknown> = {}) {
  const created = await t.admin.request('POST', '/admin/rewards', input(over));
  if (created.statusCode !== 201) throw new Error(created.body as string);
  const reward = view(created);
  const act = await t.ti.request('POST', `/admin/rewards/${reward.id}/activate`);
  if (act.statusCode !== 200) throw new Error((act as unknown as { body: string }).body);
  return reward;
}

async function withPoints(points: number): Promise<Person> {
  const p = await person(app, db);
  const acc = await db.ledgerAccount.create({ data: { ownerType: 'USUARIO', userId: p.user.id, balance: points } });
  await db.ledgerEntry.create({ data: { accountId: acc.id, type: 'CREDITO', amount: points, sourceType: 'prueba', idempotencyKey: `seed-${p.user.id}` } });
  return p;
}
const claim = (p: Person, id: string, zone = 'Manizales', key = idem()) => p.request('POST', `/rewards/${id}/claim`, { zone }, { 'idempotency-key': key });
const stockOf = async (rewardId: string, zone = 'Manizales') =>
  (await db.rewardInventory.findUniqueOrThrow({ where: { rewardId_zone: { rewardId, zone } } })).available;
const balanceOf = async (p: Person) => (await db.ledgerAccount.findUniqueOrThrow({ where: { userId: p.user.id } })).balance;

describe('catálogo y gobierno (Guía Técnica §5.8)', () => {
  it('una recompensa nueva nace inactiva y quien la crea no puede activarla', async () => {
    const t = await team(app, db);
    const created = view(await t.admin.request('POST', '/admin/rewards', input()));
    expect(created.active).toBe(false);
    const own = await t.admin.request('POST', `/admin/rewards/${created.id}/activate`);
    expect(own.statusCode).toBe(403);
    const player = await withPoints(500);
    expect(RewardCatalogSchema.parse((await player.request('GET', '/rewards')).json()).rewards).toHaveLength(0);
    expect(view(await t.ti.request('POST', `/admin/rewards/${created.id}/activate`)).active).toBe(true);
    const cat = RewardCatalogSchema.parse((await player.request('GET', '/rewards')).json());
    expect(cat.rewards).toHaveLength(1);
    expect(cat).toMatchObject({
      balance: 500,
      rewards: [{ name: 'Gorra ILC', delivery: 'pickup', soldOut: false, zones: [{ zone: 'Manizales', available: 3 }] }],
    });
  });

  it('valida lo que debe: condiciones visibles, fechas coherentes y permisos por rol', async () => {
    const t = await team(app, db);
    expect(err(await t.admin.request('POST', '/admin/rewards', input({ conditions: [] }))).fields).toBeDefined();
    expect(err(await t.admin.request('POST', '/admin/rewards', input({ endsAt: new Date(Date.now() - 2 * DAY).toISOString() }))).fields).toHaveProperty([
      'endsAt',
    ]);
    expect((await t.marca.request('POST', '/admin/rewards', input())).statusCode).toBe(403);
    expect((await (await person(app, db)).request('GET', '/admin/rewards')).statusCode).toBe(403);
    await t.admin.request('POST', '/admin/rewards', input());
    expect((await t.admin.request('POST', '/admin/rewards', input())).statusCode).toBe(409);
  });

  it('una recompensa de una campaña no se canjea si la campaña no está activa', async () => {
    const t = await team(app, db);
    await publishedCampaign(app, db, 'feria');
    const reward = await liveReward(t, { campaignSlug: 'feria' });
    const player = await withPoints(500);
    expect((await claim(player, reward.id)).statusCode).toBe(200);
    await db.campaign.update({ where: { slug: 'feria' }, data: { status: 'PAUSADA' } });
    const other = await withPoints(500);
    expect(err(await claim(other, reward.id)).code).toBe('REWARD_NOT_AVAILABLE');
    expect(RewardCatalogSchema.parse((await other.request('GET', '/rewards')).json()).rewards).toHaveLength(0);
  });
});

describe('canje atómico (stock + puntos)', () => {
  it('descuenta stock y puntos, entrega un código y queda en el ledger y en "mis canjes"', async () => {
    const t = await team(app, db);
    const reward = await liveReward(t);
    const player = await withPoints(500);
    const res = RewardClaimResultSchema.parse((await claim(player, reward.id)).json());
    expect(res).toMatchObject({ status: 'RESERVADO', cost: 300, balance: 200, zone: 'Manizales', replayed: false });
    expect(res.code).toMatch(/^[0-9A-Z]{8}$/);
    expect(res.expiresAt).not.toBeNull();
    expect(await stockOf(reward.id)).toBe(2);
    const w = WalletSchema.parse((await player.request('GET', '/wallet')).json());
    expect(w.balance).toBe(200);
    expect(w.entries[0]).toMatchObject({ kind: 'debit', amount: -300 });
    const mine = MyRewardClaimSchema.array().parse((await player.request('GET', '/rewards/claims')).json());
    expect(mine[0]).toMatchObject({ status: 'RESERVADO', code: res.code });
  });

  it('un reintento con la misma clave devuelve el mismo canje sin cobrar de nuevo', async () => {
    const t = await team(app, db);
    const reward = await liveReward(t, { maxPerUser: 3 });
    const player = await withPoints(900);
    const key = idem();
    const a = RewardClaimResultSchema.parse((await claim(player, reward.id, 'Manizales', key)).json());
    const b = RewardClaimResultSchema.parse((await claim(player, reward.id, 'Manizales', key)).json());
    expect(b).toMatchObject({ claimId: a.claimId, code: a.code, replayed: true });
    expect(await balanceOf(player)).toBe(600);
    expect(await stockOf(reward.id)).toBe(2);
    // La clave se liga a la persona: la misma clave de otra persona es un canje distinto, nunca el de la primera.
    const other = await withPoints(900);
    const c = RewardClaimResultSchema.parse((await claim(other, reward.id, 'Manizales', key)).json());
    expect(c.claimId).not.toBe(a.claimId);
    expect(c.replayed).toBe(false);
  });

  it('rechaza sin saldo, sin stock, fuera de zona y por encima del límite por persona, sin dejar nada a medias', async () => {
    const t = await team(app, db);
    const reward = await liveReward(t, { zones: [{ zone: 'Manizales', available: 1, lowStockAlert: 0 }] });
    const poor = await withPoints(100);
    expect(err(await claim(poor, reward.id)).code).toBe('INSUFFICIENT_BALANCE');
    expect(await stockOf(reward.id)).toBe(1); // el stock se devolvió: la transacción se deshizo
    expect(await balanceOf(poor)).toBe(100);
    const rich = await withPoints(900);
    expect(err(await claim(rich, reward.id, 'Pereira')).code).toBe('REWARD_NOT_AVAILABLE');
    expect((await claim(rich, reward.id)).statusCode).toBe(200);
    expect(err(await claim(rich, reward.id)).code).toBe('REWARD_LIMIT_REACHED');
    const late = await withPoints(900);
    expect(err(await claim(late, reward.id)).code).toBe('REWARD_OUT_OF_STOCK');
  });

  it('una cuenta temporal debe guardar su progreso antes de canjear', async () => {
    const t = await team(app, db);
    const reward = await liveReward(t);
    const temp = await person(app, db);
    await db.user.update({ where: { id: temp.user.id }, data: { status: 'TEMPORAL' } });
    expect(err(await claim(temp, reward.id)).code).toBe('ACCOUNT_REQUIRED');
  });

  it('concurrencia: con 3 en stock y 8 personas, se canjean exactamente 3 y los saldos cuadran', async () => {
    const t = await team(app, db);
    const reward = await liveReward(t);
    const players = await Promise.all(Array.from({ length: 8 }, () => withPoints(300)));
    const results = await Promise.all(players.map((p) => claim(p, reward.id)));
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(3);
    expect(results.filter((r) => r.statusCode !== 200).every((r) => err(r).code === 'REWARD_OUT_OF_STOCK')).toBe(true);
    expect(await stockOf(reward.id)).toBe(0);
    expect(await db.rewardClaim.count({ where: { rewardId: reward.id } })).toBe(3);
    const balances = await Promise.all(players.map(balanceOf));
    expect(balances.filter((b) => b === 0)).toHaveLength(3);
    expect(balances.filter((b) => b === 300)).toHaveLength(5);
  });

  it('el doble toque (misma clave en paralelo) cobra una sola vez', async () => {
    const t = await team(app, db);
    const reward = await liveReward(t, { maxPerUser: 5 });
    const player = await withPoints(900);
    const key = idem();
    const results = await Promise.all([
      claim(player, reward.id, 'Manizales', key),
      claim(player, reward.id, 'Manizales', key),
      claim(player, reward.id, 'Manizales', key),
    ]);
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    expect(new Set(results.map((r) => RewardClaimResultSchema.parse(r.json()).claimId)).size).toBe(1);
    expect(await balanceOf(player)).toBe(600);
  });

  it('lo digital se entrega al canjear', async () => {
    const t = await team(app, db);
    const reward = await liveReward(t, { type: 'DIGITAL', cost: 100 });
    const player = await withPoints(100);
    expect(RewardClaimResultSchema.parse((await claim(player, reward.id)).json())).toMatchObject({ status: 'ENTREGADO', expiresAt: null });
  });
});

describe('entrega, anulación y vencimiento', () => {
  it('entrega contra el código una sola vez y no a uno mismo', async () => {
    const t = await team(app, db);
    const reward = await liveReward(t);
    const player = await withPoints(500);
    const { code } = RewardClaimResultSchema.parse((await claim(player, reward.id)).json());
    expect(err(await t.admin.request('POST', '/admin/rewards/claims/deliver', { code: 'ZZZZZZZZ' })).code).toBe('NOT_FOUND');
    const ok = AdminRewardClaimSchema.parse((await t.admin.request('POST', '/admin/rewards/claims/deliver', { code: code.toLowerCase() })).json());
    expect(ok.status).toBe('ENTREGADO');
    expect(err(await t.admin.request('POST', '/admin/rewards/claims/deliver', { code })).code).toBe('CONFLICT');
    // Quien tiene rol de consola tampoco puede entregarse su propio canje.
    await db.ledgerAccount.create({ data: { ownerType: 'USUARIO', userId: t.admin.user.id, balance: 300 } });
    await db.ledgerEntry.create({
      data: {
        accountId: (await db.ledgerAccount.findUniqueOrThrow({ where: { userId: t.admin.user.id } })).id,
        type: 'CREDITO',
        amount: 300,
        sourceType: 'prueba',
        idempotencyKey: 'seed-admin',
      },
    });
    const mineCode = RewardClaimResultSchema.parse((await claim(t.admin, reward.id)).json()).code;
    expect((await t.admin.request('POST', '/admin/rewards/claims/deliver', { code: mineCode })).statusCode).toBe(403);
  });

  it('anular devuelve stock y puntos con un movimiento compensatorio y deja la razón', async () => {
    const t = await team(app, db);
    const reward = await liveReward(t);
    const player = await withPoints(500);
    const { claimId } = RewardClaimResultSchema.parse((await claim(player, reward.id)).json());
    expect(err(await t.admin.request('POST', `/admin/rewards/claims/${claimId}/cancel`, { reason: 'x' })).fields).toBeDefined();
    const done = AdminRewardClaimSchema.parse((await t.admin.request('POST', `/admin/rewards/claims/${claimId}/cancel`, { reason: 'Producto dañado' })).json());
    expect(done).toMatchObject({ status: 'ANULADO', cancelReason: 'Producto dañado' });
    expect(await stockOf(reward.id)).toBe(3);
    expect(await balanceOf(player)).toBe(500);
    const refund = await db.ledgerEntry.findFirstOrThrow({ where: { sourceType: 'reward_refund', sourceId: claimId } });
    expect(refund).toMatchObject({ type: 'REVERSO', amount: 300 });
    expect(refund.originalEntryId).not.toBeNull();
    expect(err(await t.admin.request('POST', `/admin/rewards/claims/${claimId}/cancel`, { reason: 'otra vez' })).code).toBe('CONFLICT');
    // La persona puede volver a canjear tras la anulación (no cuenta contra su límite).
    expect((await claim(player, reward.id)).statusCode).toBe(200);
  });

  it('una reserva no retirada vence una sola vez y devuelve stock y puntos; el entregado no vence', async () => {
    const t = await team(app, db);
    const reward = await liveReward(t, { maxPerUser: 2 });
    const player = await withPoints(900);
    const a = RewardClaimResultSchema.parse((await claim(player, reward.id)).json());
    const b = RewardClaimResultSchema.parse((await claim(player, reward.id)).json());
    await t.admin.request('POST', '/admin/rewards/claims/deliver', { code: b.code });
    const svc = app.get(RewardsService);
    expect(await svc.expireDue(new Date())).toBe(0);
    const later = new Date(Date.now() + 20 * DAY);
    expect(await svc.expireDue(later)).toBe(1);
    expect(await svc.expireDue(later)).toBe(0);
    expect((await db.rewardClaim.findUniqueOrThrow({ where: { id: a.claimId } })).status).toBe('EXPIRADO');
    expect((await db.rewardClaim.findUniqueOrThrow({ where: { id: b.claimId } })).status).toBe('ENTREGADO');
    expect(await stockOf(reward.id)).toBe(2);
    expect(await balanceOf(player)).toBe(600);
    // El código vencido ya no se entrega.
    expect(err(await t.admin.request('POST', '/admin/rewards/claims/deliver', { code: a.code })).code).toBe('CONFLICT');
  });
});

describe('inventario y alertas', () => {
  it('ajusta stock con motivo, nunca queda negativo y alerta al cruzar el umbral', async () => {
    const t = await team(app, db);
    const reward = await liveReward(t, { zones: [{ zone: 'Manizales', available: 4, lowStockAlert: 3 }], maxPerUser: 5 });
    const adj = (body: Record<string, unknown>) => t.admin.request('POST', `/admin/rewards/${reward.id}/stock`, body);
    expect(err(await adj({ zone: 'Manizales', delta: -10, reason: 'merma' })).code).toBe('CONFLICT');
    expect(err(await adj({ zone: 'Manizales', delta: 5, reason: 'x' })).fields).toBeDefined();
    expect(err(await adj({ zone: 'Armenia', delta: 5, reason: 'reposición' })).code).toBe('NOT_FOUND');
    expect(view(await adj({ zone: 'Manizales', delta: 2, reason: 'reposición' })).zones[0]).toMatchObject({ available: 6, low: false });
    const player = await withPoints(2000);
    for (let i = 0; i < 4; i++) await claim(player, reward.id);
    // 6 → 2: cruza el umbral (3) una sola vez.
    const alerts = await db.auditEvent.findMany({ where: { action: 'reward.low_stock' } });
    expect(alerts).toHaveLength(1);
    const list = (await t.admin.request('GET', '/admin/rewards')).json() as unknown[];
    expect(RewardAdminViewSchema.array().parse(list)[0]?.zones[0]).toMatchObject({ available: 2, low: true });
    expect(await db.auditEvent.count({ where: { action: 'reward.stock_adjusted' } })).toBe(1);
  });

  it('desactivar retira la recompensa del catálogo al instante, con motivo', async () => {
    const t = await team(app, db);
    const reward = await liveReward(t);
    expect(err(await t.admin.request('POST', `/admin/rewards/${reward.id}/deactivate`, { reason: 'x' })).fields).toBeDefined();
    expect(view(await t.admin.request('POST', `/admin/rewards/${reward.id}/deactivate`, { reason: 'Error en el precio' })).active).toBe(false);
    const player = await withPoints(500);
    expect(err(await claim(player, reward.id)).code).toBe('REWARD_NOT_AVAILABLE');
  });
});
