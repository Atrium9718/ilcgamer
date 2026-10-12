import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';
import { DomainError } from './domain-error.ts';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defensa CSRF para la sesión por cookie (§9.1): toda operación que modifica estado y llega desde un
 * navegador debe venir de un origen permitido. SameSite=Lax es la primera barrera; esta es la segunda.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    if (SAFE.has(req.method)) return true;
    const origin = req.headers.origin;
    if (origin === undefined) return true; // clientes no-navegador (integraciones server-to-server, pruebas)
    if (this.env.CORS_ORIGINS.includes(origin)) return true;
    throw new DomainError('FORBIDDEN', 'Origen no permitido.');
  }
}
