#!/usr/bin/env node
/**
 * E2E de la ruta crítica (Guía Técnica §12.1 suite 4): QR de botella → control de edad → cuenta → activación → saldo →
 * canje → entrega, y una misión de Ruta B sin Puntos ILC. Corre contra un stack real (API + PWA con VITE_DEMO_DATA=false).
 *
 * Requisitos: API compilada (`pnpm build`), OTP_PROVIDER=console, AUTH_RATE_LIMIT_PER_MINUTE alto, marcas sembradas
 * (`pnpm --filter @ilc/api db:seed`), `psql` o no (no se usa) y Chromium de Playwright.
 *   API_URL=http://localhost:3000/api/v1 PWA_URL=http://localhost:5173 API_LOG=/ruta/al/log node tools/e2e/critical-path.cjs
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const API = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const PWA = process.env.PWA_URL ?? 'http://localhost:5173';
const LOG = process.env.API_LOG ?? '/tmp/ilc-api.log';
const ROOT = path.resolve(__dirname, '../..');
const stamp = Date.now().toString(36);
// Celular distinto en cada corrida: los códigos tienen enfriamiento por destino.
const phone = `300${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
const assert = (c, m) => {
  if (!c) throw new Error(`FALLÓ: ${m}`);
  console.log('✓', m);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────────── Cliente de API con cookies ─────────────
class Client {
  constructor() {
    this.cookies = new Map();
  }
  async req(method, url, body, headers = {}) {
    const res = await fetch(API + url, {
      method,
      headers: {
        Origin: PWA,
        Accept: '*/*',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(this.cookies.size ? { Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      this.cookies.set(kv.slice(0, i), kv.slice(i + 1));
    }
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, json, text };
  }
}
const must = (r, what) => {
  if (r.status >= 300) throw new Error(`${what}: HTTP ${r.status} ${r.text.slice(0, 300)}`);
  return r.json ?? r.text;
};

/** Último código OTP impreso por la API (OTP_PROVIDER=console). */
async function otpCode() {
  await sleep(900);
  const lines = fs
    .readFileSync(LOG, 'utf8')
    .split('\n')
    .filter((l) => l.includes('OTP'));
  return [...lines.join(' ').matchAll(/\b(\d{6})\b/g)].pop()[1];
}

async function staffLogin(email, role) {
  execFileSync('node', ['--env-file-if-exists=.env', 'dist/admin-grant.js', '--email', email, '--role', role], {
    cwd: path.join(ROOT, 'apps/api'),
    stdio: 'pipe',
  });
  const c = new Client();
  must(await c.req('POST', '/auth/otp/request', { channel: 'email', destination: email }), 'otp');
  must(await c.req('POST', '/auth/otp/verify', { channel: 'email', destination: email, code: await otpCode() }), 'verify');
  return c;
}

const DAY = 86_400_000;

