import {
  AdminRewardClaimSchema,
  ApiErrorSchema,
  ClaimResultSchema,
  DealerDashboardSchema,
  PublicVenueSchema,
  RewardAdminViewSchema,
  RewardClaimResultSchema,
  StaffDashboardSchema,
  VenueAdminViewSchema,
} from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hmac } from '../src/common/crypto.ts';
import { ENV } from '../src/config/config.module.ts';
import type { Env } from '../src/config/env.ts';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { RedisService } from '../src/redis/redis.service.ts';
import { claimableCodes, DAY, person, seedBrands } from './fixtures.ts';
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
const venueView = (r: Res) => VenueAdminViewSchema.parse(r.json());
let n = 0;
const idem = () => `v${Date.now().toString(36)}${(n++).toString(36)}`.padEnd(20, 'x');

/** Una persona con cuenta por correo (como si ya hubiera ingresado una vez). */
async function withEmail(email: string, alias: string): Promise<Person> {
  const p = await person(app, db, [], alias);
  const subject = hmac(app.get<Env>(ENV).APP_SECRET, `email:${email}`);
  await db.identityCredential.create({ data: { userId: p.user.id, provider: 'otp:email', subject } });
  return p;
}

async function setup() {
  const admin = await person(app, db, ['ADMIN_MARCA'], 'Admin');
  const venue = venueView(
    await admin.request('POST', '/admin/venues', { name: 'Bar de prueba', channel: 'ON_PREMISE', city: 'Manizales', department: 'Caldas' }),
  );
  const staff = await withEmail('staff@ilc.test', 'Mesera');
  const dealer = await withEmail('dealer@ilc.test', 'Dueño');
  return { admin, venue, staff, dealer };
}
async function approvedVenue() {
  const s = await setup();
  await s.admin.request('POST', `/admin/venues/${s.venue.id}/approve`);
  const added = venueView(await s.admin.request('POST', `/admin/venues/${s.venue.id}/personnel`, { email: 'Staff@ILC.test', role: 'STAFF' }));
  await s.admin.request('POST', `/admin/venues/${s.venue.id}/personnel`, { email: 'dealer@ilc.test', role: 'DEALER' });
  const code = added.personnel.find((p) => p.role === 'STAFF')?.code as string;
  return { ...s, code };
}

describe('establecimientos y personal (Instrucciones §3.3-§3.5)', () => {
  it('nace pendiente; se aprueba y se suspende con motivo; solo Marca y TI administran', async () => {
    const { admin, venue } = await setup();
    expect(venue.status).toBe('PENDIENTE');
    const player = await person(app, db);
    expect((await player.request('GET', '/admin/venues')).statusCode).toBe(403);
    expect(
      (await (await person(app, db, ['EDITOR_CONTENIDO'])).request('POST', '/admin/venues', { name: 'X', channel: 'ON_PREMISE', city: 'Y', department: 'Z' }))
        .statusCode,
    ).toBe(403);
    expect(venueView(await admin.request('POST', `/admin/venues/${venue.id}/approve`)).status).toBe('APROBADO');
    expect(err(await admin.request('POST', `/admin/venues/${venue.id}/suspend`, { reason: 'x' })).fields).toBeDefined();
    expect(venueView(await admin.request('POST', `/admin/venues/${venue.id}/suspend`, { reason: 'Incumplió las condiciones' })).status).toBe('SUSPENDIDO');
    expect(await db.auditEvent.count({ where: { action: { in: ['venue.created', 'venue.approved', 'venue.suspended'] } } })).toBe(3);
  });

  it('agrega Staff y Dealer por correo, entrega un código de Staff y rechaza correos sin cuenta', async () => {
    const { admin, venue, staff, dealer } = await setup();
    const add = (email: string, role: string) => admin.request('POST', `/admin/venues/${venue.id}/personnel`, { email, role });
    expect(err(await add('nadie@ilc.test', 'STAFF')).code).toBe('NOT_FOUND');
    const v = venueView(await add('Staff@ILC.test', 'STAFF'));
    const s = v.personnel.find((p) => p.userId === staff.user.id);
    expect(s).toMatchObject({ role: 'STAFF', active: true });
    expect(s?.code).toMatch(/^[0-9A-Z]{8}$/);
    expect(venueView(await add('dealer@ilc.test', 'DEALER')).personnel.find((p) => p.userId === dealer.user.id)?.role).toBe('DEALER');
    expect((await add('staff@ilc.test', 'STAFF')).statusCode).toBe(200); // repetir no duplica
    const other = venueView(
      await admin.request('POST', '/admin/venues', { name: 'Otro bar', channel: 'ON_PREMISE', city: 'Pereira', department: 'Risaralda' }),
    );
    expect(err(await admin.request('POST', `/admin/venues/${other.id}/personnel`, { email: 'staff@ilc.test', role: 'STAFF' })).code).toBe('CONFLICT');
    const removed = venueView(await admin.request('DELETE', `/admin/venues/${venue.id}/personnel/${staff.user.id}`));
    expect(removed.personnel.find((p) => p.userId === staff.user.id)).toMatchObject({ active: false });
    expect((await staff.request('GET', '/staff/me')).statusCode).toBe(403);
  });
});

