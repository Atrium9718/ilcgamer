import { z } from 'zod';
import { RouteSchema } from './domain.ts';

/**
 * Campañas, reglas versionadas y gobierno editorial (Paso 5).
 * Fuentes: Instrucciones §2, §6, §9, §11; Guía Técnica §5.3, §5.7, §5.11, §14, §16, §18.
 */

export const CHANNELS = ['ON_PREMISE', 'OFF_PREMISE', 'EVENTO', 'DIGITAL'] as const;
export const ChannelSchema = z.enum(CHANNELS);

/** Estado de una VERSIÓN de reglas (la campaña tiene su propio ciclo de vida, CAMPAIGN_STATUSES). */
export const CAMPAIGN_VERSION_STATES = ['BORRADOR', 'EN_REVISION', 'APROBADA', 'PUBLICADA', 'REEMPLAZADA'] as const;
export const CampaignVersionStateSchema = z.enum(CAMPAIGN_VERSION_STATES);

export const APPROVAL_KINDS = ['MARCA', 'JURIDICA', 'PRIVACIDAD', 'TI'] as const;
export const ApprovalKindSchema = z.enum(APPROVAL_KINDS);

export const ROLES = [
  'JUGADOR',
  'STAFF',
  'DEALER',
  'ADMIN_MARCA',
  'REVISOR_MARCA',
  'REVISOR_JURIDICO',
  'RESPONSABLE_PRIVACIDAD',
  'EDITOR_CONTENIDO',
  'SUPERADMIN',
] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

/** Qué rol puede emitir cada tipo de aprobación (Guía Técnica §3.3, §14). */
export const APPROVER_ROLE: Record<(typeof APPROVAL_KINDS)[number], Role> = {
  MARCA: 'REVISOR_MARCA',
  JURIDICA: 'REVISOR_JURIDICO',
  PRIVACIDAD: 'RESPONSABLE_PRIVACIDAD',
  TI: 'SUPERADMIN',
};

const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex #RRGGBB');
const SKU = z.string().regex(/^[A-Z0-9-]{2,40}$/, 'SKU en mayúsculas, números y guiones');

/**
 * Reglas de la campaña. Esquema CERRADO (strict): solo existen las mecánicas listadas, con rangos acotados.
 * No hay forma de configurar premios por velocidad de consumo, intervalos entre botellas, cantidad ingerida
 * o presión grupal (Guía Técnica §1.2, §5.7, §9.4): una regla desconocida se rechaza.
 * Los valores son PARÁMETROS DE PRUEBA hasta aprobación de Finanzas/Jurídica (Guía Técnica §5.7).
 */
export const CampaignRulesSchema = z
  .object({
    /** Puntos ILC por activación válida, por referencia (Instrucciones §6.1). */
    pointsBySku: z.record(SKU, z.number().int().min(0).max(10_000)).default({}),
    /** Multiplicadores por temporada (Instrucciones §9). Factor máximo x3. */
    multipliers: z
      .array(
        z
          .object({
            label: z.string().trim().min(2).max(60),
            factor: z.number().min(1).max(3),
            startsAt: z.iso.datetime(),
            endsAt: z.iso.datetime(),
          })
          .strict()
          .refine((m) => m.endsAt > m.startsAt, 'El multiplicador debe terminar después de empezar.'),
      )
      .max(5)
      .default([]),
    /** Energía del Parche en minutos (Instrucciones §5 paso 5: configurable). */
    energyMinutes: z.number().int().min(5).max(240).default(45),
    /** Hora local de cierre de sesiones del Parche (Instrucciones §6.2-B). Reloj distinto a la vigencia del saldo. */
    sessionEndsAtLocalTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora HH:MM')
      .default('06:00'),
    /**
     * XP adicional por activación válida. Solo en campañas MIXTAS: es el vínculo explícito, aprobado y versionado
     * entre las dos economías (Guía Técnica §5.7, §12.2). Los XP nunca se convierten en Puntos ILC.
     */
    xpPerActivation: z.number().int().min(1).max(500).optional(),
    /** Vigencia de los Puntos ILC emitidos, en días (regla separada y transparente — §1.2). */
    pointsExpiryDays: z.number().int().min(1).max(730).optional(),
    limits: z
      .object({
        activationsPerUserPerDay: z.number().int().min(1).max(20).default(3),
        activationsPerUserTotal: z.number().int().min(1).max(1000).optional(),
      })
      .strict()
      .default({ activationsPerUserPerDay: 3 }),
  })
  .strict();
