import {
  type BatchView,
  type ClaimRequest,
  ClaimRequestSchema,
  type ClaimResult,
  type CreateProduct,
  CreateProductSchema,
  type GenerateCodes,
  GenerateCodesSchema,
  type ImportPreview,
  IntegrationValidateRequestSchema,
  type IntegrationValidateResponse,
  LinkBatchSchema,
  type ProductCodeLookup,
  type ProductView,
  RevokeBatchSchema,
  type Role,
  type UrlTemplate,
  UrlTemplateSchema,
} from '@ilc/contracts';
import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { idempotencyKeyOf, RequiresIdempotencyKey } from '../common/idempotency.ts';
import { ZodValidationPipe } from '../common/zod-validation.pipe.ts';
import { Auth, type AuthContext, AuthGuard, OptionalAuthGuard } from '../identity/auth.guard.ts';
import { RequireRoles, type RoledRequest, RolesGuard } from '../identity/roles.guard.ts';
import { ClaimsService } from './claims.service.ts';
import { ImportsService } from './imports.service.ts';
import { IntegrationKeyGuard } from './integration.guard.ts';
import { ProductCodesService } from './product-codes.service.ts';
import { SmartTagsAdminService } from './smarttags-admin.service.ts';

/** Límite por IP de consultas y reclamaciones (protección contra enumeración y fuerza bruta — §5.6, §9.1). */
const CODES = { rateLimit: { max: () => Number(process.env.CODE_RATE_LIMIT_PER_MINUTE ?? 30), timeWindow: '1 minute' } };

@ApiTags('Códigos')
@Controller()
export class CodesController {
  constructor(
    private readonly products: ProductCodesService,
    private readonly claims: ClaimsService,
  ) {}

  /** GET /api/v1/product-codes/{token}/status (Guía Técnica §7). Consultar no consume ningún beneficio. */
  @Get('product-codes/:token/status')
  @RouteConfig(CODES)
  @UseGuards(OptionalAuthGuard)
  @Header('Cache-Control', 'no-store')
  status(@Param('token') token: string, @Auth() auth: AuthContext | null, @Req() req: FastifyRequest): Promise<ProductCodeLookup> {
    return this.products.lookup(token, auth, req.ip);
  }

  /** POST /api/v1/campaign-codes/{token}/claim (Guía Técnica §7): atómico, idempotente, elegibilidad en servidor. */
  @Post('campaign-codes/:token/claim')
  @HttpCode(200)
  @RouteConfig(CODES)
  @RequiresIdempotencyKey()
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  claim(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(ClaimRequestSchema)) body: ClaimRequest,
    @Auth() auth: AuthContext,
    @Req() req: FastifyRequest,
  ): Promise<ClaimResult> {
    return this.claims.claim(token, auth, idempotencyKeyOf(req), String(req.id), body.sessionId, undefined, body.staffCode);
  }

  /** POST /api/v1/smarttags/validate (Instrucciones §10): validación síncrona para el ERP. Nunca reclama. */
  @Post('smarttags/validate')
  @HttpCode(200)
  @UseGuards(IntegrationKeyGuard)
  @ApiBearerAuth()
  validate(@Body(new ZodValidationPipe(IntegrationValidateRequestSchema)) body: { token: string }): Promise<IntegrationValidateResponse> {
    return this.products.validateForIntegration(body.token);
  }
}

/** Instrucciones §3.6: generación, importación, revocación y plantilla de URL son del SuperAdmin (TI). */
const MASTER: Role[] = ['SUPERADMIN'];
/** Catálogo de productos, lotes y vínculo con campañas: Admin de Marca. */
const BRAND_ADMIN: Role[] = ['ADMIN_MARCA'];

function actorOf(req: RoledRequest): Actor {
  const auth = req.auth;
  if (!auth) throw new Error('AuthGuard requerido');
  return { userId: auth.user.id, alias: auth.user.alias, roles: req.roles ?? [], requestId: String(req.id) };
}

function sendCsv(reply: FastifyReply, file: { fileName: string; csv: string }): string {
  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', `attachment; filename="${file.fileName}"`);
  reply.header('Cache-Control', 'no-store');
  return file.csv;
}

const FileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[^/\\]+$/, 'Nombre de archivo no válido');

