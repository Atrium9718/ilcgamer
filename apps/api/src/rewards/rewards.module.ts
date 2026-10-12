import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.ts';
import { RolesGuard } from '../identity/roles.guard.ts';
import { AdminRewardsController, RewardsController } from './rewards.controller.ts';
import { RewardsService } from './rewards.service.ts';
import { RewardsScheduler } from './rewards-scheduler.ts';

/** Recompensas e inventario (Guía Técnica §5.8). */
@Module({
  imports: [IdentityModule],
  controllers: [RewardsController, AdminRewardsController],
  providers: [RewardsService, RewardsScheduler, RolesGuard],
  exports: [RewardsService],
})
export class RewardsModule {}
