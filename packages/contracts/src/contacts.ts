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
