import { AdminAccountSchema, ApiErrorSchema, ProgressSchema, ReconciliationSchema, WalletSchema } from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { LedgerService } from '../src/economy/ledger.service.ts';
import { ProgressService } from '../src/economy/progress.service.ts';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { RedisService } from '../src/redis/redis.service.ts';
import { claimableCodes, claimCode, DAY, draft, person, seedBrands } from './fixtures.ts';
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

type Res = { json: () => unknown };
const err = (res: Res) => ApiErrorSchema.parse(res.json()).error;
const wallet = (res: Res) => WalletSchema.parse(res.json());
const account = (res: Res) => AdminAccountSchema.parse(res.json());
const withExpiry = (days: number) => draft({ rules: { ...draft().rules, pointsExpiryDays: days } });

describe('billetera del titular (GET /wallet)', () => {
  it('muestra saldo, movimientos con su origen y el aviso de vencimiento', async () => {
    const { tokens } = await claimableCodes(app, db, 2, withExpiry(20));
    const player = await person(app, db);
    for (const t of tokens) await claimCode(player, t);
    const w = wallet(await player.request('GET', '/wallet'));
    expect(w.balance).toBe(1000);
    expect(w.entries).toHaveLength(2);
    expect(w.entries[0]).toMatchObject({ kind: 'credit', amount: 500, description: 'Código activado', detail: 'Feria de Manizales' });
    expect(w.expiring?.amount).toBe(1000);
    expect(new Date(w.expiring?.at ?? 0).getTime()).toBeGreaterThan(Date.now() + 19 * DAY);
  });

  it('una cuenta sin movimientos ve saldo cero; nadie ve la billetera de otro', async () => {
    const player = await person(app, db);
    expect(wallet(await player.request('GET', '/wallet'))).toMatchObject({ balance: 0, entries: [], expiring: null });
    expect((await browser(app).request('GET', '/wallet')).statusCode).toBe(401);
  });

  it('pagina con cursor', async () => {
    const player = await person(app, db);
    const acc = await db.ledgerAccount.create({ data: { ownerType: 'USUARIO', userId: player.user.id } });
    for (let i = 0; i < 35; i++) {
      await db.ledgerEntry.create({ data: { accountId: acc.id, type: 'CREDITO', amount: 10, sourceType: 'prueba', idempotencyKey: `p${i}` } });
    }
    await db.ledgerAccount.update({ where: { id: acc.id }, data: { balance: 350 } });
    const first = wallet(await player.request('GET', '/wallet'));
    expect(first.entries).toHaveLength(30);
    const second = wallet(await player.request('GET', `/wallet?cursor=${first.nextCursor}`));
    expect(second.entries).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
  });
});

describe('vencimientos (§5.7)', () => {
  it('vence solo lo que queda sin usar, una sola vez, con movimiento compensatorio', async () => {
    const { tokens } = await claimableCodes(app, db, 1, withExpiry(10));
    const player = await person(app, db);
    await claimCode(player, tokens[0] as string);
    const acc = await db.ledgerAccount.findFirstOrThrow({ where: { userId: player.user.id } });
    // Un canje de 200 (Paso 10) consume primero este crédito.
    await db.ledgerEntry.create({ data: { accountId: acc.id, type: 'DEBITO', amount: -200, sourceType: 'reward', idempotencyKey: 'canje-1' } });
    await db.ledgerAccount.update({ where: { id: acc.id }, data: { balance: { decrement: 200 } } });

    const ledger = app.get(LedgerService);
    const later = new Date(Date.now() + 11 * DAY);
    expect(await ledger.expireDue(later)).toMatchObject({ expired: 1, points: 300 });
    expect(await ledger.expireDue(later)).toMatchObject({ expired: 0, points: 0 });

    const w = wallet(await player.request('GET', '/wallet'));
    expect(w.balance).toBe(0);
    expect(w.entries[0]).toMatchObject({ kind: 'expiry', amount: -300, description: 'Vencimiento de puntos', detail: 'Código activado · Feria de Manizales' });
    expect((await ledger.reconcile()).mismatches).toEqual([]);
  });

  it('los puntos sin vigencia no vencen', async () => {
    const { tokens } = await claimableCodes(app, db, 1);
    const player = await person(app, db);
    await claimCode(player, tokens[0] as string);
    expect(await app.get(LedgerService).expireDue(new Date(Date.now() + 1000 * DAY))).toMatchObject({ expired: 0 });
  });
});

