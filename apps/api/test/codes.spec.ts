import { createHash, randomUUID } from 'node:crypto';
import { ApiErrorSchema, ClaimResultSchema, ImportPreviewSchema, ProductCodeLookupSchema } from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { maskUrl } from '../src/bootstrap.ts';
import { CampaignsService } from '../src/campaigns/campaigns.service.ts';
import { UNKNOWN_LOOKUPS_LIMIT } from '../src/codes/product-codes.service.ts';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { RedisService } from '../src/redis/redis.service.ts';
import { DAY, draft, person, publishedCampaign, seedBrands } from './fixtures.ts';
import { browser, createTestApp, resetDatabase, testPrisma } from './helpers.ts';

const INTEGRATION_KEY = 'clave-de-integracion-erp-de-prueba-0123456789';
let app: NestFastifyApplication;
let db: PrismaClient;

beforeAll(async () => {
  process.env.SMARTTAGS_INTEGRATION_KEY_HASHES = createHash('sha256').update(INTEGRATION_KEY).digest('hex');
  app = await createTestApp();
  db = testPrisma();
});
afterAll(async () => {
  delete process.env.SMARTTAGS_INTEGRATION_KEY_HASHES;
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

type Res = { statusCode: number; json: () => unknown; body: string; headers: Record<string, unknown> };
const err = (res: Res) => ApiErrorSchema.parse(res.json()).error;
const key = () => randomUUID().replaceAll('-', '');
const claimBody = (res: Res) => ClaimResultSchema.parse(res.json());
const lookup = (res: Res) => ProductCodeLookupSchema.parse(res.json());

/** Catálogo + lote generado por TI (SuperAdmin); devuelve los tokens en claro de la descarga única. */
async function inventory(count = 3, sku = 'RVC-8', batchLabel = '4092') {
  const brandAdmin = await person(app, db, ['ADMIN_MARCA'], 'Marca');
  const ti = await person(app, db, ['SUPERADMIN'], 'TI');
  if (!(await db.product.findUnique({ where: { sku } }))) {
    const created = await brandAdmin.request('POST', '/admin/smarttags/products', {
      sku,
      name: 'Ron Viejo de Caldas 8 años',
      brandSlug: 'ron-viejo-de-caldas',
    });
    expect(created.statusCode).toBe(201);
  }
  const res = await ti.request('POST', '/admin/smarttags/generate', { sku, batchLabel, supplier: 'Imprenta A', count });
  expect(res.statusCode).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/csv/);
  const lines = res.body.trim().split('\r\n');
  const tokens = lines.slice(1).map((l) => l.split(',')[0] as string);
  const batch = await db.batch.findFirstOrThrow({ where: { label: batchLabel } });
  return { tokens, batch, brandAdmin, ti, csv: res.body };
}

async function claimable(count = 3, d = draft()) {
  const inv = await inventory(count);
  await publishedCampaign(app, db, 'feria', d);
  const linked = await inv.brandAdmin.request('POST', `/admin/smarttags/batches/${inv.batch.id}/link`, { campaignSlug: 'feria' });
  expect(linked.json()).toEqual({ created: count, skipped: 0 });
  return inv;
}

const claim = (who: ReturnType<typeof browser>, token: string, idem = key()) =>
  who.request('POST', `/campaign-codes/${token}/claim`, undefined, { 'idempotency-key': idem });

describe('generación y catálogo (Instrucciones §3.6, §4.1)', () => {
  it('la descarga única trae tokens de 12 caracteres y la URL de la plantilla; la base solo guarda hashes', async () => {
    const { tokens, csv, ti } = await inventory(5);
    expect(tokens).toHaveLength(5);
    for (const t of tokens) expect(t).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/);
    expect(csv).toContain(`https://ilc.app/v/${tokens[0]}`);
    const stored = await db.productCode.findMany();
    expect(stored.map((s) => s.status)).toEqual(Array(5).fill('ASIGNADO_A_LOTE'));
    expect(stored.some((s) => tokens.includes(s.tokenHash))).toBe(false);
    expect(stored.map((s) => s.tokenHint).sort()).toEqual(tokens.map((t) => t.slice(-4)).sort());

    // Cambiar la plantilla solo afecta las próximas generaciones.
    expect(err(await ti.request('PUT', '/admin/smarttags/settings', { urlTemplate: 'http://otro.co/{token}' })).code).toBe('VALIDATION_FAILED');
    expect((await ti.request('PUT', '/admin/smarttags/settings', { urlTemplate: 'https://qr.ilc.com.co/b/{token}?o=1' })).statusCode).toBe(200);
    const next = await ti.request('POST', '/admin/smarttags/generate', { sku: 'RVC-8', batchLabel: '4093', count: 1 });
    expect(next.body).toContain('https://qr.ilc.com.co/b/');
  });

  it('solo TI genera, importa y revoca; Marca administra el catálogo y los lotes', async () => {
    const marca = await person(app, db, ['ADMIN_MARCA']);
    const editor = await person(app, db, ['EDITOR_CONTENIDO']);
    expect(err(await marca.request('POST', '/admin/smarttags/generate', { sku: 'RVC-8', batchLabel: '1', count: 1 })).code).toBe('FORBIDDEN');
    expect(err(await editor.request('GET', '/admin/smarttags/batches')).code).toBe('FORBIDDEN');
    expect(err(await marca.request('PUT', '/admin/smarttags/settings', { urlTemplate: 'https://ilc.app/v/{token}' })).code).toBe('FORBIDDEN');
    await marca.request('POST', '/admin/smarttags/products', { sku: 'RVC-8', name: 'Ron Viejo de Caldas 8 años', brandSlug: 'ron-viejo-de-caldas' });
    expect(err(await marca.request('POST', '/admin/smarttags/products', { sku: 'RVC-8', name: 'Otro', brandSlug: 'ron-viejo-de-caldas' })).code).toBe(
      'CONFLICT',
    );
  });

  it('los tokens nunca quedan completos en los logs', () => {
    expect(maskUrl('/api/v1/product-codes/X89K2P4M7K2Q/status')).toBe('/api/v1/product-codes/••••7K2Q/status');
    expect(maskUrl('/api/v1/campaign-codes/X89K2P4M7K2Q/claim')).toBe('/api/v1/campaign-codes/••••7K2Q/claim');
  });
});

