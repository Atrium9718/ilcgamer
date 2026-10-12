import { z } from 'zod';
import { ApprovalKindSchema } from './campaigns.ts';

/**
 * Catálogo de juegos y misiones (Paso 9). Fuentes: Guía Técnica §5.4 (contrato del módulo, resultado verificado por
 * servidor, aprobar/desactivar/revertir), §5.5, §5.7; Instrucciones §13 (Ruta A simple y rápida, Ruta B de mediano y
 * largo plazo, máximo 2 experiencias de Ruta B por persona y contexto).
 *
 * Reglas que el esquema hace imposibles de saltar:
 * - un juego nunca emite Puntos ILC (no existe ese campo): los Puntos ILC solo nacen de reclamar un código;
 * - el XP solo existe en módulos de Ruta B (economía de experiencia separada — §5.7);
 * - el resultado lo decide el servidor (motor propio) o lo confirma el proveedor con una llamada firmada.
 */

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const ModuleSlugSchema = z.string().regex(SLUG, 'Minúsculas con guiones').min(3).max(60);
const Icon = z.string().regex(/^[a-z0-9_]{2,40}$/, 'Nombre de ícono de Material Symbols');
const Text = (max: number, min = 1) => z.string().trim().min(min).max(max);

export const GAME_ENGINES = ['trivia', 'wheel', 'chapters'] as const;
export const GameEngineSchema = z.enum(GAME_ENGINES);
export type GameEngine = z.infer<typeof GameEngineSchema>;

export const GAME_ROUTES = ['A', 'B'] as const;
export const GameRouteSchema = z.enum(GAME_ROUTES);

/** Máximo de experiencias de Ruta B disponibles por persona en un mismo contexto (Instrucciones §13.2). */
export const MAX_ROUTE_B_PER_CONTEXT = 2;

// ─────────────── Configuración de cada motor (la valida el servidor al registrar) ───────────────

const Question = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,30}$/, 'Identificador corto en minúsculas'),
    prompt: Text(200),
    options: z.array(Text(80)).min(2).max(4),
    correctIndex: z.number().int().min(0).max(3),
    /** Dato que se muestra al responder. Contenido editorial: lo revisa Marca antes de activar. */
    fact: Text(300).optional(),
  })
  .strict()
  .refine((q) => q.correctIndex < q.options.length, { message: 'La respuesta correcta debe ser una de las opciones', path: ['correctIndex'] });

export const TriviaConfigSchema = z
  .object({
    questions: z.array(Question).min(3).max(100),
    /** Preguntas por partida (el servidor las sortea). */
    perGame: z.number().int().min(3).max(15).default(8),
    /** Aporte al marcador del Parche por respuesta correcta. */
    parchePerCorrect: z.number().int().min(1).max(100).default(10),
    /** Tiempo tope por pregunta. Es solo un límite: no hay bonificación por rapidez. */
    secondsPerQuestion: z.number().int().min(10).max(120).default(30),
  })
  .strict()
  .refine((c) => c.questions.length >= c.perGame, { message: 'Hay menos preguntas que las de cada partida', path: ['perGame'] })
  .refine((c) => new Set(c.questions.map((q) => q.id)).size === c.questions.length, { message: 'Identificadores de pregunta repetidos', path: ['questions'] });

export const WheelConfigSchema = z
  .object({
    segments: z
      .array(
        z
          .object({
            label: Text(24),
            /** Aporte al marcador del Parche. */
            score: z.number().int().min(0).max(100),
            /** Reto cultural o de conocimiento. Nunca de consumo, velocidad o presión grupal: lo revisa Marca/Jurídica. */
            challenge: Text(140).optional(),
          })
          .strict(),
      )
      .min(4)
      .max(12),
  })
  .strict();

export const ChaptersConfigSchema = z
  .object({
    chapters: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9-]{1,30}$/, 'Identificador corto en minúsculas'),
            title: Text(40),
            icon: Icon,
            /** Relato del capítulo: contenido editorial aprobado por Marca. */
            story: Text(600),
            question: z
              .object({ prompt: Text(200), options: z.array(Text(80)).min(2).max(4), correctIndex: z.number().int().min(0).max(3) })
              .strict()
              .refine((q) => q.correctIndex < q.options.length, { message: 'La respuesta correcta debe ser una de las opciones', path: ['correctIndex'] }),
            fact: Text(300).optional(),
            /** XP al completar el capítulo (una sola vez por persona). */
            xp: z.number().int().min(1).max(200),
          })
          .strict(),
      )
      .min(2)
      .max(12),
    /** Insignia al completar todos los capítulos (debe existir en el catálogo de insignias). */
    finalBadge: z.string().regex(SLUG).optional(),
  })
  .strict()
  .refine((c) => new Set(c.chapters.map((x) => x.id)).size === c.chapters.length, { message: 'Identificadores de capítulo repetidos', path: ['chapters'] });

