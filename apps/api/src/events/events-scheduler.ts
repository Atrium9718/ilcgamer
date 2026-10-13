import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';
import { RedisService } from '../redis/redis.service.ts';
import { EventsService } from './events.service.ts';

const LOCK = 'lock:contests-close';

/** Cada minuto cierra los concursos cuya votación ya terminó y fija el ganador. Candado en Redis entre instancias. */
@Injectable()
export class EventsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Concursos');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly events: EventsService,
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
      if ((await this.redis.client.set(LOCK, String(process.pid), 'PX', 50_000, 'NX')) !== 'OK') return;
      const n = await this.events.tick();
      if (n) this.logger.log(`Concursos cerrados: ${n}`);
    } catch (err) {
      this.logger.error(err);
    }
  }
}
