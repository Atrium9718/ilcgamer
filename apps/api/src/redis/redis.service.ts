import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';

/**
 * Redis para expiración de sesiones del Parche, límites de intentos y pub/sub en tiempo real
 * (ADR-05). Conexión perezosa: la API arranca aunque Redis tarde en estar disponible.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(@Inject(ENV) env: Env) {
    this.client = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });
    this.client.on('error', () => {
      /* el estado se reporta en /health; se evita ruido en logs */
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (this.client.status === 'wait' || this.client.status === 'end') await this.client.connect();
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
