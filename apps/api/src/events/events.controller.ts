import {
  CastVoteSchema,
  type ContestAdminView,
  type ContestScreen,
  type ContestView,
  type CreateContest,
  CreateContestSchema,
  type CreateEvent,
  CreateEventSchema,
  DeliverPrizeSchema,
  type EventAdminView,
  type ModerateEntry,
  ModerateEntrySchema,
  type PublicEvent,
  type Role,
  type UpsertEntry,
  UpsertEntrySchema,
} from '@ilc/contracts';
import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { ZodValidationPipe } from '../common/zod-validation.pipe.ts';
import { Auth, type AuthContext, AuthGuard } from '../identity/auth.guard.ts';
import { RequireRoles, type RoledRequest, RolesGuard } from '../identity/roles.guard.ts';
import { EventsService } from './events.service.ts';

const BRAND: Role[] = ['ADMIN_MARCA', 'SUPERADMIN'];

function actorOf(req: RoledRequest): Actor {
  const auth = req.auth;
  if (!auth) throw new Error('AuthGuard requerido');
  return { userId: auth.user.id, alias: auth.user.alias, roles: req.roles ?? [], requestId: String(req.id) };
}

/** Imagen de una inscripción: solo JPEG (el servidor ya le quitó los metadatos), poca caché y nunca interpretada como otra cosa. */
function sendPhoto(reply: FastifyReply, photo: { data: Buffer; sha256: string }, cache: string): Buffer {
  reply.header('Content-Type', 'image/jpeg');
  reply.header('ETag', `"${photo.sha256}"`);
  reply.header('Cache-Control', cache);
  reply.header('Content-Disposition', 'inline');
  return photo.data;
}

/** Eventos y concursos para las personas (requiere control de edad y sesión). */
@ApiTags('Eventos')
@ApiCookieAuth()
@Controller()
@UseGuards(AuthGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get('events')
  @Header('Cache-Control', 'no-store')
  list(): Promise<PublicEvent[]> {
    return this.events.listPublic();
  }

  @Get('events/:slug')
  @Header('Cache-Control', 'no-store')
  one(@Param('slug') slug: string): Promise<PublicEvent> {
    return this.events.publicEvent(slug);
  }

  @Get('contests/:id')
  @Header('Cache-Control', 'no-store')
  contest(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext): Promise<ContestView> {
    return this.events.contestFor(auth.user, id);
  }

  @Post('contests/:id/entries')
  @HttpCode(200)
  entry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpsertEntrySchema)) body: UpsertEntry,
    @Auth() auth: AuthContext,
  ): Promise<ContestView> {
    return this.events.upsertEntry(auth.user, id, body);
  }

  /** Cuerpo: la imagen JPEG tal cual (Content-Type: image/jpeg), hasta 2 MB. */
  @Put('contests/:id/entries/me/photo')
  photo(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Auth() auth: AuthContext): Promise<ContestView> {
    return this.events.putPhoto(auth.user, id, body);
  }

  @Delete('contests/:id/entries/me')
  @HttpCode(204)
  async withdraw(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext): Promise<void> {
    await this.events.withdraw(auth.user, id);
  }

  @Get('contests/:id/entries/:entryId/photo')
  async photoOf(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Auth() auth: AuthContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Buffer> {
    return sendPhoto(reply, await this.events.photoFor(auth.user, id, entryId), 'private, max-age=300');
  }

  @Post('contests/:id/votes')
  @HttpCode(200)
  vote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CastVoteSchema)) body: { entryId: string },
    @Auth() auth: AuthContext,
  ): Promise<ContestView> {
    return this.events.vote(auth.user, id, body.entryId);
  }
}

/** Consola: eventos, concursos, moderación, resultados y entrega del premio. */
@ApiTags('Eventos (consola)')
@ApiCookieAuth()
@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
export class AdminEventsController {
  constructor(private readonly events: EventsService) {}

  @Get('events')
  @RequireRoles(...BRAND)
  @Header('Cache-Control', 'no-store')
  list(): Promise<EventAdminView[]> {
    return this.events.listAdmin();
  }

