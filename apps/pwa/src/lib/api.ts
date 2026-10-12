import { API_PREFIX, type ApiError, ApiErrorSchema, type ErrorCode, HEADERS } from '@ilc/contracts';

/** Error tipado de la API: la UI decide por `code`, nunca por el texto (Guía Técnica §7.1). */
export class ApiRequestError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT',
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /**
   * Obligatoria en operaciones con efecto económico/promocional. Reutilice LA MISMA clave al reintentar
   * para que el servidor no duplique la operación (Guía Técnica §5.7 regla 8).
   */
  idempotencyKey?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const BASE = import.meta.env.VITE_API_URL ?? API_PREFIX;

/** Clave de idempotencia nueva por intención de usuario (no por intento de red). */
export function newIdempotencyKey(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

export async function apiRequest<T>(path: string, { method = 'GET', body, idempotencyKey, timeoutMs = 15_000, signal }: RequestOptions = {}): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const headers: Record<string, string> = { Accept: 'application/json', [HEADERS.requestId]: crypto.randomUUID() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers[HEADERS.idempotencyKey] = idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch {
    // Resultado incierto: el cliente debe consultar el estado antes de reintentar (§12.2).
    if (timeout.aborted) throw new ApiRequestError('TIMEOUT', 'La operación tardó demasiado. Verificaremos su estado.', true);
    throw new ApiRequestError('NETWORK_ERROR', 'Sin conexión. Revisa tu señal e intenta de nuevo.', true, undefined, undefined);
  }

  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;

  let parsed: ApiError | undefined;
  try {
    parsed = ApiErrorSchema.parse(await res.json());
  } catch {
    parsed = undefined;
  }
  if (parsed) {
    const e = parsed.error;
    throw new ApiRequestError(e.code, e.message, e.retryable, res.status, e.requestId);
  }
  throw new ApiRequestError('INTERNAL_ERROR', 'Ocurrió un error inesperado.', res.status >= 500, res.status, res.headers.get(HEADERS.requestId) ?? undefined);
}
