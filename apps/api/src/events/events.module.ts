import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.ts';
import { RolesGuard } from '../identity/roles.guard.ts';
import { AdminEventsController, EventsController, ScreensController } from './events.controller.ts';
import { EventsService } from './events.service.ts';
import { EventsScheduler } from './events-scheduler.ts';

/** Eventos y concursos (concurso de disfraces con fotos, votación y pantalla pública). */
@Module({
  imports: [IdentityModule],
  controllers: [EventsController, AdminEventsController, ScreensController],
  providers: [EventsService, EventsScheduler, RolesGuard],
  exports: [EventsService],
})
export class EventsModule {}