export type CampaignRules = z.infer<typeof CampaignRulesSchema>;

/** Tema de campaña: solo variables de marca (los colores funcionales no se tocan — DESIGN.md). */
export const CampaignThemeSchema = z
  .object({
    mode: z.enum(['dark', 'light']).default('dark'),
    brand: z.string().regex(/^[a-z0-9-]{2,60}$/),
    brandColors: z.object({ 'brand-accent': HEX.optional(), 'brand-surface': HEX.optional(), 'on-brand-surface': HEX.optional() }).strict().optional(),
  })
  .strict();
export type CampaignTheme = z.infer<typeof CampaignThemeSchema>;

/** Uso de datos: si es verdadero, la versión requiere aprobación de Privacidad (§5.11, §9.3). */
export const DataUsageSchema = z.object({ location: z.boolean().default(false), extraData: z.boolean().default(false) }).strict();

/** Contenido editable de una versión. Cualquier cambio genera nuevo hash e invalida aprobaciones previas. */
export const CampaignDraftSchema = z
  .object({
    internalName: z.string().trim().min(3).max(120),
    publicTitle: z.string().trim().min(3).max(80),
    publicDescription: z.string().trim().max(400).default(''),
    objective: z.string().trim().min(3).max(300),
    kpi: z.string().trim().min(3).max(200),
    ownerTeam: z.string().trim().min(2).max(80),
    brandSlugs: z
      .array(z.string().regex(/^[a-z0-9-]{2,60}$/))
      .min(1, 'Elige al menos una submarca.')
      .max(10),
    channels: z.array(ChannelSchema).min(1, 'Elige al menos un canal.'),
    /** Municipios/departamentos (selección por campaña, no GPS — §5.3, §11). */
    territories: z.array(z.string().trim().min(2).max(80)).max(200).default([]),
    minAge: z.number().int().min(18).max(99).default(18),
    startsAt: z.iso.datetime('Indica la fecha y hora de inicio.'),
    endsAt: z.iso.datetime('Indica la fecha y hora de fin.'),
    terms: z.string().trim().max(10_000).default(''),
    rules: CampaignRulesSchema,
    theme: CampaignThemeSchema,
    dataUsage: DataUsageSchema.default({ location: false, extraData: false }),
    /**
     * Juegos disponibles en esta campaña (identificadores del catálogo). Como máximo 2 de Ruta B por persona y
     * campaña (Instrucciones §13.2): la API lo valida al guardar y todos deben estar activos al publicar.
     */
    modules: z
      .array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/))
      .max(10)
      .default([]),
  })
  .strict()
  .refine((d) => d.endsAt > d.startsAt, { message: 'La campaña debe terminar después de empezar.', path: ['endsAt'] });
export type CampaignDraft = z.infer<typeof CampaignDraftSchema>;

export const CreateCampaignSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug en minúsculas con guiones')
    .min(3)
    .max(80),
  route: RouteSchema,
  draft: CampaignDraftSchema,
});
export type CreateCampaign = z.infer<typeof CreateCampaignSchema>;

