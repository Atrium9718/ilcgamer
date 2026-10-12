import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';
import { RedisService } from '../redis/redis.service.ts';
import { RewardsService } from './rewards.service.ts';

const LOCK = 'lock:rewards-expiry';

/** Vence cada 10 minutos las reservas no retiradas (devuelve stock y puntos). Candado en Redis entre instancias. */
@Injectable()
export class RewardsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Recompensas');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly rewards: RewardsService,
    private readonly redis: RedisService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    if (this.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.expire(), 10 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async expire(): Promise<void> {
    try {
      if (!(await this.redis.isHealthy())) return;
      if ((await this.redis.client.set(LOCK, String(process.pid), 'PX', 9 * 60_000, 'NX')) !== 'OK') return;
      const n = await this.rewards.expireDue();
      if (n) this.logger.log(`Reservas vencidas: ${n}`);
    } catch (err) {
      this.logger.error(err);
    }
  }
}
