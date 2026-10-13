import { type CampaignDraft, CHECKLIST_KEYS, GameManifestSchema, type Role, requiredModuleApprovals } from '@ilc/contracts';
import { createApp } from './bootstrap.ts';
import { CampaignsService } from './campaigns/campaigns.service.ts';
import { SmartTagsAdminService } from './codes/smarttags-admin.service.ts';
import { hmac } from './common/crypto.ts';
import { DomainError } from './common/domain-error.ts';
import { ENV } from './config/config.module.ts';
import { type Env, separationOfDutiesApplies } from './config/env.ts';
import { DEMO_MANIFESTS } from './demo/manifests.ts';
import { ProgressService } from './economy/progress.service.ts';
import { ModulesService } from './games/modules.service.ts';
import { normalizeDestination } from './identity/destination.ts';
import { PrismaService } from './prisma/prisma.service.ts';
import { RewardsService } from './rewards/rewards.service.ts';

/**
 * Datos de DEMOSTRACIÓN para un staging (contenido de prueba, no de marca): 3 juegos aprobados y activos, una campaña
 * mixta publicada con su producto y lote de códigos, y recompensas activas. Pasa por los servicios reales (validación y
 * auditoría), como lo haría una persona desde la consola. Es idempotente: lo que ya existe se omite.
 *   node dist/seed-demo.js --as andresepulveda718@gmail.com
 * Exige que la cuenta ya tenga el rol SUPERADMIN (admin-grant) y la excepción de staging de separación de funciones.
 */
const argv = process.argv.slice(2);
const asIndex = argv.indexOf('--as');
const email = normalizeDestination('email', asIndex >= 0 ? (argv[asIndex + 1] ?? '') : '');

const app = await createApp({ logger: false });
await app.init();
const env = app.get<Env>(ENV);
const prisma = app.get(PrismaService);

if (separationOfDutiesApplies(env)) {
  console.error('Este seed usa una sola cuenta para crear y aprobar: exige STAGING_RELAX_SEPARATION_ACK (solo staging).');
  process.exit(1);
}
const user = await prisma.user.findFirst({
  where: { credentials: { some: { provider: 'otp:email', subject: hmac(env.APP_SECRET, `email:${email}`) } } },
  include: { roles: true },
});
if (!user) throw new Error('No existe esa cuenta. Ejecuta antes admin-grant.');
const roles = user.roles.map((r) => r.role as Role);
if (!roles.includes('SUPERADMIN')) throw new Error('La cuenta necesita el rol SUPERADMIN (admin-grant).');
const actor = { userId: user.id, alias: user.alias, roles: roles.includes('ADMIN_MARCA') ? roles : [...roles, 'ADMIN_MARCA' as Role], requestId: 'seed-demo' };

const modules = app.get(ModulesService);
const campaigns = app.get(CampaignsService);
const rewards = app.get(RewardsService);
const progress = app.get(ProgressService);
const smart = app.get(SmartTagsAdminService);

/** Ejecuta un paso y tolera que ya exista (idempotencia). */
async function step<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const out = await fn();
    console.log(`  ✓ ${label}`);
    return out;
  } catch (err) {
    if (err instanceof DomainError && (err.code === 'CONFLICT' || err.code === 'VALIDATION_FAILED')) {
      console.log(`  · ${label}: ${err.message}`);
      return undefined;
    }
    throw err;
  }
}

const DAY = 86_400_000;
console.log('1/5 Insignia y juegos');
await step('insignia explorador-de-ejemplo', () => progress.createBadge(actor, { slug: 'explorador-de-ejemplo', name: 'Explorador', icon: 'explore' }));
for (const raw of DEMO_MANIFESTS) {
  const m = GameManifestSchema.parse(raw);
  const existing = await prisma.moduleVersion.findFirst({ where: { version: m.version, module: { slug: m.moduleId } } });
  if (existing?.status === 'ACTIVO') {
    console.log(`  · ${m.moduleId} ya está activo`);
    continue;
  }
  if (!existing) await step(`registrar ${m.moduleId}`, () => modules.register(actor, raw));
  await step(`probar ${m.moduleId}`, () => modules.toTest(actor, m.moduleId, m.version));
  for (const kind of requiredModuleApprovals(m))
    await step(`aprobar ${m.moduleId} (${kind})`, () => modules.decide(actor, m.moduleId, m.version, { kind, decision: 'APROBADO' }));
  await step(`activar ${m.moduleId}`, () => modules.activate(actor, m.moduleId, m.version));
}

