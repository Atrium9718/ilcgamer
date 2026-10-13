#!/usr/bin/env node
/**
 * E2E del concurso de disfraces (Paso 14): una persona sube su foto desde el celular (el navegador la reduce a JPEG), Marca la
 * modera, otra persona vota, el voto propio no existe, y la pantalla pública (sin sesión) muestra el ranking en vivo.
 * Corre contra un stack real (API + PWA con VITE_DEMO_DATA=false). Mismos requisitos que critical-path.cjs.
 *   API_URL=http://localhost:3000/api/v1 PWA_URL=http://localhost:5173 API_LOG=/ruta/al/log node tools/e2e/contest.cjs
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const API = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const PWA = process.env.PWA_URL ?? 'http://localhost:5173';
const LOG = process.env.API_LOG ?? '/tmp/ilc-api.log';
const SHOTS = process.env.SHOTS_DIR;
const ROOT = path.resolve(__dirname, '../..');
const stamp = Date.now().toString(36);
const phone = () => `300${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
const assert = (c, m) => {
  if (!c) throw new Error(`FALLÓ: ${m}`);
  console.log('✓', m);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => (SHOTS ? page.screenshot({ path: path.join(SHOTS, `e2e-concurso-${name}.png`) }) : undefined);

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

/** Control de edad + registro por código en el navegador (como lo haría una persona). */
async function signUp(page, goal) {
  await page.goto(`${PWA}${goal}`);
  await page.getByText(/confirma que eres mayor de edad/i).waitFor();
  await page.getByRole('textbox', { name: 'Día' }).fill('14');
  await page.getByRole('textbox', { name: 'Mes' }).fill('08');
  await page.getByRole('textbox', { name: 'Año' }).fill('1990');
  await page.getByLabel(/confirmo que soy mayor de 18/i).check();
  await page.getByRole('button', { name: /continuar/i }).click();
  await page.getByRole('button', { name: 'Guardar mi progreso' }).first().click();
  await page.waitForURL(/\/registro/);
  await page.getByLabel(/acepto los términos/i).check();
  await page.getByRole('button', { name: /código por whatsapp/i }).click();
  await page.getByLabel('Celular').fill(phone());
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await page.getByLabel('Dígito 1 de 6').waitFor();
  await page.getByLabel('Dígito 1 de 6').click();
  await page.keyboard.type(await otpCode());
  await page.getByRole('button', { name: 'Verificar' }).click();
  await page.waitForURL((u) => !/\/registro/.test(u.pathname));
}

const HOUR = 3_600_000;

