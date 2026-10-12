import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.ts';

const base = {
  DATABASE_URL: 'postgresql://ilc@localhost:5432/x',
  REDIS_URL: 'redis://localhost:6379',
  APP_SECRET: 'un-secreto-aleatorio-de-mas-de-32-caracteres',
};

describe('configuración (falla temprano)', () => {
  it('acepta una configuración válida y separa orígenes CORS', () => {
    const env = loadEnv({ ...base, CORS_ORIGINS: 'https://a.co, https://b.co' });
    expect(env.CORS_ORIGINS).toEqual(['https://a.co', 'https://b.co']);
    expect(env.OPENAPI_UI).toBe(false);
  });

  it('rechaza secretos cortos y URLs inválidas', () => {
    expect(() => loadEnv({ ...base, APP_SECRET: 'corto' })).toThrow(/APP_SECRET/);
    expect(() => loadEnv({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it('impide arrancar producción con el secreto de ejemplo', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', APP_SECRET: 'cambiar-por-un-secreto-aleatorio-de-al-menos-32-caracteres' })).toThrow(/producción/);
  });
});
