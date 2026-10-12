import { z } from 'zod';
import { CodeLookupResultSchema, ProductCodeStatusSchema } from './domain.ts';

/**
 * Smart Tags y reclamaciones (Paso 6). Dos dominios separados (Guía Técnica §5.6):
 * 1. Código de producto: consultar no consume ningún beneficio; las consultas son eventos.
 * 2. Código de campaña/claim: uso único, vigencia y condiciones; reclamar es atómico e idempotente.
 * Fuentes: Instrucciones §3.6, §4, §10; Guía Técnica §5.6, §5.7, §7, §9.2.
 */

/** Token tal como viene en la URL del QR (formato abierto para tokens de imprenta; se valida longitud y alfabeto). */
export const SmartTagTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Token con 8 a 64 caracteres (letras, números, - o _).');

/** Longitud recomendada para tokens generados por la plataforma (Crockford base32, 60 bits). */
export const GENERATED_TOKEN_LENGTH = 12;
/** Por debajo de esta longitud la importación advierte baja entropía (protección contra enumeración — §5.6). */
export const MIN_RECOMMENDED_TOKEN_LENGTH = 10;

export const SkuSchema = z.string().regex(/^[A-Z0-9-]{2,40}$/, 'SKU en mayúsculas, números y guiones');
export const BatchLabelSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9 #._-]{1,40}$/, 'Lote con letras, números, espacios, #, ., _ o -');

/** Estado de la promoción asociada a la botella, visto por quien consulta. */
export const CLAIM_AVAILABILITY = ['none', 'available', 'claimed_by_you', 'claimed', 'expired', 'not_available'] as const;
export const ClaimAvailabilitySchema = z.enum(CLAIM_AVAILABILITY);
export type ClaimAvailability = z.infer<typeof ClaimAvailabilitySchema>;

export const ProductCodeLookupSchema = z.object({
  /** Resultado de la consulta del producto (sin afirmar autenticidad física absoluta). */
  status: CodeLookupResultSchema,
  brandLabel: z.string(),
  themeId: z.string(),
  /** "Ron Viejo de Caldas 8 años · Lote 4092" (solo si el código es reconocido). */
  productLabel: z.string().optional(),
  /** Promoción disponible para esta botella, con condiciones visibles ANTES de reclamar (§5.7 regla 6). */
  campaign: z
    .object({
      slug: z.string(),
      title: z.string(),
      availability: ClaimAvailabilitySchema,
      points: z.number().int().min(0),
      currencyName: z.string(),
      pointsExpiryDays: z.number().int().nullable(),
      minAge: z.number().int(),
      endsAt: z.iso.datetime(),
      activationsPerUserPerDay: z.number().int(),
    })
    .nullable(),
});
export type ProductCodeLookup = z.infer<typeof ProductCodeLookupSchema>;

export const ClaimResultSchema = z.object({
  claimId: z.uuid(),
  /** true si la respuesta repite una reclamación ya confirmada con la misma Idempotency-Key. */
  replayed: z.boolean(),
  points: z.number().int().min(0),
  /** XP adicional solo en campañas mixtas con regla aprobada (economía de Ruta B, separada de los puntos). */
  xp: z.number().int().min(0),
  currencyName: z.string(),
  pointsExpireAt: z.iso.datetime().nullable(),
  balance: z.number().int().min(0),
  campaign: z.object({ slug: z.string(), title: z.string() }),
  claimedAt: z.iso.datetime(),
  /** La activación se hizo dentro de un Parche y recargó su energía. */
  parcheRecharged: z.boolean(),
});
export type ClaimResult = z.infer<typeof ClaimResultSchema>;

/** Cuerpo opcional de la reclamación: si se activa dentro de un Parche, recarga su energía (Instrucciones §5 paso 5). */
export const ClaimRequestSchema = z.object({ sessionId: z.uuid().optional() }).default({});
export type ClaimRequest = z.infer<typeof ClaimRequestSchema>;

