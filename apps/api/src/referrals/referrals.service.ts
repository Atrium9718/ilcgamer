import { randomBytes } from 'node:crypto';
import { type ReferralMe, type ReferralSettings, ReferralSettingsSchema, type ReferralSummary } from '@ilc/contracts';
import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service.ts';
import { AuditService } from '../audit/audit.service.ts';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { DomainError } from '../common/domain-error.ts';
import { ProgressService } from '../economy/progress.service.ts';
import type { User } from '../generated/prisma/client.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { SettingsService } from '../platform/settings.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

type Tx = Prisma.TransactionClient;
const DAY = 86_400_000;
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const newCode = () => Array.from(randomBytes(8), (b) => ALPHABET[b % 32]).join('');
const lockUser = (tx: Tx, userId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;

/**
 * Referidos (Instrucciones §8; Guía Gamificación §16.2). La atribución es de una sola vez por persona; la bonificación
 * existe solo si está habilitada, tras una acción real del referido, con topes diarios y semanales para quien invita.
 * No hay huella de dispositivo (la Guía Técnica pide no activarla por defecto) ni lectura de contactos.
 */
@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
    private readonly progress: ProgressService,
  ) {}

  async config(): Promise<ReferralSettings> {
    return ReferralSettingsSchema.parse(await this.settings.get('referrals.settings'));
  }

  private rewardText(c: ReferralSettings, currencyName: string): string | null {
    if (!c.enabled || (c.referrerPoints === 0 && c.referrerXp === 0)) return null;
    const parts: string[] = [];
    if (c.referrerPoints > 0) parts.push(`${c.referrerPoints.toLocaleString('es-CO')} ${currencyName} cuando tu invitado (+18) activa su primera botella`);
    if (c.referrerXp > 0) parts.push(`${c.referrerXp} XP cuando tu invitado completa su primera misión`);
    return `Ganas ${parts.join(' y ')}. Máximo ${c.dailyCap} bonificaciones por día y ${c.weeklyCap} por semana. Invitar es voluntario: nunca por presionar a nadie.`;
  }

  /** Código propio, creado la primera vez que se pide. */
  async me(user: User): Promise<ReferralMe> {
    let row = await this.prisma.referralCode.findUnique({ where: { userId: user.id } });
    if (!row) {
      for (let i = 0; i < 5 && !row; i++) {
        try {
          row = await this.prisma.referralCode.create({ data: { userId: user.id, code: newCode() } });
        } catch (err) {
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
          row = await this.prisma.referralCode.findUnique({ where: { userId: user.id } });
        }
      }
      if (!row) throw new DomainError('INTERNAL_ERROR');
    }
    const [joined, rewarded, config, currency] = await Promise.all([
      this.prisma.referralAttribution.count({ where: { referrerId: user.id } }),
      this.prisma.referralAttribution.count({ where: { referrerId: user.id, OR: [{ claimRewardedAt: { not: null } }, { missionRewardedAt: { not: null } }] } }),
      this.config(),
      this.settings.get('economy.currencyName'),
    ]);
    return { code: row.code, linkPath: `/r/${row.code}`, joined, rewarded, rewardText: this.rewardText(config, String(currency)) };
  }

  /**
   * Atribuye el código de quien invitó a una cuenta nueva. Una sola vez, nunca a uno mismo, solo con la cuenta guardada
   * y dentro de la ventana desde su creación. Un código desconocido se ignora sin revelar si existe (anti-enumeración).
   */
  async attribute(user: User, code: string, requestId: string, now = new Date()): Promise<{ attributed: boolean }> {
    if (user.status !== 'ACTIVA') throw new DomainError('ACCOUNT_REQUIRED', 'Guarda tu progreso para usar un código de invitación.');
    const config = await this.config();
    if (now.getTime() - user.createdAt.getTime() > config.attributionWindowDays * DAY) return { attributed: false };
    const owner = await this.prisma.referralCode.findUnique({ where: { code } });
    if (!owner || owner.userId === user.id) return { attributed: false };
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.referralAttribution.create({ data: { referredId: user.id, referrerId: owner.userId } });
        await this.audit.record(
          { actorId: user.id, action: 'referral.attributed', resource: 'user', resourceId: user.id, requestId, metadata: { referrerId: owner.userId } },
          tx,
        );
        await this.analytics.emit('referral_attributed', {}, tx);
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { attributed: false };
      throw err;
    }
    return { attributed: true };
  }

  /**
   * Bonificación por la primera activación válida del referido (Ruta A → Puntos ILC). Se llama dentro de la transacción
   * de la reclamación; es idempotente y nunca hace fallar la activación del referido.
   */
  async onFirstClaim(tx: Tx, referredId: string, claimId: string, now: Date): Promise<void> {
    const config = await this.config();
    if (!config.enabled || config.referrerPoints <= 0) return;
    const attr = await tx.referralAttribution.findUnique({ where: { referredId } });
    if (!attr || attr.claimRewardedAt) return;
    if ((await tx.claim.count({ where: { userId: referredId, confirmed: true } })) !== 1) return;
    if (!(await this.withinCaps(tx, attr.referrerId, config, 'claim', now))) return this.capped(tx, 'claim');
    await lockUser(tx, attr.referrerId);
    const marked = await tx.referralAttribution.updateMany({ where: { referredId, claimRewardedAt: null }, data: { claimRewardedAt: now, rewardedAt: now } });
    if (marked.count === 0) return;
    const account = await tx.ledgerAccount.upsert({
      where: { userId: attr.referrerId },
      update: {},
      create: { ownerType: 'USUARIO', userId: attr.referrerId },
    });
    const days = Number(await this.settings.get('economy.defaultPointsExpiryDays'));
    await tx.ledgerEntry.create({
      data: {
        accountId: account.id,
        type: 'CREDITO',
        amount: config.referrerPoints,
        sourceType: 'referral',
        sourceId: claimId,
        actorId: null,
        idempotencyKey: `referral:${referredId}`,
        expiresAt: days > 0 ? new Date(now.getTime() + days * DAY) : null,
      },
    });
    await tx.ledgerAccount.update({ where: { id: account.id }, data: { balance: { increment: config.referrerPoints } } });
    await this.audit.record(
      {
        action: 'referral.rewarded',
        resource: 'user',
        resourceId: attr.referrerId,
        requestId: 'referral',
        metadata: { kind: 'claim', points: config.referrerPoints },
      },
      tx,
    );
    await this.analytics.emit('referral_rewarded', { properties: { kind: 'claim' } }, tx);
  }

  /** Bonificación por la primera misión del referido (Ruta B → XP). Economía separada: nunca da Puntos ILC. */
  async onFirstMission(tx: Tx, referredId: string, missionId: string, now: Date): Promise<void> {
    const config = await this.config();
    if (!config.enabled || config.referrerXp <= 0) return;
    const attr = await tx.referralAttribution.findUnique({ where: { referredId } });
    if (!attr || attr.missionRewardedAt) return;
    // Solo la primera misión verificada (no de prueba) del referido.
    if ((await tx.missionProgress.count({ where: { userId: referredId, status: 'VERIFICADA', preview: false, id: { not: missionId } } })) > 0) return;
    if (!(await this.withinCaps(tx, attr.referrerId, config, 'mission', now))) return this.capped(tx, 'mission');
    await lockUser(tx, attr.referrerId);
    const marked = await tx.referralAttribution.updateMany({
      where: { referredId, missionRewardedAt: null },
      data: { missionRewardedAt: now, rewardedAt: now },
    });
    if (marked.count === 0) return;
    await this.progress.awardXp(
      { userId: attr.referrerId, amount: config.referrerXp, source: 'referral', idempotencyKey: `referral-xp:${referredId}`, missionId },
      tx,
    );
    await this.audit.record(
      {
        action: 'referral.rewarded',
        resource: 'user',
        resourceId: attr.referrerId,
        requestId: 'referral',
        metadata: { kind: 'mission', xp: config.referrerXp },
      },
      tx,
    );
    await this.analytics.emit('referral_rewarded', { properties: { kind: 'mission' } }, tx);
  }

  /** Topes por quien invita: bonificaciones aplicadas en las últimas 24 h y 7 días. */
  private async withinCaps(tx: Tx, referrerId: string, c: ReferralSettings, _kind: 'claim' | 'mission', now: Date): Promise<boolean> {
    const count = (since: Date) => tx.referralAttribution.count({ where: { referrerId, rewardedAt: { gte: since } } });
    return (await count(new Date(now.getTime() - DAY))) < c.dailyCap && (await count(new Date(now.getTime() - 7 * DAY))) < c.weeklyCap;
  }

  private async capped(tx: Tx, kind: 'claim' | 'mission'): Promise<void> {
    await this.analytics.emit('referral_capped', { properties: { kind, window: 'cap' } }, tx);
  }

  // ───────────────────────── Consola ─────────────────────────

  async save(actor: Actor, input: ReferralSettings): Promise<ReferralSettings> {
    const before = await this.config();
    await this.settings.set('referrals.settings', input, actor.userId);
    await this.audit.record({
      actorId: actor.userId,
      action: 'referral.settings_changed',
      resource: 'platform_setting',
      resourceId: 'referrals.settings',
      requestId: actor.requestId,
      metadata: { before, after: input },
    });
    return input;
  }

  async summary(days: number, now = new Date()): Promise<ReferralSummary> {
    const from = new Date(now.getTime() - days * DAY);
    const [attributed, byClaim, byMission, capped] = await Promise.all([
      this.prisma.referralAttribution.count({ where: { createdAt: { gte: from } } }),
      this.prisma.referralAttribution.count({ where: { claimRewardedAt: { gte: from } } }),
      this.prisma.referralAttribution.count({ where: { missionRewardedAt: { gte: from } } }),
      this.prisma.analyticsEvent.count({ where: { name: 'referral_capped', occurredAt: { gte: from } } }),
    ]);
    return { days, attributed, rewardedByClaim: byClaim, rewardedByMission: byMission, capped };
  }
}
