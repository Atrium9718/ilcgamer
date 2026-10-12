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
