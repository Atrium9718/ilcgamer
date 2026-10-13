import { DEFAULT_XP_LEVELS, type PublicConfig } from '@ilc/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

/** Valores por defecto si el administrador aún no los ha configurado (todo editable — Guía Técnica §18). */
const DEFAULTS = {
  'economy.currencyName': 'Puntos ILC',
  'legal.noticeVersion': '1.0',
  'platform.minAge': 18,
  /** Plantilla de la URL impresa en el QR (Instrucciones §4.1). */
  'smarttags.urlTemplate': 'https://ilc.app/v/{token}',
  /** Consultas por hora de un mismo código que disparan "Requiere verificación adicional" (§5.6, §9.2). */
  'smarttags.anomalyLookupsPerHour': 50,
  /** Días de anticipación para avisar en la billetera qué puntos vencen (transparencia — §5.7). */
  'economy.expiringNoticeDays': 30,
  /** Umbrales de XP por nivel (parámetros de prueba hasta aprobación de Marca). */
  'economy.xpLevels': DEFAULT_XP_LEVELS as readonly number[],
  /** El Parche sin campaña (Ruta B libre): energía, hora de cierre e inactividad (Instrucciones §3.2, §5). */
  'parche.energyMinutes': 45,
  'parche.endsAtLocalTime': '06:00',
  'parche.inactivityMinutes': 120,
  'parche.capacity': 12,
  /** Referidos (apagados hasta que Marca, Finanzas y Jurídico aprueben términos y topes; Guía Técnica §5.10). */
  'referrals.settings': { enabled: false, referrerPoints: 0, referrerXp: 0, dailyCap: 5, weeklyCap: 20, attributionWindowDays: 7 } as Record<
    string,
    string | number | boolean
  >,
  /** Vigencia por defecto (días) de los Puntos ILC por bonificación de referidos; 0 = sin vencimiento. */
  'economy.defaultPointsExpiryDays': 0,
  /** Retención (Guía Técnica §9.3): días que se conserva cada tipo de dato. El ledger y la auditoría NO se purgan. */
  'retention.analyticsEventsDays': 730,
  'retention.resolvedSecurityEventsDays': 730,
  'retention.productCodeConsultationsDays': 365,
  'retention.missionPrivateStateDays': 30,
  /** Fotos de concursos: se eliminan estos días después de cerrar el concurso (son datos personales). */
  'retention.contestPhotosDays': 30,
  /** Meta semanal de vinculaciones de un Staff (indicador de avance; nunca premia rapidez ni volumen de consumo). */
  'staff.weeklyGoal': 40,
  /** Días para retirar una recompensa reservada; después vence y se devuelven stock y puntos (§5.8). */
  'rewards.reservationDays': 14,
  /** Juegos disponibles cuando no hay campaña (o la campaña no define los suyos). Máximo 2 de Ruta B. */
  'games.defaultModules': [] as readonly string[],
} as const;

type Key = keyof typeof DEFAULTS;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async get<K extends Key>(key: K): Promise<(typeof DEFAULTS)[K]> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    return (row?.value ?? DEFAULTS[key]) as (typeof DEFAULTS)[K];
  }

  async set<K extends Key>(key: K, value: (typeof DEFAULTS)[K] | string | number, updatedById: string): Promise<void> {
    await this.prisma.platformSetting.upsert({ where: { key }, update: { value, updatedById }, create: { key, value, updatedById } });
  }

  async publicConfig(): Promise<PublicConfig> {
    return {
      currencyName: String(await this.get('economy.currencyName')),
      legalNoticeVersion: String(await this.get('legal.noticeVersion')),
      minAge: Math.max(18, Number(await this.get('platform.minAge'))),
      otpChannels: this.env.OTP_PROVIDER === 'none' ? [] : ['whatsapp', 'sms', 'email'],
      // Google/Apple se habilitan al registrar credenciales de cliente (Guía Técnica §5.2, §15).
      oauthProviders: [],
    };
  }
}
