import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';

/** Base de datos de pruebas (separada de desarrollo). En CI la provee el servicio postgres del workflow. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://ilc@localhost:5432/ilc_test';

export function useTestEnv(overrides: Record<string, string> = {}): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379',
    APP_SECRET: 'prueba-secreto-de-al-menos-32-caracteres-xx',
    CORS_ORIGINS: 'http://localhost:5173',
    OPENAPI_UI: 'false',
    OTP_PROVIDER: 'console',
    RATE_LIMIT_PER_MINUTE: '1000',
    AUTH_RATE_LIMIT_PER_MINUTE: '1000',
    CODE_RATE_LIMIT_PER_MINUTE: '1000',
    ...overrides,
  });
}

export async function createTestApp(): Promise<NestFastifyApplication> {
  useTestEnv();
  const { createApp } = await import('../src/bootstrap.ts');
  const app = await createApp({ logger: false });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

export function testPrisma(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }) });
}

/** Vacía todas las tablas. TRUNCATE no dispara los triggers por fila que protegen el ledger. */
export async function resetDatabase(db: PrismaClient): Promise<void> {
  const rows = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length) await db.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

/** Cliente HTTP de prueba con "frasco" de cookies, como un navegador. */
export function browser(app: NestFastifyApplication, origin: string | null = 'http://localhost:5173') {
  const jar = new Map<string, string>();
  const fastify = app.getHttpAdapter().getInstance();
  return {
    jar,
    async request(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
      const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
      const res = await fastify.inject({
        method,
        url: `/api/v1${url}`,
        payload: body === undefined ? undefined : (body as object),
        headers: { ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), ...extraHeaders },
      });
      const set = res.headers['set-cookie'];
      for (const c of Array.isArray(set) ? set : set ? [set] : []) {
        const [pair = ''] = c.split(';');
        const [name = '', value = ''] = pair.split('=');
        if (/Expires=Thu, 01 Jan 1970/i.test(c) || value === '') jar.delete(name);
        else jar.set(name, value);
      }
      return res;
    },
  };
}
