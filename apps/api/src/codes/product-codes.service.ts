import { CampaignDraftSchema, type ClaimAvailability, type IntegrationValidateResponse, type ProductCodeLookup, SmartTagTokenSchema } from '@ilc/contracts';
import { Injectable } from '@nestjs/common';
import { isCampaignOpen } from '../campaigns/campaign-state.ts';
import { DomainError } from '../common/domain-error.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import type { AuthContext } from '../identity/auth.guard.ts';
import { SettingsService } from '../platform/settings.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { RedisService } from '../redis/redis.service.ts';
import { pointsFor } from './rules.ts';
import { campaignCodeHash, productTokenHash } from './tokens.ts';

/** Consultas de códigos inexistentes por IP en 10 minutos antes de frenar (enumeración — §5.6, §9.2). */
export const UNKNOWN_LOOKUPS_LIMIT = 20;
const UNKNOWN_WINDOW_S = 600;
const CORPORATE = { brandLabel: 'Industria Licorera de Caldas', themeId: 'ilc' } as const;

type CodeWithProduct = Prisma.ProductCodeGetPayload<{ include: { product: { include: { brand: true } }; batch: true } }>;

/** El código de producto existe, pero no se puede confirmar (revocado, alerta, fuera de circulación). */
export function needsReview(code: CodeWithProduct): boolean {
  return code.status === 'REVOCADO' || code.status === 'ALERTA_DE_ANOMALIA' || code.status === 'GENERADO' || code.batch?.revokedAt != null;
}

/**
 * Dominio 1 — código de PRODUCTO (Guía Técnica §5.6). Consultar no consume ningún beneficio: cada consulta es
 * un evento acumulativo. Las respuestas nunca afirman autenticidad física absoluta ni incluyen datos personales.
 */
