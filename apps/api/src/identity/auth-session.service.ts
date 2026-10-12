import { Inject, Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomToken, sha256 } from '../common/crypto.ts';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';
import type { Prisma, User } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

/**
 * Sesiones de acceso opacas en cookie HttpOnly + SameSite=Lax (+ Secure y prefijo __Host- fuera de desarrollo).
 * El token solo existe en el navegador; la base guarda su SHA-256. Revocables en cualquier momento.
 */
@Injectable()
export class AuthSessionService {
  readonly cookieName: string;
  private readonly secure: boolean;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.secure = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
    this.cookieName = this.secure ? '__Host-ilc_sid' : 'ilc_sid';
  }

  async create(userId: string, reply: FastifyReply, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    const token = randomToken();
    const expiresAt = new Date(Date.now() + this.env.SESSION_TTL_DAYS * 24 * 3600 * 1000);
    await tx.authSession.create({ data: { userId, tokenHash: sha256(token), expiresAt } });
    reply.setCookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
  }

  /** Usuario de la sesión vigente, o null. Cuentas eliminadas o suspendidas no tienen sesión válida. */
  async resolve(req: FastifyRequest): Promise<{ user: User; sessionId: string } | null> {
    const token = req.cookies?.[this.cookieName];
    if (!token || token.length > 128) return null;
    const session = await this.prisma.authSession.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
    if (session.user.status === 'ELIMINADA' || session.user.status === 'SUSPENDIDA') return null;
    // Actualizar "visto por última vez" como máximo cada 10 minutos para no escribir en cada solicitud.
    if (Date.now() - session.lastSeenAt.getTime() > 10 * 60 * 1000) {
      await this.prisma.authSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    }
    return { user: session.user, sessionId: session.id };
  }

  async revoke(sessionId: string, reply: FastifyReply, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.authSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
    this.clearCookie(reply);
  }

  async revokeAll(userId: string, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  clearCookie(reply: FastifyReply): void {
    reply.clearCookie(this.cookieName, { path: '/', httpOnly: true, secure: this.secure, sameSite: 'lax' });
  }
}