describe('consulta de producto (Guía Técnica §5.6)', () => {
  it('reconoce el código sin afirmar autenticidad absoluta y registra la consulta como evento', async () => {
    const { tokens } = await inventory(1);
    const res = lookup(await browser(app).request('GET', `/product-codes/${tokens[0]}/status`));
    expect(res).toEqual({
      status: 'recognized',
      brandLabel: 'Ron Viejo de Caldas',
      themeId: 'ron-viejo-de-caldas',
      productLabel: 'Ron Viejo de Caldas 8 años · Lote 4092',
      campaign: null,
    });
    expect(JSON.stringify(res)).not.toMatch(/auténtico|100/i);
    expect(await db.productCodeEvent.count({ where: { type: 'CONSULTA' } })).toBe(1);
    expect(lookup(await browser(app).request('GET', '/product-codes/NOEXISTE1234/status')).status).toBe('unrecognized');
  });

  it('consultar muchas veces el mismo código lo marca para verificación (sin bloquear a nadie)', async () => {
    const { tokens } = await inventory(1);
    await db.platformSetting.create({ data: { key: 'smarttags.anomalyLookupsPerHour', value: 3 } });
    const b = browser(app);
    for (let i = 0; i < 3; i++) expect(lookup(await b.request('GET', `/product-codes/${tokens[0]}/status`)).status).toBe('recognized');
    expect(lookup(await b.request('GET', `/product-codes/${tokens[0]}/status`)).status).toBe('needs_review');
    expect(await db.productCode.findFirst()).toMatchObject({ status: 'ALERTA_DE_ANOMALIA' });
    expect(await db.securityEvent.count({ where: { type: 'smarttags.lookup_anomaly' } })).toBe(1);
  });

  it('frena la enumeración de códigos inexistentes desde una misma IP', async () => {
    const b = browser(app);
    for (let i = 0; i < UNKNOWN_LOOKUPS_LIMIT; i++)
      expect((await b.request('GET', `/product-codes/INVENTADO${String(i).padStart(4, '0')}/status`)).statusCode).toBe(200);
    expect(err(await b.request('GET', '/product-codes/INVENTADO9999/status')).code).toBe('RATE_LIMITED');
    expect(await db.securityEvent.count({ where: { type: 'smarttags.enumeration_suspected' } })).toBe(1);
  });
});

