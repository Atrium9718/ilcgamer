import { z } from 'zod';

/**
 * Eventos y concursos (p. ej. concurso de disfraces de la feria). Un EVENTO agrupa uno o más CONCURSOS.
 * Reglas del producto que este contrato respeta:
 *  - Votar y concursar NO emite Puntos ILC ni XP: el premio es un artículo/experiencia que se entrega en persona.
 *  - La foto de una persona es dato personal: exige autorización expresa, pasa por moderación antes de verse, se puede retirar
 *    y se elimina al cerrar el plazo de retención. El servidor quita los metadatos (EXIF/ubicación) de la imagen.
 *  - El servidor decide todo: fases por fecha, un voto por cuenta, no se vota por sí mismo, desempate determinista.
 *  - La pantalla pública solo muestra alias, título y foto aprobada, nunca datos de contacto.
 */
export const EVENT_STATUSES = ['BORRADOR', 'PUBLICADO', 'CERRADO'] as const;
export const EventStatusSchema = z.enum(EVENT_STATUSES);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const CONTEST_KINDS = ['DISFRACES'] as const;
export const ContestKindSchema = z.enum(CONTEST_KINDS);
export type ContestKind = z.infer<typeof ContestKindSchema>;

export const CONTEST_STATUSES = ['BORRADOR', 'ABIERTO', 'CERRADO'] as const;
export const ContestStatusSchema = z.enum(CONTEST_STATUSES);
export type ContestStatus = z.infer<typeof ContestStatusSchema>;

/** Fase calculada por el servidor a partir de las fechas (la persona nunca la decide). */
export const CONTEST_PHASES = ['PROXIMAMENTE', 'INSCRIPCION', 'ENTRE_FASES', 'VOTACION', 'TERMINADO'] as const;
export const ContestPhaseSchema = z.enum(CONTEST_PHASES);
export type ContestPhase = z.infer<typeof ContestPhaseSchema>;

export const ENTRY_STATUSES = ['PENDIENTE', 'APROBADA', 'RECHAZADA'] as const;
export const EntryStatusSchema = z.enum(ENTRY_STATUSES);
export type EntryStatus = z.infer<typeof EntryStatusSchema>;

export const EVENT_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const Text = (max: number) => z.string().trim().max(max);

export const MAX_ENTRY_PHOTO_BYTES = 2 * 1024 * 1024;
/** Norma visible al subir (reglas de contenido: nada de copas, botellas ni consumo de alcohol). */
export const ENTRY_PHOTO_GUIDELINES = [
  'Solo tu disfraz: sin copas, botellas ni consumo de alcohol en la foto.',
  'Sin menores de edad ni datos personales visibles (documentos, teléfonos).',
  'La foto es tuya o tienes permiso de quien aparece.',
] as const;

// ─────────────── Consola: eventos y concursos ───────────────

export const CreateEventSchema = z
  .object({
    slug: z.string().regex(EVENT_SLUG, 'Minúsculas con guiones').min(3).max(60),
    title: Text(80).min(3),
    description: Text(500).default(''),
    city: Text(60).default(''),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), { message: 'La fecha final debe ser posterior a la inicial', path: ['endsAt'] });
export type CreateEvent = z.infer<typeof CreateEventSchema>;

export const CreateContestSchema = z
  .object({
    slug: z.string().regex(EVENT_SLUG, 'Minúsculas con guiones').min(3).max(60),
    kind: ContestKindSchema.default('DISFRACES'),
    title: Text(80).min(3),
    description: Text(500).default(''),
    /** Qué se lleva quien gane (p. ej. «Palco para la feria»). Se entrega en persona, no es Puntos ILC. */
    prize: Text(160).min(3),
    prizeConditions: Text(300).default(''),
    uploadsCloseAt: z.iso.datetime(),
    votingOpensAt: z.iso.datetime(),
    votingClosesAt: z.iso.datetime(),
  })
  .refine((v) => new Date(v.votingOpensAt) >= new Date(v.uploadsCloseAt), {
    message: 'La votación abre después de cerrar la inscripción',
    path: ['votingOpensAt'],
  })
  .refine((v) => new Date(v.votingClosesAt) > new Date(v.votingOpensAt), { message: 'La votación cierra después de abrir', path: ['votingClosesAt'] });
export type CreateContest = z.infer<typeof CreateContestSchema>;

export const ContestAdminSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  kind: ContestKindSchema,
  title: z.string(),
  prize: z.string(),
  status: ContestStatusSchema,
  phase: ContestPhaseSchema,
  uploadsCloseAt: z.iso.datetime(),
  votingOpensAt: z.iso.datetime(),
  votingClosesAt: z.iso.datetime(),
  entries: z.number().int(),
  pending: z.number().int(),
  votes: z.number().int(),
});
export type ContestAdminSummary = z.infer<typeof ContestAdminSummarySchema>;

export const EventAdminViewSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  city: z.string(),
  status: EventStatusSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  contests: z.array(ContestAdminSummarySchema),
});
export type EventAdminView = z.infer<typeof EventAdminViewSchema>;

