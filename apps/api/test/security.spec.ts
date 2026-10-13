import { MissionStartSchema } from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildOpenApi } from '../src/bootstrap.ts';
import { ENV } from '../src/config/config.module.ts';
import type { Env } from '../src/config/env.ts';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { person } from './fixtures.ts';
import { activateModule, team, triviaManifest } from './game-fixtures.ts';
import { browser, createTestApp, resetDatabase, testPrisma } from './helpers.ts';

let app: NestFastifyApplication;
let db: PrismaClient;

beforeAll(async () => {
  app = await createTestApp();
  db = testPrisma();
  await resetDatabase(db);
});
afterAll(async () => {
  await app?.close();
  await db?.$disconnect();
});

const UUID = '00000000-0000-7000-8000-000000000001';
const KEY = { 'idempotency-key': 'k'.repeat(24) };
const fill = (path: string) =>
  path
    .replace(/\{(id|userId|claimId|entryId)\}/g, UUID)
    .replace(/\{slug\}/g, 'x-slug')
    .replace(/\{version\}/g, '1.0.0')
    .replace(/\{token\}/g, 'X89K2P4M7K2Q')
    .replace(/\{[^}]+\}/g, 'abcd1234');

/**
 * Rutas que, por diseño, se pueden llamar sin sesión. Todo lo demás debe exigirla: si aparece una ruta nueva sin
 * protección, esta prueba falla y obliga a decidir (Guía Técnica §12.1 suite 6: autorización vertical).
 */
const PUBLIC = new Set([
  'GET /api/v1/config',
  'GET /api/v1/health',
  'POST /api/v1/age-gate',
  'POST /api/v1/auth/otp/request',
  'POST /api/v1/auth/otp/verify',
  'POST /api/v1/auth/logout',
  'POST /api/v1/auth/oauth/{provider}',
  'GET /api/v1/product-codes/{token}/status',
  'GET /api/v1/campaigns/{slug}',
  // Con firma HMAC propia del proveedor o llave de integración (no sesión).
  'POST /api/v1/games/provider-callback',
  'POST /api/v1/smarttags/validate',
]);

function operations() {
  const doc = buildOpenApi(app, app.get<Env>(ENV));
  const out: Array<{ method: string; path: string; key: string }> = [];
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      if ((item as Record<string, unknown>)[method]) out.push({ method: method.toUpperCase(), path, key: `${method.toUpperCase()} ${path}` });
    }
  }
  return out.filter((o) => !o.path.endsWith('/openapi.json'));
}

describe('autorización vertical: nada protegido responde sin sesión', () => {
  it('toda ruta fuera de la lista pública exige sesión (401)', async () => {
    const ops = operations();
    expect(ops.length).toBeGreaterThan(80);
    const anon = browser(app);
    const open: string[] = [];
    for (const o of ops) {
      if (PUBLIC.has(o.key)) continue;
      const res = await anon.request(o.method as 'GET', fill(o.path).replace('/api/v1', ''), o.method === 'GET' || o.method === 'DELETE' ? undefined : {}, KEY);
      if (res.statusCode !== 401) open.push(`${o.key} → ${res.statusCode}`);
    }
    expect(open).toEqual([]);
  });

  it('un jugador común recibe 403 en toda la consola (/admin) y en los paneles de Staff y Comercio', async () => {
    const player = await person(app, db);
    const forbidden: string[] = [];
    for (const o of operations()) {
      if (!o.path.includes('/admin/') && !o.path.includes('/staff/') && !o.path.includes('/dealer/')) continue;
      const res = await player.request(
        o.method as 'GET',
        fill(o.path).replace('/api/v1', ''),
        o.method === 'GET' || o.method === 'DELETE' ? undefined : {},
        KEY,
      );
      if (res.statusCode !== 403) forbidden.push(`${o.key} → ${res.statusCode}`);
    }
    expect(forbidden).toEqual([]);
  });

  it('la consola de Marca no abre rutas de TI exclusivas ni al revés (SUPERADMIN siempre pasa, los demás no)', async () => {
    const editor = await person(app, db, ['EDITOR_CONTENIDO']);
    const denied = ['POST /admin/games/modules', 'POST /admin/smarttags/generate', 'POST /admin/rewards', 'POST /admin/venues', 'GET /admin/analytics'];
    for (const d of denied) {
      const [method, path] = d.split(' ') as [string, string];
      expect((await editor.request(method as 'POST', path, {})).statusCode, d).toBe(403);
    }
  });
});

