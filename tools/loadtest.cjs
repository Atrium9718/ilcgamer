#!/usr/bin/env node
/**
 * Prueba de carga de humo (Guía Técnica §11: rendimiento). Sin dependencias: concurrencia fija sobre fetch.
 *   API=http://localhost:3000/api/v1 COOKIE='ilc_sid=...' CONCURRENCY=50 SECONDS=10 node tools/loadtest.cjs
 * Mide latencia p50/p95/p99 y tasa de error por escenario y falla si p95 > P95_MS (300) o hay errores 5xx.
 * Para medir la API y no el limitador, arrancarla con RATE_LIMIT_PER_MINUTE y CODE_RATE_LIMIT_PER_MINUTE altos.
 */
const API = process.env.API ?? 'http://localhost:3000/api/v1';
const COOKIE = process.env.COOKIE ?? '';
const CONC = Number(process.env.CONCURRENCY ?? 50);
const SECONDS = Number(process.env.SECONDS ?? 10);
const P95 = Number(process.env.P95_MS ?? 300);
const headers = { Origin: process.env.ORIGIN ?? 'http://localhost:5173', ...(COOKIE ? { Cookie: COOKIE } : {}) };

const scenarios = [
  { name: 'GET /health', path: '/health' },
  { name: 'GET /config', path: '/config' },
  { name: 'GET /product-codes/:token/status (desconocido)', path: '/product-codes/ABCDEFGHJKLM/status' },
  ...(COOKIE
    ? [
        { name: 'GET /games', path: '/games' },
        { name: 'GET /rewards', path: '/rewards' },
        { name: 'GET /wallet', path: '/wallet' },
      ]
    : []),
];

const pct = (a, p) => a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];

async function run(s) {
  const lat = [];
  let errors = 0;
  let serverErrors = 0;
  const until = Date.now() + SECONDS * 1000;
  await Promise.all(
    Array.from({ length: CONC }, async () => {
      while (Date.now() < until) {
        const t = performance.now();
        try {
          const r = await fetch(API + s.path, { headers });
          await r.arrayBuffer();
          if (r.status >= 500) serverErrors++;
          else if (r.status >= 400 && r.status !== 404) errors++;
        } catch {
          serverErrors++;
        }
        lat.push(performance.now() - t);
      }
    }),
  );
  lat.sort((a, b) => a - b);
  return { name: s.name, n: lat.length, rps: Math.round(lat.length / SECONDS), p50: pct(lat, 50), p95: pct(lat, 95), p99: pct(lat, 99), errors, serverErrors };
}

(async () => {
  let failed = false;
  console.log(`Concurrencia ${CONC}, ${SECONDS}s por escenario, objetivo p95 ≤ ${P95} ms`);
  for (const s of scenarios) {
    const r = await run(s);
    const ok = r.p95 <= P95 && r.serverErrors === 0;
    failed ||= !ok;
    console.log(
      `${ok ? '✓' : '✗'} ${r.name}: ${r.rps} req/s · p50 ${r.p50.toFixed(0)} ms · p95 ${r.p95.toFixed(0)} ms · p99 ${r.p99.toFixed(0)} ms · 4xx ${r.errors} · 5xx ${r.serverErrors}`,
    );
  }
  process.exit(failed ? 1 : 0);
})();
