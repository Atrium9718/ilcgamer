import { ApiErrorSchema, type CampaignDraft, CampaignViewSchema, CHECKLIST_KEYS, type Role } from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CampaignsService } from '../src/campaigns/campaigns.service.ts';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { RedisService } from '../src/redis/redis.service.ts';
import { browser, createTestApp, resetDatabase, testPrisma } from './helpers.ts';

let app: NestFastifyApplication;
let db: PrismaClient;
const DAY = 86_400_000;

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
});

const err = (res: { json: () => unknown }) => ApiErrorSchema.parse(res.json()).error;
const view = (res: { json: () => unknown }) => CampaignViewSchema.parse(res.json());
const fullChecklist = Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, true]));

function draft(overrides: Partial<CampaignDraft> = {}): CampaignDraft {
  return {
    internalName: 'Feria de Manizales 2027',
    publicTitle: 'Feria de Manizales',
    publicDescription: 'Descubre los secretos del origen en la feria.',
    objective: 'Activaciones comerciales válidas en bares aliados',
    kpi: 'Activaciones válidas por establecimiento',
    ownerTeam: 'Trade Marketing',
    brandSlugs: ['ron-viejo-de-caldas'],
    channels: ['ON_PREMISE'],
    territories: ['Caldas'],
    minAge: 18,
    startsAt: new Date(Date.now() - DAY).toISOString(),
    endsAt: new Date(Date.now() + 10 * DAY).toISOString(),
    terms: 'Términos de prueba.',
    rules: { pointsBySku: { 'RVC-8': 500 }, multipliers: [], energyMinutes: 45, sessionEndsAtLocalTime: '06:00', limits: { activationsPerUserPerDay: 3 } },
    theme: { mode: 'dark', brand: 'ron-viejo-de-caldas' },
    dataUsage: { location: false, extraData: false },
    ...overrides,
  };
}

/** Crea una persona de consola con roles y sesión (como si hubiera iniciado sesión). */
async function staff(roles: Role[], alias = roles[0] ?? 'Equipo') {
  const user = await db.user.create({
    data: { alias: alias.slice(0, 20), status: 'ACTIVA', ageVerifiedAt: new Date(), roles: { create: roles.map((role) => ({ role })) } },
  });
  const b = browser(app);
  // Sesión real a través del servicio de sesiones (misma cookie que el login por código).
  const { AuthSessionService } = await import('../src/identity/auth-session.service.ts');
  const sessions = app.get(AuthSessionService);
  const fakeReply = { setCookie: (name: string, value: string) => b.jar.set(name, value) } as never;
  await sessions.create(user.id, fakeReply);
  return Object.assign(b, { user });
}

async function team() {
  return {
    admin: await staff(['ADMIN_MARCA'], 'Laura'),
    editor: await staff(['EDITOR_CONTENIDO'], 'Editor'),
    marca: await staff(['REVISOR_MARCA'], 'Rev marca'),
    juridica: await staff(['REVISOR_JURIDICO'], 'Rev jurídica'),
    privacidad: await staff(['RESPONSABLE_PRIVACIDAD'], 'Privacidad'),
  };
}

async function approvedCampaign(t: Awaited<ReturnType<typeof team>>, d = draft()) {
  await t.editor.request('POST', '/admin/campaigns', { slug: 'feria', route: 'A_COMERCIAL', draft: d });
  await t.editor.request('POST', '/admin/campaigns/feria/submit');
  await t.marca.request('POST', '/admin/campaigns/feria/approvals', { kind: 'MARCA', decision: 'APROBADO' });
  return view(await t.juridica.request('POST', '/admin/campaigns/feria/approvals', { kind: 'JURIDICA', decision: 'APROBADO' }));
}

describe('permisos (RBAC, Guía Técnica §3.3, §14)', () => {
  it('un jugador o un visitante no accede a la consola', async () => {
    expect((await browser(app).request('GET', '/admin/campaigns')).statusCode).toBe(401);
    const player = browser(app);
    await player.request('POST', '/age-gate', { birthDate: '1990-01-01', declaration: true });
    expect(err(await player.request('GET', '/admin/campaigns')).code).toBe('FORBIDDEN');
  });

  it('un revisor puede leer pero no crear campañas; el editor no puede publicar', async () => {
    const t = await team();
    expect((await t.marca.request('GET', '/admin/campaigns')).statusCode).toBe(200);
    expect(err(await t.marca.request('POST', '/admin/campaigns', { slug: 'x-1', route: 'A_COMERCIAL', draft: draft() })).code).toBe('FORBIDDEN');
    await approvedCampaign(t);
    expect(err(await t.editor.request('POST', '/admin/campaigns/feria/publish', { checklist: fullChecklist })).code).toBe('FORBIDDEN');
  });
});

