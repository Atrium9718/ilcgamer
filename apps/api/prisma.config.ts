import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no carga .env automáticamente. En CI/producción las variables ya están en el entorno.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` no necesita conexión; migrate/deploy sí exigen DATABASE_URL.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
