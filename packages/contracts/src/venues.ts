import { z } from 'zod';
import { ChannelSchema } from './campaigns.ts';

/**
 * Establecimientos, Staff y Dealer (Instrucciones §3.3-§3.5; Guía Técnica §5.9).
 * Staff: acceso limitado a su establecimiento, sin datos personales de participantes. Dealer: solo su establecimiento,
 * con datos de jugadores siempre agregados. Los incentivos económicos dependen de contratos y no se calculan aquí.
 */
const Text = (max: number) => z.string().trim().max(max);

export const VENUE_STATUSES = ['PENDIENTE', 'APROBADO', 'SUSPENDIDO'] as const;
export const VenueStatusSchema = z.enum(VENUE_STATUSES);
export type VenueStatus = z.infer<typeof VenueStatusSchema>;

export const PERSONNEL_ROLES = ['STAFF', 'DEALER'] as const;
export const PersonnelRoleSchema = z.enum(PERSONNEL_ROLES);

/** Código individual del Staff (el QR que escanea la persona en la mesa). */
export const STAFF_CODE = /^[0-9A-Z]{8}$/;
export const StaffCodeSchema = z.string().trim().toUpperCase().regex(STAFF_CODE, 'Código de Staff no válido');

// ─────────────── Consola de Admin ───────────────

export const CreateVenueSchema = z.object({
  name: Text(80).min(3),
  channel: ChannelSchema,
  city: Text(60).min(2),
  department: Text(60).min(2),
  address: Text(160).default(''),
});
export type CreateVenue = z.infer<typeof CreateVenueSchema>;

export const VenueAdminViewSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  channel: ChannelSchema,
  city: z.string(),
  department: z.string(),
  address: z.string(),
  status: VenueStatusSchema,
  listed: z.boolean(),
  personnel: z.array(z.object({ userId: z.uuid(), alias: z.string(), role: PersonnelRoleSchema, code: z.string().nullable(), active: z.boolean() })),
  campaigns: z.array(z.object({ slug: z.string(), title: z.string() })),
});
export type VenueAdminView = z.infer<typeof VenueAdminViewSchema>;

export const AddPersonnelSchema = z.object({ email: Text(120).min(5), role: PersonnelRoleSchema });
export type AddPersonnel = z.infer<typeof AddPersonnelSchema>;

export const LinkCampaignsSchema = z.object({ campaignSlugs: z.array(Text(80)).max(30) });
export const SuspendVenueSchema = z.object({ reason: Text(300).min(5) });

// ─────────────── Perfil público y directorio ───────────────

export const VenueProfileSchema = z.object({
  description: Text(500).default(''),
  hours: Text(200).default(''),
  address: Text(160).default(''),
  listed: z.boolean(),
});
export type VenueProfile = z.infer<typeof VenueProfileSchema>;

export const PublicVenueSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  channel: ChannelSchema,
  city: z.string(),
  department: z.string(),
  address: z.string(),
  hours: z.string(),
  description: z.string(),
});
export type PublicVenue = z.infer<typeof PublicVenueSchema>;

// ─────────────── Paneles de Staff y Dealer (solo agregados) ───────────────

export const StaffDashboardSchema = z.object({
  venue: z.object({ name: z.string(), city: z.string() }),
  code: z.string(),
  /** Ruta de la PWA que abre el QR del Staff. */
  qrPath: z.string(),
  counts: z.object({ today: z.number().int(), week: z.number().int() }),
  weeklyGoal: z.number().int(),
  recent: z.array(z.object({ at: z.iso.datetime(), campaignTitle: z.string(), tableName: z.string().nullable() })),
});
export type StaffDashboard = z.infer<typeof StaffDashboardSchema>;

export const DealerDashboardSchema = z.object({
  venue: z.object({ id: z.uuid(), name: z.string(), city: z.string(), channel: ChannelSchema }),
  counts: z.object({ today: z.number().int(), week: z.number().int(), month: z.number().int() }),
  /** Últimos 14 días (hora de Colombia), del más antiguo al más reciente. */
  series: z.array(z.object({ date: z.string(), count: z.number().int() })),
  /** Solo la posición propia entre los locales de su ciudad; nunca nombres de otros. */
  rank: z.object({ position: z.number().int(), total: z.number().int(), city: z.string() }).nullable(),
  campaigns: z.array(z.object({ slug: z.string(), title: z.string() })),
  profile: VenueProfileSchema,
});
export type DealerDashboard = z.infer<typeof DealerDashboardSchema>;
