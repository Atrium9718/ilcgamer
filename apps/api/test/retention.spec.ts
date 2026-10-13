import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { RetentionService } from '../src/platform/retention.service.ts';
import { claimableCodes, claimCode, DAY, person, seedBrands } from './fixtures.ts';
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
  await seedBrands(db);
});

describe('retención y minimización (Guía Técnica §9.3)', () => {
  it('depura analítica, incidentes resueltos y consultas viejas; conserva ledger, auditoría y lo reciente', async () => {
    const { tokens } = await claimableCodes(app, db, 1);
    const player = await person(app, db);
    await claimCode(player, tokens[0] as string);
    const old = new Date(Date.now() - 800 * DAY);
    await db.analyticsEvent.create({ data: { name: 'consent_updated', schemaVersion: 1, occurredAt: old } });
    await db.securityEvent.create({ data: { type: 'prueba.vieja', severity: 'BAJA', resolvedAt: old, createdAt: old } });
    await db.securityEvent.create({ data: { type: 'prueba.abierta', severity: 'ALTA', createdAt: old } });
    const entries = await db.ledgerEntry.count();
    const audits = await db.auditEvent.count();
    const recentEvents = await db.analyticsEvent.count({ where: { occurredAt: { gte: new Date(Date.now() - DAY) } } });

    const r = await app.get(RetentionService).purge();
    expect(r.analyticsEvents).toBe(1);
    expect(r.securityEvents).toBe(1);
    expect(await db.securityEvent.count({ where: { type: 'prueba.abierta' } })).toBe(1); // lo no resuelto se conserva
    expect(await db.ledgerEntry.count()).toBe(entries);
    expect(await db.auditEvent.count()).toBe(audits);
    expect(await db.analyticsEvent.count({ where: { occurredAt: { gte: new Date(Date.now() - DAY) } } })).toBe(recentEvents);
    expect((await app.get(RetentionService).purge()).analyticsEvents).toBe(0);
  });
});
