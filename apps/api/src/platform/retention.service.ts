import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { RedisService } from '../redis/redis.service.ts';
import { SettingsService } from './settings.service.ts';

const DAY = 86_400_000;
const LOCK = 'lock:retention';

export interface PurgeResult {
  analyticsEvents: number;
  securityEvents: number;
  productCodeConsultations: number;
  missionStates: number;
}

/**
 * Retención y minimización (Guía Técnica §9.3): solo se purgan datos operativos o analíticos. El ledger, la auditoría,
 * los consentimientos y los canjes se conservan (base legítima y trazabilidad). Cada plazo es configurable.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Retención');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly redis: RedisService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    if (this.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.run(), 6 * 3_600_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async run(): Promise<void> {
    try {
      if (!(await this.redis.isHealthy())) return;
      if ((await this.redis.client.set(LOCK, String(process.pid), 'PX', 5 * 3_600_000, 'NX')) !== 'OK') return;
      const r = await this.purge();
      this.logger.log(`Depuración: ${JSON.stringify(r)}`);
    } catch (err) {
      this.logger.error(err);
    }
  }

  async purge(now = new Date()): Promise<PurgeResult> {
    const ago = async (
      key:
        | 'retention.analyticsEventsDays'
        | 'retention.resolvedSecurityEventsDays'
        | 'retention.productCodeConsultationsDays'
        | 'retention.missionPrivateStateDays',
    ) => new Date(now.getTime() - Number(await this.settings.get(key)) * DAY);
    const [analytics, security, consults, missions] = await Promise.all([
      this.prisma.analyticsEvent.deleteMany({ where: { occurredAt: { lt: await ago('retention.analyticsEventsDays') } } }),
      this.prisma.securityEvent.deleteMany({ where: { resolvedAt: { not: null, lt: await ago('retention.resolvedSecurityEventsDays') } } }),
      this.prisma.productCodeEvent.deleteMany({ where: { type: 'CONSULTA', createdAt: { lt: await ago('retention.productCodeConsultationsDays') } } }),
      // El estado privado de una misión terminada (claves de respuesta, sorteo) deja de hacer falta.
      this.prisma.missionProgress.updateMany({
        where: {
          status: { in: ['VERIFICADA', 'RECHAZADA', 'ABANDONADA'] },
          state: { not: Prisma.DbNull },
          completedAt: { lt: await ago('retention.missionPrivateStateDays') },
        },
        data: { state: Prisma.DbNull },
      }),
    ]);
    return { analyticsEvents: analytics.count, securityEvents: security.count, productCodeConsultations: consults.count, missionStates: missions.count };
  }
}
