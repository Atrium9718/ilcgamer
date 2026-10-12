import { createHash, randomBytes } from 'node:crypto';
import {
  type AdjustStock,
  type AdminRewardClaim,
  CampaignDraftSchema,
  type ClaimReward,
  type CreateReward,
  IMMEDIATE_REWARD_TYPES,
  type MyRewardClaim,
  type RewardAdminView,
  type RewardCatalog,
  type RewardClaimResult,
} from '@ilc/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.ts';
import { isCampaignOpen } from '../campaigns/campaign-state.ts';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { DomainError } from '../common/domain-error.ts';
import type { User } from '../generated/prisma/client.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { SettingsService } from '../platform/settings.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

type Tx = Prisma.TransactionClient;
const DAY = 86_400_000;
/** Mismo candado por persona que usan la reclamación de códigos y el ledger: ningún movimiento corre en paralelo con otro. */
const lockUser = (tx: Tx, userId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LIVE = ['RESERVADO', 'RECLAMADO', 'ENTREGADO'] as const;

const newCode = () => Array.from(randomBytes(8), (b) => ALPHABET[b % 32]).join('');
const keyHash = (userId: string, key: string) => createHash('sha256').update(`${userId}:${key}`).digest('hex');

type ClaimRow = Prisma.RewardClaimGetPayload<{ include: { reward: true } }>;

/**
 * Rewards & Inventory (Guía Técnica §5.8; Instrucciones §6.2, §9). El canje descuenta stock, debita Puntos ILC y crea el
 * canje en UNA transacción bajo el candado de la persona: sin stock o sin saldo no pasa nada, y un reintento con la misma
 * clave devuelve el mismo canje. Lo no retirado vence; anular o vencer devuelve stock y puntos con movimientos compensatorios.
 */
@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────── Persona ─────────────────────────

  async catalog(user: User, now = new Date()): Promise<RewardCatalog> {
    const [rewards, account, mine, currencyName] = await Promise.all([
      this.prisma.reward.findMany({
        where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } },
        include: { inventory: true, campaign: { include: { activeVersion: true } } },
        orderBy: [{ cost: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.ledgerAccount.findUnique({ where: { userId: user.id } }),
      this.prisma.rewardClaim.groupBy({ by: ['rewardId'], where: { userId: user.id, status: { in: [...LIVE] } }, _count: true }),
      this.settings.get('economy.currencyName'),
    ]);
    const claimed = new Map(mine.map((m) => [m.rewardId, m._count]));
    const items = rewards
      .filter((r) => !r.campaign || isCampaignOpen(r.campaign, r.campaign.activeVersion, now))
      .map((r) => {
        const zones = r.inventory.map((i) => ({ zone: i.zone, available: i.available })).sort((a, b) => a.zone.localeCompare(b.zone, 'es'));
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          type: r.type,
          icon: r.icon,
          cost: r.cost,
          conditions: r.conditions,
          maxPerUser: r.maxPerUser,
          endsAt: r.endsAt.toISOString(),
          campaign: r.campaign?.activeVersion
            ? { slug: r.campaign.slug, title: CampaignDraftSchema.parse(r.campaign.activeVersion.content).publicTitle }
            : null,
          zones,
          soldOut: zones.every((z) => z.available <= 0),
          claimedByYou: claimed.get(r.id) ?? 0,
          delivery: IMMEDIATE_REWARD_TYPES.includes(r.type) ? ('immediate' as const) : ('pickup' as const),
        };
      });
    return { balance: account?.balance ?? 0, currencyName: String(currencyName), rewards: items };
  }

  async claim(user: User, rewardId: string, input: ClaimReward, idempotencyKey: string, requestId: string, now = new Date()): Promise<RewardClaimResult> {
    const key = keyHash(user.id, idempotencyKey);
    const previous = await this.prisma.rewardClaim.findUnique({ where: { idempotencyKey: key }, include: { reward: true } });
    if (previous) return this.replay(previous, user.id);
    if (user.status !== 'ACTIVA') throw new DomainError('ACCOUNT_REQUIRED', 'Guarda tu progreso con tu número o correo para canjear recompensas.');
    const days = Number(await this.settings.get('rewards.reservationDays'));

    try {
      const claim = await this.prisma.$transaction(async (tx) => {
        await lockUser(tx, user.id);
        const again = await tx.rewardClaim.findUnique({ where: { idempotencyKey: key }, include: { reward: true } });
        if (again) return { row: again, replayed: true };

        const reward = await tx.reward.findUnique({ where: { id: rewardId }, include: { campaign: { include: { activeVersion: true } } } });
        const open =
          !!reward &&
          reward.active &&
          reward.startsAt <= now &&
          now < reward.endsAt &&
          (!reward.campaign || isCampaignOpen(reward.campaign, reward.campaign.activeVersion, now));
        if (!reward || !open) throw new DomainError('REWARD_NOT_AVAILABLE', 'Esta recompensa no está disponible en este momento.');
        const used = await tx.rewardClaim.count({ where: { rewardId, userId: user.id, status: { in: [...LIVE] } } });
        if (used >= reward.maxPerUser) throw new DomainError('REWARD_LIMIT_REACHED', 'Ya alcanzaste el máximo de canjes de esta recompensa.');
        const zone = await tx.rewardInventory.findUnique({ where: { rewardId_zone: { rewardId, zone: input.zone } } });
        if (!zone) throw new DomainError('REWARD_NOT_AVAILABLE', 'Esta recompensa no se ofrece en esa zona.');

        // Stock y saldo con actualización condicional: o se cumplen ambos o se deshace todo.
        const stock = await tx.rewardInventory.updateMany({
          where: { rewardId, zone: input.zone, available: { gte: 1 } },
          data: { available: { decrement: 1 } },
        });
        if (stock.count === 0) throw new DomainError('REWARD_OUT_OF_STOCK', 'Esta recompensa se agotó en esa zona.');
        let accountId: string | null = null;
        if (reward.cost > 0) {
          const account = await tx.ledgerAccount.findUnique({ where: { userId: user.id } });
          const paid = account
            ? await tx.ledgerAccount.updateMany({ where: { id: account.id, balance: { gte: reward.cost } }, data: { balance: { decrement: reward.cost } } })
            : { count: 0 };
          if (!account || paid.count === 0) throw new DomainError('INSUFFICIENT_BALANCE', 'No tienes puntos suficientes para esta recompensa.');
          accountId = account.id;
        }

        const immediate = IMMEDIATE_REWARD_TYPES.includes(reward.type);
        const created = await tx.rewardClaim.create({
          data: {
            rewardId,
            userId: user.id,
            zone: input.zone,
            status: immediate ? 'ENTREGADO' : 'RESERVADO',
            idempotencyKey: key,
            cost: reward.cost,
            code: newCode(),
            expiresAt: immediate ? null : new Date(now.getTime() + days * DAY),
            deliveredAt: immediate ? now : null,
          },
          include: { reward: true },
        });
        if (accountId) {
          const entry = await tx.ledgerEntry.create({
            data: {
              accountId,
              type: 'DEBITO',
              amount: -reward.cost,
              campaignVersionId: reward.campaign?.activeVersionId ?? null,
              sourceType: 'reward_claim',
              sourceId: created.id,
              actorId: user.id,
              idempotencyKey: `reward:${created.id}`,
            },
          });
          await tx.rewardClaim.update({ where: { id: created.id }, data: { ledgerEntryId: entry.id } });
        }
        await this.audit.record(
          {
            actorId: user.id,
            action: 'reward.claimed',
            resource: 'reward_claim',
            resourceId: created.id,
            requestId,
            metadata: { reward: reward.slug, zone: input.zone, cost: reward.cost },
          },
          tx,
        );
        await tx.analyticsEvent.create({
          data: { name: 'reward_claimed', schemaVersion: 1, properties: { reward: reward.slug, type: reward.type, zone: input.zone }, occurredAt: now },
        });
        if (zone.available - 1 <= zone.lowStockAlert && zone.available > zone.lowStockAlert) {
          // Alerta de stock bajo al cruzar el umbral (una sola vez por cruce).
          await this.audit.record(
            {
              action: 'reward.low_stock',
              resource: 'reward',
              resourceId: reward.id,
              requestId,
              metadata: { reward: reward.slug, zone: input.zone, available: zone.available - 1, threshold: zone.lowStockAlert },
            },
            tx,
          );
        }
        return { row: created, replayed: false };
      });
      return this.result(claim.row, user.id, claim.replayed);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const row = await this.prisma.rewardClaim.findUnique({ where: { idempotencyKey: key }, include: { reward: true } });
        if (row) return this.replay(row, user.id);
      }
      throw err;
    }
  }

  async mine(userId: string): Promise<MyRewardClaim[]> {
    const rows = await this.prisma.rewardClaim.findMany({ where: { userId }, include: { reward: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((r) => ({
      id: r.id,
      rewardName: r.reward.name,
      icon: r.reward.icon,
      status: r.status,
      code: r.status === 'RESERVADO' || r.status === 'RECLAMADO' || r.status === 'ENTREGADO' ? r.code : null,
      cost: r.cost,
      zone: r.zone,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.status === 'RESERVADO' ? (r.expiresAt?.toISOString() ?? null) : null,
      deliveredAt: r.deliveredAt?.toISOString() ?? null,
    }));
  }

  private async replay(row: ClaimRow, userId: string): Promise<RewardClaimResult> {
    if (row.userId !== userId) throw new DomainError('IDEMPOTENCY_KEY_REUSED');
    return this.result(row, userId, true);
  }

  private async result(row: ClaimRow, userId: string, replayed: boolean): Promise<RewardClaimResult> {
    const [account, currencyName] = await Promise.all([this.prisma.ledgerAccount.findUnique({ where: { userId } }), this.settings.get('economy.currencyName')]);
    return {
      claimId: row.id,
      status: row.status,
      rewardName: row.reward.name,
      cost: row.cost,
      zone: row.zone,
      code: row.code ?? '',
      balance: account?.balance ?? 0,
      currencyName: String(currencyName),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      replayed,
    };
  }

  // ───────────────────────── Consola: catálogo e inventario ─────────────────────────

  async list(now = new Date()): Promise<RewardAdminView[]> {
    const rewards = await this.prisma.reward.findMany({ include: { inventory: true, campaign: true }, orderBy: { createdAt: 'desc' } });
    const counts = await this.prisma.rewardClaim.groupBy({ by: ['rewardId', 'status'], _count: true });
    void now;
    return rewards.map((r) => {
      const n = (statuses: string[]) => counts.filter((c) => c.rewardId === r.id && statuses.includes(c.status)).reduce((a, c) => a + c._count, 0);
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        type: r.type,
        icon: r.icon,
        cost: r.cost,
        conditions: r.conditions,
        maxPerUser: r.maxPerUser,
        startsAt: r.startsAt.toISOString(),
        endsAt: r.endsAt.toISOString(),
        active: r.active,
        fulfillment: r.fulfillment,
        campaignSlug: r.campaign?.slug ?? null,
        zones: r.inventory
          .map((i) => ({ zone: i.zone, available: i.available, lowStockAlert: i.lowStockAlert, low: i.available <= i.lowStockAlert }))
          .sort((a, b) => a.zone.localeCompare(b.zone, 'es')),
        counts: { reserved: n(['RESERVADO', 'RECLAMADO']), delivered: n(['ENTREGADO']), cancelled: n(['ANULADO', 'EXPIRADO']) },
      };
    });
  }

  async create(actor: Actor, input: CreateReward): Promise<RewardAdminView> {
    let campaignId: string | null = null;
    if (input.campaignSlug) {
      const c = await this.prisma.campaign.findUnique({ where: { slug: input.campaignSlug } });
      if (!c)
        throw new DomainError('VALIDATION_FAILED', 'La campaña no existe.', { fields: { campaignSlug: ['No existe una campaña con ese identificador.'] } });
      campaignId = c.id;
    }
    try {
      const reward = await this.prisma.$transaction(async (tx) => {
        const created = await tx.reward.create({
          data: {
            slug: input.slug,
            name: input.name,
            description: input.description,
            type: input.type,
            icon: input.icon,
            cost: input.cost,
            conditions: input.conditions,
            maxPerUser: input.maxPerUser,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
            fulfillment: input.fulfillment,
            campaignId,
            createdById: actor.userId,
            active: false,
            inventory: { create: input.zones.map((z) => ({ zone: z.zone, available: z.available, lowStockAlert: z.lowStockAlert })) },
          },
        });
        await this.audit.record(
          {
            actorId: actor.userId,
            action: 'reward.created',
            resource: 'reward',
            resourceId: created.id,
            requestId: actor.requestId,
            metadata: { slug: created.slug, cost: created.cost },
          },
          tx,
        );
        return created;
      });
      return this.one(reward.id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        throw new DomainError('CONFLICT', 'Ya existe una recompensa con ese identificador.');
      throw err;
    }
  }

  private async one(id: string): Promise<RewardAdminView> {
    const found = (await this.list()).find((r) => r.id === id);
    if (!found) throw new DomainError('NOT_FOUND', 'No existe esa recompensa.');
    return found;
  }

  /** Activa una recompensa. Quien la creó no puede activarla (separación de funciones, §12.2). */
  async setActive(actor: Actor, id: string, active: boolean, reason?: string): Promise<RewardAdminView> {
    const reward = await this.prisma.reward.findUnique({ where: { id } });
    if (!reward) throw new DomainError('NOT_FOUND', 'No existe esa recompensa.');
    if (active) {
      if (reward.createdById === actor.userId) throw new DomainError('FORBIDDEN', 'Quien creó la recompensa no puede activarla: pide a otra persona de Marca.');
      if (reward.endsAt <= new Date()) throw new DomainError('CONFLICT', 'La fecha final de esta recompensa ya pasó.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.reward.update({ where: { id }, data: { active, activatedById: active ? actor.userId : reward.activatedById } });
      await this.audit.record(
        {
          actorId: actor.userId,
          action: active ? 'reward.activated' : 'reward.deactivated',
          resource: 'reward',
          resourceId: id,
          requestId: actor.requestId,
          reason,
          metadata: { slug: reward.slug },
        },
        tx,
      );
    });
    return this.one(id);
  }

  /** Reposición o descuento de stock con motivo y auditoría; nunca deja el stock negativo. */
  async adjustStock(actor: Actor, id: string, input: AdjustStock): Promise<RewardAdminView> {
    const zone = await this.prisma.rewardInventory.findUnique({ where: { rewardId_zone: { rewardId: id, zone: input.zone } } });
    if (!zone) throw new DomainError('NOT_FOUND', 'Esa zona no existe en esta recompensa. Usa una zona ya definida.');
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.rewardInventory.updateMany({
        where: { rewardId: id, zone: input.zone, ...(input.delta < 0 ? { available: { gte: -input.delta } } : {}) },
        data: { available: { increment: input.delta }, ...(input.lowStockAlert !== undefined ? { lowStockAlert: input.lowStockAlert } : {}) },
      });
      if (done.count === 0) throw new DomainError('CONFLICT', 'El descuento supera el stock disponible.');
      await this.audit.record(
        {
          actorId: actor.userId,
          action: 'reward.stock_adjusted',
          resource: 'reward',
          resourceId: id,
          requestId: actor.requestId,
          reason: input.reason,
          metadata: { zone: input.zone, delta: input.delta },
        },
        tx,
      );
    });
    return this.one(id);
  }

  // ───────────────────────── Consola: canjes ─────────────────────────

  async claims(filter: { status?: string; code?: string }): Promise<AdminRewardClaim[]> {
    const rows = await this.prisma.rewardClaim.findMany({
      where: { ...(filter.status ? { status: filter.status as never } : {}), ...(filter.code ? { code: filter.code.toUpperCase() } : {}) },
      include: { reward: true, user: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      rewardSlug: r.reward.slug,
      rewardName: r.reward.name,
      zone: r.zone,
      status: r.status,
      cost: r.cost,
      userId: r.userId,
      userAlias: r.user.alias,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt?.toISOString() ?? null,
      deliveredAt: r.deliveredAt?.toISOString() ?? null,
      cancelReason: r.cancelReason,
    }));
  }

  /** Entrega contra el código que presenta la persona. Una sola vez, antes de que venza, y no a sí mismo. */
  async deliver(actor: Actor, code: string, now = new Date()): Promise<AdminRewardClaim> {
    const claim = await this.prisma.rewardClaim.findUnique({ where: { code } });
    if (!claim) throw new DomainError('NOT_FOUND', 'No encontramos un canje con ese código.');
    if (claim.userId === actor.userId) throw new DomainError('FORBIDDEN', 'No puedes entregarte tu propio canje.');
    if (claim.status === 'ENTREGADO') throw new DomainError('CONFLICT', 'Este canje ya fue entregado.');
    if (claim.status !== 'RESERVADO' && claim.status !== 'RECLAMADO') throw new DomainError('CONFLICT', 'Este canje ya no está vigente.');
    if (claim.expiresAt && claim.expiresAt <= now) throw new DomainError('CONFLICT', 'La reserva de este canje venció.');
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.rewardClaim.updateMany({
        where: { id: claim.id, status: { in: ['RESERVADO', 'RECLAMADO'] } },
        data: { status: 'ENTREGADO', deliveredAt: now, deliveredById: actor.userId },
      });
      if (done.count === 0) throw new DomainError('CONFLICT', 'Este canje ya fue entregado.');
      await this.audit.record(
        { actorId: actor.userId, action: 'reward.delivered', resource: 'reward_claim', resourceId: claim.id, requestId: actor.requestId },
        tx,
      );
    });
    return this.adminClaim(claim.id);
  }

  async cancel(actor: Actor, claimId: string, reason: string): Promise<AdminRewardClaim> {
    const claim = await this.prisma.rewardClaim.findUnique({ where: { id: claimId }, include: { reward: true } });
    if (!claim) throw new DomainError('NOT_FOUND', 'No existe ese canje.');
    if (claim.userId === actor.userId) throw new DomainError('FORBIDDEN', 'No puedes anular tu propio canje.');
    if (claim.status !== 'RESERVADO' && claim.status !== 'RECLAMADO') throw new DomainError('CONFLICT', 'Solo se anulan canjes pendientes de entrega.');
    await this.prisma.$transaction((tx) => this.release(tx, claim, 'ANULADO', reason, actor.userId, actor.requestId));
    return this.adminClaim(claimId);
  }

  private async adminClaim(id: string): Promise<AdminRewardClaim> {
    const found = (await this.claims({})).find((c) => c.id === id);
    if (!found) throw new DomainError('NOT_FOUND', 'No existe ese canje.');
    return found;
  }

  /** Vence las reservas no retiradas: devuelve stock y puntos. Idempotente (cada canje cambia de estado una sola vez). */
  async expireDue(now = new Date()): Promise<number> {
    const due = await this.prisma.rewardClaim.findMany({ where: { status: 'RESERVADO', expiresAt: { lte: now } }, include: { reward: true }, take: 100 });
    let n = 0;
    for (const claim of due) {
      const ok = await this.prisma
        .$transaction((tx) => this.release(tx, claim, 'EXPIRADO', 'Reserva vencida sin retirar', null, 'scheduler'))
        .then(
          () => true,
          (err) => {
            if (err instanceof DomainError) return false;
            throw err;
          },
        );
      if (ok) n++;
    }
    return n;
  }

  /** Libera el stock y devuelve los puntos con un movimiento compensatorio ligado al débito original. */
  private async release(tx: Tx, claim: ClaimRow, status: 'ANULADO' | 'EXPIRADO', reason: string, actorId: string | null, requestId: string): Promise<void> {
    await lockUser(tx, claim.userId);
    const changed = await tx.rewardClaim.updateMany({
      where: { id: claim.id, status: { in: ['RESERVADO', 'RECLAMADO'] } },
      data: { status, cancelledAt: new Date(), cancelReason: reason },
    });
    if (changed.count === 0) throw new DomainError('CONFLICT', 'Este canje ya cambió de estado.');
    await tx.rewardInventory.update({ where: { rewardId_zone: { rewardId: claim.rewardId, zone: claim.zone } }, data: { available: { increment: 1 } } });
    if (claim.cost > 0 && claim.ledgerEntryId) {
      const account = await tx.ledgerAccount.findUniqueOrThrow({ where: { userId: claim.userId } });
      const refund = await tx.ledgerEntry.create({
        data: {
          accountId: account.id,
          type: 'REVERSO',
          amount: claim.cost,
          sourceType: 'reward_refund',
          sourceId: claim.id,
          originalEntryId: claim.ledgerEntryId,
          reason,
          actorId,
          idempotencyKey: `reward-refund:${claim.id}`,
        },
      });
      await tx.ledgerAccount.update({ where: { id: account.id }, data: { balance: { increment: claim.cost } } });
      await tx.rewardClaim.update({ where: { id: claim.id }, data: { refundEntryId: refund.id } });
    }
    await this.audit.record(
      {
        actorId,
        action: status === 'ANULADO' ? 'reward.cancelled' : 'reward.expired',
        resource: 'reward_claim',
        resourceId: claim.id,
        requestId,
        reason,
        metadata: { refunded: claim.cost },
      },
      tx,
    );
  }
}