/** POST /smarttags/validate (integración ERP — Instrucciones §10). Solo estado del producto; nunca reclama. */
export const IntegrationValidateRequestSchema = z.object({ token: SmartTagTokenSchema });
export const IntegrationValidateResponseSchema = z.object({
  recognized: z.boolean(),
  status: ProductCodeStatusSchema.nullable(),
  sku: z.string().nullable(),
  batch: z.string().nullable(),
  revoked: z.boolean(),
});
export type IntegrationValidateResponse = z.infer<typeof IntegrationValidateResponseSchema>;

// ─────────────── Administración ───────────────

export const CreateProductSchema = z.object({
  sku: SkuSchema,
  name: z.string().trim().min(3).max(120),
  brandSlug: z.string().regex(/^[a-z0-9-]{2,60}$/),
});
export type CreateProduct = z.infer<typeof CreateProductSchema>;

export const ProductViewSchema = z.object({
  id: z.uuid(),
  sku: z.string(),
  name: z.string(),
  brandSlug: z.string(),
  brandLabel: z.string(),
  active: z.boolean(),
  codes: z.number().int(),
});
export type ProductView = z.infer<typeof ProductViewSchema>;

export const BatchViewSchema = z.object({
  id: z.uuid(),
  sku: z.string(),
  productName: z.string(),
  label: z.string(),
  supplier: z.string().nullable(),
  total: z.number().int(),
  byStatus: z.partialRecord(ProductCodeStatusSchema, z.number().int()),
  revokedAt: z.iso.datetime().nullable(),
  campaigns: z.array(z.object({ slug: z.string(), title: z.string(), codes: z.number().int(), claimed: z.number().int() })),
  createdAt: z.iso.datetime(),
});
export type BatchView = z.infer<typeof BatchViewSchema>;

export const LinkBatchSchema = z.object({ campaignSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/) });
export const RevokeBatchSchema = z.object({ reason: z.string().trim().min(5).max(500) });

export const GenerateCodesSchema = z.object({
  sku: SkuSchema,
  batchLabel: BatchLabelSchema,
  supplier: z.string().trim().max(60).optional(),
  count: z.number().int().min(1).max(10_000),
});
export type GenerateCodes = z.infer<typeof GenerateCodesSchema>;

/** Plantilla de URL del QR (Instrucciones §4.1): https y exactamente un {token}. */
export const UrlTemplateSchema = z.object({
  urlTemplate: z
    .string()
    .trim()
    .max(200)
    .url('URL no válida')
    .refine((u) => u.startsWith('https://'), 'Debe empezar por https://')
    .refine((u) => u.split('{token}').length === 2, 'Debe contener {token} exactamente una vez'),
});
export type UrlTemplate = z.infer<typeof UrlTemplateSchema>;
export const DEFAULT_URL_TEMPLATE = 'https://ilc.app/v/{token}';

export const IMPORT_STATUSES = ['PREVISTA', 'CONFIRMADA', 'DESCARTADA'] as const;
export const ImportRowIssueSchema = z.object({ line: z.number().int(), tokenHint: z.string(), message: z.string() });

/** Vista previa de una importación CSV/XLSX: nada se guarda en el inventario hasta confirmar (§5.6). */
export const ImportPreviewSchema = z.object({
  id: z.uuid(),
  fileName: z.string(),
  status: z.enum(IMPORT_STATUSES),
  totalRows: z.number().int(),
  validRows: z.number().int(),
  duplicateRows: z.number().int(),
  errorRows: z.number().int(),
  warnings: z.array(z.string()),
  /** Primeros problemas encontrados (el detalle completo se descarga como CSV). */
  issues: z.array(ImportRowIssueSchema),
  /** Resumen por producto y lote de las filas válidas. */
  groups: z.array(z.object({ sku: z.string(), batch: z.string(), rows: z.number().int() })),
  createdAt: z.iso.datetime(),
  confirmedAt: z.iso.datetime().nullable(),
});
export type ImportPreview = z.infer<typeof ImportPreviewSchema>;

/** Columnas aceptadas en CSV/XLSX (encabezados, sin distinción de mayúsculas). */
export const IMPORT_COLUMNS = {
  token: ['token', 'codigo', 'código'],
  sku: ['sku', 'referencia'],
  batch: ['lote', 'batch'],
  supplier: ['proveedor', 'supplier'],
} as const;
export const MAX_IMPORT_ROWS = 50_000;
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
