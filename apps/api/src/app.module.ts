import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AnalyticsModule } from './analytics/analytics.module.ts';
import { AuditModule } from './audit/audit.module.ts';
import { CampaignsModule } from './campaigns/campaigns.module.ts';
import { CodesModule } from './codes/codes.module.ts';
import { AllExceptionsFilter } from './common/exception.filter.ts';
import { IdempotencyKeyGuard } from './common/idempotency.ts';
import { OriginGuard } from './common/origin.guard.ts';
import { ConfigModule } from './config/config.module.ts';
import { EconomyModule } from './economy/economy.module.ts';
import { EventsModule } from './events/events.module.ts';
import { GamesModule } from './games/games.module.ts';
import { HealthModule } from './health/health.module.ts';
import { IdentityModule } from './identity/identity.module.ts';
import { ParcheModule } from './parche/parche.module.ts';
import { PlatformModule } from './platform/platform.module.ts';
import { PrismaModule } from './prisma/prisma.module.ts';
import { RedisModule } from './redis/redis.module.ts';
import { ReferralsModule } from './referrals/referrals.module.ts';
import { RewardsModule } from './rewards/rewards.module.ts';
import { VenuesModule } from './venues/venues.module.ts';

/**
 * Monolito modular (ADR-03). Paso 4: identity, platform y audit. Paso 5: campaigns. Los siguientes módulos de dominio ( product-codes, claims,
 * ledger, sessions, missions, rewards, venues, referrals, analytics, audit) se agregan aquí en los
 * pasos 4-12 del plan, cada uno con sus propios límites.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    AuditModule,
    PlatformModule,
    HealthModule,
    IdentityModule,
    CampaignsModule,
    CodesModule,
    EconomyModule,
    ParcheModule,
    GamesModule,
    RewardsModule,
    VenuesModule,
    AnalyticsModule,
    ReferralsModule,
    EventsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: IdempotencyKeyGuard },
  ],
})
export class AppModule {}
