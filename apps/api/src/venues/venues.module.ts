import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.ts';
import { RolesGuard } from '../identity/roles.guard.ts';
import { AdminVenuesController, VenueStaffController, VenuesController } from './venues.controller.ts';
import { VenuesService } from './venues.service.ts';

/** Establecimientos, Staff y Dealer (Guía Técnica §5.9). */
@Module({
  imports: [IdentityModule],
  controllers: [VenuesController, VenueStaffController, AdminVenuesController],
  providers: [VenuesService, RolesGuard],
  exports: [VenuesService],
})
export class VenuesModule {}