describe('vinculación de la botella al Staff', () => {
  it('el código de Staff en la activación acredita al Staff y lo ve en su panel sin datos de la persona', async () => {
    const { tokens } = await claimableCodes(app, db, 3);
    const { staff, code } = await approvedVenue();
    const player = await person(app, db);
    const res = await player.request('POST', `/campaign-codes/${tokens[0]}/claim`, { staffCode: code }, { 'idempotency-key': idem() });
    ClaimResultSchema.parse(res.json());
    expect((await db.claim.findFirstOrThrow()).staffUserId).toBe(staff.user.id);
    const dash = StaffDashboardSchema.parse((await staff.request('GET', '/staff/me')).json());
    expect(dash).toMatchObject({
      code,
      qrPath: `/s/${code}`,
      venue: { name: 'Bar de prueba', city: 'Manizales' },
      counts: { today: 1, week: 1 },
      weeklyGoal: 40,
    });
    expect(dash.recent[0]).toMatchObject({ campaignTitle: 'Feria de Manizales', tableName: null });
    expect(JSON.stringify(dash)).not.toContain(player.user.id);
  });

  it('un código inválido, de un local sin aprobar o el propio no bloquea la activación ni acredita a nadie', async () => {
    const { tokens } = await claimableCodes(app, db, 3);
    const s = await setup();
    const added = venueView(await s.admin.request('POST', `/admin/venues/${s.venue.id}/personnel`, { email: 'staff@ilc.test', role: 'STAFF' }));
    const pendingCode = added.personnel[0]?.code as string;
    const player = await person(app, db);
    expect((await player.request('POST', `/campaign-codes/${tokens[0]}/claim`, { staffCode: 'ZZZZZZZZ' }, { 'idempotency-key': idem() })).statusCode).toBe(200);
    expect((await player.request('POST', `/campaign-codes/${tokens[1]}/claim`, { staffCode: pendingCode }, { 'idempotency-key': idem() })).statusCode).toBe(
      200,
    );
    // El propio Staff no se acredita a sí mismo.
    await s.admin.request('POST', `/admin/venues/${s.venue.id}/approve`);
    expect((await s.staff.request('POST', `/campaign-codes/${tokens[2]}/claim`, { staffCode: pendingCode }, { 'idempotency-key': idem() })).statusCode).toBe(
      200,
    );
    expect((await db.claim.findMany()).every((c) => c.staffUserId === null)).toBe(true);
  });

  it('dentro de un Parche, la activación con código de Staff liga el Parche al establecimiento', async () => {
    const { tokens } = await claimableCodes(app, db, 3);
    const { code, venue } = await approvedVenue();
    const ana = await person(app, db);
    const first = ClaimResultSchema.parse((await ana.request('POST', `/campaign-codes/${tokens[0]}/claim`, {}, { 'idempotency-key': idem() })).json());
    const session = (await ana.request('POST', '/sessions', { name: 'Mesa 4', alias: 'Ana', claimId: first.claimId })).json() as { id: string };
    await ana.request('POST', `/campaign-codes/${tokens[1]}/claim`, { sessionId: session.id, staffCode: code }, { 'idempotency-key': idem() });
    expect((await db.session.findUniqueOrThrow({ where: { id: session.id } })).venueId).toBe(venue.id);
    const claim = await db.claim.findFirstOrThrow({ where: { sessionId: session.id } });
    expect(claim.staffUserId).not.toBeNull();
  });
});

