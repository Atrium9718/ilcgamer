import { ApiErrorSchema, HealthResponseSchema } from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers.ts';

let app: NestFastifyApplication;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app?.close();
});

const fastify = () => app.getHttpAdapter().getInstance();

describe('GET /api/v1/health', () => {
  it('responde con el contrato HealthResponse y dependencias arriba', async () => {
    const res = await fastify().inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    const body = HealthResponseSchema.parse(res.json());
    expect(body.checks).toEqual({ database: 'up', cache: 'up' });
    expect(body.environment).toBe('test');
  });
});

describe('errores y trazabilidad (Guía Técnica §7.1)', () => {
  it('una ruta inexistente devuelve ApiError NOT_FOUND con requestId', async () => {
    const res = await fastify().inject({ method: 'GET', url: '/api/v1/no-existe' });
    expect(res.statusCode).toBe(404);
    const body = ApiErrorSchema.parse(res.json());
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('respeta un X-Request-Id válido del cliente y reemplaza uno inválido', async () => {
    const ok = await fastify().inject({ method: 'GET', url: '/api/v1/health', headers: { 'x-request-id': 'soporte-12345678' } });
    expect(ok.headers['x-request-id']).toBe('soporte-12345678');
    const bad = await fastify().inject({ method: 'GET', url: '/api/v1/health', headers: { 'x-request-id': '<script>' } });
    expect(bad.headers['x-request-id']).not.toBe('<script>');
  });
});

describe('cabeceras de seguridad (Guía Técnica §9.1)', () => {
  it('aplica CSP, HSTS, nosniff y bloquea iframes', async () => {
    const res = await fastify().inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('CORS solo para orígenes configurados', async () => {
    const allowed = await fastify().inject({ method: 'GET', url: '/api/v1/health', headers: { origin: 'http://localhost:5173' } });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const denied = await fastify().inject({ method: 'GET', url: '/api/v1/health', headers: { origin: 'https://sitio-ajeno.example' } });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('publica el contrato OpenAPI con los esquemas compartidos', async () => {
    const res = await fastify().inject({ method: 'GET', url: '/api/v1/openapi.json' });
    const doc = res.json() as { paths: Record<string, unknown>; components: { schemas: Record<string, unknown> } };
    expect(Object.keys(doc.paths)).toContain('/api/v1/health');
    expect(Object.keys(doc.components.schemas)).toEqual(expect.arrayContaining(['ApiError', 'HealthResponse']));
  });
});
