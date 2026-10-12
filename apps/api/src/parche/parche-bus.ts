import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { RedisService } from '../redis/redis.service.ts';

type Listener = () => void;
const channel = (sessionId: string) => `parche:${sessionId}`;

/**
 * Avisos de cambio de estado del Parche entre instancias de la API (Redis pub/sub — ADR-05). Solo viaja el
 * "cambió la sesión X"; cada conexión vuelve a leer el estado autoritativo de la base de datos.
 */
@Injectable()
export class ParcheBus implements OnModuleDestroy {
  private readonly logger = new Logger('Parche');
  private subscriber?: Redis;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(private readonly redis: RedisService) {}

  async publish(sessionId: string): Promise<void> {
    try {
      if (await this.redis.isHealthy()) {
        await this.redis.client.publish(channel(sessionId), '1');
        return;
      }
    } catch {
      /* sin Redis: se avisa al menos a las conexiones de esta instancia */
    }
    this.emit(sessionId);
  }

  async subscribe(sessionId: string, listener: Listener): Promise<() => void> {
    const set = this.listeners.get(sessionId) ?? new Set();
    set.add(listener);
    this.listeners.set(sessionId, set);
    if (set.size === 1) await (await this.sub())?.subscribe(channel(sessionId)).catch(() => undefined);
    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(sessionId);
        void this.subscriber?.unsubscribe(channel(sessionId)).catch(() => undefined);
      }
    };
  }

  private emit(sessionId: string): void {
    for (const l of this.listeners.get(sessionId) ?? []) l();
  }

  private async sub(): Promise<Redis | undefined> {
    if (this.subscriber) return this.subscriber;
    if (!(await this.redis.isHealthy())) return undefined;
    this.subscriber = this.redis.client.duplicate({ enableOfflineQueue: true });
    this.subscriber.on('error', (err) => this.logger.warn(`pub/sub: ${err.message}`));
    this.subscriber.on('message', (ch: string) => this.emit(ch.replace(/^parche:/, '')));
    return this.subscriber;
  }

  onModuleDestroy(): void {
    this.subscriber?.disconnect();
  }
}
