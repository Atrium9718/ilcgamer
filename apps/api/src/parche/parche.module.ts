import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.ts';
import { ParcheController } from './parche.controller.ts';
import { ParcheService } from './parche.service.ts';
import { ParcheBus } from './parche-bus.ts';
import { ParcheScheduler } from './parche-scheduler.ts';

/** El Parche en tiempo real (Guía Técnica §5.5, §8). */
@Module({
  imports: [IdentityModule],
  controllers: [ParcheController],
  providers: [ParcheService, ParcheBus, ParcheScheduler],
  exports: [ParcheService],
})
export class ParcheModule {}