describe('flujo editorial completo (§5.3, §5.11, §16)', () => {
  it('borrador → revisión → aprobada → publicada (activa) con auditoría', async () => {
    const t = await team();
    const created = view(await t.editor.request('POST', '/admin/campaigns', { slug: 'feria', route: 'A_COMERCIAL', draft: draft() }));
    expect(created).toMatchObject({ status: 'BORRADOR', workingVersion: { version: 1, state: 'BORRADOR' } });

    const submitted = view(await t.editor.request('POST', '/admin/campaigns/feria/submit'));
    expect(submitted.status).toBe('EN_REVISION');
    expect(submitted.workingVersion.approvals.map((a) => [a.kind, a.status])).toEqual([
      ['MARCA', 'pending'],
      ['JURIDICA', 'pending'],
      ['PRIVACIDAD', 'not_required'],
    ]);
    expect(submitted.publish).toEqual({ allowed: false, missing: ['la versión no está aprobada', 'aprobación de Marca', 'aprobación de Jurídica'] });

    await t.marca.request('POST', '/admin/campaigns/feria/approvals', { kind: 'MARCA', decision: 'APROBADO', note: 'Tono y assets OK' });
    const approved = view(await t.juridica.request('POST', '/admin/campaigns/feria/approvals', { kind: 'JURIDICA', decision: 'APROBADO' }));
    expect(approved).toMatchObject({ status: 'APROBADA', workingVersion: { state: 'APROBADA' }, publish: { allowed: true, missing: [] } });
    expect(approved.workingVersion.approvals[0]).toMatchObject({ status: 'approved', byAlias: 'Rev marca', note: 'Tono y assets OK' });

    const published = view(await t.admin.request('POST', '/admin/campaigns/feria/publish', { checklist: fullChecklist }));
    expect(published).toMatchObject({ status: 'ACTIVA', activeVersion: 1, workingVersion: { state: 'PUBLICADA' } });

    const actions = (await db.auditEvent.findMany({ orderBy: { createdAt: 'asc' } })).map((a) => a.action);
    expect(actions).toEqual(['campaign.created', 'campaign.submitted', 'campaign.approved', 'campaign.approved', 'campaign.published']);
  });

  it('publicar exige el checklist completo e indica qué falta', async () => {
    const t = await team();
    await approvedCampaign(t);
    const partial = { ...fullChecklist } as Record<string, true>;
    delete partial.sinPresion;
    const res = await t.admin.request('POST', '/admin/campaigns/feria/publish', { checklist: partial });
    expect(err(res).message).toMatch(/checklist \(1 pendientes\)/);
  });

  it('no se puede publicar sin todas las aprobaciones', async () => {
    const t = await team();
    await t.editor.request('POST', '/admin/campaigns', { slug: 'feria', route: 'A_COMERCIAL', draft: draft() });
    await t.editor.request('POST', '/admin/campaigns/feria/submit');
    await t.marca.request('POST', '/admin/campaigns/feria/approvals', { kind: 'MARCA', decision: 'APROBADO' });
    const res = await t.admin.request('POST', '/admin/campaigns/feria/publish', { checklist: fullChecklist });
    expect(err(res).message).toMatch(/aprobación de Jurídica/);
  });

  it('con fecha de inicio futura queda PROGRAMADA y el programador la activa y luego la cierra', async () => {
    const t = await team();
    const start = new Date(Date.now() + 2 * DAY);
    await approvedCampaign(t, draft({ startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3 * DAY).toISOString() }));
    expect(view(await t.admin.request('POST', '/admin/campaigns/feria/publish', { checklist: fullChecklist })).status).toBe('PROGRAMADA');
    const service = app.get(CampaignsService);
    expect(await service.tick(new Date(start.getTime() + 1000))).toEqual({ activated: 1, closed: 0 });
    expect(await service.tick(new Date(start.getTime() + 4 * DAY))).toEqual({ activated: 0, closed: 1 });
    expect((await db.campaign.findUniqueOrThrow({ where: { slug: 'feria' } })).status).toBe('CERRADA');
  });
});

