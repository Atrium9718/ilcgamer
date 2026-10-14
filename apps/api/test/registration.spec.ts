import { ApiErrorSchema } from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
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

const body = (over: Record<string, unknown> = {}) => ({
  fullName: 'Ana María Gómez',
  email: 'Ana@Ejemplo.test',
  phone: '300 111 2233',
  noticeVersion: '1.0',
  acceptDataTreatment: true,
  acceptMarketing: true,
  ...over,
});

describe('registro al entrar y panel de registros', () => {
  it('guarda nombre, correo y celular normalizados, registra las dos autorizaciones por separado y aparece en el panel', async () => {
    const p = await person(app, db, [], 'Visitante');
    const res = await p.request('POST', '/me/profile', body());
    expect(res.statusCode, res.body).toBe(200);
    const pii = await db.userPii.findUniqueOrThrow({ where: { userId: p.user.id } });
    expect(pii).toMatchObject({ fullName: 'Ana María Gómez', email: 'ana@ejemplo.test', phone: '+573001112233' });
    const consents = await db.consentRecord.findMany({ where: { userId: p.user.id }, orderBy: { createdAt: 'asc' } });
    expect(consents.map((c) => [c.purpose, c.granted, c.source])).toEqual([
      ['TERMINOS_Y_PRIVACIDAD', true, 'registro'],
      ['MARKETING', true, 'registro'],
    ]);

    const q = await person(app, db, [], 'Otro');
    await q.request('POST', '/me/profile', body({ fullName: 'Beto Ruiz', email: 'beto@ejemplo.test', phone: '3009998877', acceptMarketing: false }));

    const admin = await person(app, db, ['ADMIN_MARCA'], 'Admin');
    const dash = (await admin.request('GET', '/admin/contacts/registrations?days=7')).json() as {
      summary: { total: number; withMarketing: number; withEmail: number; withPhone: number; today: number };
      byDay: Array<{ count: number }>;
      rows: Array<{ fullName: string; marketing: boolean }>;
    };
    expect(dash.summary).toMatchObject({ total: 2, withMarketing: 1, withEmail: 2, withPhone: 2, today: 2 });
    expect(dash.byDay).toHaveLength(7);
    expect(dash.rows.map((r) => [r.fullName, r.marketing]).sort()).toEqual([
      ['Ana María Gómez', true],
      ['Beto Ruiz', false],
    ]);
    expect(await db.auditEvent.count({ where: { action: 'contacts.registrations_listed' } })).toBe(1);
    expect((await p.request('GET', '/admin/contacts/registrations')).statusCode).toBe(403);
  });

  it('exige autorizar el tratamiento de datos, datos válidos, la versión vigente y no repite correo o celular de otra persona', async () => {
    const p = await person(app, db, [], 'Visitante');
    expect((await p.request('POST', '/me/profile', body({ acceptDataTreatment: false }))).statusCode).toBe(400);
    expect((await p.request('POST', '/me/profile', body({ email: 'no-es-correo' }))).statusCode).toBe(400);
    expect((await p.request('POST', '/me/profile', body({ phone: '12345' }))).statusCode).toBe(400);
    expect((await p.request('POST', '/me/profile', body({ noticeVersion: '9.9' }))).statusCode).toBe(409);
    expect(await db.consentRecord.count()).toBe(0);

    expect((await p.request('POST', '/me/profile', body())).statusCode).toBe(200);
    const q = await person(app, db, [], 'Otro');
    const dup = await q.request('POST', '/me/profile', body({ fullName: 'Otra Persona' }));
    expect(dup.statusCode).toBe(409);
    expect(ApiErrorSchema.parse(dup.json()).error.code).toBe('CONFLICT');
    // La misma persona puede corregir sus datos
    expect((await p.request('POST', '/me/profile', body({ fullName: 'Ana M. Gómez' }))).statusCode).toBe(200);
    expect((await db.userPii.findUniqueOrThrow({ where: { userId: p.user.id } })).fullName).toBe('Ana M. Gómez');
  });

  it('quien elimina su cuenta sale del panel', async () => {
    const p = await person(app, db, [], 'Visitante');
    await p.request('POST', '/me/profile', body());
    await db.user.update({ where: { id: p.user.id }, data: { status: 'ELIMINADA', deletedAt: new Date() } });
    const admin = await person(app, db, ['ADMIN_MARCA'], 'Admin');
    const dash = (await admin.request('GET', '/admin/contacts/registrations')).json() as { summary: { total: number } };
    expect(dash.summary.total).toBe(0);
  });
});
