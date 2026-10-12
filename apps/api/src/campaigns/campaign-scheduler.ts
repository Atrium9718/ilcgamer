import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';
import { RedisService } from '../redis/redis.service.ts';
import { CampaignsService } from './campaigns.service.ts';

const LOCK_KEY = 'lock:campaign-scheduler';

/**
 * Activa campañas programadas y cierra las vencidas cada minuto. Con varias instancias de la API, un
 * candado en Redis evita trabajo duplicado; además cada cambio es condicional (idempotente).
 */
@Injectable()
export class CampaignScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Programador');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly campaigns: CampaignsService,
    private readonly redis: RedisService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    if (this.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.run(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async run(): Promise<void> {
    try {
      if (!(await this.redis.isHealthy())) return;
      const acquired = await this.redis.client.set(LOCK_KEY, String(process.pid), 'PX', 55_000, 'NX');
      if (!acquired) return;
      const r = await this.campaigns.tick();
      if (r.activated || r.closed) this.logger.log(`Campañas activadas: ${r.activated}, cerradas: ${r.closed}`);
    } catch (err) {
      this.logger.error(err);
    }
  }
}
