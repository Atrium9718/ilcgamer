import type { Role } from '@ilc/contracts';
import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { DomainError } from '../common/domain-error.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import type { AuthContext } from './auth.guard.ts';

const ROLES_KEY = 'ilc:roles';

/** Roles con acceso a la consola (lectura de campañas). */
export const CONSOLE_ROLES: Role[] = ['ADMIN_MARCA', 'EDITOR_CONTENIDO', 'REVISOR_MARCA', 'REVISOR_JURIDICO', 'RESPONSABLE_PRIVACIDAD', 'SUPERADMIN'];

/** Restringe la ruta a estos roles (RBAC, Guía Técnica §9.1). SUPERADMIN siempre pasa. Usar después de AuthGuard. */
export const RequireRoles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export type RoledRequest = FastifyRequest & { auth?: AuthContext | null; roles?: Role[] };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const req = context.switchToHttp().getRequest<RoledRequest>();
    if (!req.auth) throw new DomainError('UNAUTHENTICATED');
    if (req.auth.user.status !== 'ACTIVA') throw new DomainError('FORBIDDEN');
    const roles = (await this.prisma.userRole.findMany({ where: { userId: req.auth.user.id }, select: { role: true } })).map((r) => r.role as Role);
    req.roles = roles;
    if (roles.includes('SUPERADMIN') || roles.some((r) => required.includes(r))) return true;
    throw new DomainError('FORBIDDEN');
  }
}
