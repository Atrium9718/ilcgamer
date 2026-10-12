import {
  type AdminAccount,
  type BadgeAdmin,
  BadgeAdminSchema,
  type BadgeAdminView,
  type Progress,
  type Reconciliation,
  ReverseEntrySchema,
  type Role,
  type Wallet,
} from '@ilc/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { DomainError } from '../common/domain-error.ts';
import { ZodValidationPipe } from '../common/zod-validation.pipe.ts';
import { Auth, type AuthContext, AuthGuard } from '../identity/auth.guard.ts';
import { RequireRoles, type RoledRequest, RolesGuard } from '../identity/roles.guard.ts';
import { LedgerService } from './ledger.service.ts';
import { ProgressService } from './progress.service.ts';

@ApiTags('Economía')
@ApiCookieAuth()
@Controller()
@UseGuards(AuthGuard)
export class EconomyController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly progressService: ProgressService,
  ) {}

  /** GET /api/v1/wallet (Guía Técnica §7): saldo y movimientos del titular, paginados. */
  @Get('wallet')
  wallet(@Auth() auth: AuthContext, @Query('cursor', new ZodValidationPipe(z.uuid().optional())) cursor?: string): Promise<Wallet> {
    return this.ledger.wallet(auth.user.id, cursor);
  }

  /** GET /api/v1/profile/progress (Guía Técnica §7): XP, nivel e insignias del titular. */
  @Get('profile/progress')
  progress(@Auth() auth: AuthContext): Promise<Progress> {
    return this.progressService.progress(auth.user.id);
  }
}

/** Ajustes de saldo: Admin de Marca y SuperAdmin, siempre con motivo y auditoría (§9.1). */
const LEDGER_ADMINS: Role[] = ['ADMIN_MARCA'];

function actorOf(req: RoledRequest): Actor {
  const auth = req.auth;
  if (!auth) throw new Error('AuthGuard requerido');
  return { userId: auth.user.id, alias: auth.user.alias, roles: req.roles ?? [], requestId: String(req.id) };
}

@ApiTags('Consola · Economía')
@ApiCookieAuth()
@Controller('admin/economy')
@UseGuards(AuthGuard, RolesGuard)
export class AdminEconomyController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly progressService: ProgressService,
  ) {}

  /** Busca una cuenta por id de reclamación (aparece en la exportación de auditoría) o por id de persona. */
  @Get('accounts')
  @RequireRoles(...LEDGER_ADMINS)
  account(
    @Query('claimId', new ZodValidationPipe(z.uuid().optional())) claimId?: string,
    @Query('userId', new ZodValidationPipe(z.uuid().optional())) userId?: string,
  ): Promise<AdminAccount> {
    if (claimId) return this.ledger.account({ claimId });
    if (userId) return this.ledger.account({ userId });
    throw new DomainError('VALIDATION_FAILED', 'Indica un id de reclamación o de persona.');
  }

  @Post('entries/:id/reverse')
  @HttpCode(200)
  @RequireRoles(...LEDGER_ADMINS)
  reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReverseEntrySchema)) body: { reason: string },
    @Req() req: RoledRequest,
  ): Promise<AdminAccount> {
    return this.ledger.reverse(actorOf(req), id, body.reason);
  }

  @Get('reconciliation')
  @RequireRoles(...LEDGER_ADMINS)
  reconcile(): Promise<Reconciliation> {
    return this.ledger.reconcile();
  }

  @Get('badges')
  @RequireRoles(...LEDGER_ADMINS)
  badges(): Promise<BadgeAdminView[]> {
    return this.progressService.listBadges();
  }

  @Post('badges')
  @RequireRoles(...LEDGER_ADMINS)
  createBadge(@Body(new ZodValidationPipe(BadgeAdminSchema)) body: BadgeAdmin, @Req() req: RoledRequest): Promise<BadgeAdminView> {
    return this.progressService.createBadge(actorOf(req), body);
  }
}
