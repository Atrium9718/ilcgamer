import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { resetDatabase, testPrisma } from './helpers.ts';

/**
 * Reglas de integridad garantizadas por la BASE DE DATOS (migración "integridad"), no solo por el código:
 * aunque un servicio tenga un bug, estos estados son imposibles. Guía Técnica §5.5-§5.8, §6.1, §9.2.
 */
let db: PrismaClient;
const day = 24 * 3600 * 1000;

beforeAll(() => {
  db = testPrisma();
});
afterAll(async () => {
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDatabase(db);
});

async function userWithAccount(balance = 0) {
  const user = await db.user.create({ data: { alias: 'Andrés' } });
  const account = await db.ledgerAccount.create({ data: { ownerType: 'USUARIO', userId: user.id, balance } });
  return { user, account };
}

async function campaignWithCode() {
  const campaign = await db.campaign.create({ data: { slug: `feria-${Date.now()}`, internalName: 'Feria', route: 'A_COMERCIAL', status: 'ACTIVA' } });
  const version = await db.campaignVersion.create({
    data: {
      campaignId: campaign.id,
      version: 1,
      objective: 'activación',
      channels: ['ON_PREMISE'],
      territories: ['Caldas'],
      startsAt: new Date(),
      endsAt: new Date(Date.now() + day),
      rules: {},
    },
  });
  const code = await db.campaignCode.create({ data: { codeHash: 'a'.repeat(64), codeHint: 'aaaa', campaignId: campaign.id, status: 'DISPONIBLE' } });
  return { campaign, version, code };
}

describe('ledger inmutable (§5.7)', () => {
  it('no permite editar ni borrar un movimiento confirmado', async () => {
    const { account } = await userWithAccount();
    const entry = await db.ledgerEntry.create({ data: { accountId: account.id, type: 'CREDITO', amount: 500, sourceType: 'claim', idempotencyKey: 'k-1' } });
    await expect(db.ledgerEntry.update({ where: { id: entry.id }, data: { amount: 5000 } })).rejects.toThrow(/inmutable/);
    await expect(db.ledgerEntry.delete({ where: { id: entry.id } })).rejects.toThrow(/inmutable/);
  });

  it('exige signo coherente con el tipo y prohíbe cantidad cero', async () => {
    const { account } = await userWithAccount();
    await expect(
      db.ledgerEntry.create({ data: { accountId: account.id, type: 'CREDITO', amount: -10, sourceType: 't', idempotencyKey: 'k-2' } }),
    ).rejects.toThrow();
    await expect(
      db.ledgerEntry.create({ data: { accountId: account.id, type: 'DEBITO', amount: 10, sourceType: 't', idempotencyKey: 'k-3' } }),
    ).rejects.toThrow();
    await expect(
      db.ledgerEntry.create({ data: { accountId: account.id, type: 'AJUSTE', amount: 0, sourceType: 't', idempotencyKey: 'k-4' } }),
    ).rejects.toThrow();
  });

  it('un reverso debe referenciar el movimiento original y su motivo', async () => {
    const { account } = await userWithAccount();
    const original = await db.ledgerEntry.create({
      data: { accountId: account.id, type: 'CREDITO', amount: 50, sourceType: 'referral', idempotencyKey: 'k-5' },
    });
    await expect(
      db.ledgerEntry.create({ data: { accountId: account.id, type: 'REVERSO', amount: -50, sourceType: 'admin', idempotencyKey: 'k-6' } }),
    ).rejects.toThrow();
    await expect(
      db.ledgerEntry.create({
        data: {
          accountId: account.id,
          type: 'REVERSO',
          amount: -50,
          sourceType: 'admin',
          idempotencyKey: 'k-7',
          originalEntryId: original.id,
          reason: 'Código anulado',
        },
      }),
    ).resolves.toBeDefined();
  });

  it('la misma clave de idempotencia no emite dos veces en la misma cuenta', async () => {
    const { account } = await userWithAccount();
    const data = { accountId: account.id, type: 'CREDITO' as const, amount: 300, sourceType: 'claim', idempotencyKey: 'doble-toque' };
    await db.ledgerEntry.create({ data });
    await expect(db.ledgerEntry.create({ data })).rejects.toThrow(/Unique constraint/);
  });

  it('el saldo nunca queda negativo', async () => {
    const { account } = await userWithAccount(100);
    await expect(db.ledgerAccount.update({ where: { id: account.id }, data: { balance: { decrement: 101 } } })).rejects.toThrow();
  });
});