describe('aprobaciones ligadas a la versión exacta (§5.11)', () => {
  it('quien crea o envía la versión no puede aprobarla (separación de funciones)', async () => {
    const t = await team();
    const both = await staff(['EDITOR_CONTENIDO', 'REVISOR_MARCA'], 'Doble rol');
    await both.request('POST', '/admin/campaigns', { slug: 'feria', route: 'A_COMERCIAL', draft: draft() });
    await both.request('POST', '/admin/campaigns/feria/submit');
    const res = await both.request('POST', '/admin/campaigns/feria/approvals', { kind: 'MARCA', decision: 'APROBADO' });
    expect(err(res).message).toMatch(/no puede aprobarla/);
    void t;
  });

  it('cada revisor solo emite su tipo de aprobación', async () => {
    const t = await team();
    await t.editor.request('POST', '/admin/campaigns', { slug: 'feria', route: 'A_COMERCIAL', draft: draft() });
    await t.editor.request('POST', '/admin/campaigns/feria/submit');
    expect(err(await t.marca.request('POST', '/admin/campaigns/feria/approvals', { kind: 'JURIDICA', decision: 'APROBADO' })).code).toBe('FORBIDDEN');
  });

  it('un rechazo devuelve a borrador; al editar y reenviar, las aprobaciones previas ya no valen', async () => {
    const t = await team();
    await t.editor.request('POST', '/admin/campaigns', { slug: 'feria', route: 'A_COMERCIAL', draft: draft() });
    await t.editor.request('POST', '/admin/campaigns/feria/submit');
    await t.marca.request('POST', '/admin/campaigns/feria/approvals', { kind: 'MARCA', decision: 'APROBADO' });
    const rejected = view(
      await t.juridica.request('POST', '/admin/campaigns/feria/approvals', { kind: 'JURIDICA', decision: 'RECHAZADO', note: 'Ajustar términos' }),
    );
    expect(rejected).toMatchObject({ status: 'BORRADOR', workingVersion: { state: 'BORRADOR' } });

    await t.editor.request('PUT', '/admin/campaigns/feria/draft', draft({ terms: 'Términos corregidos.' }));
    const resubmitted = view(await t.editor.request('POST', '/admin/campaigns/feria/submit'));
    expect(resubmitted.workingVersion.approvals.find((a) => a.kind === 'MARCA')?.status).toBe('pending');
  });

  it('una versión en revisión no se puede editar', async () => {
    const t = await team();
    await t.editor.request('POST', '/admin/campaigns', { slug: 'feria', route: 'A_COMERCIAL', draft: draft() });
    await t.editor.request('POST', '/admin/campaigns/feria/submit');
    expect(err(await t.editor.request('PUT', '/admin/campaigns/feria/draft', draft({ terms: 'cambio' }))).code).toBe('CONFLICT');
  });

  it('si usa ubicación o datos adicionales, exige aprobación de Privacidad', async () => {
    const t = await team();
    await t.editor.request('POST', '/admin/campaigns', {
      slug: 'feria',
      route: 'A_COMERCIAL',
      draft: draft({ dataUsage: { location: true, extraData: false } }),
    });
    await t.editor.request('POST', '/admin/campaigns/feria/submit');
    await t.marca.request('POST', '/admin/campaigns/feria/approvals', { kind: 'MARCA', decision: 'APROBADO' });
    const afterLegal = view(await t.juridica.request('POST', '/admin/campaigns/feria/approvals', { kind: 'JURIDICA', decision: 'APROBADO' }));
    expect(afterLegal.status).toBe('EN_REVISION');
    const done = view(await t.privacidad.request('POST', '/admin/campaigns/feria/approvals', { kind: 'PRIVACIDAD', decision: 'APROBADO' }));
    expect(done.status).toBe('APROBADA');
  });
});

describe('versiones de una campaña en curso', () => {
  it('la versión publicada sigue vigente mientras la nueva se revisa; al publicar, la reemplaza', async () => {
    const t = await team();
    await approvedCampaign(t);
    await t.admin.request('POST', '/admin/campaigns/feria/publish', { checklist: fullChecklist });
    const v2 = view(await t.editor.request('POST', '/admin/campaigns/feria/versions'));
    expect(v2).toMatchObject({ status: 'ACTIVA', activeVersion: 1, workingVersion: { version: 2, state: 'BORRADOR' } });
    expect(err(await t.editor.request('POST', '/admin/campaigns/feria/versions')).code).toBe('CONFLICT');

    await t.editor.request('PUT', '/admin/campaigns/feria/draft', draft({ rules: { ...draft().rules, energyMinutes: 60 } }));
    await t.editor.request('POST', '/admin/campaigns/feria/submit');
    await t.marca.request('POST', '/admin/campaigns/feria/approvals', { kind: 'MARCA', decision: 'APROBADO' });
    await t.juridica.request('POST', '/admin/campaigns/feria/approvals', { kind: 'JURIDICA', decision: 'APROBADO' });
    expect((await browser(app).request('GET', '/campaigns/feria')).json()).toMatchObject({ energyMinutes: 45 });
    const published = view(await t.admin.request('POST', '/admin/campaigns/feria/publish', { checklist: fullChecklist }));
    expect(published).toMatchObject({ status: 'ACTIVA', activeVersion: 2 });
    expect((await browser(app).request('GET', '/campaigns/feria')).json()).toMatchObject({ energyMinutes: 60 });
    expect(published.versions.map((v) => [v.version, v.state])).toEqual([
      [2, 'PUBLICADA'],
      [1, 'REEMPLAZADA'],
    ]);
  });
});