describe('panel del comercio (solo su establecimiento, en agregado)', () => {
  it('cuenta activaciones por día, da su posición en la ciudad sin nombrar a otros y respeta el perfil público', async () => {
    const { tokens } = await claimableCodes(app, db, 5);
    const { admin, dealer, code, venue } = await approvedVenue();
    // Un segundo local de la misma ciudad con más activaciones.
    const rival = venueView(await admin.request('POST', '/admin/venues', { name: 'Rival', channel: 'ON_PREMISE', city: 'Manizales', department: 'Caldas' }));
    await admin.request('POST', `/admin/venues/${rival.id}/approve`);
    const rivalStaff = await withEmail('rival@ilc.test', 'Rival staff');
    const rv = venueView(await admin.request('POST', `/admin/venues/${rival.id}/personnel`, { email: 'rival@ilc.test', role: 'STAFF' }));
    const rivalCode = rv.personnel.find((p) => p.userId === rivalStaff.user.id)?.code as string;
    const players = await Promise.all([person(app, db), person(app, db), person(app, db), person(app, db), person(app, db)]);
    await players[0]?.request('POST', `/campaign-codes/${tokens[0]}/claim`, { staffCode: code }, { 'idempotency-key': idem() });
    await players[1]?.request('POST', `/campaign-codes/${tokens[1]}/claim`, { staffCode: rivalCode }, { 'idempotency-key': idem() });
    await players[2]?.request('POST', `/campaign-codes/${tokens[2]}/claim`, { staffCode: rivalCode }, { 'idempotency-key': idem() });
    await players[4]?.request('POST', `/campaign-codes/${tokens[4]}/claim`, { staffCode: rivalCode }, { 'idempotency-key': idem() });
    const old = await players[3]?.request('POST', `/campaign-codes/${tokens[3]}/claim`, { staffCode: code }, { 'idempotency-key': idem() });
    ClaimResultSchema.parse(old?.json());
    const oldClaim = await db.claim.findFirstOrThrow({ where: { campaignCode: { codeHint: { not: '' } } }, orderBy: { createdAt: 'desc' } });
    await db.$executeRaw`UPDATE claims SET "createdAt" = ${new Date(Date.now() - 10 * DAY)} WHERE id = ${oldClaim.id}::uuid`;

    const dash = DealerDashboardSchema.parse((await dealer.request('GET', '/dealer/me')).json());
    expect(dash.venue).toMatchObject({ id: venue.id, name: 'Bar de prueba' });
    expect(dash.counts).toEqual({ today: 1, week: 1, month: 2 });
    expect(dash.series).toHaveLength(14);
    expect(dash.series.at(-1)?.count).toBe(1);
    expect(dash.rank).toEqual({ position: 2, total: 2, city: 'Manizales' });
    expect(JSON.stringify(dash)).not.toContain('Rival');
    // Otro comercio no ve el panel de este, y un Staff no es Dealer.
    expect((await rivalStaff.request('GET', '/dealer/me')).statusCode).toBe(403);

    expect(
      (
        await dealer.request('PUT', '/dealer/me/profile', {
          description: 'Bar cultural',
          hours: 'Mar a sáb 6 p. m. – 2 a. m.',
          address: 'Cra 23 # 10-20',
          listed: true,
        })
      ).statusCode,
    ).toBe(200);
    const dir = PublicVenueSchema.array().parse((await (await person(app, db)).request('GET', '/venues')).json());
    expect(dir.map((v) => v.name)).toEqual(['Bar de prueba']);
    expect(dir[0]).toMatchObject({ hours: 'Mar a sáb 6 p. m. – 2 a. m.', description: 'Bar cultural' });
    // Suspender lo saca del directorio al instante.
    await admin.request('POST', `/admin/venues/${venue.id}/suspend`, { reason: 'Revisión de cumplimiento' });
    expect(PublicVenueSchema.array().parse((await (await person(app, db)).request('GET', '/venues')).json())).toEqual([]);
    expect((await dealer.request('PUT', '/dealer/me/profile', { listed: true })).statusCode).toBe(409);
  });
});