export type TriviaConfig = z.infer<typeof TriviaConfigSchema>;
export type WheelConfig = z.infer<typeof WheelConfigSchema>;
export type ChaptersConfig = z.infer<typeof ChaptersConfigSchema>;

// ─────────────── Manifiesto del módulo (Guía Técnica §5.4) ───────────────

const Delivery = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('engine'), engine: GameEngineSchema, config: z.record(z.string(), z.unknown()) }).strict(),
  z
    .object({
      kind: z.literal('iframe'),
      /** Dirección HTTPS del módulo del proveedor. Debe ser de otro origen que la PWA. */
      entryUrl: z.url().refine((u) => u.startsWith('https://'), 'Debe empezar por https://'),
      /** Origen exacto del que se aceptan mensajes (p. ej. https://juegos.proveedor.com). */
      allowedOrigin: z.string().regex(/^https:\/\/[a-z0-9.-]+(:\d{2,5})?$/i, 'Origen https sin ruta'),
    })
    .strict()
    .refine((d) => d.entryUrl.startsWith(`${d.allowedOrigin}/`) || d.entryUrl === d.allowedOrigin, {
      message: 'La dirección del módulo debe pertenecer al origen permitido',
      path: ['entryUrl'],
    }),
]);

export const GameManifestSchema = z
  .object({
    moduleId: ModuleSlugSchema,
    provider: Text(60),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Versión x.y.z'),
    title: Text(60),
    description: Text(200),
    route: GameRouteSchema,
    icon: Icon,
    minutes: z.number().int().min(1).max(60),
    players: z.object({ min: z.number().int().min(1).max(50), max: z.number().int().min(1).max(50) }).strict(),
    languages: z
      .array(z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/))
      .min(1)
      .max(5)
      .default(['es-CO']),
    aspect: z.enum(['portrait', 'any']).default('portrait'),
    /** Permisos del dispositivo que pide el módulo. Cualquiera exige aprobación de Privacidad. */
    permissions: z
      .array(z.enum(['camera', 'microphone', 'geolocation']))
      .max(3)
      .default([]),
    dataPolicy: z.object({ collectsPersonalData: z.boolean(), trackers: z.boolean(), notes: Text(300).optional() }).strict(),
    accessibility: z.object({ screenReader: z.boolean(), reducedMotion: z.boolean() }).strict(),
    delivery: Delivery,
    scoring: z
      .object({
        /** Máximo que una misión puede sumar al marcador del Parche. */
        parcheScoreMax: z.number().int().min(0).max(1000),
        /** Máximo de XP por misión (solo Ruta B). */
        xpMax: z.number().int().min(0).max(500),
        attemptsPerDay: z.number().int().min(1).max(50).default(10),
        maxSeconds: z.number().int().min(30).max(3600).default(600),
      })
      .strict(),
    badge: z.string().regex(SLUG).optional(),
  })
  .strict()
  .refine((m) => m.players.min <= m.players.max, { message: 'El mínimo de jugadores supera al máximo', path: ['players'] })
  .refine((m) => m.route === 'B' || m.scoring.xpMax === 0, {
    message: 'El XP es de la Ruta B: un juego de Ruta A no puede otorgarlo',
    path: ['scoring', 'xpMax'],
  })
  .refine((m) => m.delivery.kind !== 'engine' || (m.delivery.engine === 'chapters') === (m.route === 'B'), {
    message: 'El motor de capítulos es de Ruta B; trivia y ruleta son de Ruta A',
    path: ['delivery', 'engine'],
  });
export type GameManifest = z.infer<typeof GameManifestSchema>;