describe('ciclo de vida y vista pública', () => {
  it('la vista pública solo muestra campañas activas, sin reglas internas', async () => {
    const t = await team();
    await approvedCampaign(t);
    expect((await browser(app).request('GET', '/campaigns/feria')).statusCode).toBe(404);
    await t.admin.request('POST', '/admin/campaigns/feria/publish', { checklist: fullChecklist });
    const pub = (await browser(app).request('GET', '/campaigns/feria')).json() as Record<string, unknown>;
    expect(pub).toMatchObject({ slug: 'feria', title: 'Feria de Manizales', theme: { brand: 'ron-viejo-de-caldas' }, minAge: 18 });
    expect(pub).not.toHaveProperty('rules');
    expect(JSON.stringify(pub)).not.toContain('Trade Marketing');

    await t.admin.request('POST', '/admin/campaigns/feria/pause');
    expect((await browser(app).request('GET', '/campaigns/feria')).statusCode).toBe(404);
    await t.admin.request('POST', '/admin/campaigns/feria/resume');
    expect((await browser(app).request('GET', '/campaigns/feria')).statusCode).toBe(200);
  });

  it('rechaza transiciones inválidas (p. ej. archivar una campaña activa)', async () => {
    const t = await team();
    await approvedCampaign(t);
    await t.admin.request('POST', '/admin/campaigns/feria/publish', { checklist: fullChecklist });
    expect(err(await t.admin.request('POST', '/admin/campaigns/feria/archive')).message).toMatch(/No se puede archivar una campaña en estado ACTIVA/);
    await t.admin.request('POST', '/admin/campaigns/feria/close');
    expect(view(await t.admin.request('POST', '/admin/campaigns/feria/archive')).status).toBe('ARCHIVADA');
  });

  it('las reglas con mecánicas no soportadas se rechazan al guardar', async () => {
    const t = await team();
    const bad = { ...draft(), rules: { ...draft().rules, rewardFastestRefill: true } };
    expect(err(await t.editor.request('POST', '/admin/campaigns', { slug: 'mala', route: 'A_COMERCIAL', draft: bad })).code).toBe('VALIDATION_FAILED');
  });

  it('la edad mínima de una campaña activa se aplica en el control de edad', async () => {
    const t = await team();
    await approvedCampaign(t, draft({ minAge: 21 }));
    await t.admin.request('POST', '/admin/campaigns/feria/publish', { checklist: fullChecklist });
    const nineteen = `${new Date().getFullYear() - 19}-01-01`;
    const res = await browser(app).request('POST', '/age-gate', { birthDate: nineteen, declaration: true, campaignSlug: 'feria' });
    expect(err(res).code).toBe('AGE_REQUIREMENT_NOT_MET');
  });
});

describe('inicio de sesión del personal de consola', () => {
  it('una cuenta existente inicia sesión por correo sin pasar el control de edad; una nueva no', async () => {
    const t = await team();
    void t;
    const { hmac } = await import('../src/common/crypto.ts');
    const laura = await db.user.findFirstOrThrow({ where: { alias: 'Laura' } });
    await db.identityCredential.create({
      data: { userId: laura.id, provider: 'otp:email', subject: hmac(process.env.APP_SECRET as string, 'email:laura@ilc.com.co') },
    });
    const b = browser(app);
    await b.request('POST', '/auth/otp/request', { channel: 'email', destination: 'laura@ilc.com.co' });
    const { OtpSender } = await import('../src/identity/otp-sender.ts');
    const code = (app.get(OtpSender) as unknown as { outbox: Map<string, string> }).outbox.get('laura@ilc.com.co');
    const me = (await b.request('POST', '/auth/otp/verify', { channel: 'email', destination: 'laura@ilc.com.co', code })).json() as { roles: string[] };
    expect(me.roles).toEqual(['ADMIN_MARCA']);
    expect((await b.request('GET', '/admin/campaigns')).statusCode).toBe(200);

    const stranger = browser(app);
    await stranger.request('POST', '/auth/otp/request', { channel: 'email', destination: 'nadie@ejemplo.com' });
    const strangerCode = (app.get(OtpSender) as unknown as { outbox: Map<string, string> }).outbox.get('nadie@ejemplo.com');
    expect(err(await stranger.request('POST', '/auth/otp/verify', { channel: 'email', destination: 'nadie@ejemplo.com', code: strangerCode })).code).toBe(
      'AGE_GATE_REQUIRED',
    );
  });
});