(async () => {
  const photoSrc = await import(require('node:url').pathToFileURL(path.join(ROOT, 'apps/api/dist/demo/contest-photos.js')).href);
  const photoFile = path.join(os.tmpdir(), `disfraz-${stamp}.jpg`);
  fs.writeFileSync(photoFile, Buffer.from(photoSrc.DEMO_CONTEST_PHOTOS[0].base64, 'base64'));

  // ── Escenario: evento publicado y concurso abierto (lo crea A, lo abre B: separación de funciones) ──
  const [a, b] = [await staffLogin(`marca-a-${stamp}@e2e.ilc.test`, 'ADMIN_MARCA'), await staffLogin(`marca-b-${stamp}@e2e.ilc.test`, 'ADMIN_MARCA')];
  const ev = must(
    await a.req('POST', '/admin/events', {
      slug: `feria-${stamp}`,
      title: 'Feria E2E',
      city: 'Manizales',
      startsAt: new Date(Date.now() - HOUR).toISOString(),
      endsAt: new Date(Date.now() + 48 * HOUR).toISOString(),
    }),
    'crear evento',
  );
  must(await a.req('POST', `/admin/events/${ev.id}/publish`), 'publicar evento');
  const opens = Date.now() + 60_000; // la votación abre en 60 s: tiempo para inscribirse desde el navegador
  const contest = must(
    await a.req('POST', `/admin/events/${ev.id}/contests`, {
      slug: 'disfraces',
      kind: 'DISFRACES',
      title: 'Concurso de disfraces E2E',
      prize: 'Palco para la feria',
      prizeConditions: 'Se entrega en persona',
      uploadsCloseAt: new Date(opens).toISOString(),
      votingOpensAt: new Date(opens).toISOString(),
      votingClosesAt: new Date(opens + 2 * HOUR).toISOString(),
    }),
    'crear concurso',
  );
  assert((await a.req('POST', `/admin/contests/${contest.id}/open`)).status === 403, 'quien creó el concurso no puede abrirlo');
  must(await b.req('POST', `/admin/contests/${contest.id}/open`), 'abrir concurso (otra persona)');
  console.log('✓ escenario: evento publicado y concurso abierto');

  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
  const errors = [];

  // ── Persona 1 (celular): se inscribe con foto ──
  const ctx1 = await browser.newContext({ ...devices['Pixel 5'] });
  const p1 = await ctx1.newPage();
  p1.on('pageerror', (e) => errors.push(e.message));
  await signUp(p1, `/concursos/${contest.id}`);
  await p1.goto(`${PWA}/eventos`);
  await p1.getByRole('button', { name: /Concurso de disfraces E2E/ }).click();
  await p1.getByRole('heading', { name: 'Inscribe tu disfraz' }).waitFor();
  assert(await p1.getByText(/sin copas, botellas ni consumo de alcohol/).isVisible(), 'la norma de la foto (sin alcohol) se muestra al inscribirse');
  await p1.getByLabel(/Nombre de tu disfraz/).fill('El pirata del Cable');
  await p1.getByLabel('Foto de tu disfraz').setInputFiles(photoFile);
  await p1
    .getByRole('button', { name: 'Enviar mi disfraz' })
    .isDisabled()
    .then((d) => assert(d, 'no se puede enviar sin autorizar que se muestre la foto'));
  await p1.getByRole('checkbox', { name: /Autorizo que se muestre mi foto/ }).check();
  await shot(p1, '1-inscripcion');
  await p1.getByRole('button', { name: 'Enviar mi disfraz' }).click();
  await p1.getByText(/quedó en revisión/).waitFor();
  assert(true, 'la foto se reduce en el navegador, se sube y queda en revisión');

  // ── Marca modera (ve la foto) ──
  const adminView = must(await a.req('GET', `/admin/contests/${contest.id}`), 'detalle admin');
  const entry = adminView.entriesList[0];
  assert(entry && entry.hasPhoto && entry.status === 'PENDIENTE', 'Marca ve la inscripción pendiente con su foto');
  const img = await fetch(`${API}/admin/contests/${contest.id}/entries/${entry.id}/photo`, {
    headers: { Cookie: [...a.cookies].map(([k, v]) => `${k}=${v}`).join('; '), Origin: PWA },
  });
  const bytes = Buffer.from(await img.arrayBuffer());
  assert(img.headers.get('content-type') === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8, 'la foto guardada es JPEG');
  assert(!bytes.toString('latin1').includes('Exif'), 'la foto guardada no trae metadatos EXIF');
  must(await a.req('POST', `/admin/contests/${contest.id}/entries/${entry.id}/moderate`, { decision: 'APROBADA' }), 'aprobar');

  // ── Espera a que abra la votación ──
  const wait = opens - Date.now() + 1500;
  if (wait > 0) {
    console.log(`… esperando ${Math.ceil(wait / 1000)} s a que abra la votación`);
    await sleep(wait);
  }
  await p1.reload();
  await p1.getByText('Tu disfraz', { exact: true }).waitFor();
  assert((await p1.getByRole('button', { name: 'Votar' }).count()) === 0, 'nadie puede votar por su propio disfraz');

  // ── Persona 2 (celular): vota ──
  const ctx2 = await browser.newContext({ ...devices['Pixel 5'] });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => errors.push(e.message));
  await signUp(p2, `/concursos/${contest.id}`);
  await p2.goto(`${PWA}/concursos/${contest.id}`);
  await p2.getByRole('button', { name: 'Votar' }).click();
  await p2.getByText('¡Voto registrado!').waitFor();
  await p2.getByRole('button', { name: 'Tu voto' }).waitFor();
  assert(await p2.getByRole('button', { name: 'Tu voto' }).isDisabled(), 'el voto es único: el botón queda como «Tu voto»');
  await shot(p2, '2-votacion');

  // ── Pantalla pública (sin sesión, escritorio) ──
  const ctx3 = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const p3 = await ctx3.newPage();
  p3.on('pageerror', (e) => errors.push(e.message));
  const screenPath = must(await a.req('GET', `/admin/contests/${contest.id}`), 'detalle').screenPath;
  await p3.goto(`${PWA}${screenPath}`);
  await p3.getByRole('list', { name: 'Clasificación en vivo' }).waitFor();
  await p3.getByText('1 votos en total').waitFor({ timeout: 10_000 });
  assert(await p3.getByText('El pirata del Cable').first().isVisible(), 'la pantalla pública muestra el ranking en vivo sin iniciar sesión');
  assert(await p3.getByAltText(/Código QR para votar/).isVisible(), 'la pantalla muestra el QR para votar');
  const photoOk = await p3.evaluate(() => [...document.images].some((i) => i.alt.includes('El pirata') && i.naturalWidth > 0));
  assert(photoOk, 'la foto aprobada se ve en la pantalla');
  assert(!/@|\+57/.test(await p3.locator('body').innerText()), 'la pantalla no muestra datos de contacto');
  await shot(p3, '3-pantalla');
  // Un enlace de pantalla rotado deja de funcionar
  must(await a.req('POST', `/admin/contests/${contest.id}/screen/rotate`), 'rotar enlace');
  await p3.reload();
  await p3.getByText(/ya no está disponible/).waitFor({ timeout: 10_000 });
  assert(true, 'al rotar el enlace, la pantalla anterior deja de funcionar');

  // ── Consola: ve la inscripción, el conteo y puede moderar ──
  const final = must(await a.req('GET', `/admin/contests/${contest.id}`), 'detalle final');
  assert(final.votes === 1 && final.entriesList[0].votes === 1, 'la consola cuenta 1 voto para la inscripción');

  assert(errors.length === 0, `sin errores de JavaScript en las pantallas (${errors.join(' | ') || 'ninguno'})`);
  await browser.close();
  fs.rmSync(photoFile, { force: true });
  console.log('\nE2E del concurso de disfraces: OK');
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
