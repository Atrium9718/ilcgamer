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
  OTP_PROVIDER: z.enum(['console', 'webhook', 'none']).default('none'),
  /** Con OTP_PROVIDER=webhook: pasarela que entrega el código por WhatsApp, SMS o correo (el proveedor lo define ILC). */
  /**
   * Excepción SOLO para staging sin usuarios reales: permite OTP_PROVIDER=console en un servidor desplegado (el código sale en
   * el log de la API). Exige escribir exactamente esta frase; con usuarios reales debe estar vacío y usarse la pasarela.
   */
  STAGING_OTP_LOG_ACK: z.string().optional(),
  /**
   * Excepción SOLO para staging con una sola persona administradora: relaja "quien crea no aprueba/activa" (juegos, campañas,
   * recompensas). Exige la misma frase; con usuarios reales debe estar vacío.
   */
  STAGING_RELAX_SEPARATION_ACK: z.string().optional(),
  /**
   * Excepción SOLO para staging sin usuarios reales: tras el control de edad la cuenta nace ACTIVA (sin registrarse con celular
   * o correo), para recorrer la demostración «como si estuvieras con sesión». Exige la misma frase; con usuarios reales debe
   * estar vacío. No registra autorizaciones por la persona: las decisiones de consentimiento se siguen pidiendo.
   */
  STAGING_AUTO_ACCOUNT_ACK: z.string().optional(),
  /** true = la PWA exige el registro (nombre, correo, celular y tratamiento de datos) al entrar. Por defecto no (pruebas y CI). */
  REQUIRE_PROFILE_AT_ENTRY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  OTP_WEBHOOK_URL: z.url({ protocol: /^https?$/ }).optional(),
  OTP_WEBHOOK_TOKEN: z.string().min(16, 'OTP_WEBHOOK_TOKEN debe tener al menos 16 caracteres').optional(),
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
  /** Token (≥ 24 caracteres) para leer GET /api/v1/metrics. Vacío = métricas deshabilitadas (404). */
  METRICS_TOKEN: z.string().min(24, 'METRICS_TOKEN debe tener al menos 24 caracteres').optional(),
  APP_VERSION: z.string().default(packageVersion()),
});

export const STAGING_OTP_LOG_PHRASE = 'solo-staging-sin-usuarios-reales';

/** true = se exige separación de funciones (lo normal). Solo es false en staging con la frase de confirmación. */
export function separationOfDutiesApplies(env: Pick<Env, 'STAGING_RELAX_SEPARATION_ACK'>): boolean {
  return env.STAGING_RELAX_SEPARATION_ACK !== STAGING_OTP_LOG_PHRASE;
}

/** true solo en staging con la frase de confirmación: las cuentas nacen activas tras el control de edad. */
export function autoAccountEnabled(env: Pick<Env, 'STAGING_AUTO_ACCOUNT_ACK'>): boolean {
  return env.STAGING_AUTO_ACCOUNT_ACK === STAGING_OTP_LOG_PHRASE;
}

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
  if (deployed && parsed.data.OTP_PROVIDER === 'console' && parsed.data.STAGING_OTP_LOG_ACK !== STAGING_OTP_LOG_PHRASE) {
    throw new Error('Configuración inválida: OTP_PROVIDER=console solo se permite en desarrollo y pruebas (o en staging con STAGING_OTP_LOG_ACK explícito)');
  }
  if (parsed.data.STAGING_RELAX_SEPARATION_ACK && parsed.data.STAGING_RELAX_SEPARATION_ACK !== STAGING_OTP_LOG_PHRASE) {
    throw new Error('Configuración inválida: STAGING_RELAX_SEPARATION_ACK tiene un valor distinto a la frase de confirmación');
  }
  if (parsed.data.STAGING_AUTO_ACCOUNT_ACK && parsed.data.STAGING_AUTO_ACCOUNT_ACK !== STAGING_OTP_LOG_PHRASE) {
    throw new Error('Configuración inválida: STAGING_AUTO_ACCOUNT_ACK tiene un valor distinto a la frase de confirmación');
  }
  if (parsed.data.OTP_PROVIDER === 'webhook') {
    if (!parsed.data.OTP_WEBHOOK_URL || !parsed.data.OTP_WEBHOOK_TOKEN)
      throw new Error('Configuración inválida: OTP_PROVIDER=webhook exige OTP_WEBHOOK_URL y OTP_WEBHOOK_TOKEN');
    if (deployed && !parsed.data.OTP_WEBHOOK_URL.startsWith('https://'))
      throw new Error('Configuración inválida: OTP_WEBHOOK_URL debe ser https en staging y producción');
  }
  return parsed.data;
}
