import { type BadgeAdmin, type BadgeAdminView, type Progress, XpLevelsSchema } from '@ilc/contracts';
import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service.ts';
import { AuditService } from '../audit/audit.service.ts';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { DomainError } from '../common/domain-error.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { SettingsService } from '../platform/settings.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { levelFor } from './allocation.ts';

type Tx = Prisma.TransactionClient;

/**
 * Economía de experiencia (Ruta B — Guía Técnica §5.7): XP, niveles e insignias. No monetaria y separada de los
 * Puntos ILC: aquí no existe ninguna conversión entre ambas. El motor de misiones (Paso 9) otorga XP e insignias
 * con estas mismas funciones idempotentes.
 */
@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
  ) {}

  /** Otorga XP una sola vez por clave. Devuelve false si esa clave ya se había usado. */
  async awardXp(input: { userId: string; amount: number; source: string; idempotencyKey: string; missionId?: string }, tx: Tx = this.prisma): Promise<boolean> {
    if (!Number.isInteger(input.amount) || input.amount <= 0) throw new DomainError('VALIDATION_FAILED', 'El XP debe ser un entero positivo.');
    const res = await tx.xpEntry.createMany({ data: [input], skipDuplicates: true });
    return res.count === 1;
  }

  /** Otorga una insignia una sola vez por persona. */
  async awardBadge(userId: string, slug: string, missionId?: string, tx: Tx = this.prisma): Promise<boolean> {
    const badge = await tx.badge.findUnique({ where: { slug } });
    if (!badge) throw new DomainError('NOT_FOUND', 'No existe esa insignia.');
    const res = await tx.badgeAward.createMany({ data: [{ userId, badgeId: badge.id, missionId: missionId ?? null }], skipDuplicates: true });
    if (res.count === 1) await this.analytics.emit('badge_awarded', { properties: { badge: slug } }, tx);
    return res.count === 1;
  }

  async progress(userId: string): Promise<Progress> {
    const [sum, catalog, awards, levels] = await Promise.all([
      this.prisma.xpEntry.aggregate({ where: { userId }, _sum: { amount: true } }),
      this.prisma.badge.findMany({ orderBy: { slug: 'asc' } }),
      this.prisma.badgeAward.findMany({ where: { userId } }),
      this.settings.get('economy.xpLevels'),
    ]);
    const xp = sum._sum.amount ?? 0;
    return {
      xp,
      level: levelFor(xp, XpLevelsSchema.parse(levels)),
      badges: catalog.map((b) => {
        const award = awards.find((a) => a.badgeId === b.id);
        return { slug: b.slug, name: b.name, icon: b.icon, earned: !!award, awardedAt: award?.awardedAt.toISOString() ?? null };
      }),
    };
  }

  // ───────── Catálogo de insignias (consola) ─────────

  async listBadges(): Promise<BadgeAdminView[]> {
    const badges = await this.prisma.badge.findMany({ include: { _count: { select: { awards: true } } }, orderBy: { slug: 'asc' } });
    return badges.map((b) => ({ slug: b.slug, name: b.name, icon: b.icon, awarded: b._count.awards }));
  }

  async createBadge(actor: Actor, input: BadgeAdmin): Promise<BadgeAdminView> {
    try {
      const b = await this.prisma.badge.create({ data: input });
      await this.audit.record({
        actorId: actor.userId,
        action: 'badge.created',
        resource: 'badge',
        resourceId: b.id,
        requestId: actor.requestId,
        metadata: { slug: b.slug },
      });
      return { ...input, awarded: 0 };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        throw new DomainError('CONFLICT', `Ya existe la insignia ${input.slug}.`);
      throw err;
    }
  }
}
