import { readFileSync } from 'node:fs';
import { z } from 'zod';

function packageVersion(): string {
  try {
    return (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }).version;
  } catch {
    return '0.0.0';
  }
}

/** Variables de entorno validadas al arrancar: si falta algo, la API no inicia (falla temprano). */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  APP_SECRET: z.string().min(32, 'APP_SECRET debe tener al menos 32 caracteres'),
  OPENAPI_UI: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  APP_VERSION: z.string().default(packageVersion()),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.APP_SECRET.startsWith('cambiar')) {
    throw new Error('Configuración inválida: APP_SECRET de ejemplo en producción');
  }
  return parsed.data;
}
