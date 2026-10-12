import type { ErrorCode } from '@ilc/contracts';

/** Mensajes por defecto en español, sin datos internos ni personales. */
const DEFAULT_MESSAGES: Partial<Record<ErrorCode, string>> = {
  VALIDATION_FAILED: 'Revisa los datos enviados.',
  UNAUTHENTICATED: 'Necesitas iniciar sesión para continuar.',
  FORBIDDEN: 'No tienes permiso para esta acción.',
  NOT_FOUND: 'No encontramos lo que buscas.',
  RATE_LIMITED: 'Demasiados intentos. Espera un momento y vuelve a intentarlo.',
  IDEMPOTENCY_KEY_REQUIRED: 'Falta la clave de idempotencia de la operación.',
  IDEMPOTENCY_KEY_REUSED: 'Esta clave ya se usó con otros datos.',
  SERVICE_UNAVAILABLE: 'El servicio no está disponible. Intenta de nuevo en unos minutos.',
  INTERNAL_ERROR: 'Ocurrió un error inesperado. Puedes reintentar de forma segura.',
};

const RETRYABLE: ReadonlySet<ErrorCode> = new Set(['RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'INTERNAL_ERROR']);

/** Error de negocio con código estable del contrato (@ilc/contracts ERROR_CODES). */
export class DomainError extends Error {
  readonly retryable: boolean;

  constructor(
    readonly code: ErrorCode,
    message?: string,
    options?: { retryable?: boolean; fields?: Record<string, string[]> },
  ) {
    super(message ?? DEFAULT_MESSAGES[code] ?? code);
    this.retryable = options?.retryable ?? RETRYABLE.has(code);
    this.fields = options?.fields;
  }

  readonly fields?: Record<string, string[]>;
}