describe('entrega de recompensas desde el establecimiento', () => {
  async function claimedReward(city: string) {
    const admin = await person(app, db, ['ADMIN_MARCA'], 'Admin2');
    const ti = await person(app, db, ['SUPERADMIN'], 'TI');
    const body = {
      slug: 'gorra-ilc',
      name: 'Gorra ILC',
      type: 'MERCHANDISING',
      cost: 100,
      conditions: ['Retiro en punto aliado'],
      startsAt: new Date(Date.now() - DAY).toISOString(),
      endsAt: new Date(Date.now() + 30 * DAY).toISOString(),
      fulfillment: 'Trade',
      zones: [{ zone: city, available: 3, lowStockAlert: 1 }],
    };
    const reward = RewardAdminViewSchema.parse((await admin.request('POST', '/admin/rewards', body)).json());
    await ti.request('POST', `/admin/rewards/${reward.id}/activate`);
    const player = await person(app, db);
    const acc = await db.ledgerAccount.create({ data: { ownerType: 'USUARIO', userId: player.user.id, balance: 100 } });
    await db.ledgerEntry.create({ data: { accountId: acc.id, type: 'CREDITO', amount: 100, sourceType: 'prueba', idempotencyKey: `s-${player.user.id}` } });
    const res = RewardClaimResultSchema.parse(
      (await player.request('POST', `/rewards/${reward.id}/claim`, { zone: city }, { 'idempotency-key': idem() })).json(),
    );
    return res.code;
  }

  it('Staff y Dealer entregan solo en su ciudad y con el local aprobado', async () => {
    const { staff, dealer } = await approvedVenue();
    const wrongCity = await claimedReward('Pereira');
    expect(err(await staff.request('POST', '/admin/rewards/claims/deliver', { code: wrongCity })).code).toBe('FORBIDDEN');
    expect(err(await dealer.request('POST', '/admin/rewards/claims/deliver', { code: wrongCity })).code).toBe('FORBIDDEN');
  });

  it('entrega de su ciudad: la hace el Staff, queda el establecimiento en auditoría y no se repite', async () => {
    const { staff, dealer, venue } = await approvedVenue();
    const code = await claimedReward('Manizales');
    const ok = AdminRewardClaimSchema.parse((await staff.request('POST', '/admin/rewards/claims/deliver', { code })).json());
    expect(ok.status).toBe('ENTREGADO');
    const ev = await db.auditEvent.findFirstOrThrow({ where: { action: 'reward.delivered' } });
    expect((ev.metadata as { venueId: string }).venueId).toBe(venue.id);
    expect(err(await dealer.request('POST', '/admin/rewards/claims/deliver', { code })).code).toBe('CONFLICT');
    // Staff y Dealer no administran el catálogo ni ven todos los canjes.
    expect((await staff.request('GET', '/admin/rewards/claims')).statusCode).toBe(403);
    expect((await dealer.request('POST', '/admin/rewards', {})).statusCode).toBe(403);
  });

  it('un local suspendido no entrega', async () => {
    const { staff, admin, venue } = await approvedVenue();
    const code = await claimedReward('Manizales');
    await admin.request('POST', `/admin/venues/${venue.id}/suspend`, { reason: 'Revisión de cumplimiento' });
    expect(err(await staff.request('POST', '/admin/rewards/claims/deliver', { code })).code).toBe('FORBIDDEN');
  });
});
