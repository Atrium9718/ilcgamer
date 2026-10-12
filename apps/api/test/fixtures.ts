import { type CampaignDraft, CHECKLIST_KEYS, type Role } from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { browser } from './helpers.ts';

export const DAY = 86_400_000;
export const fullChecklist = Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, true]));

export function draft(overrides: Partial<CampaignDraft> = {}): CampaignDraft {
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

/** Persona con cuenta ACTIVA, roles y sesión real (misma cookie que el login por código). */
export async function person(app: NestFastifyApplication, db: PrismaClient, roles: Role[] = [], alias = roles[0] ?? 'Jugador') {
  const user = await db.user.create({
    data: { alias: alias.slice(0, 20), status: 'ACTIVA', ageVerifiedAt: new Date(), roles: { create: roles.map((role) => ({ role })) } },
  });
  const b = browser(app);
  const { AuthSessionService } = await import('../src/identity/auth-session.service.ts');
  const fakeReply = { setCookie: (name: string, value: string) => b.jar.set(name, value) } as never;
  await app.get(AuthSessionService).create(user.id, fakeReply);
  return Object.assign(b, { user });
}

/** Publica una campaña activa recorriendo el flujo editorial real (editor → revisores → admin). */
export async function publishedCampaign(app: NestFastifyApplication, db: PrismaClient, slug = 'feria', d = draft(), route = 'A_COMERCIAL') {
  const editor = await person(app, db, ['EDITOR_CONTENIDO'], 'Editor');
  const marca = await person(app, db, ['REVISOR_MARCA'], 'Rev marca');
  const juridica = await person(app, db, ['REVISOR_JURIDICO'], 'Rev jurídica');
  const admin = await person(app, db, ['ADMIN_MARCA'], 'Admin');
  await editor.request('POST', '/admin/campaigns', { slug, route, draft: d });
  await editor.request('POST', `/admin/campaigns/${slug}/submit`);
  await marca.request('POST', `/admin/campaigns/${slug}/approvals`, { kind: 'MARCA', decision: 'APROBADO' });
  await juridica.request('POST', `/admin/campaigns/${slug}/approvals`, { kind: 'JURIDICA', decision: 'APROBADO' });
  const res = await admin.request('POST', `/admin/campaigns/${slug}/publish`, { checklist: fullChecklist });
  if (res.statusCode !== 200) throw new Error(`No se pudo publicar: ${res.body}`);
  return admin;
}

export async function seedBrands(db: PrismaClient) {
  for (const [slug, name] of [
    ['ilc', 'Industria Licorera de Caldas'],
    ['ron-viejo-de-caldas', 'Ron Viejo de Caldas'],
    ['aguardiente-amarillo', 'Aguardiente Amarillo de Manzanares'],
  ] as const) {
    await db.brand.create({ data: { slug, name, themeId: slug } });
  }
}

/** Catálogo + lote generado por TI y vinculado a una campaña publicada. Devuelve los tokens en claro. */
export async function claimableCodes(app: NestFastifyApplication, db: PrismaClient, count = 1, d = draft(), route = 'A_COMERCIAL', slug = 'feria') {
  const brandAdmin = await person(app, db, ['ADMIN_MARCA'], 'Marca');
  const ti = await person(app, db, ['SUPERADMIN'], 'TI');
  if (!(await db.product.findUnique({ where: { sku: 'RVC-8' } }))) {
    await brandAdmin.request('POST', '/admin/smarttags/products', { sku: 'RVC-8', name: 'Ron Viejo de Caldas 8 años', brandSlug: 'ron-viejo-de-caldas' });
  }
  const label = `L${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const res = await ti.request('POST', '/admin/smarttags/generate', { sku: 'RVC-8', batchLabel: label, count });
  const tokens = res.body
    .trim()
    .split('\r\n')
    .slice(1)
    .map((l) => l.split(',')[0] as string);
  const batch = await db.batch.findFirstOrThrow({ where: { label } });
  await publishedCampaign(app, db, slug, d, route);
  const linked = await brandAdmin.request('POST', `/admin/smarttags/batches/${batch.id}/link`, { campaignSlug: slug });
  if (linked.statusCode !== 200) throw new Error(`No se pudo vincular: ${linked.body}`);
  return { tokens, batch, brandAdmin, ti };
}

export const claimCode = (who: { request: ReturnType<typeof browser>['request'] }, token: string, key = crypto.randomUUID().replaceAll('-', '')) =>
  who.request('POST', `/campaign-codes/${token}/claim`, undefined, { 'idempotency-key': key });