@Injectable()
export class ProductCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
  ) {}

  async lookup(token: string, auth: AuthContext | null, ip: string, now = new Date()): Promise<ProductCodeLookup> {
    const code = SmartTagTokenSchema.safeParse(token).success ? await this.findProductCode(token) : null;
    if (!code) {
      await this.noteUnknown(ip);
      return { status: 'unrecognized', ...CORPORATE, campaign: null };
    }

    await this.prisma.productCodeEvent.create({ data: { productCodeId: code.id, type: 'CONSULTA', context: { channel: 'pwa' } } });
    const flagged = await this.checkAnomaly(code, now);
    const current = flagged ? { ...code, status: 'ALERTA_DE_ANOMALIA' as const } : code;
    const review = needsReview(current);

    const brand = { brandLabel: code.product.brand.name, themeId: code.product.brand.themeId };
    const productLabel = [code.product.name, code.batch ? `Lote ${code.batch.label}` : null].filter(Boolean).join(' · ');
    const campaign = await this.campaignFor(code, review, auth, now);
    const status = review ? 'needs_review' : campaign?.availability === 'claimed' ? 'already_claimed' : 'recognized';
    return { status, ...brand, productLabel, campaign };
  }

  /** POST /smarttags/validate: estado logístico para el ERP (Instrucciones §10). No reclama ni cuenta como consulta pública. */
  async validateForIntegration(token: string): Promise<IntegrationValidateResponse> {
    const code = await this.findProductCode(token);
    if (!code) return { recognized: false, status: null, sku: null, batch: null, revoked: false };
    await this.prisma.productCodeEvent.create({ data: { productCodeId: code.id, type: 'CONSULTA', context: { channel: 'integracion' } } });
    return {
      recognized: true,
      status: code.status,
      sku: code.product.sku,
      batch: code.batch?.label ?? null,
      revoked: code.status === 'REVOCADO' || code.batch?.revokedAt != null,
    };
  }

  private findProductCode(token: string): Promise<CodeWithProduct | null> {
    return this.prisma.productCode.findUnique({
      where: { tokenHash: productTokenHash(token) },
      include: { product: { include: { brand: true } }, batch: true },
    });
  }

  private async campaignFor(code: CodeWithProduct, review: boolean, auth: AuthContext | null, now: Date): Promise<ProductCodeLookup['campaign']> {
    const cc = await this.prisma.campaignCode.findUnique({
      where: { codeHash: campaignCodeHash(code.tokenHash) },
      include: { campaign: { include: { activeVersion: true } }, claims: { where: { confirmed: true }, select: { userId: true } } },
    });
    const version = cc?.campaign.activeVersion;
    if (!cc || !version) return null;

    const draft = CampaignDraftSchema.parse(version.content);
    const { points } = pointsFor(draft.rules, code.product.sku, now);
    const expired = cc.status === 'EXPIRADO' || (cc.expiresAt && cc.expiresAt.getTime() <= now.getTime()) || version.endsAt.getTime() <= now.getTime();
    let availability: ClaimAvailability;
    if (cc.status === 'RECLAMADO') availability = cc.claims.some((c) => c.userId === auth?.user.id) ? 'claimed_by_you' : 'claimed';
    else if (expired || cc.campaign.status === 'CERRADA' || cc.campaign.status === 'ARCHIVADA') availability = 'expired';
    else if (cc.status !== 'DISPONIBLE' || review || !isCampaignOpen(cc.campaign, version, now)) availability = 'not_available';
    else availability = 'available';

    return {
      slug: cc.campaign.slug,
      title: draft.publicTitle,
      availability,
      points,
      currencyName: String(await this.settings.get('economy.currencyName')),
      pointsExpiryDays: draft.rules.pointsExpiryDays ?? null,
      minAge: version.minAge,
      endsAt: version.endsAt.toISOString(),
      activationsPerUserPerDay: draft.rules.limits.activationsPerUserPerDay,
    };
  }

  /**
   * Muchas consultas del mismo código en una hora sugieren un QR copiado: se marca ALERTA_DE_ANOMALIA para revisión
   * humana, sin declarar fraudulento a nadie ni bloquear cuentas (§5.6, §9.2).
   */
  private async checkAnomaly(code: CodeWithProduct, now: Date): Promise<boolean> {
    if (code.status === 'ALERTA_DE_ANOMALIA' || code.status === 'REVOCADO') return false;
    const threshold = Number(await this.settings.get('smarttags.anomalyLookupsPerHour'));
    const key = `pc:lookups:${code.tokenHash}:${Math.floor(now.getTime() / 3_600_000)}`;
    const count = await this.counter(key, 3600);
    if (count <= threshold) return false;
    const res = await this.prisma.productCode.updateMany({ where: { id: code.id, status: code.status }, data: { status: 'ALERTA_DE_ANOMALIA' } });
    if (res.count === 0) return true;
    await this.prisma.$transaction([
      this.prisma.productCodeEvent.create({ data: { productCodeId: code.id, type: 'ANOMALIA', context: { reason: 'consultas_por_hora', count, threshold } } }),
      this.prisma.securityEvent.create({
        data: { type: 'smarttags.lookup_anomaly', severity: 'MEDIA', subjectId: code.id, metadata: { tokenHint: code.tokenHint, count, threshold } },
      }),
    ]);
    return true;
  }

  private async noteUnknown(ip: string): Promise<void> {
    const count = await this.counter(`pc:unknown:${ip}`, UNKNOWN_WINDOW_S);
    if (count === UNKNOWN_LOOKUPS_LIMIT + 1) {
      await this.prisma.securityEvent.create({
        data: { type: 'smarttags.enumeration_suspected', severity: 'MEDIA', metadata: { count, windowSeconds: UNKNOWN_WINDOW_S } },
      });
    }
    if (count > UNKNOWN_LOOKUPS_LIMIT) throw new DomainError('RATE_LIMITED', 'Demasiadas consultas de códigos no reconocidos. Intenta más tarde.');
  }

  /** Contador con vencimiento. Sin Redis, la consulta sigue funcionando (el límite por IP de Fastify sigue activo). */
  private async counter(key: string, ttlSeconds: number): Promise<number> {
    try {
      if (!(await this.redis.isHealthy())) return 0;
      const count = await this.redis.client.incr(key);
      if (count === 1) await this.redis.client.expire(key, ttlSeconds);
      return count;
    } catch {
      return 0;
    }
  }
}
