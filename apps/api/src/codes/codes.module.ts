import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.ts';
import { RolesGuard } from '../identity/roles.guard.ts';
import { ParcheModule } from '../parche/parche.module.ts';
import { ReferralsModule } from '../referrals/referrals.module.ts';
import { ClaimsService } from './claims.service.ts';
import { AdminSmartTagsController, CodesController } from './codes.controller.ts';
import { ImportsService } from './imports.service.ts';
import { IntegrationKeyGuard } from './integration.guard.ts';
import { ProductCodesService } from './product-codes.service.ts';
import { SmartTagsAdminService } from './smarttags-admin.service.ts';

/** Smart Tags (consulta de producto) y códigos de campaña (claims): dominios separados — Guía Técnica §5.6. */
@Module({
  imports: [IdentityModule, ParcheModule, ReferralsModule],
  controllers: [CodesController, AdminSmartTagsController],
  providers: [ProductCodesService, ClaimsService, SmartTagsAdminService, ImportsService, IntegrationKeyGuard, RolesGuard],
})
export class CodesModule {}
