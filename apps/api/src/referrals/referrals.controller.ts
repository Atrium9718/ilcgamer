import {
  type AttributeReferral,
  AttributeReferralSchema,
  DASHBOARD_DAYS,
  type ReferralMe,
  type ReferralSettings,
  ReferralSettingsSchema,
  type ReferralSummary,
  type Role,
} from '@ilc/contracts';
import { Body, Controller, Get, Header, HttpCode, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { ZodValidationPipe } from '../common/zod-validation.pipe.ts';
import { Auth, type AuthContext, AuthGuard } from '../identity/auth.guard.ts';
import { RequireRoles, type RoledRequest, RolesGuard } from '../identity/roles.guard.ts';
import { ReferralsService } from './referrals.service.ts';

const ATTRIBUTE_LIMIT = { rateLimit: { max: () => Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE ?? 10), timeWindow: '1 minute' } };

@ApiTags('Referidos')
@ApiCookieAuth()
@Controller('referrals')
@UseGuards(AuthGuard)
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Auth() auth: AuthContext): Promise<ReferralMe> {
    return this.referrals.me(auth.user);
  }

  /** La PWA lo llama una vez al guardar la cuenta con el código que trajo el enlace /r/{código}. */
  @Post('attribute')
  @HttpCode(200)
  @RouteConfig(ATTRIBUTE_LIMIT)
  attribute(
    @Body(new ZodValidationPipe(AttributeReferralSchema)) body: AttributeReferral,
    @Auth() auth: AuthContext,
    @Req() req: RoledRequest,
  ): Promise<{ attributed: boolean }> {
    return this.referrals.attribute(auth.user, body.code, String(req.id));
  }
}

const BRAND: Role[] = ['ADMIN_MARCA', 'SUPERADMIN'];

@ApiTags('Consola · Referidos')
@ApiCookieAuth()
@Controller('admin/referrals')
@UseGuards(AuthGuard, RolesGuard)
@RequireRoles(...BRAND)
export class AdminReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('settings')
  settings(): Promise<ReferralSettings> {
    return this.referrals.config();
  }

  @Put('settings')
  save(@Body(new ZodValidationPipe(ReferralSettingsSchema)) body: ReferralSettings, @Req() req: RoledRequest): Promise<ReferralSettings> {
    const auth = req.auth;
    if (!auth) throw new Error('AuthGuard requerido');
    const actor: Actor = { userId: auth.user.id, alias: auth.user.alias, roles: req.roles ?? [], requestId: String(req.id) };
    return this.referrals.save(actor, body);
  }

  @Get('summary')
  summary(
    @Query(
      'days',
      new ZodValidationPipe(
        z.coerce
          .number()
          .int()
          .refine((n) => (DASHBOARD_DAYS as readonly number[]).includes(n))
          .default(30),
      ),
    )
    days: number,
  ): Promise<ReferralSummary> {
    return this.referrals.summary(days);
  }
}