@ApiTags('Consola · Smart Tags')
@ApiCookieAuth()
@Controller('admin/smarttags')
@UseGuards(AuthGuard, RolesGuard)
export class AdminSmartTagsController {
  constructor(
    private readonly admin: SmartTagsAdminService,
    private readonly imports: ImportsService,
  ) {}

  @Get('products')
  @RequireRoles(...BRAND_ADMIN)
  products(): Promise<ProductView[]> {
    return this.admin.listProducts();
  }

  @Post('products')
  @RequireRoles(...BRAND_ADMIN)
  createProduct(@Body(new ZodValidationPipe(CreateProductSchema)) body: CreateProduct, @Req() req: RoledRequest): Promise<ProductView> {
    return this.admin.createProduct(actorOf(req), body);
  }

  @Get('batches')
  @RequireRoles(...BRAND_ADMIN)
  batches(): Promise<BatchView[]> {
    return this.admin.listBatches();
  }

  @Post('batches/:id/link')
  @HttpCode(200)
  @RequireRoles(...BRAND_ADMIN)
  link(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(LinkBatchSchema)) body: { campaignSlug: string }, @Req() req: RoledRequest) {
    return this.admin.linkBatch(actorOf(req), id, body.campaignSlug);
  }

  @Post('batches/:id/distribute')
  @HttpCode(200)
  @RequireRoles(...BRAND_ADMIN)
  distribute(@Param('id', ParseUUIDPipe) id: string, @Req() req: RoledRequest) {
    return this.admin.distributeBatch(actorOf(req), id);
  }

  @Post('batches/:id/revoke')
  @HttpCode(200)
  @RequireRoles(...MASTER)
  revoke(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(RevokeBatchSchema)) body: { reason: string }, @Req() req: RoledRequest) {
    return this.admin.revokeBatch(actorOf(req), id, body.reason);
  }

  @Get('batches/:id/export')
  @RequireRoles(...BRAND_ADMIN)
  async exportBatch(@Param('id', ParseUUIDPipe) id: string, @Req() req: RoledRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<string> {
    return sendCsv(reply, await this.admin.exportBatch(actorOf(req), id));
  }

  /** Devuelve el CSV con los tokens en claro: es la única vez que salen de la plataforma. */
  @Post('generate')
  @HttpCode(200)
  @RequireRoles(...MASTER)
  async generate(
    @Body(new ZodValidationPipe(GenerateCodesSchema)) body: GenerateCodes,
    @Req() req: RoledRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<string> {
    return sendCsv(reply, await this.admin.generate(actorOf(req), body));
  }

  /** Cuerpo: el archivo CSV/XLSX tal cual (application/octet-stream); nombre en ?fileName=. */
  @Post('imports')
  @RequireRoles(...MASTER)
  preview(@Query('fileName', new ZodValidationPipe(FileNameSchema)) fileName: string, @Req() req: RoledRequest): Promise<ImportPreview> {
    return this.imports.preview(actorOf(req), fileName, req.body as Buffer);
  }

  @Get('imports/:id')
  @RequireRoles(...MASTER)
  getImport(@Param('id', ParseUUIDPipe) id: string): Promise<ImportPreview> {
    return this.imports.get(id);
  }

  @Post('imports/:id/confirm')
  @HttpCode(200)
  @RequireRoles(...MASTER)
  confirm(@Param('id', ParseUUIDPipe) id: string, @Req() req: RoledRequest): Promise<ImportPreview> {
    return this.imports.confirm(actorOf(req), id);
  }

  @Post('imports/:id/discard')
  @HttpCode(200)
  @RequireRoles(...MASTER)
  discard(@Param('id', ParseUUIDPipe) id: string, @Req() req: RoledRequest): Promise<ImportPreview> {
    return this.imports.discard(actorOf(req), id);
  }

  @Get('imports/:id/issues')
  @RequireRoles(...MASTER)
  async issues(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) reply: FastifyReply): Promise<string> {
    return sendCsv(reply, await this.imports.issuesCsv(id));
  }

  @Get('settings')
  @RequireRoles(...BRAND_ADMIN, ...MASTER)
  settings(): Promise<UrlTemplate> {
    return this.admin.urlTemplate();
  }

  @Put('settings')
  @RequireRoles(...MASTER)
  setSettings(@Body(new ZodValidationPipe(UrlTemplateSchema)) body: UrlTemplate, @Req() req: RoledRequest): Promise<UrlTemplate> {
    return this.admin.setUrlTemplate(actorOf(req), body.urlTemplate);
  }
}
