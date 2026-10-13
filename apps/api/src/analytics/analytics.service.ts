import { type AnalyticsDashboard, type AnalyticsEventName, CampaignDraftSchema, type ClientEvent } from '@ilc/contracts';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

type Db = Prisma.TransactionClient | PrismaService;
const DAY = 86_400_000;
const bogotaDay = (d: Date) => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);

/**
 * Propiedades permitidas por evento (Guía Técnica §10.1: finalidad, datos permitidos, versión). Todo lo demás se descarta
 * al emitir, de modo que ningún evento pueda arrastrar datos personales ni afirmar consumo.
 */
const REGISTRY: Record<AnalyticsEventName, { version: number; allowed: readonly string[] }> = {
  campaign_viewed: { version: 1, allowed: [] },
  age_gate_result_recorded: { version: 1, allowed: ['result'] },
  mission_started: { version: 1, allowed: ['moduleId', 'route'] },
  mission_completed: { version: 1, allowed: ['moduleId', 'route', 'xp'] },
  badge_awarded: { version: 1, allowed: ['badge'] },
  session_created: { version: 1, allowed: ['route', 'mode'] },
  session_joined: { version: 1, allowed: [] },
  session_closed: { version: 1, allowed: ['reason'] },
  product_code_status_checked: { version: 1, allowed: ['status'] },
  campaign_code_claimed: { version: 1, allowed: ['points', 'factor'] },
  commercial_points_credited: { version: 1, allowed: ['amount', 'source'] },
  commercial_points_reversed: { version: 1, allowed: ['amount'] },
  reward_viewed: { version: 1, allowed: ['reward'] },
  reward_claimed: { version: 1, allowed: ['reward', 'type', 'zone'] },
  consent_updated: { version: 1, allowed: ['purpose', 'granted'] },
  share_card_generated: { version: 1, allowed: ['template', 'target'] },
  share_link_opened: { version: 1, allowed: ['source'] },
  staff_activation_recorded: { version: 1, allowed: [] },
  referral_attributed: { version: 1, allowed: [] },
  referral_rewarded: { version: 1, allowed: ['kind'] },
  referral_capped: { version: 1, allowed: ['kind', 'window'] },
};

