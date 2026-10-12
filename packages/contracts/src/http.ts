/** Cabeceras HTTP del contrato (Guía Técnica §7.1). */
export const HEADERS = {
  /** Obligatoria en toda operación con efecto económico o promocional. */
  idempotencyKey: 'Idempotency-Key',
  /** Correlación de solicitudes en logs y soporte. */
  requestId: 'X-Request-Id',
} as const;

export const API_PREFIX = '/api/v1';
