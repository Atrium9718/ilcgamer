import { Global, Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.ts';
import { RolesGuard } from '../identity/roles.guard.ts';
import { AdminAnalyticsController, EventsController } from './analytics.controller.ts';
import { AnalyticsService } from './analytics.service.ts';

@Global()
@Module({
  imports: [IdentityModule],
  controllers: [EventsController, AdminAnalyticsController],
  providers: [AnalyticsService, RolesGuard],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
