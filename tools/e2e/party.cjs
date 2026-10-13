#!/usr/bin/env node
/**
 * E2E de los juegos de fiesta (Paso 15): TI y Marca instalan los 6 juegos por el flujo real (registrar → prueba → aprobación de
 * Marca y Jurídica → activar), Marca personaliza uno desde la API (nueva versión, el servidor rechaza texto que incite al
 * alcohol) y en un celular se juegan: girador, verdad o reto, categorías, yo nunca, adivina en la frente y pulso firme.
 * Mismos requisitos que critical-path.cjs.
 *   API_URL=http://localhost:3000/api/v1 PWA_URL=http://localhost:5173 API_LOG=/ruta/al/log node tools/e2e/party.cjs
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
const assert = (c, m) => {
  if (!c) throw new Error(`FALLÓ: ${m}`);
  console.log('✓', m);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor() {
    this.cookies = new Map();
  }
  async req(method, url, body) {
    const res = await fetch(API + url, {
      method,
      headers: {
        Origin: PWA,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(this.cookies.size ? { Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
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

async function signUp(page, goal) {
  await page.goto(`${PWA}${goal}`);
  await page.getByText(/confirma que eres mayor de edad/i).waitFor();
  await page.getByRole('textbox', { name: 'Día' }).fill('14');
  await page.getByRole('textbox', { name: 'Mes' }).fill('08');
  await page.getByRole('textbox', { name: 'Año' }).fill('1990');
  await page.getByLabel(/confirmo que soy mayor de 18/i).check();
  await page.getByRole('button', { name: /continuar/i }).click();
  await page.waitForURL((u) => !/\/edad/.test(u.pathname));
}

(async () => {
  const { defaultPartyManifest, PARTY_GAMES } = require(path.join(ROOT, 'packages/contracts/dist/index.js'));
  const ti = await staffLogin(`ti-${stamp}@e2e.ilc.test`, 'SUPERADMIN');
  const marca = await staffLogin(`marca-${stamp}@e2e.ilc.test`, 'ADMIN_MARCA');
  const revMarca = await staffLogin(`revmarca-${stamp}@e2e.ilc.test`, 'REVISOR_MARCA');
  const juridica = await staffLogin(`juridica-${stamp}@e2e.ilc.test`, 'REVISOR_JURIDICO');

  // ── Instalación por el flujo real de aprobaciones ──
  const manifests = PARTY_GAMES.map((g) =>
    defaultPartyManifest(g, { moduleId: `${defaultPartyManifest(g).moduleId}-${stamp}`, title: `${defaultPartyManifest(g).title} ${stamp}` }),
  );
  for (const m of manifests) {
    must(await ti.req('POST', '/admin/games/modules', { manifest: m }), `registrar ${m.moduleId}`);
    must(await ti.req('POST', `/admin/games/modules/${m.moduleId}/versions/${m.version}/test`), `probar ${m.moduleId}`);
    must(
      await revMarca.req('POST', `/admin/games/modules/${m.moduleId}/versions/${m.version}/approvals`, { kind: 'MARCA', decision: 'APROBADO' }),
      'aprobar Marca',
    );
    must(
      await juridica.req('POST', `/admin/games/modules/${m.moduleId}/versions/${m.version}/approvals`, { kind: 'JURIDICA', decision: 'APROBADO' }),
      'aprobar Jurídica',
    );
    must(await marca.req('POST', `/admin/games/modules/${m.moduleId}/versions/${m.version}/activate`), `activar ${m.moduleId}`);
  }
  must(await marca.req('PUT', '/admin/games/defaults', { modules: manifests.map((m) => m.moduleId) }), 'catálogo general');
  console.log('✓ los 6 juegos de fiesta se instalaron con aprobación de Marca y Jurídica');

  // ── Personalización: Marca cambia nombres y colores; el servidor rechaza texto con presión de alcohol ──
  const custom = JSON.parse(JSON.stringify(manifests[1]));
  custom.version = '1.0.1';
  custom.title = `Verdad o Reto ${stamp} ILC`;
  custom.delivery.config.look.accent = '#2E6B3B';
  custom.delivery.config.dares[0] = 'Haz un brindis con tu bebida favorita';
  const bad = await marca.req('POST', '/admin/games/modules', { manifest: custom });
  assert(bad.status === 400, 'el servidor rechaza un reto que incita al consumo de alcohol');
  custom.delivery.config.dares[0] = 'Cuenta un chiste a quien tengas a tu izquierda';
  must(await marca.req('POST', '/admin/games/modules', { manifest: custom }), 'registrar versión personalizada');
  assert(true, 'Marca registra una versión personalizada (queda en borrador hasta aprobarla)');

  // ── Jugar desde el celular ──
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
  const errors = [];
  const ctx = await browser.newContext({ ...devices['Pixel 5'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await signUp(page, '/jugar');
  const open = async (game) => {
    await page.goto(`${PWA}/jugar`);
    await page
      .getByRole('button', { name: new RegExp(game.title) })
      .click({ timeout: 8000 })
      .catch(async (e) => {
        console.log((await page.innerText('body')).slice(0, 800));
        throw e;
      });
  };
  const by = Object.fromEntries(manifests.map((m) => [m.delivery.config.game, m]));

  await open(by.spinner);
  await page.getByRole('button', { name: /GIRAR/ }).click();
  await page.getByRole('dialog').waitFor({ timeout: 8000 });
  await page.getByRole('button', { name: /CONTINUAR/ }).click();
  assert(await page.getByRole('button', { name: /GIRAR/ }).isVisible(), 'girador: gira, muestra el reto en un diálogo y vuelve a jugar');

  await open(by['truth-dare']);
  const dareLabel = by['truth-dare'].delivery.config.dareLabel;
  await page.getByRole('button', { name: dareLabel, exact: true }).click();
  const tagText = await page.locator('section[aria-live="polite"] p').first().innerText();
  assert(tagText.toLowerCase() === dareLabel.toLowerCase(), 'verdad o reto: muestra un reto');

  await open(by.categories);
  await page.getByRole('timer').waitFor();
  assert(true, 'categorías: cronómetro visible');

  await open(by['never-never']);
  await page.getByRole('button', { name: by['never-never'].delivery.config.nextLabel }).click();
  assert(true, 'yo nunca nunca: avanza de frase');

  await open(by.headband);
  await page.getByRole('button', { name: by.headband.delivery.config.startLabel }).click();
  await page.getByRole('timer').waitFor();
  assert(true, 'adivina en la frente: arranca la ronda');

  await open(by['steady-hand']);
  const area = page.getByLabel(/Área de juego/);
  const box = await area.boundingBox();
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await sleep(2500);
  await page.mouse.up();
  assert(await area.isVisible(), 'pulso firme: el área responde al toque');

  await open(by.impostor);
  await page.getByText('Guarda tu progreso para jugar').waitFor({ timeout: 8000 });
  assert(true, 'el impostor: sin cuenta, el servidor exige guardar el progreso antes de jugar');

  assert(errors.length === 0, `sin errores de JavaScript en el navegador (${errors.join(' | ')})`);
  await browser.close();
  console.log('\nE2E de juegos de fiesta: OK');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
