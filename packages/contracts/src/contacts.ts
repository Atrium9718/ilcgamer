import { z } from 'zod';

/**
 * Contactos con autorización de novedades vigente (el dato más valioso de la plataforma, tratado con cuidado):
 * solo aparecen personas cuya última decisión de MARKETING es «sí», con cuenta activa. Quien retira la autorización
 * desaparece del listado. Cada consulta queda en la auditoría. Se usa solo para las finalidades autorizadas.
 */
export const OptInContactSchema = z.object({
  alias: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  /** Cuándo dio la autorización vigente. */
  optedInAt: z.string(),
  /** Pantalla donde la dio (registro, perfil, campana…). */
  source: z.string(),
});
export type OptInContact = z.infer<typeof OptInContactSchema>;

export const OptInContactsSchema = z.object({ total: z.number().int(), rows: z.array(OptInContactSchema) });
export type OptInContacts = z.infer<typeof OptInContactsSchema>;

/** Panel de registros: quiénes se inscribieron con sus datos de contacto y autorizaciones (solo Marca y TI; cada consulta se audita). */
export const RegistrationRowSchema = z.object({
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  /** Cuándo autorizó el tratamiento de datos. */
  registeredAt: z.string(),
  marketing: z.boolean(),
  marketingAt: z.string().nullable(),
  source: z.string(),
});
export type RegistrationRow = z.infer<typeof RegistrationRowSchema>;

export const RegistrationsSchema = z.object({
  days: z.number().int(),
  summary: z.object({
    total: z.number().int(),
    withMarketing: z.number().int(),
    withEmail: z.number().int(),
    withPhone: z.number().int(),
    inPeriod: z.number().int(),
    today: z.number().int(),
  }),
  byDay: z.array(z.object({ date: z.string(), count: z.number().int() })),
  rows: z.array(RegistrationRowSchema),
});
export type Registrations = z.infer<typeof RegistrationsSchema>;