/** Checklist obligatorio antes de publicar (Guía Técnica §16). Lo confirma quien publica. */
export const PUBLISH_CHECKLIST = {
  menores: 'Público, canales y distribución minimizan exposición a menores.',
  kpi: 'La ruta, el objetivo y el KPI principal están definidos.',
  mecanica: 'La mecánica comercial, límites, multiplicadores y términos están aprobados.',
  sinPresion: 'Ningún reto premia velocidad de ingesta, intoxicación, tolerancia o presión social.',
  assets: 'Textos, logos, fotografía, música y assets están autorizados.',
  legales: 'Control de edad y advertencias legales aplicables están implementados.',
  permisos: 'GPS y permisos son necesarios, explicados y tienen alternativa.',
  premios: 'Los premios tienen inventario, condiciones, fechas, topes y responsable de entrega.',
  qa: 'La campaña se probó en QA y existe pausa operativa/rollback.',
  staff: 'Staff y comercios recibieron instrucciones y conocen el canal de soporte.',
  analitica: 'Los eventos de analítica corresponden a la finalidad autorizada.',
} as const;
export type ChecklistKey = keyof typeof PUBLISH_CHECKLIST;
export const CHECKLIST_KEYS = Object.keys(PUBLISH_CHECKLIST) as ChecklistKey[];

export const PublishSchema = z.object({
  // Parcial: el servicio responde cuántos puntos faltan en lugar de un error de formato genérico.
  checklist: z.partialRecord(z.enum(CHECKLIST_KEYS as [ChecklistKey, ...ChecklistKey[]]), z.literal(true)),
});

export const ApprovalDecisionSchema = z.object({
  kind: ApprovalKindSchema,
  decision: z.enum(['APROBADO', 'RECHAZADO']),
  note: z.string().trim().max(2000).optional(),
});
export type ApprovalDecisionInput = z.infer<typeof ApprovalDecisionSchema>;

export const CampaignActionSchema = z.enum(['submit', 'pause', 'resume', 'close', 'archive']);

export const ApprovalStatusSchema = z.object({
  kind: ApprovalKindSchema,
  required: z.boolean(),
  status: z.enum(['approved', 'rejected', 'pending', 'not_required']),
  byAlias: z.string().nullable(),
  at: z.iso.datetime().nullable(),
  note: z.string().nullable(),
});
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const CampaignVersionViewSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  state: CampaignVersionStateSchema,
  contentHash: z.string(),
  draft: CampaignDraftSchema,
  createdAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  approvals: z.array(ApprovalStatusSchema),
});
export type CampaignVersionView = z.infer<typeof CampaignVersionViewSchema>;

export const CampaignViewSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  route: RouteSchema,
  status: z.enum(['BORRADOR', 'EN_REVISION', 'APROBADA', 'PROGRAMADA', 'ACTIVA', 'PAUSADA', 'CERRADA', 'ARCHIVADA']),
  activeVersion: z.number().int().nullable(),
  /** Versión en curso de edición/revisión (puede ser la activa o una nueva). */
  workingVersion: CampaignVersionViewSchema,
  versions: z.array(z.object({ version: z.number().int(), state: CampaignVersionStateSchema, createdAt: z.iso.datetime() })),
  /** Si se puede publicar la versión de trabajo y, si no, qué falta (§5.11: "la interfaz indica cuál falta"). */
  publish: z.object({ allowed: z.boolean(), missing: z.array(z.string()) }),
  updatedAt: z.iso.datetime(),
});
export type CampaignView = z.infer<typeof CampaignViewSchema>;

export const CampaignSummarySchema = z.object({
  slug: z.string(),
  internalName: z.string(),
  route: RouteSchema,
  status: CampaignViewSchema.shape.status,
  brandSlugs: z.array(z.string()),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  version: z.number().int(),
  approvals: z.array(ApprovalStatusSchema.pick({ kind: true, status: true })),
});
export type CampaignSummary = z.infer<typeof CampaignSummarySchema>;

/** Lo que ve el público: solo campañas activas y dentro de su ventana. Sin reglas internas ni responsables. */
export const PublicCampaignSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  route: RouteSchema,
  minAge: z.number().int(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  theme: CampaignThemeSchema,
  energyMinutes: z.number().int(),
  terms: z.string(),
});
export type PublicCampaign = z.infer<typeof PublicCampaignSchema>;