describe('claims de uso único bajo concurrencia (§5.6, §12.1)', () => {
  it('dos reclamaciones simultáneas del mismo código producen exactamente un claim confirmado', async () => {
    const { version, code } = await campaignWithCode();
    const [a, b] = await Promise.all([db.user.create({ data: { alias: 'A' } }), db.user.create({ data: { alias: 'B' } })]);
    const results = await Promise.allSettled(
      [a, b].map((u, i) => db.claim.create({ data: { campaignCodeId: code.id, campaignVersionId: version.id, userId: u.id, idempotencyKey: `claim-${i}` } })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.claim.count({ where: { campaignCodeId: code.id, confirmed: true } })).toBe(1);
  });
});

describe('inventario de recompensas (§5.8)', () => {
  it('no permite stock negativo', async () => {
    const reward = await db.reward.create({
      data: { slug: 'gorra', name: 'Gorra', type: 'MERCHANDISING', cost: 1200, startsAt: new Date(), endsAt: new Date(Date.now() + day) },
    });
    await db.rewardInventory.create({ data: { rewardId: reward.id, zone: 'Manizales', available: 1 } });
    const where = { rewardId_zone: { rewardId: reward.id, zone: 'Manizales' } };
    await db.rewardInventory.update({ where, data: { available: { decrement: 1 } } });
    await expect(db.rewardInventory.update({ where, data: { available: { decrement: 1 } } })).rejects.toThrow();
  });
});

describe('PIN del Parche (§5.5)', () => {
  it('es único entre sesiones activas y reutilizable cuando la sesión expira', async () => {
    const host = await db.user.create({ data: { alias: 'Host' } });
    const base = { name: 'Mesa', route: 'B_EXPERIENCIAL' as const, hostId: host.id, pinLookup: 'hmac-4729', expiresAt: new Date(Date.now() + day) };
    const first = await db.session.create({ data: { ...base, status: 'ABIERTA' } });
    await expect(db.session.create({ data: { ...base, status: 'ABIERTA' } })).rejects.toThrow(/Unique constraint/);
    await db.session.update({ where: { id: first.id }, data: { status: 'EXPIRADA' } });
    await expect(db.session.create({ data: { ...base, status: 'ABIERTA' } })).resolves.toBeDefined();
  });
});

describe('campañas y consentimientos', () => {
  it('rechaza una versión de campaña con edad mínima inferior a 18 o ventana inválida', async () => {
    const campaign = await db.campaign.create({ data: { slug: 'x', internalName: 'x', route: 'B_EXPERIENCIAL' } });
    const base = {
      campaignId: campaign.id,
      objective: 'o',
      channels: [],
      territories: [],
      rules: {},
      startsAt: new Date(),
      endsAt: new Date(Date.now() + day),
    };
    await expect(db.campaignVersion.create({ data: { ...base, version: 1, minAge: 16 } })).rejects.toThrow();
    await expect(db.campaignVersion.create({ data: { ...base, version: 2, endsAt: new Date(Date.now() - day) } })).rejects.toThrow();
  });

  it('el historial de consentimientos no se reescribe (append-only)', async () => {
    const user = await db.user.create({ data: { alias: 'C' } });
    const consent = await db.consentRecord.create({
      data: { userId: user.id, purpose: 'MARKETING', granted: false, noticeVersion: '1.0', source: 'registro' },
    });
    await expect(db.consentRecord.update({ where: { id: consent.id }, data: { granted: true } })).rejects.toThrow(/append-only/);
  });
});
