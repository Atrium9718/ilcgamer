import { type AnalyticsDashboard, type ClientEvent, ClientEventSchema, DASHBOARD_DAYS, type Role } from '@ilc/contracts';
import { Body, Controller, Get, Header, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.ts';
import { AuthGuard } from '../identity/auth.guard.ts';
import { RequireRoles, RolesGuard } from '../identity/roles.guard.ts';
import { AnalyticsService } from './analytics.service.ts';

const VIEWERS: Role[] = ['ADMIN_MARCA', 'SUPERADMIN'];
const EVENT_LIMIT = { rateLimit: { max: () => Number(process.env.EVENT_RATE_LIMIT_PER_MINUTE ?? 60), timeWindow: '1 minute' } };

/** Eventos de la PWA (lista blanca): requiere sesión con edad verificada y no afecta ninguna economía. */
@ApiTags('Analítica')
@ApiCookieAuth()
@Controller('events')
@UseGuards(AuthGuard)
export class EventsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post()
  @HttpCode(204)
  @RouteConfig(EVENT_LIMIT)
  async record(@Body(new ZodValidationPipe(ClientEventSchema)) body: ClientEvent): Promise<void> {
    await this.analytics.recordClient(body);
  }
}

@ApiTags('Consola · Analítica')
@ApiCookieAuth()
@Controller('admin/analytics')
@UseGuards(AuthGuard, RolesGuard)
@RequireRoles(...VIEWERS)
export class AdminAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Tableros separados de Ruta A, Ruta B y operación (Guía Técnica §10.2). Solo agregados, nunca personas. */
  @Get()
  @Header('Cache-Control', 'no-store')
  dashboard(
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
  ): Promise<AnalyticsDashboard> {
    return this.analytics.dashboard(days);
  }
}
