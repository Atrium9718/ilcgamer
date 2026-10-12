import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ApiErrorSchema, HEADERS, HealthResponseSchema, toOpenApiComponents } from '@ilc/contracts';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.ts';
import { ENV } from './config/config.module.ts';
import type { Env } from './config/env.ts';

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Rutas sensibles que nunca deben aparecer completas en logs (Guía Técnica §9.2). */
const REDACT = ['req.headers.authorization', 'req.headers.cookie', 'req.headers["idempotency-key"]', 'req.params.token', 'req.params.pin', 'req.body.pin'];

export async function createApp(options: { logger?: boolean } = {}): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    logger: options.logger === false ? false : { level: process.env.LOG_LEVEL ?? 'info', redact: { paths: REDACT, censor: '[redactado]' } },
    // Correlación: respeta un X-Request-Id válido del cliente o genera uno.
    genReqId: (req: IncomingMessage) => {
      const incoming = req.headers[HEADERS.requestId.toLowerCase()];
      return typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    },
    trustProxy: true,
    bodyLimit: 256 * 1024,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, { logger: options.logger === false ? false : undefined });
  const env = app.get<Env>(ENV);

  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  // Límite base por IP/identidad; los endpoints sensibles (PIN, claims) tendrán límites propios (§9.1).
  await app.register(rateLimit, { max: env.RATE_LIMIT_PER_MINUTE, timeWindow: '1 minute' });

  app.enableCors({
    origin: env.CORS_ORIGINS,
    allowedHeaders: ['Content-Type', 'Authorization', HEADERS.idempotencyKey, HEADERS.requestId],
    exposedHeaders: [HEADERS.requestId],
    credentials: true,
  });
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', async (req, reply) => {
      reply.header(HEADERS.requestId, String(req.id));
    });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  const document = buildOpenApi(app, env);
  app.getHttpAdapter().get('/api/v1/openapi.json', (_req, reply) => reply.send(document));
  if (env.OPENAPI_UI && env.NODE_ENV !== 'production') SwaggerModule.setup('api/docs', app, document);

  return app;
}

export function buildOpenApi(app: NestFastifyApplication, env: Env): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('API Plataforma Phygital ILC')
    .setDescription(
      'Contrato /api/v1. Errores con forma ApiError y códigos estables; operaciones con efecto económico exigen la cabecera Idempotency-Key (Guía Técnica §7).',
    )
    .setVersion(env.APP_VERSION)
    .build();
  const document = SwaggerModule.createDocument(app, config);
  document.components = {
    ...document.components,
    schemas: {
      ...(document.components?.schemas ?? {}),
      ...(toOpenApiComponents({ ApiError: ApiErrorSchema, HealthResponse: HealthResponseSchema }) as NonNullable<
        NonNullable<OpenAPIObject['components']>['schemas']
      >),
    },
  };
  return document;
}
