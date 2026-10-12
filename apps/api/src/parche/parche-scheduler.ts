import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';
import { RedisService } from '../redis/redis.service.ts';
import { ParcheService } from './parche.service.ts';

const LOCK = 'lock:parche-expiry';

/** Expira Parches por hora de cierre o inactividad cada minuto (candado en Redis entre instancias). */
@Injectable()
export class ParcheScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Parche');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly parche: ParcheService,
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
      if ((await this.redis.client.set(LOCK, String(process.pid), 'PX', 55_000, 'NX')) !== 'OK') return;
      const n = await this.parche.tick();
      if (n) this.logger.log(`Parches expirados: ${n}`);
    } catch (err) {
      this.logger.error(err);
    }
  }
}
