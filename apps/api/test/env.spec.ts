import { describe, expect, it } from 'vitest';
import { autoAccountEnabled, loadEnv, separationOfDutiesApplies } from '../src/config/env.ts';

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

describe('proveedor de códigos por pasarela (webhook)', () => {
  const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db', REDIS_URL: 'redis://localhost:6379', APP_SECRET: 'x'.repeat(40) };

  it('exige URL y token, y en producción solo https', () => {
    expect(() => loadEnv({ ...base, OTP_PROVIDER: 'webhook' })).toThrow(/OTP_WEBHOOK_URL/);
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'production', OTP_PROVIDER: 'webhook', OTP_WEBHOOK_URL: 'http://pasarela.local/otp', OTP_WEBHOOK_TOKEN: 't'.repeat(20) }),
    ).toThrow(/https/);
    expect(
      loadEnv({ ...base, NODE_ENV: 'production', OTP_PROVIDER: 'webhook', OTP_WEBHOOK_URL: 'https://pasarela.example/otp', OTP_WEBHOOK_TOKEN: 't'.repeat(20) })
        .OTP_PROVIDER,
    ).toBe('webhook');
  });
});

describe('código en el log (excepción de staging)', () => {
  const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db', REDIS_URL: 'redis://localhost:6379', APP_SECRET: 'x'.repeat(40) };

  it('en un servidor desplegado exige la frase explícita', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', OTP_PROVIDER: 'console' })).toThrow(/OTP_PROVIDER=console/);
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', OTP_PROVIDER: 'console', STAGING_OTP_LOG_ACK: 'si' })).toThrow(/OTP_PROVIDER=console/);
    expect(loadEnv({ ...base, NODE_ENV: 'production', OTP_PROVIDER: 'console', STAGING_OTP_LOG_ACK: 'solo-staging-sin-usuarios-reales' }).OTP_PROVIDER).toBe(
      'console',
    );
  });
});

describe('separación de funciones relajada (solo staging)', () => {
  const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db', REDIS_URL: 'redis://localhost:6379', APP_SECRET: 'x'.repeat(40) };

  it('por defecto se exige; solo con la frase exacta se relaja; un valor distinto falla', () => {
    expect(separationOfDutiesApplies(loadEnv(base))).toBe(true);
    expect(separationOfDutiesApplies(loadEnv({ ...base, STAGING_RELAX_SEPARATION_ACK: 'solo-staging-sin-usuarios-reales' }))).toBe(false);
    expect(() => loadEnv({ ...base, STAGING_RELAX_SEPARATION_ACK: 'si' })).toThrow(/STAGING_RELAX_SEPARATION_ACK/);
  });
});

describe('cuentas activas en staging (STAGING_AUTO_ACCOUNT_ACK)', () => {
  it('por defecto no; solo con la frase exacta; un valor distinto falla', () => {
    expect(autoAccountEnabled(loadEnv(base))).toBe(false);
    expect(autoAccountEnabled(loadEnv({ ...base, STAGING_AUTO_ACCOUNT_ACK: 'solo-staging-sin-usuarios-reales' }))).toBe(true);
    expect(() => loadEnv({ ...base, STAGING_AUTO_ACCOUNT_ACK: 'si' })).toThrow(/STAGING_AUTO_ACCOUNT_ACK/);
  });
});
