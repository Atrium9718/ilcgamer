import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.ts';
import { RolesGuard } from '../identity/roles.guard.ts';
import { ContactsController } from './contacts.controller.ts';
import { ContactsService } from './contacts.service.ts';

/** Listado auditado de contactos que autorizaron recibir novedades. */
@Module({ imports: [IdentityModule], controllers: [ContactsController], providers: [ContactsService, RolesGuard] })
export class ContactsModule {}