describe('reversos auditados (§5.7 regla 3, §9.1)', () => {
  it('reversa lo disponible con motivo, una sola vez y sin borrar el original', async () => {
    const { tokens } = await claimableCodes(app, db, 1);
    const player = await person(app, db);
    const claim = (await claimCode(player, tokens[0] as string)).json() as { claimId: string };
    const admin = await person(app, db, ['ADMIN_MARCA'], 'Soporte');

    const found = account(await admin.request('GET', `/admin/economy/accounts?claimId=${claim.claimId}`));
    const creditEntry = found.entries[0] as (typeof found.entries)[number];
    expect(found).toMatchObject({ userId: player.user.id, balance: 500, ledgerSum: 500 });
    expect(creditEntry).toMatchObject({ type: 'CREDITO', remaining: 500, compensated: false });

    expect(err(await admin.request('POST', `/admin/economy/entries/${creditEntry.id}/reverse`, { reason: 'corto' })).code).toBe('VALIDATION_FAILED');
    const after = account(
      await admin.request('POST', `/admin/economy/entries/${creditEntry.id}/reverse`, { reason: 'Código reportado como robado por el comercio' }),
    );
    expect(after).toMatchObject({ balance: 0, ledgerSum: 0 });
    expect(after.entries[0]).toMatchObject({ type: 'REVERSO', amount: -500, reason: 'Código reportado como robado por el comercio' });
    expect(after.entries[1]).toMatchObject({ type: 'CREDITO', amount: 500, compensated: true, remaining: 0 });

    expect(err(await admin.request('POST', `/admin/economy/entries/${creditEntry.id}/reverse`, { reason: 'Intento de segundo reverso' })).message).toMatch(
      /ya fue reversado/,
    );
    expect(await db.auditEvent.count({ where: { action: 'ledger.reversed' } })).toBe(1);
    // El titular ve el reverso, pero no el motivo interno.
    const w = wallet(await player.request('GET', '/wallet'));
    expect(w.entries[0]).toMatchObject({ kind: 'reversal', description: 'Reverso auditado', detail: 'Código activado · Feria de Manizales' });
    expect(JSON.stringify(w)).not.toContain('robado');
  });

  it('nadie reversa sus propios movimientos; los roles sin permiso no acceden', async () => {
    const admin = await person(app, db, ['ADMIN_MARCA'], 'Admin');
    const acc = await db.ledgerAccount.create({ data: { ownerType: 'USUARIO', userId: admin.user.id, balance: 100 } });
    const own = await db.ledgerEntry.create({ data: { accountId: acc.id, type: 'CREDITO', amount: 100, sourceType: 'prueba', idempotencyKey: 'own' } });
    expect(err(await admin.request('POST', `/admin/economy/entries/${own.id}/reverse`, { reason: 'Me reverso a mí mismo por error' })).code).toBe('FORBIDDEN');
    const reviewer = await person(app, db, ['REVISOR_MARCA']);
    expect(err(await reviewer.request('GET', `/admin/economy/accounts?userId=${admin.user.id}`)).code).toBe('FORBIDDEN');
  });

  it('dos reversos simultáneos del mismo crédito producen uno solo', async () => {
    const player = await person(app, db);
    const acc = await db.ledgerAccount.create({ data: { ownerType: 'USUARIO', userId: player.user.id, balance: 300 } });
    const c = await db.ledgerEntry.create({ data: { accountId: acc.id, type: 'CREDITO', amount: 300, sourceType: 'prueba', idempotencyKey: 'c' } });
    const a1 = await person(app, db, ['ADMIN_MARCA'], 'A1');
    const a2 = await person(app, db, ['SUPERADMIN'], 'A2');
    const res = await Promise.all(
      [a1, a2].map((a) => a.request('POST', `/admin/economy/entries/${c.id}/reverse`, { reason: 'Reverso concurrente de prueba' })),
    );
    expect(res.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(await db.ledgerEntry.count({ where: { type: 'REVERSO' } })).toBe(1);
    expect((await db.ledgerAccount.findUniqueOrThrow({ where: { id: acc.id } })).balance).toBe(0);
  });
});

describe('conciliación (§12.2)', () => {
  it('detecta una diferencia entre el saldo en caché y la suma del ledger', async () => {
    const player = await person(app, db);
    const acc = await db.ledgerAccount.create({ data: { ownerType: 'USUARIO', userId: player.user.id, balance: 999 } });
    await db.ledgerEntry.create({ data: { accountId: acc.id, type: 'CREDITO', amount: 500, sourceType: 'prueba', idempotencyKey: 'x' } });
    const admin = await person(app, db, ['ADMIN_MARCA']);
    const r = ReconciliationSchema.parse((await admin.request('GET', '/admin/economy/reconciliation')).json());
    expect(r.mismatches).toEqual([{ userId: player.user.id, balance: 999, ledgerSum: 500 }]);
    expect(await db.securityEvent.count({ where: { type: 'ledger.reconciliation_mismatch', severity: 'ALTA' } })).toBe(1);
  });
});

describe('XP e insignias (Ruta B, economía separada)', () => {
  it('el XP y las insignias se otorgan una sola vez y el nivel sigue los umbrales configurados', async () => {
    const player = await person(app, db);
    const admin = await person(app, db, ['ADMIN_MARCA']);
    expect(
      (await admin.request('POST', '/admin/economy/badges', { slug: 'guardian-del-bosque', name: 'Guardián del bosque', icon: 'filter_vintage' })).statusCode,
    ).toBe(201);
    expect(err(await admin.request('POST', '/admin/economy/badges', { slug: 'guardian-del-bosque', name: 'Otra', icon: 'park' })).code).toBe('CONFLICT');
    expect(err(await admin.request('POST', '/admin/economy/badges', { slug: 'x', name: 'Mal', icon: 'local_bar 🍸' })).code).toBe('VALIDATION_FAILED');

    const progress = app.get(ProgressService);
    expect(await progress.awardXp({ userId: player.user.id, amount: 120, source: 'mision', idempotencyKey: 'm1' })).toBe(true);
    expect(await progress.awardXp({ userId: player.user.id, amount: 120, source: 'mision', idempotencyKey: 'm1' })).toBe(false);
    expect(await progress.awardBadge(player.user.id, 'guardian-del-bosque')).toBe(true);
    expect(await progress.awardBadge(player.user.id, 'guardian-del-bosque')).toBe(false);

    const p = ProgressSchema.parse((await player.request('GET', '/profile/progress')).json());
    expect(p).toMatchObject({ xp: 120, level: { number: 2, fromXp: 100, nextAt: 300 }, badges: [{ slug: 'guardian-del-bosque', earned: true }] });
    // XP nunca toca el saldo de Puntos ILC.
    expect(wallet(await player.request('GET', '/wallet')).balance).toBe(0);
  });

  it('solo una campaña MIXTA puede otorgar XP por activación, y lo otorga junto con los puntos', async () => {
    const editor = await person(app, db, ['EDITOR_CONTENIDO']);
    const rules = { ...draft().rules, xpPerActivation: 50 };
    const bad = await editor.request('POST', '/admin/campaigns', { slug: 'solo-a', route: 'A_COMERCIAL', draft: draft({ rules }) });
    expect(err(bad).fields).toHaveProperty(['draft.rules.xpPerActivation']);

    const { tokens } = await claimableCodes(app, db, 1, draft({ rules }), 'MIXTA', 'mixta');
    const player = await person(app, db);
    const res = (await claimCode(player, tokens[0] as string)).json() as { points: number; xp: number };
    expect(res).toMatchObject({ points: 500, xp: 50 });
    expect(ProgressSchema.parse((await player.request('GET', '/profile/progress')).json()).xp).toBe(50);
  });
});
