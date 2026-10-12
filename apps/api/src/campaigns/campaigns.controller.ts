import {
  type ApprovalDecisionInput,
  ApprovalDecisionSchema,
  CAMPAIGN_STATUSES,
  CampaignActionSchema,
  type CampaignDraft,
  CampaignDraftSchema,
  type CampaignSummary,
  type CampaignView,
  type CreateCampaign,
  CreateCampaignSchema,
  type PublicCampaign,
  PublishSchema,
  type Role,
} from '@ilc/contracts';
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.ts';
import type { CampaignStatus } from '../generated/prisma/enums.ts';
import { AuthGuard } from '../identity/auth.guard.ts';
import { CONSOLE_ROLES, RequireRoles, type RoledRequest, RolesGuard } from '../identity/roles.guard.ts';
import { type Actor, CampaignsService } from './campaigns.service.ts';

const EDITORS: Role[] = ['ADMIN_MARCA', 'EDITOR_CONTENIDO'];
const APPROVERS: Role[] = ['REVISOR_MARCA', 'REVISOR_JURIDICO', 'RESPONSABLE_PRIVACIDAD'];
/** Publicar y operar el ciclo de vida: Admin de Marca (el editor de contenido no publica — Guía Técnica §3.3). */
const PUBLISHERS: Role[] = ['ADMIN_MARCA'];

function actorOf(req: RoledRequest): Actor {
  const auth = req.auth;
  if (!auth) throw new Error('AuthGuard requerido');
  return { userId: auth.user.id, alias: auth.user.alias, roles: req.roles ?? [], requestId: String(req.id) };
}

@ApiTags('Consola · Campañas')
@ApiCookieAuth()
@Controller('admin/campaigns')
@UseGuards(AuthGuard, RolesGuard)
export class AdminCampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @RequireRoles(...CONSOLE_ROLES)
  list(@Query('estado', new ZodValidationPipe(z.enum(CAMPAIGN_STATUSES).optional())) status?: CampaignStatus): Promise<CampaignSummary[]> {
    return this.campaigns.list(status);
  }

  @Post()
  @RequireRoles(...EDITORS)
  create(@Body(new ZodValidationPipe(CreateCampaignSchema)) body: CreateCampaign, @Req() req: RoledRequest): Promise<CampaignView> {
    return this.campaigns.create(actorOf(req), body);
  }

  @Get(':slug')
  @RequireRoles(...CONSOLE_ROLES)
  get(@Param('slug') slug: string): Promise<CampaignView> {
    return this.campaigns.get(slug);
  }

  @Put(':slug/draft')
  @RequireRoles(...EDITORS)
  updateDraft(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(CampaignDraftSchema)) body: CampaignDraft,
    @Req() req: RoledRequest,
  ): Promise<CampaignView> {
    return this.campaigns.updateDraft(actorOf(req), slug, body);
  }

  @Post(':slug/versions')
  @RequireRoles(...EDITORS)
  newVersion(@Param('slug') slug: string, @Req() req: RoledRequest): Promise<CampaignView> {
    return this.campaigns.newVersion(actorOf(req), slug);
  }

  @Post(':slug/submit')
  @HttpCode(200)
  @RequireRoles(...EDITORS)
  submit(@Param('slug') slug: string, @Req() req: RoledRequest): Promise<CampaignView> {
    return this.campaigns.submit(actorOf(req), slug);
  }

  @Post(':slug/approvals')
  @HttpCode(200)
  @RequireRoles(...APPROVERS)
  decide(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(ApprovalDecisionSchema)) body: ApprovalDecisionInput,
    @Req() req: RoledRequest,
  ): Promise<CampaignView> {
    return this.campaigns.decide(actorOf(req), slug, body);
  }

  /** POST /api/v1/admin/campaigns/{slug}/publish (Guía Técnica §7). */
  @Post(':slug/publish')
  @HttpCode(200)
  @RequireRoles(...PUBLISHERS)
  publish(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(PublishSchema)) body: { checklist: Record<string, true> },
    @Req() req: RoledRequest,
  ): Promise<CampaignView> {
    return this.campaigns.publish(actorOf(req), slug, body.checklist);
  }

  @Post(':slug/:action')
  @HttpCode(200)
  @RequireRoles(...PUBLISHERS)
  transition(
    @Param('slug') slug: string,
    @Param('action', new ZodValidationPipe(CampaignActionSchema.exclude(['submit']))) action: 'pause' | 'resume' | 'close' | 'archive',
    @Req() req: RoledRequest,
  ): Promise<CampaignView> {
    return this.campaigns.transition(actorOf(req), slug, action);
  }
}

@ApiTags('Campañas')
@Controller('campaigns')
export class PublicCampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  /** Datos públicos y tema de una campaña activa (para la PWA). Sin reglas internas ni responsables. */
  @Get(':slug')
  publicView(@Param('slug') slug: string): Promise<PublicCampaign> {
    return this.campaigns.publicView(slug);
  }
}
