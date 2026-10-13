import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module.ts';
import { IdentityModule } from '../identity/identity.module.ts';
import { RolesGuard } from '../identity/roles.guard.ts';
import { AdminReferralsController, ReferralsController } from './referrals.controller.ts';
import { ReferralsService } from './referrals.service.ts';

/** Referidos con bonificación opcional, topes y economías separadas. */
@Module({
  imports: [IdentityModule, EconomyModule],
  controllers: [ReferralsController, AdminReferralsController],
  providers: [ReferralsService, RolesGuard],
  exports: [ReferralsService],
})
export class ReferralsModule {}
