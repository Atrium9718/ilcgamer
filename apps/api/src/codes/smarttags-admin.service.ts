import type { BatchView, CreateProduct, GenerateCodes, ProductCodeStatus, ProductView } from '@ilc/contracts';
import { CampaignDraftSchema } from '@ilc/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.ts';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { DomainError } from '../common/domain-error.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { SettingsService } from '../platform/settings.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { csvLine } from './csv.ts';
import { generateToken, maskedHint, productTokenHash, tokenHint } from './tokens.ts';

/**
 * Administración de Smart Tags (Instrucciones §3.6, §4.1, §10; Guía Técnica §5.6). Los tokens en claro solo
 * salen una vez, en la descarga de una generación; todo lo demás muestra el último tramo enmascarado.
 */
@Injectable()
export class SmartTagsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // ───────── Productos ─────────

  async listProducts(): Promise<ProductView[]> {
    const products = await this.prisma.product.findMany({ include: { brand: true, _count: { select: { codes: true } } }, orderBy: { sku: 'asc' } });
    return products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      brandSlug: p.brand.slug,
      brandLabel: p.brand.name,
      active: p.active,
      codes: p._count.codes,
    }));
  }

  async createProduct(actor: Actor, input: CreateProduct): Promise<ProductView> {
    const brand = await this.prisma.brand.findUnique({ where: { slug: input.brandSlug } });
    if (!brand) throw new DomainError('VALIDATION_FAILED', 'La submarca no existe.', { fields: { brandSlug: ['Submarca desconocida'] } });
    try {
      const p = await this.prisma.product.create({ data: { sku: input.sku, name: input.name, brandId: brand.id } });
      await this.audit.record({
        actorId: actor.userId,
        action: 'product.created',
        resource: 'product',
        resourceId: p.id,
        requestId: actor.requestId,
        metadata: { sku: p.sku },
      });
      return { id: p.id, sku: p.sku, name: p.name, brandSlug: brand.slug, brandLabel: brand.name, active: p.active, codes: 0 };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new DomainError('CONFLICT', `Ya existe el SKU ${input.sku}.`);
      throw err;
    }
  }

  // ───────── Lotes ─────────

  async listBatches(): Promise<BatchView[]> {
    const [batches, byStatus, links] = await Promise.all([
      this.prisma.batch.findMany({ include: { product: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.productCode.groupBy({ by: ['batchId', 'status'], _count: { _all: true } }),
      this.prisma.$queryRaw<Array<{ batchId: string; campaignId: string; codes: bigint; claimed: bigint }>>`
        SELECT pc."batchId", cc."campaignId", count(*) AS codes, count(*) FILTER (WHERE cc.status = 'RECLAMADO') AS claimed
        FROM campaign_codes cc JOIN product_codes pc ON pc.id = cc."productCodeId"
        WHERE pc."batchId" IS NOT NULL GROUP BY 1, 2`,
    ]);
    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: [...new Set(links.map((l) => l.campaignId))] } },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    const title = (id: string) => {
      const c = campaigns.find((x) => x.id === id);
      const content = c?.versions[0]?.content;
      return { slug: c?.slug ?? '', title: content ? CampaignDraftSchema.parse(content).internalName : '' };
    };
    // Varios proveedores por lote son posibles al importar; se muestra el más frecuente.
    const suppliers = await this.prisma.productCode.groupBy({ by: ['batchId', 'supplier'], _count: { _all: true }, where: { supplier: { not: null } } });
    return batches.map((b) => {
      const counts = byStatus.filter((s) => s.batchId === b.id);
      const supplier = suppliers.filter((s) => s.batchId === b.id).sort((x, y) => y._count._all - x._count._all)[0]?.supplier ?? null;
      return {
        id: b.id,
        sku: b.product.sku,
        productName: b.product.name,
        label: b.label,
        supplier,
        total: counts.reduce((n, c) => n + c._count._all, 0),
        byStatus: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<ProductCodeStatus, number>>,
        revokedAt: b.revokedAt?.toISOString() ?? null,
        campaigns: links.filter((l) => l.batchId === b.id).map((l) => ({ ...title(l.campaignId), codes: Number(l.codes), claimed: Number(l.claimed) })),
        createdAt: b.createdAt.toISOString(),
      };
    });
  }

  /**
   * Vincula las botellas de un lote a una campaña: crea un código de campaña por botella (dominio separado),
   * con la vigencia de la campaña. La campaña debe incluir la submarca del producto.
   */
  async linkBatch(actor: Actor, batchId: string, campaignSlug: string): Promise<{ created: number; skipped: number }> {
    const batch = await this.findBatch(batchId);
    if (batch.revokedAt) throw new DomainError('CONFLICT', 'El lote está revocado.');
    const campaign = await this.prisma.campaign.findUnique({
      where: { slug: campaignSlug },
      include: { versions: { orderBy: { version: 'desc' } }, activeVersion: true },
    });
    if (!campaign) throw new DomainError('NOT_FOUND', 'No existe esa campaña.');
    if (campaign.status === 'CERRADA' || campaign.status === 'ARCHIVADA') throw new DomainError('CONFLICT', 'La campaña ya terminó.');
    if (campaign.route === 'B_EXPERIENCIAL')
      throw new DomainError('CONFLICT', 'La Ruta B no emite puntos por botella: vincula el lote a una campaña de Ruta A o mixta.');
    const version = campaign.activeVersion ?? campaign.versions[0];
    if (!version) throw new DomainError('CONFLICT', 'La campaña no tiene versión.');
    const draft = CampaignDraftSchema.parse(version.content);
    if (!draft.brandSlugs.includes(batch.product.brand.slug)) {
      throw new DomainError('CONFLICT', `La campaña no incluye la submarca ${batch.product.brand.name}.`);
    }

    // SQL directo: puede tratarse de decenas de miles de botellas. El hash del código de campaña se calcula en la
    // base de datos con la misma fórmula que tokens.ts (sha256('campaign:' || hash del producto)).
    const created = await this.prisma.$executeRaw`
      INSERT INTO campaign_codes (id, "codeHash", "codeHint", "campaignId", "productCodeId", status, "singleUse", "expiresAt", "createdAt")
      SELECT gen_random_uuid(), encode(sha256(convert_to('campaign:' || pc."tokenHash", 'UTF8')), 'hex'), pc."tokenHint",
             ${campaign.id}::uuid, pc.id, 'DISPONIBLE', true, ${version.endsAt}, now()
      FROM product_codes pc
      WHERE pc."batchId" = ${batch.id}::uuid AND pc.status IN ('ASIGNADO_A_LOTE', 'DISTRIBUIDO')
      ON CONFLICT DO NOTHING`;
    const eligible = await this.prisma.productCode.count({ where: { batchId: batch.id } });
    await this.audit.record({
      actorId: actor.userId,
      action: 'batch.linked_to_campaign',
      resource: 'batch',
      resourceId: batch.id,
      requestId: actor.requestId,
      metadata: { campaignId: campaign.id, created },
    });
    return { created, skipped: eligible - created };
  }

  async distributeBatch(actor: Actor, batchId: string): Promise<{ updated: number }> {
    const batch = await this.findBatch(batchId);
    if (batch.revokedAt) throw new DomainError('CONFLICT', 'El lote está revocado.');
    const res = await this.prisma.productCode.updateMany({ where: { batchId: batch.id, status: 'ASIGNADO_A_LOTE' }, data: { status: 'DISTRIBUIDO' } });
    await this.audit.record({
      actorId: actor.userId,
      action: 'batch.distributed',
      resource: 'batch',
      resourceId: batch.id,
      requestId: actor.requestId,
      metadata: { updated: res.count },
    });
    return { updated: res.count };
  }

  /** Revocación de lote (§5.6, §9.2): los códigos dejan de confirmarse y sus promociones sin reclamar se anulan. */
  async revokeBatch(actor: Actor, batchId: string, reason: string): Promise<{ codes: number; campaignCodes: number }> {
    const batch = await this.findBatch(batchId);
    if (batch.revokedAt) throw new DomainError('CONFLICT', 'El lote ya estaba revocado.');
    return this.prisma.$transaction(async (tx) => {
      await tx.batch.update({ where: { id: batch.id }, data: { revokedAt: new Date() } });
      const codes = await tx.productCode.updateMany({ where: { batchId: batch.id, status: { not: 'REVOCADO' } }, data: { status: 'REVOCADO' } });
      const campaignCodes = await tx.campaignCode.updateMany({
        where: { productCode: { batchId: batch.id }, status: { in: ['CREADO', 'DISPONIBLE'] } },
        data: { status: 'ANULADO' },
      });
      await this.audit.record(
        {
          actorId: actor.userId,
          action: 'batch.revoked',
          resource: 'batch',
          resourceId: batch.id,
          requestId: actor.requestId,
          reason,
          metadata: { codes: codes.count, campaignCodes: campaignCodes.count },
        },
        tx,
      );
      return { codes: codes.count, campaignCodes: campaignCodes.count };
    });
  }

  /**
   * Exportación de auditoría por lote (Instrucciones §10). Sin tokens completos, sin GPS (no se recolecta — §9.3)
   * y sin datos personales: la reclamación se identifica por su id.
   */
  async exportBatch(actor: Actor, batchId: string): Promise<{ fileName: string; csv: string }> {
    const batch = await this.findBatch(batchId);
    const rows = await this.prisma.$queryRaw<
      Array<{
        hint: string;
        status: string;
        lookups: bigint;
        lastLookup: Date | null;
        campaign: string | null;
        codeStatus: string | null;
        claimId: string | null;
        claimedAt: Date | null;
      }>
    >`
      SELECT pc."tokenHint" AS hint, pc.status::text AS status,
             (SELECT count(*) FROM product_code_events e WHERE e."productCodeId" = pc.id AND e.type = 'CONSULTA') AS lookups,
             (SELECT max(e."createdAt") FROM product_code_events e WHERE e."productCodeId" = pc.id AND e.type = 'CONSULTA') AS "lastLookup",
             c.slug AS campaign, cc.status::text AS "codeStatus", cl.id AS "claimId", cl."createdAt" AS "claimedAt"
      FROM product_codes pc
      LEFT JOIN campaign_codes cc ON cc."productCodeId" = pc.id
      LEFT JOIN campaigns c ON c.id = cc."campaignId"
      LEFT JOIN claims cl ON cl."campaignCodeId" = cc.id AND cl.confirmed
      WHERE pc."batchId" = ${batch.id}::uuid
      ORDER BY pc."createdAt"`;
    const lines = [
      csvLine(['codigo', 'sku', 'lote', 'estado_producto', 'consultas', 'ultima_consulta', 'campana', 'estado_promocion', 'reclamacion', 'fecha_reclamacion']),
      ...rows.map((r) =>
        csvLine([
          maskedHint(r.hint),
          batch.product.sku,
          batch.label,
          r.status,
          String(r.lookups),
          r.lastLookup?.toISOString() ?? '',
          r.campaign ?? '',
          r.codeStatus ?? '',
          r.claimId ?? '',
          r.claimedAt?.toISOString() ?? '',
        ]),
      ),
    ];
    await this.audit.record({
      actorId: actor.userId,
      action: 'batch.exported',
      resource: 'batch',
      resourceId: batch.id,
      requestId: actor.requestId,
      metadata: { rows: rows.length },
    });
    return { fileName: `auditoria-${batch.product.sku}-${batch.label.replace(/[^A-Za-z0-9_-]/g, '_')}.csv`, csv: `﻿${lines.join('\r\n')}\r\n` };
  }

  // ───────── Generación ─────────

  /**
   * Generación masiva para imprenta (Instrucciones §3.6). Devuelve los tokens en claro UNA sola vez, con la URL
   * según la plantilla vigente; la base de datos solo guarda su hash.
   */
  async generate(actor: Actor, input: GenerateCodes): Promise<{ fileName: string; csv: string }> {
    const product = await this.prisma.product.findUnique({ where: { sku: input.sku } });
    if (!product) throw new DomainError('VALIDATION_FAILED', 'SKU desconocido.', { fields: { sku: ['Crea el producto primero'] } });
    const batch = await this.prisma.batch.upsert({
      where: { productId_label: { productId: product.id, label: input.batchLabel } },
      update: {},
      create: { productId: product.id, label: input.batchLabel },
    });
    if (batch.revokedAt) throw new DomainError('CONFLICT', 'El lote está revocado.');
    const template = String(await this.settings.get('smarttags.urlTemplate'));

    const tokens: string[] = [];
    while (tokens.length < input.count) {
      const batchTokens = Array.from({ length: input.count - tokens.length }, () => generateToken());
      const res = await this.prisma.productCode.createMany({
        data: batchTokens.map((t) => ({
          tokenHash: productTokenHash(t),
          tokenHint: tokenHint(t),
          productId: product.id,
          batchId: batch.id,
          supplier: input.supplier ?? null,
          status: 'ASIGNADO_A_LOTE' as const,
        })),
        skipDuplicates: true,
      });
      // Con 60 bits una colisión es prácticamente imposible; si ocurre, esos tokens se descartan y se generan otros.
      if (res.count === batchTokens.length) tokens.push(...batchTokens);
      else {
        const stored = await this.prisma.productCode.findMany({
          where: { tokenHash: { in: batchTokens.map(productTokenHash) }, batchId: batch.id },
          select: { tokenHash: true },
        });
        const ok = new Set(stored.map((s) => s.tokenHash));
        tokens.push(...batchTokens.filter((t) => ok.has(productTokenHash(t))));
      }
    }
    await this.audit.record({
      actorId: actor.userId,
      action: 'smarttags.generated',
      resource: 'batch',
      resourceId: batch.id,
      requestId: actor.requestId,
      metadata: { sku: product.sku, count: tokens.length },
    });
    const lines = [csvLine(['token', 'url', 'sku', 'lote']), ...tokens.map((t) => csvLine([t, template.replace('{token}', t), product.sku, batch.label]))];
    return { fileName: `smarttags-${product.sku}-${batch.label.replace(/[^A-Za-z0-9_-]/g, '_')}.csv`, csv: `${lines.join('\r\n')}\r\n` };
  }

  // ───────── Configuración ─────────

  async urlTemplate(): Promise<{ urlTemplate: string }> {
    return { urlTemplate: String(await this.settings.get('smarttags.urlTemplate')) };
  }

  /** Cambiar la plantilla afecta solo a las próximas generaciones: los QR impresos siguen funcionando (§4.1). */
  async setUrlTemplate(actor: Actor, urlTemplate: string): Promise<{ urlTemplate: string }> {
    const before = await this.urlTemplate();
    await this.settings.set('smarttags.urlTemplate', urlTemplate, actor.userId);
    await this.audit.record({
      actorId: actor.userId,
      action: 'setting.updated',
      resource: 'platform_setting',
      resourceId: 'smarttags.urlTemplate',
      requestId: actor.requestId,
      metadata: { from: before.urlTemplate, to: urlTemplate },
    });
    return { urlTemplate };
  }

  private async findBatch(id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id }, include: { product: { include: { brand: true } } } });
    if (!batch) throw new DomainError('NOT_FOUND', 'No existe ese lote.');
    return batch;
  }
}
