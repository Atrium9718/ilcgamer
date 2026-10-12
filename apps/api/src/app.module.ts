import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AllExceptionsFilter } from './common/exception.filter.ts';
import { IdempotencyKeyGuard } from './common/idempotency.ts';
import { ConfigModule } from './config/config.module.ts';
import { HealthModule } from './health/health.module.ts';
import { PrismaModule } from './prisma/prisma.module.ts';
import { RedisModule } from './redis/redis.module.ts';

/**
 * Monolito modular (ADR-03). Los módulos de dominio (identity, campaigns, product-codes, claims,
 * ledger, sessions, missions, rewards, venues, referrals, analytics, audit) se agregan aquí en los
 * pasos 4-12 del plan, cada uno con sus propios límites.
 */
@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, HealthModule],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: IdempotencyKeyGuard },
  ],
})
export class AppModule {}
