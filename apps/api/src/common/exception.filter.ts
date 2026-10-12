import { type ApiError, ERROR_HTTP_STATUS, type ErrorCode, HEADERS } from '@ilc/contracts';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { DomainError } from './domain-error.ts';

const HTTP_TO_CODE: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

/**
 * Toda respuesta de error sigue ApiErrorSchema (Guía Técnica §7.1): código estable, mensaje seguro,
 * indicador de reintento y requestId para soporte. Nunca se exponen trazas ni SQL al cliente.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const err = this.toDomainError(exception);
    const status = ERROR_HTTP_STATUS[err.code];

    if (status >= 500) this.logger.error({ requestId: req.id, err: exception }, 'Error no controlado');

    const body: ApiError = {
      error: {
        code: err.code,
        message: err.message,
        retryable: err.retryable,
        requestId: String(req.id),
        ...(err.fields ? { fields: err.fields } : {}),
      },
    };
    reply.header(HEADERS.requestId, String(req.id)).status(status).send(body);
  }

  private toDomainError(exception: unknown): DomainError {
    if (exception instanceof DomainError) return exception;
    if (exception instanceof ZodError) {
      const fields: Record<string, string[]> = {};
      for (const issue of exception.issues) {
        const key = issue.path.join('.') || '_';
        fields[key] = [...(fields[key] ?? []), issue.message];
      }
      return new DomainError('VALIDATION_FAILED', undefined, { fields });
    }
    if (exception instanceof HttpException) {
      const code = HTTP_TO_CODE[exception.getStatus()] ?? (exception.getStatus() >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED');
      return new DomainError(code);
    }
    // Fastify (rate limit, cuerpo inválido…) adjunta statusCode.
    const statusCode = (exception as { statusCode?: number })?.statusCode;
    if (statusCode && HTTP_TO_CODE[statusCode]) return new DomainError(HTTP_TO_CODE[statusCode]);
    return new DomainError('INTERNAL_ERROR');
  }
}
