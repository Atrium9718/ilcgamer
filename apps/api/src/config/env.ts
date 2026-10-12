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
  /** Límite por IP para endpoints expuestos a fuerza bruta (control de edad, OTP). */
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
  /** Duración de la sesión de acceso (cookie) en días. */
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  /**
   * Proveedor de códigos OTP (WhatsApp/SMS/correo). "console" solo existe para desarrollo/pruebas;
   * "none" deshabilita el login por código hasta contratar proveedor (Guía Técnica §15).
   */
  OTP_PROVIDER: z.enum(['console', 'none']).default('none'),
  /** Límite por IP de la consulta pública de códigos (protección contra enumeración — §5.6). */
  CODE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
  /**
   * Integración ERP (POST /smarttags/validate — Instrucciones §10): SHA-256 (hex) de las claves emitidas por TI,
   * separadas por coma. Vacío = integración deshabilitada. La clave en claro nunca se configura en la API.
   */
  SMARTTAGS_INTEGRATION_KEY_HASHES: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().regex(/^[0-9a-f]{64}$/, 'Cada valor debe ser un SHA-256 en hexadecimal'))),
  APP_VERSION: z.string().default(packageVersion()),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${issues}`);
  }
  const deployed = parsed.data.NODE_ENV === 'production' || parsed.data.NODE_ENV === 'staging';
  if (deployed && parsed.data.APP_SECRET.startsWith('cambiar')) {
    throw new Error('Configuración inválida: APP_SECRET de ejemplo en producción');
  }
  if (deployed && parsed.data.OTP_PROVIDER === 'console') {
    throw new Error('Configuración inválida: OTP_PROVIDER=console solo se permite en desarrollo y pruebas');
  }
  return parsed.data;
}
