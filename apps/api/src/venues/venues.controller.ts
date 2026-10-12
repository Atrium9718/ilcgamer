import {
  type AddPersonnel,
  AddPersonnelSchema,
  type CreateVenue,
  CreateVenueSchema,
  type DealerDashboard,
  LinkCampaignsSchema,
  type PublicVenue,
  type Role,
  type StaffDashboard,
  SuspendVenueSchema,
  type VenueAdminView,
  type VenueProfile,
  VenueProfileSchema,
} from '@ilc/contracts';
import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { ZodValidationPipe } from '../common/zod-validation.pipe.ts';
import { Auth, type AuthContext, AuthGuard } from '../identity/auth.guard.ts';
import { RequireRoles, type RoledRequest, RolesGuard } from '../identity/roles.guard.ts';
import { VenuesService } from './venues.service.ts';

const BRAND: Role[] = ['ADMIN_MARCA', 'SUPERADMIN'];

function actorOf(req: RoledRequest): Actor {
  const auth = req.auth;
  if (!auth) throw new Error('AuthGuard requerido');
  return { userId: auth.user.id, alias: auth.user.alias, roles: req.roles ?? [], requestId: String(req.id) };
}

/** Directorio público de establecimientos aprobados que decidieron aparecer (requiere control de edad, es promocional). */
@ApiTags('Establecimientos')
@ApiCookieAuth()
@Controller('venues')
@UseGuards(AuthGuard)
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  directory(@Query('city', new ZodValidationPipe(z.string().trim().max(60).optional())) city?: string): Promise<PublicVenue[]> {
    return this.venues.directory(city);
  }
}

@ApiTags('Staff y Comercio')
@ApiCookieAuth()
@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class VenueStaffController {
  constructor(private readonly venues: VenuesService) {}

  @Get('staff/me')
  @RequireRoles('STAFF')
  @Header('Cache-Control', 'no-store')
  staff(@Auth() auth: AuthContext): Promise<StaffDashboard> {
    return this.venues.staffDashboard(auth.user.id);
  }

  @Get('dealer/me')
  @RequireRoles('DEALER')
  @Header('Cache-Control', 'no-store')
  dealer(@Auth() auth: AuthContext): Promise<DealerDashboard> {
    return this.venues.dealerDashboard(auth.user.id);
  }

  @Put('dealer/me/profile')
  @RequireRoles('DEALER')
  profile(@Body(new ZodValidationPipe(VenueProfileSchema)) body: VenueProfile, @Auth() auth: AuthContext, @Req() req: RoledRequest): Promise<DealerDashboard> {
    return this.venues.updateProfile(auth.user.id, body, String(req.id));
  }
}

@ApiTags('Consola · Comercios')
@ApiCookieAuth()
@Controller('admin/venues')
@UseGuards(AuthGuard, RolesGuard)
@RequireRoles(...BRAND)
export class AdminVenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  list(): Promise<VenueAdminView[]> {
    return this.venues.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateVenueSchema)) body: CreateVenue, @Req() req: RoledRequest): Promise<VenueAdminView> {
    return this.venues.create(actorOf(req), body);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Param('id', ParseUUIDPipe) id: string, @Req() req: RoledRequest): Promise<VenueAdminView> {
    return this.venues.approve(actorOf(req), id);
  }

  @Post(':id/suspend')
  @HttpCode(200)
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SuspendVenueSchema)) body: { reason: string },
    @Req() req: RoledRequest,
  ): Promise<VenueAdminView> {
    return this.venues.suspend(actorOf(req), id, body.reason);
  }

  @Put(':id/campaigns')
  linkCampaigns(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(LinkCampaignsSchema)) body: { campaignSlugs: string[] },
    @Req() req: RoledRequest,
  ): Promise<VenueAdminView> {
    return this.venues.linkCampaigns(actorOf(req), id, body.campaignSlugs);
  }

  @Post(':id/personnel')
  @HttpCode(200)
  add(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AddPersonnelSchema)) body: AddPersonnel,
    @Req() req: RoledRequest,
  ): Promise<VenueAdminView> {
    return this.venues.addPersonnel(actorOf(req), id, body);
  }

  @Delete(':id/personnel/:userId')
  remove(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string, @Req() req: RoledRequest): Promise<VenueAdminView> {
    return this.venues.removePersonnel(actorOf(req), id, userId);
  }
}