export interface EmitInput {
  campaignId?: string | null;
  channel?: 'ON_PREMISE' | 'OFF_PREMISE' | 'EVENTO' | 'DIGITAL' | null;
  properties?: Record<string, unknown>;
  occurredAt?: Date;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra un evento versionado. Se puede llamar dentro de la transacción de la operación que lo origina. */
  async emit(name: AnalyticsEventName, input: EmitInput = {}, db: Db = this.prisma): Promise<void> {
    const spec = REGISTRY[name];
    const properties = Object.fromEntries(Object.entries(input.properties ?? {}).filter(([k]) => spec.allowed.includes(k)));
    await db.analyticsEvent.create({
      data: {
        name,
        schemaVersion: spec.version,
        campaignId: input.campaignId ?? null,
        channel: input.channel ?? null,
        properties: Object.keys(properties).length ? (properties as Prisma.InputJsonValue) : Prisma.JsonNull,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  }

  /** Eventos que informa la PWA: solo los de la lista blanca, validados por esquema; no afectan ninguna economía. */
  async recordClient(event: ClientEvent): Promise<void> {
    if (event.name === 'campaign_viewed') {
      const c = await this.prisma.campaign.findUnique({ where: { slug: event.campaignSlug }, select: { id: true } });
      return this.emit('campaign_viewed', { campaignId: c?.id ?? null });
    }
    if (event.name === 'reward_viewed') return this.emit('reward_viewed', { properties: { reward: event.rewardId } });
    if (event.name === 'share_card_generated') return this.emit('share_card_generated', { properties: { template: event.template, target: event.target } });
    return this.emit('share_link_opened', { properties: { source: event.source } });
  }

  // ───────────────────────── Tableros (solo agregados) ─────────────────────────

  async dashboard(days: number, now = new Date()): Promise<AnalyticsDashboard> {
    const from = new Date(now.getTime() - days * DAY);
    const [routeA, routeB, ops] = await Promise.all([this.routeA(from, days, now), this.routeB(from, days, now), this.ops(from)]);
    return { days, from: from.toISOString(), routeA, routeB, ops };
  }

  private series(rows: Array<{ d: string; n: number }>, days: number, now: Date) {
    const by = new Map(rows.map((r) => [r.d, r.n]));
    return Array.from({ length: days }, (_, i) => {
      const date = bogotaDay(new Date(now.getTime() - (days - 1 - i) * DAY));
      return { date, count: by.get(date) ?? 0 };
    });
  }

  private async routeA(from: Date, days: number, now: Date): Promise<AnalyticsDashboard['routeA']> {
    const [claims, credited, reversals, redemptions, staffLinked, perDay, bySku, byCampaign] = await Promise.all([
      this.prisma.claim.count({ where: { confirmed: true, createdAt: { gte: from } } }),
      this.prisma.ledgerEntry.aggregate({ where: { type: 'CREDITO', sourceType: 'claim', createdAt: { gte: from } }, _sum: { amount: true } }),
      this.prisma.ledgerEntry.aggregate({ where: { type: 'REVERSO', sourceType: 'reversal', createdAt: { gte: from } }, _sum: { amount: true }, _count: true }),
      this.prisma.rewardClaim.count({ where: { createdAt: { gte: from }, status: { in: ['RESERVADO', 'RECLAMADO', 'ENTREGADO'] } } }),
      this.prisma.claim.count({ where: { confirmed: true, createdAt: { gte: from }, staffUserId: { not: null } } }),
      this.prisma.$queryRaw<Array<{ d: string; n: number }>>`
        SELECT to_char((c."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS d, count(*)::int AS n
        FROM claims c WHERE c.confirmed AND c."createdAt" >= ${from} GROUP BY 1`,
      this.prisma.$queryRaw<Array<{ sku: string; name: string; claims: number; points: number }>>`
        SELECT p.sku, p.name, count(c.id)::int AS claims, COALESCE(sum(e.amount), 0)::int AS points
        FROM claims c
        JOIN campaign_codes cc ON cc.id = c."campaignCodeId"
        JOIN product_codes pc ON pc.id = cc."productCodeId"
        JOIN products p ON p.id = pc."productId"
        LEFT JOIN ledger_entries e ON e."sourceType" = 'claim' AND e."sourceId" = c.id::text AND e.type = 'CREDITO'
        WHERE c.confirmed AND c."createdAt" >= ${from}
        GROUP BY p.sku, p.name ORDER BY claims DESC LIMIT 20`,
      this.prisma.$queryRaw<Array<{ id: string; slug: string; claims: number; points: number }>>`
        SELECT ca.id, ca.slug, count(c.id)::int AS claims, COALESCE(sum(e.amount), 0)::int AS points
        FROM claims c
        JOIN campaign_codes cc ON cc.id = c."campaignCodeId"
        JOIN campaigns ca ON ca.id = cc."campaignId"
        LEFT JOIN ledger_entries e ON e."sourceType" = 'claim' AND e."sourceId" = c.id::text AND e.type = 'CREDITO'
        WHERE c.confirmed AND c."createdAt" >= ${from}
        GROUP BY ca.id, ca.slug ORDER BY claims DESC LIMIT 20`,
    ]);
    const campaigns = await this.prisma.campaign.findMany({ where: { id: { in: byCampaign.map((b) => b.id) } }, include: { activeVersion: true } });
    return {
      claims,
      pointsIssued: credited._sum.amount ?? 0,
      reversals: { count: reversals._count, points: Math.abs(reversals._sum.amount ?? 0) },
      redemptions,
      staffLinked,
      byDay: this.series(perDay, days, now),
      bySku,
      byCampaign: byCampaign.map((b) => {
        const c = campaigns.find((x) => x.id === b.id);
        return {
          slug: b.slug,
          title: c?.activeVersion ? CampaignDraftSchema.parse(c.activeVersion.content).publicTitle : b.slug,
          claims: b.claims,
          points: b.points,
        };
      }),
    };
  }

  private async eventCount(name: AnalyticsEventName, from: Date): Promise<number> {
    return this.prisma.analyticsEvent.count({ where: { name, occurredAt: { gte: from } } });
  }

  private async routeB(from: Date, days: number, now: Date): Promise<AnalyticsDashboard['routeB']> {
    const [started, completed, badges, created, joined, xpTotal, perDay, mods] = await Promise.all([
      this.eventCount('mission_started', from),
      this.eventCount('mission_completed', from),
      this.eventCount('badge_awarded', from),
      this.eventCount('session_created', from),
      this.eventCount('session_joined', from),
      this.prisma.xpEntry.aggregate({ where: { createdAt: { gte: from } }, _sum: { amount: true } }),
      this.prisma.$queryRaw<Array<{ d: string; n: number }>>`
        SELECT to_char((a."occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS d, count(*)::int AS n
        FROM analytics_events a WHERE a.name = 'mission_completed' AND a."occurredAt" >= ${from} GROUP BY 1`,
      this.prisma.$queryRaw<Array<{ module: string; started: number; completed: number }>>`
        SELECT a.properties->>'moduleId' AS module,
               count(*) FILTER (WHERE a.name = 'mission_started')::int AS started,
               count(*) FILTER (WHERE a.name = 'mission_completed')::int AS completed
        FROM analytics_events a
        WHERE a.name IN ('mission_started', 'mission_completed') AND a."occurredAt" >= ${from} AND a.properties->>'moduleId' IS NOT NULL
        GROUP BY 1 ORDER BY started DESC LIMIT 20`,
    ]);
    return {
      missionsStarted: started,
      missionsCompleted: completed,
      completionRate: started > 0 ? Math.min(1, completed / started) : null,
      // El XP del período vive en su propio registro de experiencia; nunca se suma a Puntos ILC.
      xpGranted: xpTotal._sum.amount ?? 0,
      badgesAwarded: badges,
      sessionsCreated: created,
      sessionsJoined: joined,
      byDay: this.series(perDay, days, now),
      byModule: mods.map((m) => ({ moduleId: m.module, started: m.started, completed: m.completed })),
    };
  }

  private async ops(from: Date): Promise<AnalyticsDashboard['ops']> {
    const [checks, unrecognized, passed, consents, shares, sec, open, high, campaigns, lowStock, pending] = await Promise.all([
      this.eventCount('product_code_status_checked', from),
      this.prisma.analyticsEvent.count({
        where: { name: 'product_code_status_checked', occurredAt: { gte: from }, properties: { path: ['status'], equals: 'unrecognized' } },
      }),
      this.prisma.analyticsEvent.count({
        where: { name: 'age_gate_result_recorded', occurredAt: { gte: from }, properties: { path: ['result'], equals: 'passed' } },
      }),
      this.eventCount('consent_updated', from),
      this.eventCount('share_card_generated', from),
      this.prisma.securityEvent.count({ where: { createdAt: { gte: from } } }),
      this.prisma.securityEvent.count({ where: { resolvedAt: null } }),
      this.prisma.securityEvent.count({ where: { createdAt: { gte: from }, severity: 'ALTA' } }),
      this.prisma.campaign.groupBy({ by: ['status'], _count: true }),
      this.prisma.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM reward_inventory i JOIN rewards r ON r.id = i."rewardId" WHERE r.active AND i.available <= i."lowStockAlert"`,
      this.prisma.moduleVersion.count({ where: { status: 'EN_PRUEBA' } }),
    ]);
    return {
      codeChecks: { total: checks, unrecognized },
      ageGate: { passed },
      consentUpdates: consents,
      securityEvents: { total: sec, open, high },
      campaignsByStatus: Object.fromEntries(campaigns.map((c) => [c.status, c._count])),
      rewardZonesLowStock: lowStock[0]?.n ?? 0,
      modulesAwaitingApproval: pending,
      shareCards: shares,
    };
  }
}
