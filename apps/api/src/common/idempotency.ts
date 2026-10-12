import { HEADERS } from '@ilc/contracts';
import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { DomainError } from './domain-error.ts';

const IDEMPOTENT = 'ilc:idempotent';
const KEY_FORMAT = /^[A-Za-z0-9_-]{16,80}$/;

/**
 * Marca una ruta con efecto económico o promocional (Guía Técnica §7.1). La clave se persiste en la
 * tabla del recurso con restricción UNIQUE; esta guarda solo garantiza que exista y tenga formato válido.
 */
export const RequiresIdempotencyKey = () => SetMetadata(IDEMPOTENT, true);

@Injectable()
export class IdempotencyKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT, [context.getHandler(), context.getClass()]);
    if (!required) return true;
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const key = req.headers[HEADERS.idempotencyKey.toLowerCase()];
    if (typeof key !== 'string' || !KEY_FORMAT.test(key)) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED');
    return true;
  }
}

export function idempotencyKeyOf(req: FastifyRequest): string {
  return req.headers[HEADERS.idempotencyKey.toLowerCase()] as string;
}
