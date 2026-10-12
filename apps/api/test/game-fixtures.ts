import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { canonicalJson } from '../src/campaigns/content-hash.ts';
import { hmac } from '../src/common/crypto.ts';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { person } from './fixtures.ts';

/** CONTENIDO DE PRUEBA: no es contenido de marca ni afirma nada sobre ILC (lo aprueba Marca antes de activar en producción). */
const Q = (id: string, prompt: string, options: string[], correctIndex: number, fact?: string) => ({
  id,
  prompt,
  options,
  correctIndex,
  ...(fact ? { fact } : {}),
});

export const QUESTIONS = [
  Q('q1', 'Pregunta de prueba 1: ¿cuánto es 2 + 2?', ['3', '4', '5'], 1, 'Dato de prueba 1'),
  Q('q2', 'Pregunta de prueba 2: ¿cuánto es 3 + 3?', ['5', '6', '7'], 1),
  Q('q3', 'Pregunta de prueba 3: ¿cuánto es 4 + 4?', ['8', '9', '10'], 0),
  Q('q4', 'Pregunta de prueba 4: ¿cuánto es 5 + 5?', ['9', '10', '11'], 1),
  Q('q5', 'Pregunta de prueba 5: ¿cuánto es 6 + 6?', ['12', '13', '14'], 0),
  Q('q6', 'Pregunta de prueba 6: ¿cuánto es 7 + 7?', ['13', '14', '15'], 1),
];

const base = {
  provider: 'ILC propio',
  version: '1.0.0',
  minutes: 3,
  players: { min: 1, max: 8 },
  languages: ['es-CO'],
  aspect: 'portrait',
  permissions: [],
  dataPolicy: { collectsPersonalData: false, trackers: false },
  accessibility: { screenReader: true, reducedMotion: true },
};

export const triviaManifest = (over: Record<string, unknown> = {}) => ({
  ...base,
  moduleId: 'trivia-prueba',
  title: 'Trivia de prueba',
  description: 'Contenido de prueba pendiente de aprobación de marca',
  route: 'A',
  icon: 'quiz',
  delivery: { kind: 'engine', engine: 'trivia', config: { questions: QUESTIONS, perGame: 4, parchePerCorrect: 10, secondsPerQuestion: 30 } },
  scoring: { parcheScoreMax: 40, xpMax: 0, attemptsPerDay: 3, maxSeconds: 300 },
  ...over,
});

export const wheelManifest = (over: Record<string, unknown> = {}) => ({
  ...base,
  moduleId: 'ruleta-prueba',
  title: 'Ruleta de prueba',
  description: 'Contenido de prueba pendiente de aprobación de marca',
  route: 'A',
  icon: 'rotate_right',
  players: { min: 1, max: 8 },
  delivery: {
    kind: 'engine',
    engine: 'wheel',
    config: {
      segments: [
        { label: '+10', score: 10 },
        { label: '+20', score: 20 },
        { label: 'Reto cultural', score: 5, challenge: 'Cuenta un dato curioso de tu ciudad (reto de prueba)' },
        { label: '+5', score: 5 },
      ],
    },
  },
  scoring: { parcheScoreMax: 20, xpMax: 0, attemptsPerDay: 20, maxSeconds: 120 },
  ...over,
});

export const chaptersManifest = (over: Record<string, unknown> = {}) => ({
  ...base,
  moduleId: 'explorador-prueba',
  title: 'Explorador de prueba',
  description: 'Contenido de prueba pendiente de aprobación de marca',
  route: 'B',
  icon: 'explore',
  badge: 'explorador-de-prueba',
  delivery: {
    kind: 'engine',
    engine: 'chapters',
    config: {
      finalBadge: 'explorador-de-prueba',
      chapters: [
        {
          id: 'c1',
          title: 'Capítulo de prueba 1',
          icon: 'water_drop',
          story: 'Relato de prueba 1, pendiente de aprobación de marca.',
          question: { prompt: '¿2 + 2?', options: ['3', '4'], correctIndex: 1 },
          xp: 40,
          fact: 'Dato de prueba',
        },
        {
          id: 'c2',
          title: 'Capítulo de prueba 2',
          icon: 'landscape',
          story: 'Relato de prueba 2, pendiente de aprobación de marca.',
          question: { prompt: '¿3 + 3?', options: ['6', '7'], correctIndex: 0 },
          xp: 60,
        },
      ],
    },
  },
  scoring: { parcheScoreMax: 0, xpMax: 60, attemptsPerDay: 20, maxSeconds: 900 },
  ...over,
});

export const iframeManifest = (over: Record<string, unknown> = {}) => ({
  ...base,
  moduleId: 'proveedor-prueba',
  provider: 'Estudio externo de prueba',
  title: 'Juego externo de prueba',
  description: 'Módulo de un proveedor externo (prueba)',
  route: 'A',
  icon: 'sports_esports',
  delivery: { kind: 'iframe', entryUrl: 'https://juegos.proveedor-prueba.co/trivia/index.html', allowedOrigin: 'https://juegos.proveedor-prueba.co' },
  scoring: { parcheScoreMax: 50, xpMax: 0, attemptsPerDay: 5, maxSeconds: 600 },
  ...over,
});

type Browser = Awaited<ReturnType<typeof person>>;
export interface Team {
  ti: Browser;
  admin: Browser;
  marca: Browser;
  juridica: Browser;
  privacidad: Browser;
}

export async function team(app: NestFastifyApplication, db: PrismaClient): Promise<Team> {
  return {
    ti: await person(app, db, ['SUPERADMIN'], 'TI'),
    admin: await person(app, db, ['ADMIN_MARCA'], 'Admin'),
    marca: await person(app, db, ['REVISOR_MARCA'], 'Rev marca'),
    juridica: await person(app, db, ['REVISOR_JURIDICO'], 'Rev jurídica'),
    privacidad: await person(app, db, ['RESPONSABLE_PRIVACIDAD'], 'Privacidad'),
  };
}

/** Recorre el ciclo real: registrar → prueba → aprobaciones → activar. */
export async function activateModule(t: Team, manifest: { moduleId: string; version: string; permissions?: unknown[] }, privacy = false): Promise<void> {
  const path = `/admin/games/modules/${manifest.moduleId}/versions/${manifest.version}`;
  const reg = await t.ti.request('POST', '/admin/games/modules', { manifest });
  if (reg.statusCode !== 201) throw new Error(`registro: ${reg.body}`);
  await t.admin.request('POST', `${path}/test`);
  await t.marca.request('POST', `${path}/approvals`, { kind: 'MARCA', decision: 'APROBADO' });
  await t.juridica.request('POST', `${path}/approvals`, { kind: 'JURIDICA', decision: 'APROBADO' });
  if (privacy) await t.privacidad.request('POST', `${path}/approvals`, { kind: 'PRIVACIDAD', decision: 'APROBADO' });
  const act = await t.admin.request('POST', `${path}/activate`);
  if (act.statusCode !== 200) throw new Error(`activar: ${act.body}`);
}

/** Firma de proveedor como la haría su servidor: HMAC del JSON canónico con el secreto del módulo. */
export function providerSign(appSecret: string, slug: string, epoch: number, body: unknown): string {
  return `sha256=${hmac(hmac(appSecret, `provider:${slug}:${epoch}`), canonicalJson(body))}`;
}
