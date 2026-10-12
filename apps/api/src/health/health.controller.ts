import type { HealthResponse } from '@ilc/contracts';
import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { RedisService } from '../redis/redis.service.ts';

@ApiTags('Operación')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Salud de API, base de datos y caché (Guía Técnica §11: observabilidad). 503 si la base de datos cae. */
  @Get()
  @ApiOkResponse({ description: 'Servicio operativo', schema: { $ref: '#/components/schemas/HealthResponse' } })
  @ApiServiceUnavailableResponse({ description: 'Base de datos no disponible', schema: { $ref: '#/components/schemas/HealthResponse' } })
  async check(@Res({ passthrough: true }) reply: FastifyReply): Promise<HealthResponse> {
    const [db, cache] = await Promise.all([this.prisma.isHealthy(), this.redis.isHealthy()]);
    // Sin Redis la API sigue sirviendo (degradada); sin base de datos no.
    if (!db) reply.status(503);
    return {
      status: db && cache ? 'ok' : 'degraded',
      version: this.env.APP_VERSION,
      environment: this.env.NODE_ENV,
      time: new Date().toISOString(),
      checks: { database: db ? 'up' : 'down', cache: cache ? 'up' : 'down' },
    };
  }
}