console.log('2/5 Producto y códigos de demostración');
const SKU = 'DEMO-001';
if (!(await prisma.product.findUnique({ where: { sku: SKU } }))) {
  await smart.createProduct(actor, { sku: SKU, name: 'Producto de demostración', brandSlug: 'ron-viejo-de-caldas' });
  console.log('  ✓ producto DEMO-001');
}
const label = 'DEMO-1';
const product = await prisma.product.findUniqueOrThrow({ where: { sku: SKU } });
const existingBatch = await prisma.batch.findFirst({ where: { productId: product.id, label } });
let tokens: string[] = [];
if (!existingBatch) {
  const res = await smart.generate(actor, { sku: SKU, batchLabel: label, count: 10 });
  tokens = res.csv
    .trim()
    .split('\r\n')
    .slice(1)
    .map((l) => l.split(',')[0] as string);
  console.log('  ✓ lote DEMO-1 con 10 códigos');
}

console.log('3/5 Campaña mixta de demostración');
const SLUG = 'origen-demo';
const draft: CampaignDraft = {
  internalName: 'Origen ILC — demostración',
  publicTitle: 'Origen ILC (demo)',
  publicDescription: 'Campaña de demostración con contenido de prueba para mostrar la plataforma.',
  objective: 'Mostrar el recorrido completo de la plataforma en staging',
  kpi: 'Activaciones y misiones completadas de prueba',
  ownerTeam: 'Equipo de demostración',
  brandSlugs: ['ron-viejo-de-caldas'],
  channels: ['DIGITAL'],
  territories: ['Caldas'],
  minAge: 18,
  startsAt: new Date(Date.now() - DAY).toISOString(),
  endsAt: new Date(Date.now() + 90 * DAY).toISOString(),
  terms: 'Condiciones de prueba. Contenido de demostración, sin validez comercial.',
  rules: { pointsBySku: { [SKU]: 500 }, multipliers: [], energyMinutes: 45, sessionEndsAtLocalTime: '06:00', limits: { activationsPerUserPerDay: 10 } },
  theme: { mode: 'dark', brand: 'ron-viejo-de-caldas' },
  dataUsage: { location: false, extraData: false },
  modules: DEMO_MANIFESTS.map((m) => (m as { moduleId: string }).moduleId),
};
const camp = await prisma.campaign.findUnique({ where: { slug: SLUG } });
if (!camp) {
  await step('crear campaña', () => campaigns.create(actor, { slug: SLUG, route: 'MIXTA', draft }));
  await step('enviar a revisión', () => campaigns.submit(actor, SLUG));
  for (const kind of ['MARCA', 'JURIDICA', 'PRIVACIDAD', 'TI'] as const)
    await step(`aprobar campaña (${kind})`, () => campaigns.decide(actor, SLUG, { kind, decision: 'APROBADO' }));
  await step('publicar', () => campaigns.publish(actor, SLUG, Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, true]))));
} else console.log('  · la campaña ya existe');
const batch = await prisma.batch.findFirst({ where: { productId: product.id, label } });
if (batch) await step('vincular lote a la campaña', () => smart.linkBatch(actor, batch.id, SLUG));

console.log('4/5 Recompensas');
const REWARDS = [
  {
    slug: 'fondo-de-pantalla-origen',
    name: 'Fondo de pantalla Origen',
    description: 'Descarga digital de prueba.',
    type: 'DIGITAL' as const,
    icon: 'wallpaper',
    cost: 200,
    maxPerUser: 1,
    zones: [{ zone: 'Nacional', available: 100, lowStockAlert: 10 }],
  },
  {
    slug: 'gorra-ilc-demo',
    name: 'Gorra ILC (demo)',
    description: 'Artículo de prueba, se retira en el punto de entrega.',
    type: 'MERCHANDISING' as const,
    icon: 'redeem',
    cost: 800,
    maxPerUser: 1,
    zones: [{ zone: 'Manizales', available: 20, lowStockAlert: 3 }],
  },
];
for (const r of REWARDS) {
  if (await prisma.reward.findUnique({ where: { slug: r.slug } })) {
    console.log(`  · ${r.slug} ya existe`);
    continue;
  }
  const created = await rewards.create(actor, {
    ...r,
    conditions: ['Contenido de demostración, sin valor comercial', 'Se entrega una sola vez por persona'],
    startsAt: new Date(Date.now() - DAY).toISOString(),
    endsAt: new Date(Date.now() + 90 * DAY).toISOString(),
    fulfillment: 'Equipo de demostración',
    campaignSlug: SLUG,
  });
  await step(`activar ${r.slug}`, () => rewards.setActive(actor, created.id, true));
}

console.log('5/5 Listo');
if (tokens.length) {
  const domain = process.env.APP_DOMAIN ?? 'APP_DOMAIN';
  console.log('\nCódigos de demostración (cada uno se activa una sola vez):');
  for (const t of tokens) console.log(`  https://${domain}/v/${t}`);
} else console.log('Los códigos del lote ya se generaron antes (no se vuelven a mostrar).');
await app.close();
