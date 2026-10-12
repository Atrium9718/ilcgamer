import {
  type AdjustStock,
  AdjustStockSchema,
  type AdminRewardClaim,
  CancelClaimSchema,
  type ClaimReward,
  ClaimRewardSchema,
  type CreateReward,
  CreateRewardSchema,
  DeactivateRewardSchema,
  DeliverClaimSchema,
  type MyRewardClaim,
  type RewardAdminView,
  type RewardCatalog,
  type RewardClaimResult,
  type Role,
} from '@ilc/contracts';
import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { idempotencyKeyOf, RequiresIdempotencyKey } from '../common/idempotency.ts';
import { ZodValidationPipe } from '../common/zod-validation.pipe.ts';
import { Auth, type AuthContext, AuthGuard } from '../identity/auth.guard.ts';
import { CONSOLE_ROLES, RequireRoles, type RoledRequest, RolesGuard } from '../identity/roles.guard.ts';
import { RewardsService } from './rewards.service.ts';

@ApiTags('Recompensas')
@ApiCookieAuth()
@Controller('rewards')
@UseGuards(AuthGuard)
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  catalog(@Auth() auth: AuthContext): Promise<RewardCatalog> {
    return this.rewards.catalog(auth.user);
  }

  @Get('claims')
  @Header('Cache-Control', 'no-store')
  mine(@Auth() auth: AuthContext): Promise<MyRewardClaim[]> {
    return this.rewards.mine(auth.user.id);
  }

  /** POST /api/v1/rewards/{id}/claim (Guía Técnica §7): stock y puntos comprobados de forma consistente. */
  @Post(':id/claim')
  @HttpCode(200)
  @RequiresIdempotencyKey()
  claim(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ClaimRewardSchema)) body: ClaimReward,
    @Auth() auth: AuthContext,
    @Req() req: FastifyRequest,
  ): Promise<RewardClaimResult> {
    return this.rewards.claim(auth.user, id, body, idempotencyKeyOf(req), String(req.id));
  }
}

const BRAND: Role[] = ['ADMIN_MARCA', 'SUPERADMIN'];

function actorOf(req: RoledRequest): Actor {
  const auth = req.auth;
  if (!auth) throw new Error('AuthGuard requerido');
  return { userId: auth.user.id, alias: auth.user.alias, roles: req.roles ?? [], requestId: String(req.id) };
}

@ApiTags('Consola · Recompensas')
@ApiCookieAuth()
@Controller('admin/rewards')
@UseGuards(AuthGuard, RolesGuard)
export class AdminRewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get()
  @RequireRoles(...CONSOLE_ROLES)
  list(): Promise<RewardAdminView[]> {
    return this.rewards.list();
  }

  @Post()
  @RequireRoles(...BRAND)
  create(@Body(new ZodValidationPipe(CreateRewardSchema)) body: CreateReward, @Req() req: RoledRequest): Promise<RewardAdminView> {
    return this.rewards.create(actorOf(req), body);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @RequireRoles(...BRAND)
  activate(@Param('id', ParseUUIDPipe) id: string, @Req() req: RoledRequest): Promise<RewardAdminView> {
    return this.rewards.setActive(actorOf(req), id, true);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequireRoles(...BRAND)
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DeactivateRewardSchema)) body: { reason: string },
    @Req() req: RoledRequest,
  ): Promise<RewardAdminView> {
    return this.rewards.setActive(actorOf(req), id, false, body.reason);
  }

  @Post(':id/stock')
  @HttpCode(200)
  @RequireRoles(...BRAND)
  stock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdjustStockSchema)) body: AdjustStock,
    @Req() req: RoledRequest,
  ): Promise<RewardAdminView> {
    return this.rewards.adjustStock(actorOf(req), id, body);
  }

  @Get('claims')
  @RequireRoles(...BRAND)
  claims(
    @Query('status', new ZodValidationPipe(z.enum(['RESERVADO', 'RECLAMADO', 'ENTREGADO', 'EXPIRADO', 'ANULADO']).optional())) status?: string,
    @Query('code', new ZodValidationPipe(z.string().trim().max(12).optional())) code?: string,
  ): Promise<AdminRewardClaim[]> {
    return this.rewards.claims({ status, code });
  }

  /** Entrega: Marca y TI en general; Staff y Dealer, solo de su ciudad (lo valida el servicio). */
  @Post('claims/deliver')
  @HttpCode(200)
  @RequireRoles(...BRAND, 'STAFF', 'DEALER')
  deliver(@Body(new ZodValidationPipe(DeliverClaimSchema)) body: { code: string }, @Req() req: RoledRequest): Promise<AdminRewardClaim> {
    return this.rewards.deliver(actorOf(req), body.code);
  }

  @Post('claims/:id/cancel')
  @HttpCode(200)
  @RequireRoles(...BRAND)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CancelClaimSchema)) body: { reason: string },
    @Req() req: RoledRequest,
  ): Promise<AdminRewardClaim> {
    return this.rewards.cancel(actorOf(req), id, body.reason);
  }
}
