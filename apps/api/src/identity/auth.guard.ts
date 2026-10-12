import { type CanActivate, createParamDecorator, type ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { DomainError } from '../common/domain-error.ts';
import type { User } from '../generated/prisma/client.ts';
import { AuthSessionService } from './auth-session.service.ts';

export interface AuthContext {
  user: User;
  sessionId: string;
}

type AuthedRequest = FastifyRequest & { auth?: AuthContext | null };

/** Exige sesión válida y adjunta el usuario a la solicitud. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessions: AuthSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    req.auth = await this.sessions.resolve(req);
    if (!req.auth) throw new DomainError('UNAUTHENTICATED');
    return true;
  }
}

/** Adjunta el usuario si hay sesión, sin exigirla (p. ej. control de edad). */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly sessions: AuthSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    req.auth = await this.sessions.resolve(req);
    return true;
  }
}

export const Auth = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().auth ?? null);
