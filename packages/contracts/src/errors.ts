import { z } from 'zod';

/**
 * Códigos de error de negocio estables (Guía Técnica §7.1: "código estable, mensaje no sensible y opción
 * de recuperación"). Los clientes deciden su UI por `code`, nunca por el texto del mensaje.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'CONFLICT',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'AGE_GATE_REQUIRED',
  'AGE_REQUIREMENT_NOT_MET',
  'CONSENT_REQUIRED',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_LOCKED',
  'AUTH_PROVIDER_NOT_CONFIGURED',
  'ACCOUNT_UNAVAILABLE',
  'CAMPAIGN_NOT_ACTIVE',
  'CODE_NOT_RECOGNIZED',
  'CODE_ALREADY_CLAIMED',
  'SESSION_NOT_FOUND',
  'SESSION_EXPIRED',
  'SESSION_PIN_INVALID',
  'SESSION_PIN_LOCKED',
  'INSUFFICIENT_BALANCE',
  'REWARD_OUT_OF_STOCK',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    /** Mensaje en español apto para mostrar; nunca incluye datos personales ni internos. */
    message: z.string(),
    /** true si el cliente puede reintentar de forma segura (con la misma Idempotency-Key). */
    retryable: z.boolean(),
    requestId: z.string().optional(),
    /** Detalle de validación por campo, solo para VALIDATION_FAILED. */
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Estado HTTP canónico de cada código. */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  IDEMPOTENCY_KEY_REQUIRED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  AGE_GATE_REQUIRED: 403,
  AGE_REQUIREMENT_NOT_MET: 403,
  CONSENT_REQUIRED: 409,
  OTP_INVALID: 422,
  OTP_EXPIRED: 410,
  OTP_LOCKED: 423,
  AUTH_PROVIDER_NOT_CONFIGURED: 503,
  ACCOUNT_UNAVAILABLE: 403,
  NOT_FOUND: 404,
  CODE_NOT_RECOGNIZED: 404,
  SESSION_NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  CODE_ALREADY_CLAIMED: 409,
  INSUFFICIENT_BALANCE: 409,
  REWARD_OUT_OF_STOCK: 409,
  SESSION_EXPIRED: 410,
  CAMPAIGN_NOT_ACTIVE: 422,
  SESSION_PIN_INVALID: 422,
  SESSION_PIN_LOCKED: 423,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};