/** Valida además la configuración del motor elegido y que los topes de puntuación la cubran. */
export function validateManifest(input: unknown): { ok: true; manifest: GameManifest } | { ok: false; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};
  const add = (path: string, message: string) => {
    errors[path] = [...(errors[path] ?? []), message];
  };
  const parsed = GameManifestSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) add(issue.path.join('.') || 'manifest', issue.message);
    return { ok: false, errors };
  }
  const m = parsed.data;
  if (m.delivery.kind === 'engine') {
    const schema = { trivia: TriviaConfigSchema, wheel: WheelConfigSchema, chapters: ChaptersConfigSchema }[m.delivery.engine];
    const cfg = schema.safeParse(m.delivery.config);
    if (!cfg.success) {
      for (const issue of cfg.error.issues) add(`delivery.config.${issue.path.join('.')}`, issue.message);
    } else if (m.delivery.engine === 'trivia') {
      const c = cfg.data as TriviaConfig;
      if (c.perGame * c.parchePerCorrect > m.scoring.parcheScoreMax)
        add('scoring.parcheScoreMax', 'No cubre el máximo de una partida (preguntas por partida × puntos por acierto)');
    } else if (m.delivery.engine === 'wheel') {
      const c = cfg.data as WheelConfig;
      if (Math.max(...c.segments.map((s) => s.score)) > m.scoring.parcheScoreMax) add('scoring.parcheScoreMax', 'Un segmento supera el máximo permitido');
    } else {
      const c = cfg.data as ChaptersConfig;
      if (Math.max(...c.chapters.map((x) => x.xp)) > m.scoring.xpMax) add('scoring.xpMax', 'Un capítulo da más XP que el máximo por misión');
      if (c.finalBadge && c.finalBadge !== m.badge) add('badge', 'La insignia final debe coincidir con la insignia del manifiesto');
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, manifest: m };
}

/** Aprobaciones que exige un módulo: Marca y Jurídica siempre; Privacidad si recoge datos, rastrea o pide permisos. */
export function requiredModuleApprovals(m: Pick<GameManifest, 'dataPolicy' | 'permissions'>): Array<z.infer<typeof ApprovalKindSchema>> {
  const kinds: Array<z.infer<typeof ApprovalKindSchema>> = ['MARCA', 'JURIDICA'];
  if (m.dataPolicy.collectsPersonalData || m.dataPolicy.trackers || m.permissions.length > 0) kinds.push('PRIVACIDAD');
  return kinds;
}

// ─────────────── Catálogo y ciclo de vida (consola) ───────────────

export const MODULE_STATUSES = ['BORRADOR', 'EN_PRUEBA', 'APROBADO', 'ACTIVO', 'DESACTIVADO'] as const;
export const ModuleStatusSchema = z.enum(MODULE_STATUSES);
export type ModuleStatus = z.infer<typeof ModuleStatusSchema>;

export const RegisterModuleSchema = z.object({ manifest: z.unknown() });

export const ModuleVersionViewSchema = z.object({
  version: z.string(),
  status: ModuleStatusSchema,
  manifest: GameManifestSchema,
  manifestHash: z.string(),
  approvals: z.array(
    z.object({
      kind: ApprovalKindSchema,
      required: z.boolean(),
      status: z.enum(['approved', 'rejected', 'pending', 'not_required']),
      note: z.string().nullable(),
    }),
  ),
  createdAt: z.iso.datetime(),
});
export type ModuleVersionView = z.infer<typeof ModuleVersionViewSchema>;

export const ModuleViewSchema = z.object({
  moduleId: z.string(),
  provider: z.string(),
  route: GameRouteSchema,
  activeVersion: z.string().nullable(),
  versions: z.array(ModuleVersionViewSchema),
});
export type ModuleView = z.infer<typeof ModuleViewSchema>;

export const ModuleApprovalSchema = z.object({
  kind: ApprovalKindSchema,
  decision: z.enum(['APROBADO', 'RECHAZADO']),
  note: z.string().trim().max(2000).optional(),
});

export const DefaultModulesSchema = z.object({ modules: z.array(ModuleSlugSchema).max(12) });
export type DefaultModules = z.infer<typeof DefaultModulesSchema>;

export const ProviderSecretSchema = z.object({ secret: z.string(), epoch: z.number().int() });

// ─────────────── Jugador: catálogo, misiones y resultados ───────────────

export const GameSummarySchema = z.object({
  moduleId: z.string(),
  title: z.string(),
  description: z.string(),
  route: GameRouteSchema,
  icon: z.string(),
  minutes: z.number().int(),
  players: z.object({ min: z.number().int(), max: z.number().int() }),
  kind: z.enum(['engine', 'iframe']),
  /** Capítulos completados / total (motor de capítulos). */
  progress: z.object({ current: z.number().int(), total: z.number().int() }).nullable(),
});
export type GameSummary = z.infer<typeof GameSummarySchema>;

