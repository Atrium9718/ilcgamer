import { z } from 'zod';

/**
 * Analítica (Guía Técnica §10). Eventos versionados con propiedades mínimas y sin datos personales; tableros separados
 * por ruta. Una activación de código es un evento comercial válido, nunca prueba de consumo.
 */
export const SERVER_EVENTS = [
  'campaign_viewed',
  'age_gate_result_recorded',
  'mission_started',
  'mission_completed',
  'badge_awarded',
  'session_created',
  'session_joined',
  'session_closed',
  'product_code_status_checked',
  'campaign_code_claimed',
  'commercial_points_credited',
  'commercial_points_reversed',
  'reward_viewed',
  'reward_claimed',
  'consent_updated',
  'share_card_generated',
  'share_link_opened',
  'staff_activation_recorded',
  'referral_attributed',
  'referral_rewarded',
  'referral_capped',
  'contest_entry_submitted',
  'contest_vote_cast',
] as const;
export type AnalyticsEventName = (typeof SERVER_EVENTS)[number];

/** Eventos que la PWA puede informar por sí misma (no afectan economía; el servidor los limita y valida). */
export const CLIENT_EVENTS = ['campaign_viewed', 'reward_viewed', 'share_card_generated', 'share_link_opened'] as const;

export const ClientEventSchema = z.discriminatedUnion('name', [
  z.object({ name: z.literal('campaign_viewed'), campaignSlug: z.string().max(80) }),
  z.object({ name: z.literal('reward_viewed'), rewardId: z.uuid() }),
  z.object({
    name: z.literal('share_card_generated'),
    template: z.enum(['bosque', 'roble', 'montana']),
    target: z.enum(['instagram', 'whatsapp', 'tiktok', 'download']),
  }),
  z.object({ name: z.literal('share_link_opened'), source: z.enum(['referral', 'card']) }),
]);
export type ClientEvent = z.infer<typeof ClientEventSchema>;

export const DASHBOARD_DAYS = [7, 30, 90] as const;
const Series = z.array(z.object({ date: z.string(), count: z.number().int() }));

export const RouteADashboardSchema = z.object({
  claims: z.number().int(),
  pointsIssued: z.number().int(),
  reversals: z.object({ count: z.number().int(), points: z.number().int() }),
  redemptions: z.number().int(),
  staffLinked: z.number().int(),
  byDay: Series,
  bySku: z.array(z.object({ sku: z.string(), name: z.string(), claims: z.number().int(), points: z.number().int() })),
  byCampaign: z.array(z.object({ slug: z.string(), title: z.string(), claims: z.number().int(), points: z.number().int() })),
});

export const RouteBDashboardSchema = z.object({
  missionsStarted: z.number().int(),
  missionsCompleted: z.number().int(),
  /** 0-1; null si no hay misiones iniciadas. */
  completionRate: z.number().nullable(),
  xpGranted: z.number().int(),
  badgesAwarded: z.number().int(),
  sessionsCreated: z.number().int(),
  sessionsJoined: z.number().int(),
  byDay: Series,
  byModule: z.array(z.object({ moduleId: z.string(), started: z.number().int(), completed: z.number().int() })),
});

export const OpsDashboardSchema = z.object({
  codeChecks: z.object({ total: z.number().int(), unrecognized: z.number().int() }),
  ageGate: z.object({ passed: z.number().int() }),
  consentUpdates: z.number().int(),
  securityEvents: z.object({ total: z.number().int(), open: z.number().int(), high: z.number().int() }),
  campaignsByStatus: z.record(z.string(), z.number().int()),
  rewardZonesLowStock: z.number().int(),
  modulesAwaitingApproval: z.number().int(),
  shareCards: z.number().int(),
});

export const AnalyticsDashboardSchema = z.object({
  days: z.number().int(),
  from: z.iso.datetime(),
  routeA: RouteADashboardSchema,
  routeB: RouteBDashboardSchema,
  ops: OpsDashboardSchema,
});
export type AnalyticsDashboard = z.infer<typeof AnalyticsDashboardSchema>;
