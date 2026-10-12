import { z } from 'zod';
import { RewardClaimStatusSchema } from './domain.ts';

/**
 * Recompensas e inventario (Guía Técnica §5.8; Instrucciones §6.2, §9).
 * Un canje debita Puntos ILC y reserva stock en la misma transacción; nunca queda uno sin el otro.
 * Estados: RESERVADO → (RECLAMADO) → ENTREGADO; alternos EXPIRADO y ANULADO (devuelven stock y puntos).
 */
export const REWARD_TYPES = ['DIGITAL', 'MERCHANDISING', 'EXPERIENCIA', 'CONTENIDO'] as const;
export const RewardTypeSchema = z.enum(REWARD_TYPES);
export type RewardType = z.infer<typeof RewardTypeSchema>;

export type RewardClaimStatus = z.infer<typeof RewardClaimStatusSchema>;

/** Lo digital se entrega al canjear; lo material y las experiencias se retiran con un código de entrega. */
export const IMMEDIATE_REWARD_TYPES: readonly RewardType[] = ['DIGITAL', 'CONTENIDO'];

export const REWARD_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const Text = (max: number) => z.string().trim().max(max);

// ─────────────── Persona: catálogo y canje ───────────────

export const RewardItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  type: RewardTypeSchema,
  icon: z.string(),
  cost: z.number().int(),
  conditions: z.array(z.string()),
  maxPerUser: z.number().int(),
  endsAt: z.iso.datetime(),
  campaign: z.object({ slug: z.string(), title: z.string() }).nullable(),
  /** Stock por zona (solo zonas con existencias o agotadas, nunca cantidades negativas). */
  zones: z.array(z.object({ zone: z.string(), available: z.number().int() })),
  soldOut: z.boolean(),
  /** Cuántas veces la persona ya la canjeó (sin contar anuladas ni vencidas). */
  claimedByYou: z.number().int(),
  delivery: z.enum(['immediate', 'pickup']),
});
export type RewardItem = z.infer<typeof RewardItemSchema>;

export const RewardCatalogSchema = z.object({
  balance: z.number().int(),
  currencyName: z.string(),
  rewards: z.array(RewardItemSchema),
});
export type RewardCatalog = z.infer<typeof RewardCatalogSchema>;

export const ClaimRewardSchema = z.object({ zone: z.string().trim().min(1).max(60) });
export type ClaimReward = z.infer<typeof ClaimRewardSchema>;

export const RewardClaimResultSchema = z.object({
  claimId: z.uuid(),
  status: RewardClaimStatusSchema,
  rewardName: z.string(),
  cost: z.number().int(),
  zone: z.string(),
  /** Código para retirar la recompensa (también lo ve en "Mis canjes"). */
  code: z.string(),
  balance: z.number().int(),
  currencyName: z.string(),
  /** Hasta cuándo se puede retirar; después la reserva vence y se devuelven los puntos. */
  expiresAt: z.iso.datetime().nullable(),
  replayed: z.boolean(),
});
export type RewardClaimResult = z.infer<typeof RewardClaimResultSchema>;

export const MyRewardClaimSchema = z.object({
  id: z.uuid(),
  rewardName: z.string(),
  icon: z.string(),
  status: RewardClaimStatusSchema,
  code: z.string().nullable(),
  cost: z.number().int(),
  zone: z.string(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  deliveredAt: z.iso.datetime().nullable(),
});
export type MyRewardClaim = z.infer<typeof MyRewardClaimSchema>;

// ─────────────── Consola ───────────────

export const RewardZoneInputSchema = z.object({
  zone: Text(60).min(2),
  available: z.number().int().min(0).max(1_000_000),
  lowStockAlert: z.number().int().min(0).max(100_000).default(5),
});

export const CreateRewardSchema = z
  .object({
    slug: z.string().regex(REWARD_SLUG, 'Minúsculas con guiones').min(3).max(60),
    name: Text(80).min(3),
    description: Text(500).default(''),
    type: RewardTypeSchema,
    /** Ícono de Material Symbols (sin copas ni botellas — reglas de contenido). */
    icon: z
      .string()
      .regex(/^[a-z0-9_]{2,40}$/, 'Nombre de ícono de Material Symbols')
      .default('redeem'),
    cost: z.number().int().min(0).max(1_000_000),
    conditions: z.array(Text(300).min(1)).min(1, 'Indica al menos una condición visible para la persona').max(10),
    maxPerUser: z.number().int().min(1).max(50).default(1),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    /** Responsable de la entrega. */
    fulfillment: Text(120).min(3),
    campaignSlug: Text(80).optional(),
    zones: z.array(RewardZoneInputSchema).min(1, 'Define al menos una zona con stock').max(30),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), { message: 'La fecha final debe ser posterior a la inicial', path: ['endsAt'] })
  .refine((v) => new Set(v.zones.map((z) => z.zone.toLowerCase())).size === v.zones.length, { message: 'Hay zonas repetidas', path: ['zones'] });
export type CreateReward = z.infer<typeof CreateRewardSchema>;

export const AdjustStockSchema = z.object({
  zone: Text(60).min(2),
  /** Cambio con signo: positivo repone, negativo descuenta (merma, daño). Nunca deja el stock negativo. */
  delta: z
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .refine((n) => n !== 0, 'El cambio no puede ser cero'),
  reason: Text(300).min(5),
  lowStockAlert: z.number().int().min(0).max(100_000).optional(),
});
export type AdjustStock = z.infer<typeof AdjustStockSchema>;

export const RewardAdminViewSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  type: RewardTypeSchema,
  icon: z.string(),
  cost: z.number().int(),
  conditions: z.array(z.string()),
  maxPerUser: z.number().int(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  active: z.boolean(),
  fulfillment: z.string(),
  campaignSlug: z.string().nullable(),
  zones: z.array(z.object({ zone: z.string(), available: z.number().int(), lowStockAlert: z.number().int(), low: z.boolean() })),
  counts: z.object({ reserved: z.number().int(), delivered: z.number().int(), cancelled: z.number().int() }),
});
export type RewardAdminView = z.infer<typeof RewardAdminViewSchema>;

export const AdminRewardClaimSchema = z.object({
  id: z.uuid(),
  code: z.string().nullable(),
  rewardSlug: z.string(),
  rewardName: z.string(),
  zone: z.string(),
  status: RewardClaimStatusSchema,
  cost: z.number().int(),
  userId: z.uuid(),
  userAlias: z.string(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  deliveredAt: z.iso.datetime().nullable(),
  cancelReason: z.string().nullable(),
});
export type AdminRewardClaim = z.infer<typeof AdminRewardClaimSchema>;

export const DeliverClaimSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9A-Z]{6,12}$/, 'Código de entrega no válido'),
});
export const CancelClaimSchema = z.object({ reason: Text(300).min(5) });
export const DeactivateRewardSchema = z.object({ reason: Text(300).min(5) });