async function bootstrap() {
  const t = (n) => `${n}-${stamp}@e2e.ilc.test`;
  const [editor, rmarca, rjur, admin, ti] = [
    await staffLogin(t('editor'), 'EDITOR_CONTENIDO'),
    await staffLogin(t('rmarca'), 'REVISOR_MARCA'),
    await staffLogin(t('rjur'), 'REVISOR_JURIDICO'),
    await staffLogin(t('admin'), 'ADMIN_MARCA'),
    await staffLogin(t('ti'), 'SUPERADMIN'),
  ];
  const slug = `e2e-${stamp}`;
  const sku = `E2E-${stamp.toUpperCase()}`.slice(0, 30);
  must(await admin.req('POST', '/admin/smarttags/products', { sku, name: 'Producto E2E', brandSlug: 'ron-viejo-de-caldas' }), 'producto');
  const csv = must(await ti.req('POST', '/admin/smarttags/generate', { sku, batchLabel: `L${stamp}`.slice(0, 20), count: 3 }), 'generar códigos');
  const tokens = csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(',')[0]);
  const draft = {
    internalName: `Campaña E2E ${stamp}`,
    publicTitle: 'Campaña E2E',
    publicDescription: 'Prueba de punta a punta',
    objective: 'Verificar la ruta crítica',
    kpi: 'Activaciones válidas',
    ownerTeam: 'Calidad',
    brandSlugs: ['ron-viejo-de-caldas'],
    channels: ['ON_PREMISE'],
    territories: ['Caldas'],
    minAge: 18,
    startsAt: new Date(Date.now() - DAY).toISOString(),
    endsAt: new Date(Date.now() + 10 * DAY).toISOString(),
    terms: 'Términos de prueba.',
    rules: { pointsBySku: { [sku]: 500 }, multipliers: [], energyMinutes: 45, sessionEndsAtLocalTime: '06:00', limits: { activationsPerUserPerDay: 3 } },
    theme: { mode: 'dark', brand: 'ron-viejo-de-caldas' },
    dataUsage: { location: false, extraData: false },
    modules: [],
  };
  must(await editor.req('POST', '/admin/campaigns', { slug, route: 'A_COMERCIAL', draft }), 'crear campaña');
  must(await editor.req('POST', `/admin/campaigns/${slug}/submit`), 'enviar a revisión');
  must(await rmarca.req('POST', `/admin/campaigns/${slug}/approvals`, { kind: 'MARCA', decision: 'APROBADO' }), 'aprobación de Marca');
  must(await rjur.req('POST', `/admin/campaigns/${slug}/approvals`, { kind: 'JURIDICA', decision: 'APROBADO' }), 'aprobación Jurídica');
  const { CHECKLIST_KEYS } = await import(require('node:url').pathToFileURL(path.join(ROOT, 'packages/contracts/dist/index.js')).href);
  must(
    await admin.req('POST', `/admin/campaigns/${slug}/publish`, { checklist: Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, true])) }),
    'publicar campaña',
  );
  const batches = must(await admin.req('GET', '/admin/smarttags/batches'), 'lotes');
  const batch = batches.find((b) => b.label === `L${stamp}`.slice(0, 20));
  must(await admin.req('POST', `/admin/smarttags/batches/${batch.id}/link`, { campaignSlug: slug }), 'vincular lote');
  // Recompensa (la crea Marca y la activa otra persona) y juego de Ruta A (trivia de ejemplo).
  const reward = must(
    await admin.req('POST', '/admin/rewards', {
      slug: `gorra-${stamp}`,
      name: 'Gorra E2E',
      type: 'MERCHANDISING',
      cost: 300,
      conditions: ['Retiro en el punto aliado'],
      startsAt: new Date(Date.now() - DAY).toISOString(),
      endsAt: new Date(Date.now() + 30 * DAY).toISOString(),
      fulfillment: 'Calidad',
      zones: [{ zone: 'Manizales', available: 5, lowStockAlert: 1 }],
    }),
    'crear recompensa',
  );
  must(await ti.req('POST', `/admin/rewards/${reward.id}/activate`), 'activar recompensa');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'games/ejemplos/trivia-ejemplo.json'), 'utf8'));
  manifest.moduleId = `trivia-${stamp}`;
  must(await ti.req('POST', '/admin/games/modules', { manifest }), 'registrar juego');
  const gp = `/admin/games/modules/${manifest.moduleId}/versions/${manifest.version}`;
  must(await admin.req('POST', `${gp}/test`), 'juego a prueba');
  must(await rmarca.req('POST', `${gp}/approvals`, { kind: 'MARCA', decision: 'APROBADO' }), 'aprobar juego (Marca)');
  must(await rjur.req('POST', `${gp}/approvals`, { kind: 'JURIDICA', decision: 'APROBADO' }), 'aprobar juego (Jurídica)');
  must(await admin.req('POST', `${gp}/activate`), 'activar juego');
  must(await admin.req('PUT', '/admin/games/defaults', { modules: [manifest.moduleId] }), 'juegos por defecto');
  return { tokens, admin, rewardName: 'Gorra E2E', gameTitle: manifest.title };
}