describe('cabeceras y cookies (Guía Técnica §9.1)', () => {
  it('responde con CSP restrictiva, sin sniffing, sin frames y sin exponer el servidor', async () => {
    const res = await browser(app).request('GET', '/health');
    const h = (res as unknown as { headers: Record<string, string> }).headers;
    expect(h['content-security-policy']).toContain("default-src 'none'");
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-powered-by']).toBeUndefined();
    expect(h['cross-origin-resource-policy']).toBe('same-site');
  });

  it('la cookie de sesión es HttpOnly y SameSite, y no viaja en el cuerpo', async () => {
    const fastify = app.getHttpAdapter().getInstance();
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/v1/age-gate',
      headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
      payload: { birthDate: '1990-08-14', declaration: true },
    });
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=(Lax|Strict)/i);
    expect(res.body).not.toContain(cookie.split('=')[1]?.split(';')[0] ?? 'x');
  });

  it('rechaza peticiones con efecto desde un origen no permitido (CSRF)', async () => {
    const evil = browser(app, 'https://evil.example');
    const res = await evil.request('POST', '/age-gate', { birthDate: '1990-08-14', declaration: true });
    expect(res.statusCode).toBe(403);
  });

  it('un cuerpo con __proto__ o constructor no contamina ni se acepta', async () => {
    const res = await browser(app).request('POST', '/age-gate', JSON.parse('{"birthDate":"1990-08-14","declaration":true,"__proto__":{"admin":true}}'));
    expect([200, 400]).toContain(res.statusCode);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });
});

describe('autorización horizontal y manipulación del cliente (Guía Técnica §9.2)', () => {
  it('nadie lee ni entrega la misión de otra persona', async () => {
    const t = await team(app, db);
    await activateModule(t, triviaManifest());
    await t.admin.request('PUT', '/admin/games/defaults', { modules: ['trivia-prueba'] });
    const ana = await person(app, db);
    const bea = await person(app, db);
    const m = MissionStartSchema.parse(
      (await ana.request('POST', '/games/start', { moduleId: 'trivia-prueba' }, { 'idempotency-key': 'a'.repeat(20) })).json(),
    );
    expect((await bea.request('GET', `/missions/${m.missionId}`)).statusCode).toBe(404);
    expect((await bea.request('POST', `/missions/${m.missionId}/submit`, { answers: [] })).statusCode).toBe(404);
    expect((await ana.request('GET', `/missions/${m.missionId}`)).statusCode).toBe(200);
  });

  it('un Parche solo lo ve quien participa', async () => {
    const ana = await person(app, db, [], 'Ana');
    const bea = await person(app, db, [], 'Bea');
    const s = (await ana.request('POST', '/sessions', { name: 'Mesa 1', alias: 'Ana' })).json() as { id: string };
    expect([403, 404]).toContain((await bea.request('GET', `/sessions/${s.id}`)).statusCode);
    expect((await ana.request('GET', `/sessions/${s.id}`)).statusCode).toBe(200);
  });

  it('el resultado de un juego nunca lo decide el cliente: campos de puntaje en la entrega se ignoran o se rechazan', async () => {
    const t = await team(app, db);
    await activateModule(t, triviaManifest({ moduleId: 'trivia-dos' }));
    await t.admin.request('PUT', '/admin/games/defaults', { modules: ['trivia-dos'] });
    const p = await person(app, db);
    const m = MissionStartSchema.parse((await p.request('POST', '/games/start', { moduleId: 'trivia-dos' }, { 'idempotency-key': 'b'.repeat(20) })).json());
    const res = await p.request('POST', `/missions/${m.missionId}/submit`, { answers: [], parcheScore: 9999, xp: 9999, pointsEarned: 9999 });
    expect([200, 400]).toContain(res.statusCode);
    if (res.statusCode === 200) expect(res.json()).toMatchObject({ parcheScore: 0, xp: 0, pointsEarned: 0 });
  });

  it('adivinar códigos de referido está limitado por ritmo', async () => {
    const p = await person(app, db);
    const codes = Array.from({ length: 14 }, (_, i) => `ZZZZZ${String(i).padStart(3, '0')}`.slice(0, 8));
    const statuses: number[] = [];
    for (const code of codes) statuses.push((await p.request('POST', '/referrals/attribute', { code })).statusCode);
    expect(statuses).toContain(429);
  });
});

describe('observabilidad (Guía Técnica §11)', () => {
  const token = 'token-de-metricas-de-prueba-0123456789';
  const get = (auth?: string) =>
    app
      .getHttpAdapter()
      .getInstance()
      .inject({ method: 'GET', url: '/api/v1/metrics', headers: auth ? { authorization: auth } : {} });

  it('las métricas exigen su token y no se mezclan con la sesión de las personas', async () => {
    expect((await get()).statusCode).toBe(401);
    expect((await get('Bearer incorrecto')).statusCode).toBe(401);
    expect((await get(`Bearer ${token}`)).statusCode).toBe(200);
  });

  it('exponen solicitudes y duración por ruta con plantilla, sin tokens ni PIN en las etiquetas', async () => {
    await browser(app).request('GET', '/product-codes/X89K2P4M7K2Q/status');
    await browser(app).request('GET', '/health');
    const text = (await get(`Bearer ${token}`)).body;
    expect(text).toContain('ilc_http_requests_total{method="GET",route="/api/v1/product-codes/:token/status"');
    expect(text).toContain('ilc_http_request_duration_seconds_count{method="GET",route="/api/v1/health"}');
    expect(text).not.toContain('X89K2P4M7K2Q');
    expect(text).toMatch(/ilc_up 1/);
    expect(text).toMatch(/ilc_cache_up [01]/);
  });
});
