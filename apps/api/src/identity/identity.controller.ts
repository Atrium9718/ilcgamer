import {
  type AgeGateRequest,
  AgeGateRequestSchema,
  type ConsentChange,
  ConsentChangeSchema,
  type ConsentState,
  type Me,
  type OtpRequest,
  OtpRequestSchema,
  type OtpVerify,
  OtpVerifySchema,
  UpdateMeSchema,
} from '@ilc/contracts';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../common/domain-error.ts';
import { ZodValidationPipe } from '../common/zod-validation.pipe.ts';
import { Auth, type AuthContext, AuthGuard, OptionalAuthGuard } from './auth.guard.ts';
import { IdentityService } from './identity.service.ts';
import { OtpService } from './otp.service.ts';

/**
 * Límite específico por IP para endpoints expuestos a fuerza bruta (§9.1). Se lee en cada solicitud
 * (AUTH_RATE_LIMIT_PER_MINUTE, validada en env.ts) porque los decoradores se evalúan al importar.
 */
const STRICT = { rateLimit: { max: () => Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE ?? 10), timeWindow: '1 minute' } };

@ApiTags('Identidad')
@Controller()
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly otp: OtpService,
  ) {}

  /** Control de edad +18. Crea una cuenta temporal con alias si no hay sesión. No guarda la fecha de nacimiento. */
  @Post('age-gate')
  @HttpCode(200)
  @RouteConfig(STRICT)
  @UseGuards(OptionalAuthGuard)
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/Me' } })
  ageGate(
    @Body(new ZodValidationPipe(AgeGateRequestSchema)) body: AgeGateRequest,
    @Auth() auth: AuthContext | null,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Me> {
    return this.identity.passAgeGate(body.birthDate, body.campaignSlug, auth, reply, String(req.id));
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/Me' } })
  me(@Auth() auth: AuthContext): Promise<Me> {
    return this.identity.me(auth.user);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  updateMe(@Body(new ZodValidationPipe(UpdateMeSchema)) body: { alias: string }, @Auth() auth: AuthContext): Promise<Me> {
    return this.identity.updateAlias(auth.user.id, body.alias);
  }

  /** Derecho de supresión: elimina datos personales y credenciales y cierra todas las sesiones. */
  @Delete('me')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  async deleteMe(@Auth() auth: AuthContext, @Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<void> {
    await this.identity.deleteAccount(auth, reply, String(req.id));
  }

  @Get('consents')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  consents(@Auth() auth: AuthContext): Promise<ConsentState[]> {
    return this.identity.consentState(auth.user.id);
  }

  /** Registra un cambio de consentimiento (append-only, con versión del aviso y origen — §7, §9.3). */
  @Post('consents')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  recordConsent(@Body(new ZodValidationPipe(ConsentChangeSchema)) body: ConsentChange, @Auth() auth: AuthContext): Promise<ConsentState[]> {
    return this.identity.recordConsent(auth.user.id, body);
  }

  @Post('auth/otp/request')
  @HttpCode(200)
  @RouteConfig(STRICT)
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  requestOtp(@Body(new ZodValidationPipe(OtpRequestSchema)) body: OtpRequest) {
    return this.otp.request(body.channel, body.destination);
  }

  @Post('auth/otp/verify')
  @HttpCode(200)
  @RouteConfig(STRICT)
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  async verifyOtp(
    @Body(new ZodValidationPipe(OtpVerifySchema)) body: OtpVerify,
    @Auth() auth: AuthContext,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Me> {
    const { destination, destinationId } = await this.otp.verify(body.channel, body.destination, body.code);
    return this.identity.completeOtpLogin(auth, body.channel, destination, destinationId, reply, String(req.id));
  }

  /** Google / Apple: se habilitan al registrar las credenciales de cliente de ILC (Guía Técnica §15). */
  @Post('auth/oauth/:provider')
  oauth(@Param('provider') _provider: string): never {
    throw new DomainError('AUTH_PROVIDER_NOT_CONFIGURED', 'Este método de acceso aún no está disponible.');
  }

  @Post('auth/logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  async logout(@Auth() auth: AuthContext, @Res({ passthrough: true }) reply: FastifyReply): Promise<void> {
    await this.identity.logout(auth, reply);
  }
}
