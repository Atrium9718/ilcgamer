import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { safeEqualHex, sha256 } from '../common/crypto.ts';
import { DomainError } from '../common/domain-error.ts';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';

/**
 * Autenticación de integraciones servidor a servidor (ERP de ILC — Instrucciones §10): `Authorization: Bearer <clave>`.
 * La API solo conoce el SHA-256 de cada clave emitida por TI; sin claves configuradas, la integración está apagada.
 */
@Injectable()
export class IntegrationKeyGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.env.SMARTTAGS_INTEGRATION_KEY_HASHES.length === 0) {
      throw new DomainError('SERVICE_UNAVAILABLE', 'La integración de Smart Tags no está habilitada.', { retryable: false });
    }
    const header = context.switchToHttp().getRequest<FastifyRequest>().headers.authorization ?? '';
    const key = /^Bearer ([A-Za-z0-9._~-]{32,200})$/.exec(header)?.[1];
    const hash = key ? sha256(key) : '';
    // Compara contra todas las claves (tiempo constante por clave) para no revelar cuál coincidió.
    const ok = this.env.SMARTTAGS_INTEGRATION_KEY_HASHES.reduce((acc, h) => safeEqualHex(h, hash || '00') || acc, false);
    if (!ok) throw new DomainError('UNAUTHENTICATED', 'Credencial de integración no válida.');
    return true;
  }
}
