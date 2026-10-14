import { DASHBOARD_DAYS, type OptInContacts, type Registrations, type Role } from '@ilc/contracts';
import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Auth, type AuthContext, AuthGuard } from '../identity/auth.guard.ts';
import { RequireRoles, type RoledRequest, RolesGuard } from '../identity/roles.guard.ts';
import { ContactsService } from './contacts.service.ts';

const BRAND: Role[] = ['ADMIN_MARCA', 'SUPERADMIN'];

@ApiTags('Consola · Contactos')
@ApiCookieAuth()
@Controller('admin/contacts')
@UseGuards(AuthGuard, RolesGuard)
@RequireRoles(...BRAND)
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  /** Contactos con autorización de novedades vigente (para campañas de comunicación autorizadas). */
  @Get('opt-ins')
  @Header('Cache-Control', 'no-store')
  optIns(@Auth() auth: AuthContext, @Req() req: RoledRequest): Promise<OptInContacts> {
    return this.contacts.optIns(auth.user.id, String(req.id));
  }

  /** Panel de registros (totales, serie por día y filas descargables). */
  @Get('registrations')
  @Header('Cache-Control', 'no-store')
  registrations(@Auth() auth: AuthContext, @Req() req: RoledRequest, @Query('days') days?: string): Promise<Registrations> {
    const n = Number(days ?? 30);
    return this.contacts.registrations(auth.user.id, String(req.id), (DASHBOARD_DAYS as readonly number[]).includes(n) ? n : 30);
  }
}