describe('reclamación (Guía Técnica §5.6, §5.7)', () => {
  it('muestra las condiciones antes de reclamar y emite una sola vez con la misma clave', async () => {
    const { tokens } = await claimable(1);
    const token = tokens[0] as string;
    const player = await person(app, db);
    const before = lookup(await player.request('GET', `/product-codes/${token}/status`));
    expect(before.campaign).toMatchObject({ slug: 'feria', title: 'Feria de Manizales', availability: 'available', points: 500, currencyName: 'Puntos ILC' });

    const idem = key();
    const first = claimBody(await claim(player, token, idem));
    expect(first).toMatchObject({ replayed: false, points: 500, balance: 500, campaign: { slug: 'feria' } });
    const again = claimBody(await claim(player, token, idem));
    expect(again).toMatchObject({ claimId: first.claimId, replayed: true, points: 500, balance: 500 });
    expect(await db.ledgerEntry.count()).toBe(1);
    expect(await db.campaignCode.findFirst()).toMatchObject({ status: 'RECLAMADO' });

    expect(lookup(await player.request('GET', `/product-codes/${token}/status`)).campaign?.availability).toBe('claimed_by_you');
    const other = await person(app, db);
    const seen = lookup(await other.request('GET', `/product-codes/${token}/status`));
    expect(seen).toMatchObject({ status: 'already_claimed', campaign: { availability: 'claimed' } });
    expect(err(await claim(other, token)).code).toBe('CODE_ALREADY_CLAIMED');
    // La misma clave con otra persona no devuelve el resultado ajeno.
    expect(err(await claim(other, token, idem)).code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('dos o más solicitudes simultáneas del mismo código producen UNA reclamación y UNA emisión', async () => {
    const { tokens } = await claimable(1);
    const players = await Promise.all(Array.from({ length: 8 }, () => person(app, db)));
    const results = await Promise.all(players.map((p) => claim(p, tokens[0] as string)));
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409).map((r) => err(r).code)).toEqual(Array(7).fill('CODE_ALREADY_CLAIMED'));
    expect(await db.claim.count()).toBe(1);
    expect(await db.ledgerEntry.count()).toBe(1);
  });

  it('el doble toque (misma clave en paralelo) responde lo mismo sin duplicar', async () => {
    const { tokens } = await claimable(1);
    const player = await person(app, db);
    const idem = key();
    const [a, b] = await Promise.all([claim(player, tokens[0] as string, idem), claim(player, tokens[0] as string, idem)]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(claimBody(a).claimId).toBe(claimBody(b).claimId);
    expect(await db.ledgerEntry.count()).toBe(1);
  });

  it('exige cuenta guardada y clave de idempotencia', async () => {
    const { tokens } = await claimable(1);
    const visitor = browser(app);
    await visitor.request('POST', '/age-gate', { birthDate: '1990-01-01', declaration: true });
    expect(err(await claim(visitor, tokens[0] as string)).code).toBe('ACCOUNT_REQUIRED');
    const player = await person(app, db);
    expect(err(await player.request('POST', `/campaign-codes/${tokens[0]}/claim`)).code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(err(await browser(app).request('POST', `/campaign-codes/${tokens[0]}/claim`, undefined, { 'idempotency-key': key() })).code).toBe('UNAUTHENTICATED');
  });

  it('aplica el límite diario por persona en servidor', async () => {
    const { tokens } = await claimable(3, draft({ rules: { ...draft().rules, limits: { activationsPerUserPerDay: 2 } } }));
    const player = await person(app, db);
    const results = await Promise.all(tokens.map((t) => claim(player, t)));
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(2);
    expect(err(results.find((r) => r.statusCode !== 200) as Res).code).toBe('CLAIM_LIMIT_REACHED');
  });

  it('aplica el multiplicador vigente', async () => {
    const now = Date.now();
    const rules = {
      ...draft().rules,
      multipliers: [{ label: 'Feria', factor: 2, startsAt: new Date(now - DAY).toISOString(), endsAt: new Date(now + DAY).toISOString() }],
    };
    const { tokens } = await claimable(1, draft({ rules }));
    expect(claimBody(await claim(await person(app, db), tokens[0] as string)).points).toBe(1000);
  });

  it('no emite desde una campaña pausada; al cerrarla los códigos vencen', async () => {
    const { tokens } = await claimable(2);
    const admin = await person(app, db, ['ADMIN_MARCA']);
    await admin.request('POST', '/admin/campaigns/feria/pause');
    const player = await person(app, db);
    expect(lookup(await player.request('GET', `/product-codes/${tokens[0]}/status`)).campaign?.availability).toBe('not_available');
    expect(err(await claim(player, tokens[0] as string)).code).toBe('CAMPAIGN_NOT_ACTIVE');
    await admin.request('POST', '/admin/campaigns/feria/close');
    expect(await db.campaignCode.count({ where: { status: 'EXPIRADO' } })).toBe(2);
    expect(lookup(await player.request('GET', `/product-codes/${tokens[0]}/status`)).campaign?.availability).toBe('expired');
    expect(err(await claim(player, tokens[0] as string)).code).toBe('CODE_NOT_AVAILABLE');
  });

  it('el programador vence los códigos al terminar la ventana', async () => {
    await claimable(1);
    await app.get(CampaignsService).tick(new Date(Date.now() + 11 * DAY));
    expect(await db.campaignCode.findFirst()).toMatchObject({ status: 'EXPIRADO' });
  });

  it('una campaña +21 pide confirmar la edad de nuevo a quien solo demostró 18', async () => {
    const { tokens } = await claimable(1, draft({ minAge: 21 }));
    const player = await person(app, db);
    const res = await claim(player, tokens[0] as string);
    expect(err(res)).toMatchObject({ code: 'AGE_GATE_REQUIRED' });
    expect(err(res).message).toMatch(/21/);
    await player.request('POST', '/age-gate', { birthDate: '1990-01-01', declaration: true, campaignSlug: 'feria' });
    expect(claimBody(await claim(player, tokens[0] as string)).points).toBe(500);
  });

  it('revocar un lote anula sus promociones sin reclamar y la consulta pide verificación', async () => {
    const { tokens, batch, ti, brandAdmin } = await claimable(2);
    const player = await person(app, db);
    await claim(player, tokens[0] as string);
    expect(err(await brandAdmin.request('POST', `/admin/smarttags/batches/${batch.id}/revoke`, { reason: 'Etiquetas robadas' })).code).toBe('FORBIDDEN');
    expect((await ti.request('POST', `/admin/smarttags/batches/${batch.id}/revoke`, { reason: 'Etiquetas robadas en bodega' })).json()).toEqual({
      codes: 2,
      campaignCodes: 1,
    });
    expect(lookup(await player.request('GET', `/product-codes/${tokens[1]}/status`))).toMatchObject({
      status: 'needs_review',
      campaign: { availability: 'not_available' },
    });
    expect(err(await claim(player, tokens[1] as string)).code).toBe('CODE_NOT_AVAILABLE');
    // La reclamación ya hecha no se borra (el ledger es inmutable).
    expect(await db.claim.count()).toBe(1);
  });

  it('solo vincula lotes a campañas de la misma submarca y de Ruta A o mixta', async () => {
    const inv = await inventory(1);
    await publishedCampaign(app, db, 'amarillo', draft({ brandSlugs: ['aguardiente-amarillo'], theme: { mode: 'dark', brand: 'aguardiente-amarillo' } }));
    expect(err(await inv.brandAdmin.request('POST', `/admin/smarttags/batches/${inv.batch.id}/link`, { campaignSlug: 'amarillo' })).message).toMatch(
      /submarca/,
    );
  });
});

describe('importación CSV/XLSX con vista previa (§5.6, Instrucciones §10)', () => {
  async function setup() {
    const marca = await person(app, db, ['ADMIN_MARCA']);
    await marca.request('POST', '/admin/smarttags/products', { sku: 'RVC-8', name: 'Ron Viejo de Caldas 8 años', brandSlug: 'ron-viejo-de-caldas' });
    return person(app, db, ['SUPERADMIN'], 'TI');
  }
  const upload = (ti: ReturnType<typeof browser>, name: string, content: Buffer) =>
    ti.request('POST', `/admin/smarttags/imports?fileName=${encodeURIComponent(name)}`, content, { 'content-type': 'application/octet-stream' });

  it('valida fila por fila, no guarda nada hasta confirmar y no acepta el mismo archivo dos veces', async () => {
    const ti = await setup();
    const csv = Buffer.from(
      [
        'Token;SKU;Lote;Proveedor',
        'TOKENVALIDO0001;rvc-8;4100;Imprenta A',
        'TOKENVALIDO0002;RVC-8;4100;Imprenta A',
        'TOKENVALIDO0001;RVC-8;4100;Imprenta A',
        'CORTO123;RVC-8;4100;',
        'mal token!;RVC-8;4100;',
        'TOKENVALIDO0003;NO-EXISTE;4100;',
      ].join('\n'),
    );
    const preview = ImportPreviewSchema.parse((await upload(ti, 'lote-4100.csv', csv)).json());
    expect(preview).toMatchObject({
      status: 'PREVISTA',
      totalRows: 6,
      validRows: 3,
      duplicateRows: 1,
      errorRows: 2,
      groups: [{ sku: 'RVC-8', batch: '4100', rows: 3 }],
    });
    expect(preview.warnings[0]).toMatch(/1 tokens tienen menos de 10/);
    expect(preview.issues.map((i) => i.line)).toEqual([4, 6, 7]);
    expect(await db.productCode.count()).toBe(0);

    const issues = await ti.request('GET', `/admin/smarttags/imports/${preview.id}/issues`);
    expect(issues.body).toContain('••••0001');
    expect(issues.body).not.toContain('TOKENVALIDO0001');

    const done = ImportPreviewSchema.parse((await ti.request('POST', `/admin/smarttags/imports/${preview.id}/confirm`)).json());
    expect(done.status).toBe('CONFIRMADA');
    expect(await db.productCode.count({ where: { status: 'ASIGNADO_A_LOTE', supplier: 'Imprenta A' } })).toBe(2);
    expect(lookup(await browser(app).request('GET', '/product-codes/TOKENVALIDO0002/status')).productLabel).toBe('Ron Viejo de Caldas 8 años · Lote 4100');

    expect(err(await upload(ti, 'otra-vez.csv', csv)).message).toMatch(/ya se importó/);
  });

  it('acepta .xlsx', async () => {
    const ti = await setup();
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Códigos');
    sheet.addRow(['token', 'sku', 'lote']);
    sheet.addRow(['XLSXTOKEN00001', 'RVC-8', 'X1']);
    sheet.addRow(['XLSXTOKEN00002', 'RVC-8', 'X1']);
    const file = Buffer.from(await wb.xlsx.writeBuffer());
    const preview = ImportPreviewSchema.parse((await upload(ti, 'lote.xlsx', file)).json());
    expect(preview).toMatchObject({ totalRows: 2, validRows: 2 });
  });

  it('si el inventario cambió desde la vista previa, no importa nada', async () => {
    const ti = await setup();
    const csv = Buffer.from('token,sku,lote\nCAMBIO0000001,RVC-8,9\nCAMBIO0000002,RVC-8,9\n');
    const preview = ImportPreviewSchema.parse((await upload(ti, 'a.csv', csv)).json());
    const other = ImportPreviewSchema.parse((await upload(ti, 'b.csv', Buffer.from('token,sku,lote\nCAMBIO0000002,RVC-8,9\n'))).json());
    await ti.request('POST', `/admin/smarttags/imports/${other.id}/confirm`);
    expect(err(await ti.request('POST', `/admin/smarttags/imports/${preview.id}/confirm`)).message).toMatch(/cambió/);
    expect(await db.productCode.count()).toBe(1);
  });

  it('rechaza formatos y encabezados inválidos, y solo acepta binarios en esta ruta', async () => {
    const ti = await setup();
    expect(err(await upload(ti, 'x.pdf', Buffer.from('%PDF-1.4'))).message).toMatch(/Formato no admitido/);
    expect(err(await upload(ti, 'x.csv', Buffer.from('a,b\n1,2\n'))).message).toMatch(/Faltan columnas/);
    const res = await ti.request('POST', '/admin/smarttags/products', Buffer.from('{}'), { 'content-type': 'application/octet-stream' });
    expect(err(res).code).toBe('VALIDATION_FAILED');
  });
});

describe('exportación de auditoría e integración ERP (Instrucciones §10)', () => {
  it('exporta el estado por lote sin tokens completos ni datos personales', async () => {
    const { tokens, batch, brandAdmin } = await claimable(2);
    const player = await person(app, db);
    await claim(player, tokens[0] as string);
    const res = await brandAdmin.request('GET', `/admin/smarttags/batches/${batch.id}/export`);
    expect(res.headers['content-disposition']).toMatch(/auditoria-RVC-8-4092\.csv/);
    for (const t of tokens) expect(res.body).not.toContain(t);
    expect(res.body).toContain(`••••${(tokens[0] as string).slice(-4)}`);
    expect(res.body).not.toContain(player.user.id);
    expect(res.body.trim().split('\r\n')).toHaveLength(3);
  });

  it('POST /smarttags/validate exige la clave de integración y nunca reclama', async () => {
    const { tokens } = await claimable(1);
    const erp = browser(app, null);
    expect(err(await erp.request('POST', '/smarttags/validate', { token: tokens[0] })).code).toBe('UNAUTHENTICATED');
    const ok = await erp.request('POST', '/smarttags/validate', { token: tokens[0] }, { authorization: `Bearer ${INTEGRATION_KEY}` });
    expect(ok.json()).toEqual({ recognized: true, status: 'ASIGNADO_A_LOTE', sku: 'RVC-8', batch: '4092', revoked: false });
    expect(await db.campaignCode.findFirst()).toMatchObject({ status: 'DISPONIBLE' });
  });

  it('el lote se puede marcar como distribuido y la lista resume estados y campañas', async () => {
    const { batch, brandAdmin, tokens } = await claimable(2);
    await claim(await person(app, db), tokens[0] as string);
    expect((await brandAdmin.request('POST', `/admin/smarttags/batches/${batch.id}/distribute`)).json()).toEqual({ updated: 2 });
    const [row] = (await brandAdmin.request('GET', '/admin/smarttags/batches')).json() as Array<Record<string, unknown>>;
    expect(row).toMatchObject({
      sku: 'RVC-8',
      label: '4092',
      supplier: 'Imprenta A',
      total: 2,
      byStatus: { DISTRIBUIDO: 2 },
      campaigns: [{ slug: 'feria', codes: 2, claimed: 1 }],
    });
  });
});