export const ModerateEntrySchema = z
  .object({ decision: z.enum(['APROBADA', 'RECHAZADA']), reason: Text(200).optional() })
  .refine((v) => v.decision === 'APROBADA' || (v.reason?.length ?? 0) >= 3, { message: 'Indica el motivo del rechazo', path: ['reason'] });
export type ModerateEntry = z.infer<typeof ModerateEntrySchema>;

export const DeliverPrizeSchema = z.object({ code: z.string().trim().min(6).max(12) });
export type DeliverPrize = z.infer<typeof DeliverPrizeSchema>;

export const AdminEntrySchema = z.object({
  id: z.uuid(),
  alias: z.string(),
  title: z.string(),
  caption: z.string(),
  status: EntryStatusSchema,
  rejectionReason: z.string().nullable(),
  hasPhoto: z.boolean(),
  votes: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type AdminEntry = z.infer<typeof AdminEntrySchema>;

export const ContestAdminViewSchema = ContestAdminSummarySchema.extend({
  eventSlug: z.string(),
  eventTitle: z.string(),
  description: z.string(),
  prizeConditions: z.string(),
  /** Ruta de la pantalla pública (la consola le antepone el dominio). Es secreta: quien la tiene la ve. */
  screenPath: z.string(),
  entriesList: z.array(AdminEntrySchema),
  winner: z.object({ entryId: z.uuid(), alias: z.string(), title: z.string(), votes: z.number().int(), deliveredAt: z.iso.datetime().nullable() }).nullable(),
});
export type ContestAdminView = z.infer<typeof ContestAdminViewSchema>;

// ─────────────── Persona ───────────────

export const ContestEntryViewSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  caption: z.string(),
  alias: z.string(),
  /** Es la propia inscripción de quien consulta. */
  mine: z.boolean(),
  photoUrl: z.string().nullable(),
  /** Solo en la propia inscripción. */
  status: EntryStatusSchema.optional(),
  rejectionReason: z.string().nullable().optional(),
});
export type ContestEntryView = z.infer<typeof ContestEntryViewSchema>;

export const ContestViewSchema = z.object({
  id: z.uuid(),
  eventSlug: z.string(),
  eventTitle: z.string(),
  slug: z.string(),
  kind: ContestKindSchema,
  title: z.string(),
  description: z.string(),
  prize: z.string(),
  prizeConditions: z.string(),
  phase: ContestPhaseSchema,
  uploadsCloseAt: z.iso.datetime(),
  votingOpensAt: z.iso.datetime(),
  votingClosesAt: z.iso.datetime(),
  guidelines: z.array(z.string()),
  entries: z.array(ContestEntryViewSchema),
  myEntry: ContestEntryViewSchema.nullable(),
  /** Id de la inscripción por la que votó esta persona, si ya votó. */
  votedEntryId: z.uuid().nullable(),
  /** Hay un ganador y es esta persona: lleva el código para reclamar el premio en persona. */
  prizeCode: z.string().nullable(),
  winner: z.object({ entryId: z.uuid(), alias: z.string(), title: z.string(), photoUrl: z.string().nullable() }).nullable(),
});
export type ContestView = z.infer<typeof ContestViewSchema>;

export const PublicEventSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  city: z.string(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  contests: z.array(z.object({ id: z.uuid(), title: z.string(), prize: z.string(), phase: ContestPhaseSchema, kind: ContestKindSchema })),
});
export type PublicEvent = z.infer<typeof PublicEventSchema>;

export const UpsertEntrySchema = z.object({
  title: Text(60).min(3),
  caption: Text(200).default(''),
  /** Autorización expresa para mostrar la foto en la app y en la pantalla del evento. */
  consentDisplay: z.literal(true, { error: 'Debes autorizar que se muestre tu foto para participar' }),
});
export type UpsertEntry = z.infer<typeof UpsertEntrySchema>;

export const CastVoteSchema = z.object({ entryId: z.uuid() });
export type CastVote = z.infer<typeof CastVoteSchema>;

// ─────────────── Pantalla pública (sin sesión; solo agregados y fotos aprobadas) ───────────────

export const ScreenEntrySchema = z.object({
  id: z.uuid(),
  rank: z.number().int(),
  title: z.string(),
  alias: z.string(),
  votes: z.number().int(),
  photoUrl: z.string().nullable(),
});
export const ContestScreenSchema = z.object({
  title: z.string(),
  eventTitle: z.string(),
  prize: z.string(),
  phase: ContestPhaseSchema,
  votingClosesAt: z.iso.datetime(),
  totalVotes: z.number().int(),
  entries: z.array(ScreenEntrySchema),
  winner: z.object({ entryId: z.uuid(), alias: z.string(), title: z.string(), votes: z.number().int() }).nullable(),
  /** Ruta de la PWA donde la gente vota (la pantalla le pone el dominio y dibuja el QR). */
  votePath: z.string(),
  updatedAt: z.iso.datetime(),
});
export type ContestScreen = z.infer<typeof ContestScreenSchema>;
