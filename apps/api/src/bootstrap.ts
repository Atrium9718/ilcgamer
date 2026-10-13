import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import {
  ApiErrorSchema,
  ConsentStateSchema,
  HEADERS,
  HealthResponseSchema,
  MAX_IMPORT_BYTES,
  MeSchema,
  PublicConfigSchema,
  toOpenApiComponents,
} from '@ilc/contracts';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.ts';
import { ENV } from './config/config.module.ts';
import type { Env } from './config/env.ts';
import { bearerMatches, Metrics } from './observability/metrics.ts';
import { PrismaService } from './prisma/prisma.service.ts';
import { RedisService } from './redis/redis.service.ts';

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Rutas sensibles que nunca deben aparecer completas en logs (Guía Técnica §9.2). */
const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.birthDate',
  'req.body.destination',
  'req.body.code',
  'req.headers["idempotency-key"]',
  'req.params.token',
  'req.params.pin',
  'req.body.pin',
];

/** Tokens de Smart Tag y PIN también viajan en la ruta: se enmascaran en la URL registrada (§9.2). */
const TOKEN_IN_PATH = /\/(product-codes|campaign-codes|p)\/([^/?#]+)/g;
export const maskUrl = (url: string): string => url.replace(TOKEN_IN_PATH, (_m, kind: string, token: string) => `/${kind}/••••${token.slice(-4)}`);

/** Solo se aceptan cuerpos binarios en la importación de Smart Tags (archivo CSV/XLSX). */
const BINARY_ROUTES = /^\/api\/v1\/admin\/smarttags\/imports(\?|$)/;

export async function createApp(options: { logger?: boolean } = {}): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    logger:
      options.logger === false
        ? false
        : {
            level: process.env.LOG_LEVEL ?? 'info',
            redact: { paths: REDACT, censor: '[redactado]' },
            serializers: {
              req: (req: { method: string; url: string; hostname?: string }) => ({ method: req.method, url: maskUrl(req.url), host: req.hostname }),
            },
          },
    // Correlación: respeta un X-Request-Id válido del cliente o genera uno.
    genReqId: (req: IncomingMessage) => {
      const incoming = req.headers[HEADERS.requestId.toLowerCase()];
      return typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    },
    trustProxy: true,
    bodyLimit: 256 * 1024,
  });

  // bodyParser: false — el parser JSON se registra abajo (cuerpo vacío permitido); no se aceptan formularios.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, { logger: options.logger === false ? false : undefined, bodyParser: false });
  const env = app.get<Env>(ENV);

  const fastify = app.getHttpAdapter().getInstance();
  // Muchos clientes HTTP envían Content-Type JSON con cuerpo vacío en acciones sin datos (enviar, publicar):
  // se acepta como "sin cuerpo". El resto usa el parser de Fastify (protección contra __proto__ y constructor).
  const jsonParser = fastify.getDefaultJsonParser('error', 'error');
  fastify.removeContentTypeParser('application/json');
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (body === '') {
      done(null, undefined);
      return;
    }
    jsonParser(req, String(body), done);
  });
  fastify.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: MAX_IMPORT_BYTES }, (req, body, done) => {
    if (!BINARY_ROUTES.test(req.url)) {
      done(Object.assign(new Error('Tipo de contenido no admitido en esta ruta.'), { statusCode: 415 }), undefined);
      return;
    }
    done(null, body);
  });

  await app.register(cookie);
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

  // Métricas: contador y duración por ruta con plantilla; lectura protegida por token (apagada si no hay token).
  const metrics = new Metrics();
  fastify.addHook('onResponse', async (req, reply) => {
    metrics.record(req.method, req.routeOptions?.url ?? 'sin_ruta', reply.statusCode, reply.elapsedTime / 1000);
  });
  fastify.get('/api/v1/metrics', async (req, reply) => {
    if (!env.METRICS_TOKEN) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'No encontrado.', retryable: false } });
    if (!bearerMatches(req.headers.authorization, env.METRICS_TOKEN))
      return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Sin autorización.', retryable: false } });
    const prisma = app.get(PrismaService);
    const redis = app.get(RedisService);
    const [db, cache, openIncidents, pendingRewards] = await Promise.all([
      prisma.isHealthy(),
      redis.isHealthy(),
      prisma.securityEvent.count({ where: { resolvedAt: null } }).catch(() => -1),
      prisma.rewardClaim.count({ where: { status: 'RESERVADO' } }).catch(() => -1),
    ]);
    return reply.header('content-type', 'text/plain; version=0.0.4; charset=utf-8').send(
      metrics.render({
        ilc_up: db ? 1 : 0,
        ilc_database_up: db ? 1 : 0,
        ilc_cache_up: cache ? 1 : 0,
        ilc_security_events_open: openIncidents,
        ilc_reward_reservations_pending: pendingRewards,
      }),
    );
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
      ...(toOpenApiComponents({
        ApiError: ApiErrorSchema,
        HealthResponse: HealthResponseSchema,
        Me: MeSchema,
        ConsentState: ConsentStateSchema,
        PublicConfig: PublicConfigSchema,
      }) as NonNullable<NonNullable<OpenAPIObject['components']>['schemas']>),
    },
  };
  return document;
}
