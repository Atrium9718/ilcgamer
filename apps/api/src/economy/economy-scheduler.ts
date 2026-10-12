import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';
import { RedisService } from '../redis/redis.service.ts';
import { LedgerService } from './ledger.service.ts';

const EXPIRY_LOCK = 'lock:ledger-expiry';
const RECONCILE_LOCK = 'lock:ledger-reconcile';

/**
 * Vence puntos cada 10 minutos y concilia saldos cada hora. El candado en Redis evita trabajo duplicado entre
 * instancias; además cada vencimiento es idempotente (clave única por crédito).
 */
@Injectable()
export class EconomyScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Economía');
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly ledger: LedgerService,
    private readonly redis: RedisService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    if (this.env.NODE_ENV === 'test') return;
    this.timers = [setInterval(() => void this.expire(), 10 * 60_000), setInterval(() => void this.reconcile(), 60 * 60_000)];
    for (const t of this.timers) t.unref();
  }

  onModuleDestroy(): void {
    for (const t of this.timers) clearInterval(t);
  }

  private async locked(key: string, ttlMs: number): Promise<boolean> {
    if (!(await this.redis.isHealthy())) return false;
    return (await this.redis.client.set(key, String(process.pid), 'PX', ttlMs, 'NX')) === 'OK';
  }

  async expire(): Promise<void> {
    try {
      if (!(await this.locked(EXPIRY_LOCK, 9 * 60_000))) return;
      const r = await this.ledger.expireDue();
      if (r.expired) this.logger.log(`Puntos vencidos: ${r.points} en ${r.expired} créditos`);
    } catch (err) {
      this.logger.error(err);
    }
  }

  async reconcile(): Promise<void> {
    try {
      if (!(await this.locked(RECONCILE_LOCK, 55 * 60_000))) return;
      const r = await this.ledger.reconcile();
      if (r.mismatches.length) this.logger.error(`Conciliación: ${r.mismatches.length} cuentas con diferencia entre saldo y ledger`);
    } catch (err) {
      this.logger.error(err);
    }
  }
}
