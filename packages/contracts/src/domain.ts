import { z } from 'zod';

/**
 * Estados y tipos de dominio. Son la referencia que el esquema de base de datos (Prisma) debe reflejar;
 * una prueba de la API verifica que coincidan. Fuente: Guía Técnica §5.3-§5.8.
 */

/** Ruta de gamificación (Instrucciones §13; Guía Técnica §2.2). */
export const ROUTES = ['A_COMERCIAL', 'B_EXPERIENCIAL', 'MIXTA'] as const;
export const RouteSchema = z.enum(ROUTES);

/** §5.3 Estados de campaña. */
export const CAMPAIGN_STATUSES = ['BORRADOR', 'EN_REVISION', 'APROBADA', 'PROGRAMADA', 'ACTIVA', 'PAUSADA', 'CERRADA', 'ARCHIVADA'] as const;
export const CampaignStatusSchema = z.enum(CAMPAIGN_STATUSES);

/** §5.6 Código de producto (consulta). Las consultas son eventos, no estados. */
export const PRODUCT_CODE_STATUSES = ['GENERADO', 'ASIGNADO_A_LOTE', 'DISTRIBUIDO', 'ALERTA_DE_ANOMALIA', 'REVOCADO'] as const;
export const ProductCodeStatusSchema = z.enum(PRODUCT_CODE_STATUSES);

/** §5.6 Código de campaña / claim (dominio separado del de producto). */
export const CAMPAIGN_CODE_STATUSES = ['CREADO', 'DISPONIBLE', 'RECLAMADO', 'EXPIRADO', 'ANULADO'] as const;
export const CampaignCodeStatusSchema = z.enum(CAMPAIGN_CODE_STATUSES);

/** §5.5 El Parche. */
export const SESSION_STATUSES = ['CREADA', 'ABIERTA', 'EN_CURSO', 'FINALIZADA', 'EXPIRADA', 'CANCELADA'] as const;
export const SessionStatusSchema = z.enum(SESSION_STATUSES);

/** §5.7 Tipos de movimiento del ledger (inmutable). */
export const LEDGER_ENTRY_TYPES = ['CREDITO', 'DEBITO', 'REVERSO', 'AJUSTE'] as const;
export const LedgerEntryTypeSchema = z.enum(LEDGER_ENTRY_TYPES);

/** §5.8 Canje de recompensas. */
export const REWARD_CLAIM_STATUSES = ['RESERVADO', 'RECLAMADO', 'ENTREGADO', 'EXPIRADO', 'ANULADO'] as const;
export const RewardClaimStatusSchema = z.enum(REWARD_CLAIM_STATUSES);

/** Resultado visible de consultar un código (sin afirmar autenticidad absoluta — §5.6). */
export const CODE_LOOKUP_RESULTS = ['recognized', 'unrecognized', 'already_claimed', 'needs_review'] as const;
export const CodeLookupResultSchema = z.enum(CODE_LOOKUP_RESULTS);

/** Consentimientos con finalidad separada (§5.2, §9.3). */
export const CONSENT_PURPOSES = ['TERMINOS_Y_PRIVACIDAD', 'MARKETING', 'UBICACION'] as const;
export const ConsentPurposeSchema = z.enum(CONSENT_PURPOSES);
