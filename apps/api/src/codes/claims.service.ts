import { CampaignDraftSchema, type ClaimResult, SmartTagTokenSchema } from '@ilc/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.ts';
import { isCampaignOpen } from '../campaigns/campaign-state.ts';
import { DomainError } from '../common/domain-error.ts';
import type { Claim } from '../generated/prisma/client.ts';
import { Prisma } from '../generated/prisma/client.ts';
import type { AuthContext } from '../identity/auth.guard.ts';
import { ParcheService } from '../parche/parche.service.ts';
import { SettingsService } from '../platform/settings.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { needsReview } from './product-codes.service.ts';
import { addDays, pointsFor, startOfColombiaDay } from './rules.ts';
import { campaignCodeHash, productTokenHash } from './tokens.ts';

/**
 * Dominio 2 — código de CAMPAÑA (Guía Técnica §5.6, §5.7). Reclamar es atómico e idempotente:
 * - misma Idempotency-Key ⇒ misma respuesta, sin segunda emisión;
 * - dos solicitudes simultáneas del mismo código ⇒ un solo claim y una sola emisión
 *   (actualización condicional + índice único parcial `claims_one_confirmed_per_code`);
 * - límites por persona aplicados en servidor bajo un candado por usuario.
 */
@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly parche: ParcheService,
  ) {}

  async claim(
    token: string,
    auth: AuthContext,
    idempotencyKey: string,
    requestId: string,
    sessionId?: string,
    now = new Date(),
    staffCode?: string,
  ): Promise<ClaimResult> {
    const previous = await this.prisma.claim.findUnique({ where: { idempotencyKey } });
    if (previous) return this.replay(previous, auth, token);

    if (auth.user.status !== 'ACTIVA') {
      throw new DomainError('ACCOUNT_REQUIRED', 'Guarda tu progreso con tu número o correo para activar puntos.');
    }
    if (!SmartTagTokenSchema.safeParse(token).success) throw new DomainError('CODE_NOT_RECOGNIZED', 'Código no reconocido.');

    const code = await this.prisma.campaignCode.findUnique({
      where: { codeHash: campaignCodeHash(productTokenHash(token)) },
      include: {
        campaign: { include: { activeVersion: true } },
        productCode: { include: { product: { include: { brand: true } }, batch: true } },
      },
    });
    if (!code) throw new DomainError('CODE_NOT_RECOGNIZED', 'Este código no tiene una promoción asociada.');
    if (code.status === 'RECLAMADO') throw new DomainError('CODE_ALREADY_CLAIMED', 'Este código ya registra una reclamación.');
    const productCode = code.productCode;
    if (code.status === 'ANULADO' || (productCode !== null && needsReview(productCode))) {
      throw new DomainError('CODE_NOT_AVAILABLE', 'Este código requiere verificación adicional y no puede activarse ahora.');
    }
    const version = code.campaign.activeVersion;
    if (code.status === 'EXPIRADO' || (code.expiresAt && code.expiresAt.getTime() <= now.getTime())) {
      throw new DomainError('CODE_NOT_AVAILABLE', 'La promoción de este código ya terminó.');
    }
    if (!version || !isCampaignOpen(code.campaign, version, now)) {
      throw new DomainError('CAMPAIGN_NOT_ACTIVE', 'Esta promoción no está activa en este momento.');
    }
    if (version.minAge > (auth.user.ageVerifiedMinAge ?? 18)) {
      throw new DomainError('AGE_GATE_REQUIRED', `Esta promoción es solo para mayores de ${version.minAge} años. Confirma tu edad para continuar.`);
    }

    const draft = CampaignDraftSchema.parse(version.content);
    const sku = productCode?.product.sku;
    const { points, factor } = sku ? pointsFor(draft.rules, sku, now) : { points: 0, factor: 1 };
    const expiresAt = draft.rules.pointsExpiryDays ? addDays(now, draft.rules.pointsExpiryDays) : null;
    const limits = draft.rules.limits;

    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        // Un candado por persona serializa sus reclamaciones: los límites no se pueden saltar en paralelo.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${auth.user.id}, 0))`;
        // Doble toque: la otra solicitud con la misma clave pudo confirmar mientras esperábamos el candado.
        const twin = await tx.claim.findUnique({ where: { idempotencyKey } });
        if (twin) return { claim: twin, replayed: true, recharged: false };
        const today = await tx.claim.count({
          where: { userId: auth.user.id, confirmed: true, campaignCode: { campaignId: code.campaignId }, createdAt: { gte: startOfColombiaDay(now) } },
        });
        if (today >= limits.activationsPerUserPerDay) {
          throw new DomainError('CLAIM_LIMIT_REACHED', `Ya activaste ${limits.activationsPerUserPerDay} códigos de esta promoción hoy. Vuelve mañana.`);
        }
        if (limits.activationsPerUserTotal) {
          const total = await tx.claim.count({ where: { userId: auth.user.id, confirmed: true, campaignCode: { campaignId: code.campaignId } } });
          if (total >= limits.activationsPerUserTotal) throw new DomainError('CLAIM_LIMIT_REACHED', 'Alcanzaste el máximo de activaciones de esta promoción.');
        }

        const taken = await tx.campaignCode.updateMany({ where: { id: code.id, status: 'DISPONIBLE' }, data: { status: 'RECLAMADO' } });
        if (taken.count === 0) throw new DomainError('CODE_ALREADY_CLAIMED', 'Este código ya registra una reclamación.');

        // Quien atendió la mesa (Instrucciones §3.3): el código de Staff es opcional y, si no sirve, la activación sigue igual.
        const staff = staffCode ? await this.resolveStaff(tx, staffCode, auth.user.id) : null;
        const created = await tx.claim.create({
          data: {
            campaignCodeId: code.id,
            campaignVersionId: version.id,
            userId: auth.user.id,
            idempotencyKey,
            confirmed: true,
            staffUserId: staff?.userId ?? null,
          },
        });
        if (points > 0) {
          const account = await tx.ledgerAccount.upsert({
            where: { userId: auth.user.id },
            update: {},
            create: { ownerType: 'USUARIO', userId: auth.user.id },
          });
          await tx.ledgerEntry.create({
            data: {
              accountId: account.id,
              type: 'CREDITO',
              amount: points,
              campaignVersionId: version.id,
              ruleId: `pointsBySku:${sku}${factor > 1 ? `:x${factor}` : ''}`,
              sourceType: 'claim',
              sourceId: created.id,
              actorId: auth.user.id,
              idempotencyKey: `claim:${created.id}`,
              expiresAt,
            },
          });
          await tx.ledgerAccount.update({ where: { id: account.id }, data: { balance: { increment: points } } });
        }
        // Vínculo de economías solo por regla explícita de una campaña MIXTA aprobada (§5.7).
        if (code.campaign.route === 'MIXTA' && draft.rules.xpPerActivation) {
          await tx.xpEntry.create({
            data: { userId: auth.user.id, amount: draft.rules.xpPerActivation, source: 'campaign_mixed', idempotencyKey: `claim-xp:${created.id}` },
          });
        }
        await this.audit.record(
          {
            actorId: auth.user.id,
            action: 'campaign_code.claimed',
            resource: 'claim',
            resourceId: created.id,
            requestId,
            metadata: { campaignId: code.campaignId, version: version.version, points, factor, codeHint: code.codeHint, staffLinked: !!staff },
          },
          tx,
        );
        // Activación dentro de un Parche: recarga un bloque de energía (Instrucciones §5 paso 5).
        const recharged = sessionId ? await this.parche.rechargeFromClaim(tx, sessionId, auth.user.id, now) : false;
        if (recharged && sessionId) {
          // Solo se liga al Parche si la persona de verdad está en él; el Parche hereda el establecimiento del Staff.
          await tx.claim.update({ where: { id: created.id }, data: { sessionId } });
          if (staff) await tx.session.updateMany({ where: { id: sessionId, venueId: null }, data: { venueId: staff.venueId } });
        }
        await tx.analyticsEvent.create({
          data: { name: 'campaign_code_claimed', schemaVersion: 1, campaignId: code.campaignId, properties: { points, factor }, occurredAt: now },
        });
        return { claim: created, replayed: false, recharged };
      });
      if (outcome.replayed) return this.replay(outcome.claim, auth, token);
      if (outcome.recharged && sessionId) void this.parche.publish(sessionId);
      return this.result(outcome.claim, false, outcome.recharged);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Carrera con la misma clave: la otra solicitud ya confirmó; se devuelve su resultado.
        const same = await this.prisma.claim.findUnique({ where: { idempotencyKey } });
        if (same) return this.replay(same, auth, token);
        throw new DomainError('CODE_ALREADY_CLAIMED', 'Este código ya registra una reclamación.');
      }
      throw err;
    }
  }

  /** Reintento con la misma clave: solo vale para la misma persona y el mismo código (§7.1). */
  private async replay(claim: Claim, auth: AuthContext, token: string): Promise<ClaimResult> {
    const code = await this.prisma.campaignCode.findUnique({ where: { id: claim.campaignCodeId }, select: { codeHash: true } });
    if (claim.userId !== auth.user.id || code?.codeHash !== campaignCodeHash(productTokenHash(token))) {
      throw new DomainError('IDEMPOTENCY_KEY_REUSED');
    }
    return this.result(claim, true);
  }

  private async result(claim: Claim, replayed: boolean, parcheRecharged = false): Promise<ClaimResult> {
    const [entry, account, version, xp] = await Promise.all([
      this.prisma.ledgerEntry.findFirst({ where: { sourceType: 'claim', sourceId: claim.id } }),
      this.prisma.ledgerAccount.findUnique({ where: { userId: claim.userId } }),
      this.prisma.campaignVersion.findUniqueOrThrow({ where: { id: claim.campaignVersionId }, include: { campaign: true } }),
      this.prisma.xpEntry.findUnique({ where: { idempotencyKey: `claim-xp:${claim.id}` } }),
    ]);
    const draft = CampaignDraftSchema.parse(version.content);
    return {
      claimId: claim.id,
      replayed,
      points: entry?.amount ?? 0,
      xp: xp?.amount ?? 0,
      currencyName: String(await this.settings.get('economy.currencyName')),
      pointsExpireAt: entry?.expiresAt?.toISOString() ?? null,
      balance: account?.balance ?? 0,
      campaign: { slug: version.campaign.slug, title: draft.publicTitle },
      claimedAt: claim.createdAt.toISOString(),
      parcheRecharged,
    };
  }

  /** Staff activo de un establecimiento aprobado; nunca la propia persona (no se acredita a uno mismo). */
  private async resolveStaff(tx: Prisma.TransactionClient, code: string, claimantId: string): Promise<{ userId: string; venueId: string } | null> {
    const s = await tx.staffAccount.findUnique({ where: { staffCode: code }, include: { venue: true } });
    if (!s?.active || s.userId === claimantId || !s.venue.approvedAt || s.venue.suspendedAt) return null;
    return { userId: s.userId, venueId: s.venueId };
  }
}
