import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module.ts';
import { IdentityModule } from '../identity/identity.module.ts';
import { RolesGuard } from '../identity/roles.guard.ts';
import { ParcheModule } from '../parche/parche.module.ts';
import { CatalogService } from './catalog.service.ts';
import { AdminGamesController, GamesController } from './games.controller.ts';
import { MissionsService } from './missions.service.ts';
import { ModulesService } from './modules.service.ts';

/** Catálogo de juegos, ciclo de vida de módulos y misiones validadas en servidor (Guía Técnica §5.4). */
@Module({
  imports: [IdentityModule, EconomyModule, ParcheModule],
  controllers: [GamesController, AdminGamesController],
  providers: [ModulesService, CatalogService, MissionsService, RolesGuard],
  exports: [ModulesService],
})
export class GamesModule {}