  @Post('events')
  @RequireRoles(...BRAND)
  create(@Body(new ZodValidationPipe(CreateEventSchema)) body: CreateEvent, @Req() req: RoledRequest): Promise<EventAdminView> {
    return this.events.createEvent(actorOf(req), body);
  }

  @Post('events/:id/publish')
  @HttpCode(200)
  @RequireRoles(...BRAND)
  publish(@Param('id', ParseUUIDPipe) id: string, @Req() req: RoledRequest): Promise<EventAdminView> {
    return this.events.setEventStatus(actorOf(req), id, 'PUBLICADO');
  }

  @Post('events/:id/close')
  @HttpCode(200)
  @RequireRoles(...BRAND)
  closeEvent(@Param('id', ParseUUIDPipe) id: string, @Req() req: RoledRequest): Promise<EventAdminView> {
    return this.events.setEventStatus(actorOf(req), id, 'CERRADO');
  }

  @Post('events/:id/contests')
  @RequireRoles(...BRAND)
  createContest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateContestSchema)) body: CreateContest,
    @Req() req: RoledRequest,
  ): Promise<ContestAdminView> {
    return this.events.createContest(actorOf(req), id, body);
  }

  @Get('contests/:id')
  @RequireRoles(...BRAND)
  @Header('Cache-Control', 'no-store')
  contest(@Param('id', ParseUUIDPipe) id: string): Promise<ContestAdminView> {
    return this.events.adminContest(id);
  }

  @Post('contests/:id/open')
  @HttpCode(200)
  @RequireRoles(...BRAND)
  open(@Param('id', ParseUUIDPipe) id: string, @Req() req: RoledRequest): Promise<ContestAdminView> {
    return this.events.openContest(actorOf(req), id);
  }

  @Post('contests/:id/entries/:entryId/moderate')
  @HttpCode(200)
  @RequireRoles(...BRAND)
  moderate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body(new ZodValidationPipe(ModerateEntrySchema)) body: ModerateEntry,
    @Req() req: RoledRequest,
  ): Promise<ContestAdminView> {
    return this.events.moderate(actorOf(req), id, entryId, body);
  }

  @Get('contests/:id/entries/:entryId/photo')
  @RequireRoles(...BRAND)
  async photo(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Buffer> {
    return sendPhoto(reply, await this.events.adminPhoto(id, entryId), 'private, no-store');
  }

  @Post('contests/:id/screen/rotate')
  @HttpCode(200)
  @RequireRoles(...BRAND)
  rotate(@Param('id', ParseUUIDPipe) id: string, @Req() req: RoledRequest): Promise<ContestAdminView> {
    return this.events.rotateScreen(actorOf(req), id);
  }

  @Post('contests/:id/close')
  @HttpCode(200)
  @RequireRoles(...BRAND)
  close(@Param('id', ParseUUIDPipe) id: string, @Req() req: RoledRequest): Promise<ContestAdminView> {
    return this.events.closeContest(actorOf(req), id);
  }

  @Post('contests/:id/prize/deliver')
  @HttpCode(200)
  @RequireRoles(...BRAND)
  deliver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DeliverPrizeSchema)) body: { code: string },
    @Req() req: RoledRequest,
  ): Promise<ContestAdminView> {
    return this.events.deliverPrize(actorOf(req), id, body.code);
  }
}

/**
 * Pantalla pública del concurso (se proyecta en el evento): NO usa sesión; el acceso es la URL secreta (token) del concurso, que la
 * consola puede rotar. Solo entrega alias, título, foto aprobada y conteos. Con límite de ritmo por IP como el resto de la API.
 */
@ApiTags('Pantalla de concurso')
@Controller('screens')
export class ScreensController {
  constructor(private readonly events: EventsService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  state(@Param('token') token: string): Promise<ContestScreen> {
    return this.events.screen(token);
  }

  @Get(':token/photos/:entryId')
  async photo(
    @Param('token') token: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Buffer> {
    return sendPhoto(reply, await this.events.screenPhoto(token, entryId), 'private, max-age=300');
  }
}
