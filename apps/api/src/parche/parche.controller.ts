import { type CreateParche, CreateParcheSchema, JoinByInviteSchema, JoinByPinSchema, type ParcheState } from '@ilc/contracts';
import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import { ApiCookieAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../common/domain-error.ts';
import { ZodValidationPipe } from '../common/zod-validation.pipe.ts';
import { Auth, type AuthContext, AuthGuard } from '../identity/auth.guard.ts';
import { ParcheService } from './parche.service.ts';
import { ParcheBus } from './parche-bus.ts';

/** Unirse con PIN es una superficie de fuerza bruta: límite propio por IP además del de intentos (§5.5, §9.1). */
const STRICT = { rateLimit: { max: () => Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE ?? 10), timeWindow: '1 minute' } };
const HEARTBEAT_MS = 25_000;

@ApiTags('El Parche')
@ApiCookieAuth()
@Controller('sessions')
@UseGuards(AuthGuard)
export class ParcheController {
  constructor(
    private readonly parche: ParcheService,
    private readonly bus: ParcheBus,
  ) {}

  /** POST /api/v1/sessions (Guía Técnica §7): crear El Parche. */
  @Post()
  create(@Body(new ZodValidationPipe(CreateParcheSchema)) body: CreateParche, @Auth() auth: AuthContext, @Req() req: FastifyRequest): Promise<ParcheState> {
    return this.parche.create(auth.user, body, String(req.id));
  }

  /** Unirse con el PIN de 4 dígitos. */
  @Post('join')
  @HttpCode(200)
  @RouteConfig(STRICT)
  joinByPin(
    @Body(new ZodValidationPipe(JoinByPinSchema)) body: { pin: string; alias: string },
    @Auth() auth: AuthContext,
    @Req() req: FastifyRequest,
  ): Promise<ParcheState> {
    return this.parche.joinByPin(auth.user, body.pin, body.alias, req.ip, String(req.id));
  }

  /** POST /api/v1/sessions/{id}/join (Guía Técnica §7): unirse con el QR firmado. */
  @Post(':id/join')
  @HttpCode(200)
  @RouteConfig(STRICT)
  joinByInvite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(JoinByInviteSchema)) body: { invite: string; alias: string },
    @Auth() auth: AuthContext,
    @Req() req: FastifyRequest,
  ): Promise<ParcheState> {
    return this.parche.joinByInvite(auth.user, id, body.invite, body.alias, String(req.id));
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  state(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext): Promise<ParcheState> {
    return this.parche.state(id, auth.user.id);
  }

  @Post(':id/leave')
  @HttpCode(204)
  async leave(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext): Promise<void> {
    await this.parche.leave(auth.user, id);
  }

  /** POST /api/v1/sessions/{id}/close (Guía Técnica §7): solo el anfitrión. */
  @Post(':id/close')
  @HttpCode(200)
  close(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext, @Req() req: FastifyRequest): Promise<ParcheState> {
    return this.parche.close(auth.user, id, String(req.id));
  }

  /**
   * Canal en vivo (Server-Sent Events — Guía Técnica §8): autorización por sesión, estado completo con versión
   * creciente en cada cambio, heartbeat, reconexión automática del navegador (al reconectar recibe el estado
   * vigente, no se reproducen acciones) y cierre cuando la sesión termina.
   */
  @Get(':id/events')
  @ApiProduces('text/event-stream')
  async events(@Param('id', ParseUUIDPipe) id: string, @Auth() auth: AuthContext, @Req() req: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    if (!(await this.parche.canListen(id, auth.user.id))) throw new DomainError('SESSION_NOT_FOUND', 'No encontramos ese Parche.');
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Request-Id': String(req.id),
    });
    raw.write('retry: 3000\n\n');

    let lastVersion = -1;
    let closed = false;
    const send = async () => {
      if (closed) return;
      try {
        const state = await this.parche.state(id, auth.user.id);
        if (state.stateVersion <= lastVersion && !['FINALIZADA', 'EXPIRADA', 'CANCELADA'].includes(state.status)) return;
        lastVersion = state.stateVersion;
        raw.write(`id: ${state.stateVersion}\nevent: state\ndata: ${JSON.stringify(state)}\n\n`);
        const mine = state.participants.find((p) => p.isYou);
        if (['FINALIZADA', 'EXPIRADA', 'CANCELADA'].includes(state.status) || mine?.status === 'left') finish();
      } catch {
        finish();
      }
    };
    const heartbeat = setInterval(() => raw.write(': ping\n\n'), HEARTBEAT_MS);
    const unsubscribe = await this.bus.subscribe(id, () => void send());
    const finish = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
      raw.end();
    };
    req.raw.on('close', () => {
      const wasOpen = !closed;
      finish();
      if (wasOpen) void this.parche.setPresence(id, auth.user.id, false);
    });
    await this.parche.setPresence(id, auth.user.id, true);
    await send();
  }
}
