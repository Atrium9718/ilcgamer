import type { PublicConfig } from '@ilc/contracts';
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