(async () => {
  const stage = await bootstrap();
  console.log('✓ bootstrap: producto, lote, campaña publicada, recompensa y juego activos');
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
  // Celular Android de gama media (matriz de compatibilidad mínima en Chromium).
  const ctx = await browser.newContext({ ...devices['Pixel 5'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const token = stage.tokens[0];

  // 1. QR de la botella → control de edad → vuelve al código
  await page.goto(`${PWA}/v/${token}`);
  await page.getByText(/confirma que eres mayor de edad/i).waitFor();
  await page.getByRole('textbox', { name: 'Día' }).fill('14');
  await page.getByRole('textbox', { name: 'Mes' }).fill('08');
  await page.getByRole('textbox', { name: 'Año' }).fill('1990');
  await page.getByLabel(/confirmo que soy mayor de 18/i).check();
  await page.getByRole('button', { name: /continuar/i }).click();
  await page.getByText('Código reconocido').waitFor();
  assert(true, 'QR de botella → control de edad → código reconocido (consultar no consume la promoción)');

  // 2. Activar exige cuenta: registro por código y regreso
  await page.getByRole('button', { name: /Activar código y crear mi Parche/ }).click();
  await page.waitForURL(/\/registro/);
  await page.getByLabel(/acepto los términos/i).check();
  await page.getByRole('button', { name: /código por whatsapp/i }).click();
  await page.getByLabel('Celular').fill(phone);
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await page.getByLabel('Dígito 1 de 6').waitFor();
  await page.getByLabel('Dígito 1 de 6').click();
  await page.keyboard.type(await otpCode());
  await page.getByRole('button', { name: 'Verificar' }).click();
  await page.waitForURL(new RegExp(`/v/${token}`));
  await page.getByRole('button', { name: /Activar código y crear mi Parche/ }).click();
  await page.getByText(/Cada código se activa una sola vez/).waitFor();
  await page.getByRole('button', { name: 'Activar código', exact: true }).click();
  await page.getByText(/Sumaste 500 Puntos ILC/).waitFor();
  assert(true, 'cuenta por código OTP y activación única: +500 Puntos ILC');

  // 3. Billetera
  await page.goto(`${PWA}/billetera`);
  await page.getByText('Código activado').first().waitFor();
  assert(/500/.test(await page.locator('body').innerText()), 'la billetera muestra el crédito de la activación');

  // 4. Canje → código de entrega
  await page.goto(`${PWA}/recompensas`);
  await page
    .getByRole('button', { name: new RegExp(stage.rewardName) })
    .first()
    .click();
  await page.getByLabel('Leí las condiciones').check();
  await page.getByRole('button', { name: /Confirmar canje/ }).click();
  await page.getByText('¡Canje listo!').waitFor();
  const code = (await page.locator('dialog p.tracking-\\[0\\.3em\\]').innerText()).trim();
  assert(/^[0-9A-Z]{8}$/.test(code) && /Tu saldo ahora: 200/.test(await page.locator('dialog').innerText()), `canje atómico: código ${code} y saldo 500 → 200`);

  // 5. Ruta B: misión sin Puntos ILC
  await page.goto(`${PWA}/jugar`);
  await page
    .getByRole('button', { name: new RegExp(stage.gameTitle.split(' ')[0]) })
    .first()
    .click();
  for (let i = 0; i < 20; i++) {
    await page.getByRole('radio').first().click();
    const last = page.getByRole('button', { name: 'Terminar' });
    if (await last.count()) {
      await last.click();
      break;
    }
    await page.getByRole('button', { name: 'Siguiente' }).click();
  }
  await page.getByText('Resultado verificado').waitFor();
  assert(/no otorga|solo se ganan/.test(await page.locator('body').innerText()), 'la misión se verifica en el servidor y no otorga Puntos ILC');

  // 6. Entrega por Marca (API) y comprobación en la PWA
  const delivered = await stage.admin.req('POST', '/admin/rewards/claims/deliver', { code });
  assert(delivered.status === 200, 'Marca entrega el canje contra el código');
  const again = await stage.admin.req('POST', '/admin/rewards/claims/deliver', { code });
  assert(again.status === 409, 'entregar dos veces el mismo código se rechaza');
  await page.goto(`${PWA}/recompensas/mis-canjes`);
  await page.getByText('Entregado').first().waitFor();
  assert(true, 'la persona ve su canje como Entregado');

  // 7. Sin errores de JavaScript durante todo el recorrido
  assert(errors.length === 0, `sin errores de JavaScript en el navegador (${errors.length})`);
  await browser.close();
  console.log('E2E ruta crítica OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
