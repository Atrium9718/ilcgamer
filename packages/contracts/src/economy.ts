import { z } from 'zod';

/**
 * Economía dual (Paso 7). Fuentes: Guía Técnica §5.7, §7 (`GET /wallet`, `GET /profile/progress`), §12.2.
 * - Puntos ILC (Ruta A): ledger inmutable; vencimientos y reversos son movimientos compensatorios.
 * - XP e insignias (Ruta B): progreso experiencial, no monetario. No se convierten en Puntos ILC.
 */

/** Tipo visible de un movimiento de la billetera. */
export const WALLET_ENTRY_KINDS = ['credit', 'debit', 'reversal', 'adjustment', 'expiry'] as const;
export const WalletEntryKindSchema = z.enum(WALLET_ENTRY_KINDS);
export type WalletEntryKind = z.infer<typeof WalletEntryKindSchema>;

export const WalletEntrySchema = z.object({
  id: z.uuid(),
  kind: WalletEntryKindSchema,
  /** Con signo: positivo suma, negativo resta. */
  amount: z.number().int(),
  description: z.string(),
  detail: z.string().optional(),
  at: z.iso.datetime(),
  /** Solo créditos con vigencia. */
  expiresAt: z.iso.datetime().nullable(),
});
export type WalletEntry = z.infer<typeof WalletEntrySchema>;

export const WalletSchema = z.object({
  balance: z.number().int().min(0),
  currencyName: z.string(),
  /** Próximo vencimiento dentro de la ventana de aviso (transparencia — §1.2, §5.7). */
  expiring: z.object({ amount: z.number().int().positive(), at: z.iso.datetime() }).nullable(),
  entries: z.array(WalletEntrySchema),
  nextCursor: z.string().nullable(),
});
export type Wallet = z.infer<typeof WalletSchema>;

export const LevelSchema = z.object({
  number: z.number().int().min(1),
  /** XP con que empieza este nivel y el siguiente (null en el último nivel). */
  fromXp: z.number().int(),
  nextAt: z.number().int().nullable(),
});

export const ProgressSchema = z.object({
  xp: z.number().int().min(0),
  level: LevelSchema,
  badges: z.array(z.object({ slug: z.string(), name: z.string(), icon: z.string(), earned: z.boolean(), awardedAt: z.iso.datetime().nullable() })),
});
export type Progress = z.infer<typeof ProgressSchema>;

/** Umbrales de XP por nivel, configurables por la plataforma (parámetros de prueba). */
export const XpLevelsSchema = z
  .array(z.number().int().min(0))
  .min(2)
  .max(50)
  .refine((l) => l[0] === 0 && l.every((v, i) => i === 0 || v > (l[i - 1] as number)), 'Empieza en 0 y crece estrictamente');
export const DEFAULT_XP_LEVELS = [0, 100, 300, 700, 1500, 3000];

// ─────────────── Consola ───────────────

export const AdminLedgerEntrySchema = WalletEntrySchema.extend({
  type: z.enum(['CREDITO', 'DEBITO', 'REVERSO', 'AJUSTE']),
  /** Lo que queda sin usar de un crédito (asignación FIFO por vencimiento). Null en movimientos que no son crédito. */
  remaining: z.number().int().nullable(),
  /** Ya tiene un reverso o vencimiento registrado. */
  compensated: z.boolean(),
  reason: z.string().nullable(),
  sourceType: z.string(),
  sourceId: z.string().nullable(),
});
export type AdminLedgerEntry = z.infer<typeof AdminLedgerEntrySchema>;

export const AdminAccountSchema = z.object({
  userId: z.uuid(),
  alias: z.string(),
  status: z.string(),
  balance: z.number().int(),
  /** Suma de movimientos: debe coincidir con el saldo en caché (conciliación). */
  ledgerSum: z.number().int(),
  xp: z.number().int(),
  level: z.number().int(),
  entries: z.array(AdminLedgerEntrySchema),
});
export type AdminAccount = z.infer<typeof AdminAccountSchema>;

export const LedgerLookupSchema = z.union([z.object({ claimId: z.uuid() }), z.object({ userId: z.uuid() })]);

export const ReverseEntrySchema = z.object({ reason: z.string().trim().min(10, 'Explica el motivo (mínimo 10 caracteres).').max(500) });

export const ReconciliationSchema = z.object({
  checkedAccounts: z.number().int(),
  mismatches: z.array(z.object({ userId: z.uuid().nullable(), balance: z.number().int(), ledgerSum: z.number().int() })),
  checkedAt: z.iso.datetime(),
});
export type Reconciliation = z.infer<typeof ReconciliationSchema>;

export const BadgeAdminSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Minúsculas con guiones')
    .min(3)
    .max(60),
  name: z.string().trim().min(3).max(60),
  /** Ícono de Material Symbols (sin copas ni botellas — reglas de contenido). */
  icon: z.string().regex(/^[a-z0-9_]{2,40}$/, 'Nombre de ícono de Material Symbols'),
});
export type BadgeAdmin = z.infer<typeof BadgeAdminSchema>;
export const BadgeAdminViewSchema = BadgeAdminSchema.extend({ awarded: z.number().int() });
export type BadgeAdminView = z.infer<typeof BadgeAdminViewSchema>;
