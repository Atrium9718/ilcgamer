import { Module } from '@nestjs/common';
import { GamesModule } from '../games/games.module.ts';
import { IdentityModule } from '../identity/identity.module.ts';
import { RolesGuard } from '../identity/roles.guard.ts';
import { CampaignScheduler } from './campaign-scheduler.ts';
import { AdminCampaignsController, PublicCampaignsController } from './campaigns.controller.ts';
import { CampaignsService } from './campaigns.service.ts';

@Module({
  imports: [IdentityModule, GamesModule],
  controllers: [AdminCampaignsController, PublicCampaignsController],
  providers: [CampaignsService, CampaignScheduler, RolesGuard],
  exports: [CampaignsService],
})
export class CampaignsModule {}
