import {
  type DefaultModules,
  DefaultModulesSchema,
  type GameCatalog,
  type MissionResult,
  type MissionStart,
  ModuleApprovalSchema,
  type ModuleView,
  type ProviderCallback,
  ProviderCallbackSchema,
  RegisterModuleSchema,
  type Role,
  type StartMission,
  StartMissionSchema,
  type SubmitMission,
  SubmitMissionSchema,
} from '@ilc/contracts';
import { Body, Controller, Get, Header, Headers, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { idempotencyKeyOf, RequiresIdempotencyKey } from '../common/idempotency.ts';
import { ZodValidationPipe } from '../common/zod-validation.pipe.ts';
import { Auth, type AuthContext, AuthGuard } from '../identity/auth.guard.ts';
import { CONSOLE_ROLES, RequireRoles, type RoledRequest, RolesGuard } from '../identity/roles.guard.ts';
import { CatalogService } from './catalog.service.ts';
import { MissionsService } from './missions.service.ts';
import { ModulesService } from './modules.service.ts';

/** Misiones: quien juega no puede inundar al servidor con intentos (el tope diario es por módulo). */
const PLAY = { rateLimit: { max: () => Number(process.env.GAME_RATE_LIMIT_PER_MINUTE ?? 60), timeWindow: '1 minute' } };

@ApiTags('Juegos')
@Controller()
export class GamesController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly missions: MissionsService,
  ) {}

  /** Juegos disponibles para esta persona en su contexto (Parche, campaña o plataforma). */
  @Get('games')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @Header('Cache-Control', 'no-store')
  games(
    @Auth() auth: AuthContext,
    @Query('campaignSlug', new ZodValidationPipe(z.string().max(80).optional())) campaignSlug?: string,
    @Query('sessionId', new ZodValidationPipe(z.uuid().optional())) sessionId?: string,
  ): Promise<GameCatalog> {
    return this.catalog.catalog(auth.user, { campaignSlug, sessionId });
  }

  @Post('games/start')
  @HttpCode(200)
  @RouteConfig(PLAY)
  @RequiresIdempotencyKey()
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  start(@Body(new ZodValidationPipe(StartMissionSchema)) body: StartMission, @Auth() auth: AuthContext, @Req() req: FastifyRequest): Promise<MissionStart> {
    return this.missions.start(auth.user, body, idempotencyKeyOf(req));
  }

  @Post('missions/:id/submit')
  @HttpCode(200)
  @RouteConfig(PLAY)
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SubmitMissionSchema)) body: SubmitMission,
    @Auth() auth: AuthContext,
    @Req() req: FastifyRequest,
  ): Promise<MissionResult> {
    return this.missions.submit(auth.user, id, body, String(req.id));
  }

  @Get('missions/:id')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @Header('Cache-Control', 'no-store')
  mission(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext): Promise<MissionResult> {
    return this.missions.get(auth.user, id);
  }

  /**
   * Confirmación del proveedor de un módulo iframe (backend a backend — Guía Técnica §5.4). No usa cookie: se
   * autentica con la firma `X-Provider-Signature: sha256=<HMAC del JSON canónico>`.
   */
  @Post('games/provider-callback')
  @HttpCode(200)
  providerCallback(
    @Body(new ZodValidationPipe(ProviderCallbackSchema)) body: ProviderCallback,
    @Headers('x-provider-signature') signature: string | undefined,
    @Req() req: FastifyRequest,
  ): Promise<{ status: string }> {
    return this.missions.providerCallback(body, signature, String(req.id));
  }
}

const MASTER: Role[] = ['SUPERADMIN'];
const BRAND: Role[] = ['ADMIN_MARCA'];
const APPROVERS: Role[] = ['REVISOR_MARCA', 'REVISOR_JURIDICO', 'RESPONSABLE_PRIVACIDAD'];

function actorOf(req: RoledRequest): Actor {
  const auth = req.auth;
  if (!auth) throw new Error('AuthGuard requerido');
  return { userId: auth.user.id, alias: auth.user.alias, roles: req.roles ?? [], requestId: String(req.id) };
}

