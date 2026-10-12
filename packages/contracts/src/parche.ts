import { z } from 'zod';
import { RouteSchema } from './domain.ts';
import { AliasSchema } from './identity.ts';

/**
 * El Parche: sesión social temporal en tiempo real (Paso 8). Fuentes: Instrucciones §3.2, §5; Guía Técnica §5.5, §7, §8.
 * - No es una cuenta: es una sesión con anfitrión, alias y PIN/QR que expira.
 * - El marcador del Parche (experiencial) es distinto del saldo de Puntos ILC de cada persona.
 * - La expiración de la sesión, la vigencia de los puntos y la del código promocional son relojes distintos.
 */

export const ParcheNameSchema = z
  .string()
  .trim()
  .min(2, 'Mínimo 2 caracteres')
  .max(24, 'Máximo 24 caracteres')
  .regex(/^[\p{L}\p{N} ¡!¿?.,'_-]+$/u, 'Caracteres no permitidos');

export const PinSchema = z.string().regex(/^\d{4}$/, 'El PIN tiene 4 dígitos');

export const CreateParcheSchema = z
  .object({
    name: ParcheNameSchema,
    alias: AliasSchema,
    mode: z.enum(['MULTI_DISPOSITIVO', 'UN_DISPOSITIVO']).default('MULTI_DISPOSITIVO'),
    /** Origen: una activación propia (Ruta A) o el QR de un evento/campaña (Ruta B). Sin origen: Parche libre de Ruta B. */
    claimId: z.uuid().optional(),
    campaignSlug: z.string().max(80).optional(),
    /** Solo en modo un dispositivo: alias de quienes juegan por turnos (sin cuenta). */
    localPlayers: z.array(AliasSchema).max(11).optional(),
  })
  .refine((v) => !(v.claimId && v.campaignSlug), 'Indica una activación o una campaña, no ambas');
export type CreateParche = z.infer<typeof CreateParcheSchema>;

export const JoinByPinSchema = z.object({ pin: PinSchema, alias: AliasSchema });
export const JoinByInviteSchema = z.object({ invite: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/), alias: AliasSchema });

export const ParticipantStateSchema = z.object({
  /** Identificador opaco por sesión (no es el id de la persona). */
  id: z.string(),
  alias: z.string(),
  isHost: z.boolean(),
  isYou: z.boolean(),
  status: z.enum(['connected', 'reconnecting', 'left']),
});

export const ParcheStateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  route: RouteSchema,
  mode: z.enum(['MULTI_DISPOSITIVO', 'UN_DISPOSITIVO']),
  status: z.enum(['CREADA', 'ABIERTA', 'EN_CURSO', 'FINALIZADA', 'EXPIRADA', 'CANCELADA']),
  isHost: z.boolean(),
  /** Solo para quien ya está dentro (para invitar). */
  pin: z.string().nullable(),
  /** Ruta de invitación firmada para el QR; válida solo mientras la sesión siga activa. */
  invitePath: z.string().nullable(),
  capacity: z.number().int(),
  participants: z.array(ParticipantStateSchema),
  localPlayers: z.array(z.string()),
  energy: z.object({ minutes: z.number().int(), endsAt: z.iso.datetime().nullable() }),
  expiresAt: z.iso.datetime(),
  /** Marcador experiencial del Parche (juegos, retos). No es saldo comercial. */
  score: z.number().int(),
  /** Activaciones de botella hechas dentro del Parche (la emisión de puntos va a cada persona). */
  activations: z.number().int(),
  campaign: z.object({ slug: z.string(), title: z.string(), themeId: z.string() }).nullable(),
  /** Aumenta con cada cambio: el cliente descarta estados más viejos que el que ya tiene. */
  stateVersion: z.number().int(),
  serverTime: z.iso.datetime(),
});
export type ParcheState = z.infer<typeof ParcheStateSchema>;
export type ParcheParticipantState = z.infer<typeof ParticipantStateSchema>;

/** Respuesta a un intento fallido de PIN (sin revelar si el PIN existe). */
export const PIN_MAX_FAILURES = 5;
export const PIN_LOCK_MINUTES = 10;