export const GameCatalogSchema = z.object({
  campaign: z.object({ slug: z.string(), title: z.string() }).nullable(),
  games: z.array(GameSummarySchema),
});
export type GameCatalog = z.infer<typeof GameCatalogSchema>;

export const StartMissionSchema = z
  .object({
    moduleId: ModuleSlugSchema,
    campaignSlug: z.string().max(80).optional(),
    sessionId: z.uuid().optional(),
    /** Pruebas del equipo editorial: no otorgan nada. */
    preview: z.boolean().optional(),
  })
  .refine((v) => !(v.campaignSlug && v.sessionId), 'Indica una campaña o un Parche, no ambos');

export type StartMission = z.infer<typeof StartMissionSchema>;

const PublicQuestion = z.object({ id: z.string(), prompt: z.string(), options: z.array(z.string()) });

export const MissionStartSchema = z.object({
  missionId: z.uuid(),
  moduleId: z.string(),
  title: z.string(),
  route: GameRouteSchema,
  preview: z.boolean(),
  /** Segundos máximos de la misión según el servidor. */
  maxSeconds: z.number().int(),
  play: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('trivia'), questions: z.array(PublicQuestion), secondsPerQuestion: z.number().int() }),
    z.object({ kind: z.literal('wheel'), segments: z.array(z.object({ label: z.string() })) }),
    z.object({
      kind: z.literal('chapters'),
      index: z.number().int(),
      total: z.number().int(),
      chapter: z.object({
        id: z.string(),
        title: z.string(),
        icon: z.string(),
        story: z.string(),
        question: PublicQuestion.omit({ id: true }),
        xp: z.number().int(),
      }),
      completedIds: z.array(z.string()),
    }),
    z.object({ kind: z.literal('iframe'), entryUrl: z.string(), allowedOrigin: z.string() }),
  ]),
});
export type MissionStart = z.infer<typeof MissionStartSchema>;

export const SubmitMissionSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.string().max(30), choice: z.number().int().min(0).max(3) }))
    .max(20)
    .optional(),
  choice: z.number().int().min(0).max(3).optional(),
});
export type SubmitMission = z.infer<typeof SubmitMissionSchema>;

export const MISSION_STATUSES = ['INICIADA', 'COMPLETADA_PENDIENTE', 'VERIFICADA', 'RECHAZADA', 'ABANDONADA'] as const;

export const MissionResultSchema = z.object({
  missionId: z.uuid(),
  status: z.enum(MISSION_STATUSES),
  preview: z.boolean(),
  headline: z.string(),
  summary: z.string(),
  /** Capítulo: false si la respuesta fue incorrecta (se puede reintentar). Otros motores: null. */
  correct: z.boolean().nullable(),
  /** Aporte al marcador del Parche (experiencial). */
  parcheScore: z.number().int(),
  /** XP de la Ruta B (economía separada). */
  xp: z.number().int(),
  /** Nunca hay Puntos ILC por jugar: solo por reclamar un código. */
  pointsEarned: z.literal(0),
  badge: z.object({ slug: z.string(), name: z.string() }).nullable(),
  fact: z.string().nullable(),
  /** Ruleta: segmento que salió y su reto. */
  outcome: z.object({ label: z.string(), challenge: z.string().nullable() }).nullable(),
  /** Capítulos: hay otro capítulo por jugar / ya terminó el módulo. */
  hasNext: z.boolean(),
  completedModule: z.boolean(),
});
export type MissionResult = z.infer<typeof MissionResultSchema>;

/** Llamada firmada del proveedor de un módulo iframe que confirma el resultado (backend a backend — §5.4). */
export const ProviderCallbackSchema = z.object({
  missionId: z.uuid(),
  /** Marca de tiempo del proveedor; se acepta ±5 minutos para evitar repeticiones. */
  issuedAt: z.iso.datetime(),
  outcome: z.enum(['completed', 'rejected']),
  parcheScore: z.number().int().min(0).max(1000).default(0),
  xp: z.number().int().min(0).max(500).default(0),
});
export type ProviderCallback = z.infer<typeof ProviderCallbackSchema>;
export const PROVIDER_SIGNATURE_HEADER = 'X-Provider-Signature';
