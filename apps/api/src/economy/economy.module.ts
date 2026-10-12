import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.ts';
import { RolesGuard } from '../identity/roles.guard.ts';
import { AdminEconomyController, EconomyController } from './economy.controller.ts';
import { EconomyScheduler } from './economy-scheduler.ts';
import { LedgerService } from './ledger.service.ts';
import { ProgressService } from './progress.service.ts';

/** Economía dual: Puntos ILC (ledger) y XP/insignias (Ruta B) — Guía Técnica §5.7. */
@Module({
  imports: [IdentityModule],
  controllers: [EconomyController, AdminEconomyController],
  providers: [LedgerService, ProgressService, EconomyScheduler, RolesGuard],
  exports: [LedgerService, ProgressService],
})
export class EconomyModule {}
