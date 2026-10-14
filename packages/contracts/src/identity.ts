import { z } from 'zod';
import { ConsentPurposeSchema } from './domain.ts';

/**
 * Identidad, edad y consentimientos (Paso 4).
 * Fuentes: Instrucciones §3.1, §5 paso 3, §7; Guía Técnica §5.2, §7, §9.3, §9.4.
 */

/** Alias visible en pantallas compartidas: sin datos personales (§5.5). */
export const AliasSchema = z
  .string()
  .trim()
  .min(2, 'El alias debe tener al menos 2 caracteres.')
  .max(20, 'El alias puede tener hasta 20 caracteres.')
  .regex(/^[\p{L}\p{N} ._-]+$/u, 'Usa solo letras, números, espacios, punto, guion o guion bajo.');

/** Fecha ISO (AAAA-MM-DD). Se usa solo para calcular la edad: NO se almacena (§5.2). */
export const BirthDateSchema = z.iso.date('Fecha de nacimiento inválida.');

export const AgeGateRequestSchema = z.object({
  birthDate: BirthDateSchema,
  /** Casilla "Confirmo que soy mayor de 18 años". */
  declaration: z.literal(true, 'Debes confirmar que eres mayor de edad.'),
  /** Campaña de entrada (opcional): puede exigir una edad mínima mayor a 18. */
  campaignSlug: z.string().max(80).optional(),
});
export type AgeGateRequest = z.infer<typeof AgeGateRequestSchema>;

export const AccountStatusSchema = z.enum(['TEMPORAL', 'ACTIVA', 'SUSPENDIDA', 'ELIMINADA']);

export const ConsentStateSchema = z.object({
  purpose: ConsentPurposeSchema,
  granted: z.boolean(),
  noticeVersion: z.string().nullable(),
  updatedAt: z.iso.datetime().nullable(),
});
export type ConsentState = z.infer<typeof ConsentStateSchema>;

export const MeSchema = z.object({
  id: z.uuid(),
  alias: z.string(),
  status: AccountStatusSchema,
  ageVerified: z.boolean(),
  /** Métodos de acceso vinculados (sin exponer el identificador completo). */
  credentials: z.array(z.object({ provider: z.string(), hint: z.string() })),
  consents: z.array(ConsentStateSchema),
  /** Roles operativos (consola). Un jugador no tiene roles. */
  roles: z.array(z.string()),
});
export type Me = z.infer<typeof MeSchema>;

export const UpdateMeSchema = z.object({ alias: AliasSchema });

export const ConsentChangeSchema = z.object({
  purpose: ConsentPurposeSchema,
  granted: z.boolean(),
  /** Versión del aviso que la persona vio al decidir. */
  noticeVersion: z.string().regex(/^\d+\.\d+(\.\d+)?$/, 'Versión de aviso inválida.'),
  /** Pantalla o flujo donde se dio la autorización (trazabilidad, §9.3). */
  source: z.enum(['registro', 'perfil', 'campana', 'soporte']),
});
export type ConsentChange = z.infer<typeof ConsentChangeSchema>;

export const OtpChannelSchema = z.enum(['whatsapp', 'sms', 'email']);
export type OtpChannel = z.infer<typeof OtpChannelSchema>;

export const OtpRequestSchema = z.object({
  channel: OtpChannelSchema,
  destination: z.string().trim().min(5).max(120),
});
export type OtpRequest = z.infer<typeof OtpRequestSchema>;

export const OtpRequestResponseSchema = z.object({
  /** Destino enmascarado para mostrar ("+57 300 •••• 567"). */
  maskedDestination: z.string(),
  expiresInSeconds: z.number().int().positive(),
  resendInSeconds: z.number().int().nonnegative(),
});

export const OtpVerifySchema = OtpRequestSchema.extend({
  code: z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos.'),
});
export type OtpVerify = z.infer<typeof OtpVerifySchema>;

/** Configuración pública para la PWA (sin secretos). */
export const PublicConfigSchema = z.object({
  currencyName: z.string(),
  legalNoticeVersion: z.string(),
  minAge: z.number().int().min(18),
  otpChannels: z.array(OtpChannelSchema),
  oauthProviders: z.array(z.enum(['google', 'apple'])),
  /** true = al entrar hay que completar el registro (nombre, correo, celular y tratamiento de datos) antes de usar la app. */
  requireProfile: z.boolean().optional(),
});
export type PublicConfig = z.infer<typeof PublicConfigSchema>;

/**
 * Registro al entrar a la app (Paso 16): datos de contacto para ILC con autorización de tratamiento de datos. El tratamiento
 * de datos es obligatorio para continuar; las novedades y promociones son una autorización aparte. En esta etapa el correo y el
 * celular se guardan sin verificar con código (se verifican cuando haya pasarela de correo/SMS).
 */
export const ProfileCaptureSchema = z.object({
  fullName: z.string().trim().min(3, 'Escribe tu nombre completo.').max(80),
  email: z.email('Correo inválido.').max(120),
  phone: z.string().trim().min(7, 'Escribe tu celular.').max(20),
  /** Versión del aviso de privacidad que la persona vio. */
  noticeVersion: z.string().regex(/^\d+\.\d+(\.\d+)?$/),
  acceptDataTreatment: z.literal(true, { error: 'Debes autorizar el tratamiento de tus datos para continuar.' }),
  acceptMarketing: z.boolean().default(false),
});
export type ProfileCapture = z.infer<typeof ProfileCaptureSchema>;
