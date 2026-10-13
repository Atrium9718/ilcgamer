import { z } from 'zod';

/**
 * Referidos (Instrucciones §8; Guía Gamificación §16.2). Enlace, código corto y QR de usuario; sin agenda de contactos
 * ni mensajes automáticos a terceros. La bonificación solo existe si la campaña de la plataforma la habilita y tras una
 * acción real del referido (primera activación válida en Ruta A, primera misión en Ruta B), con topes por día y semana.
 * Las economías siguen separadas: la activación da Puntos ILC, la misión da XP.
 */
export const REFERRAL_CODE = /^[A-Z0-9-]{4,12}$/;
export const ReferralCodeSchema = z.string().trim().toUpperCase().regex(REFERRAL_CODE, 'Código de referido no válido');

export const AttributeReferralSchema = z.object({ code: ReferralCodeSchema });
export type AttributeReferral = z.infer<typeof AttributeReferralSchema>;

export const ReferralMeSchema = z.object({
  code: z.string(),
  /** Ruta de la PWA que abre el enlace de invitación. */
  linkPath: z.string(),
  /** Personas que se registraron con tu código / cuántas ya te dieron bonificación. */
  joined: z.number().int(),
  rewarded: z.number().int(),
  /** Reglas transparentes tal como aplican hoy; null si no hay bonificación activa. */
  rewardText: z.string().nullable(),
});
export type ReferralMe = z.infer<typeof ReferralMeSchema>;

export const ReferralSettingsSchema = z
  .object({
    enabled: z.boolean(),
    /** Puntos ILC para quien invita cuando su invitado hace su primera activación válida (Ruta A). 0 = sin bonificación. */
    referrerPoints: z.number().int().min(0).max(5000),
    /** XP para quien invita cuando su invitado completa su primera misión (Ruta B). 0 = sin bonificación. */
    referrerXp: z.number().int().min(0).max(500),
    dailyCap: z.number().int().min(1).max(100),
    weeklyCap: z.number().int().min(1).max(500),
    /** Días desde que se creó la cuenta durante los cuales aún se puede atribuir un código. */
    attributionWindowDays: z.number().int().min(1).max(30),
  })
  .refine((v) => v.dailyCap <= v.weeklyCap, { message: 'El tope diario no puede superar al semanal', path: ['dailyCap'] });
export type ReferralSettings = z.infer<typeof ReferralSettingsSchema>;

export const ReferralSummarySchema = z.object({
  days: z.number().int(),
  attributed: z.number().int(),
  rewardedByClaim: z.number().int(),
  rewardedByMission: z.number().int(),
  capped: z.number().int(),
});
export type ReferralSummary = z.infer<typeof ReferralSummarySchema>;