const Version = new ZodValidationPipe(z.string().regex(/^\d+\.\d+\.\d+$/));
const Slug = new ZodValidationPipe(
  z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(60),
);

@ApiTags('Consola · Juegos')
@ApiCookieAuth()
@Controller('admin/games')
@UseGuards(AuthGuard, RolesGuard)
export class AdminGamesController {
  constructor(private readonly modules: ModulesService) {}

  @Get('modules')
  @RequireRoles(...CONSOLE_ROLES)
  list(): Promise<ModuleView[]> {
    return this.modules.list();
  }

  /** Registra una versión de un módulo con su manifiesto. Solo TI. */
  @Post('modules')
  @RequireRoles(...MASTER)
  register(@Body(new ZodValidationPipe(RegisterModuleSchema)) body: { manifest: unknown }, @Req() req: RoledRequest): Promise<ModuleView> {
    return this.modules.register(actorOf(req), body.manifest);
  }

  @Post('modules/:slug/versions/:version/test')
  @HttpCode(200)
  @RequireRoles(...BRAND, ...MASTER)
  test(@Param('slug', Slug) slug: string, @Param('version', Version) version: string, @Req() req: RoledRequest): Promise<ModuleView> {
    return this.modules.toTest(actorOf(req), slug, version);
  }

  @Post('modules/:slug/versions/:version/approvals')
  @HttpCode(200)
  @RequireRoles(...APPROVERS)
  decide(
    @Param('slug', Slug) slug: string,
    @Param('version', Version) version: string,
    @Body(new ZodValidationPipe(ModuleApprovalSchema)) body: {
      kind: 'MARCA' | 'JURIDICA' | 'PRIVACIDAD' | 'TI';
      decision: 'APROBADO' | 'RECHAZADO';
      note?: string;
    },
    @Req() req: RoledRequest,
  ): Promise<ModuleView> {
    return this.modules.decide(actorOf(req), slug, version, body);
  }

  /** Activa una versión aprobada o vuelve a una anterior. */
  @Post('modules/:slug/versions/:version/activate')
  @HttpCode(200)
  @RequireRoles(...BRAND)
  activate(@Param('slug', Slug) slug: string, @Param('version', Version) version: string, @Req() req: RoledRequest): Promise<ModuleView> {
    return this.modules.activate(actorOf(req), slug, version);
  }

  @Post('modules/:slug/deactivate')
  @HttpCode(200)
  @RequireRoles(...BRAND)
  deactivate(
    @Param('slug', Slug) slug: string,
    @Body(new ZodValidationPipe(z.object({ reason: z.string().trim().min(5).max(500) }))) body: { reason: string },
    @Req() req: RoledRequest,
  ): Promise<ModuleView> {
    return this.modules.deactivate(actorOf(req), slug, body.reason);
  }

  @Get('defaults')
  @RequireRoles(...BRAND)
  defaults(): Promise<DefaultModules> {
    return this.modules.defaults();
  }

  @Put('defaults')
  @RequireRoles(...BRAND)
  setDefaults(@Body(new ZodValidationPipe(DefaultModulesSchema)) body: DefaultModules, @Req() req: RoledRequest): Promise<DefaultModules> {
    return this.modules.setDefaults(actorOf(req), body.modules);
  }

  @Post('modules/:slug/provider-secret')
  @HttpCode(200)
  @RequireRoles(...MASTER)
  secret(@Param('slug', Slug) slug: string, @Req() req: RoledRequest) {
    return this.modules.providerSecret(actorOf(req), slug, false);
  }

  @Post('modules/:slug/provider-secret/rotate')
  @HttpCode(200)
  @RequireRoles(...MASTER)
  rotate(@Param('slug', Slug) slug: string, @Req() req: RoledRequest) {
    return this.modules.providerSecret(actorOf(req), slug, true);
  }

  @Get('guide')
  @RequireRoles(...CONSOLE_ROLES)
  guide(): Promise<{ markdown: string }> {
    return this.modules.guide();
  }
}
