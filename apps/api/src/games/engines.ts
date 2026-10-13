import { randomInt } from 'node:crypto';
import {
  type ChaptersConfig,
  type GameManifest,
  type MissionStart,
  type PartyConfig,
  type SubmitMission,
  type TriviaConfig,
  type WheelConfig,
} from '@ilc/contracts';
import { DomainError } from '../common/domain-error.ts';

/**
 * Motores de juego propios (Guía Técnica §5.4). El SERVIDOR decide el resultado: sortea preguntas y segmentos,
 * guarda las claves de respuesta en estado privado (nunca llegan al cliente) y puntúa. Son funciones puras: la
 * persistencia, los límites y las recompensas viven en MissionsService.
 */

export interface Prepared {
  /** Lo que ve el cliente (sin claves de respuesta). */
  play: MissionStart['play'];
  /** Estado privado del servidor. */
  state: Record<string, unknown>;
  maxSeconds: number;
}

export interface Evaluation {
  /** Capítulos: false = respuesta incorrecta, se puede reintentar sin cerrar la misión. */
  correct: boolean | null;
  /** La misión queda verificada (false solo en capítulo incorrecto). */
  finished: boolean;
  parcheScore: number;
  xp: number;
  headline: string;
  summary: string;
  fact: string | null;
  outcome: { label: string; challenge: string | null } | null;
  /** Capítulos: id del capítulo completado. */
  chapterId?: string;
}

/** Fisher–Yates con aleatoriedad criptográfica: ningún cliente puede predecir el sorteo. */
export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

// ─────────────── Trivia ───────────────

export function prepareTrivia(config: TriviaConfig, manifest: GameManifest): Prepared {
  const picked = shuffle(config.questions).slice(0, config.perGame);
  return {
    play: {
      kind: 'trivia',
      secondsPerQuestion: config.secondsPerQuestion,
      questions: picked.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })),
    },
    state: {
      keys: Object.fromEntries(picked.map((q) => [q.id, q.correctIndex])),
      facts: Object.fromEntries(picked.filter((q) => q.fact).map((q) => [q.id, q.fact])),
    },
    maxSeconds: Math.min(manifest.scoring.maxSeconds, config.perGame * config.secondsPerQuestion + 15),
  };
}

export function evaluateTrivia(config: TriviaConfig, state: Record<string, unknown>, submission: SubmitMission): Evaluation {
  const keys = state.keys as Record<string, number>;
  const facts = (state.facts ?? {}) as Record<string, string>;
  const ids = Object.keys(keys);
  const answers = submission.answers ?? [];
  const seen = new Set<string>();
  for (const a of answers) {
    if (!(a.questionId in keys)) throw new DomainError('VALIDATION_FAILED', 'Respuesta a una pregunta que no es de esta partida.');
    if (seen.has(a.questionId)) throw new DomainError('VALIDATION_FAILED', 'Hay dos respuestas para la misma pregunta.');
    seen.add(a.questionId);
  }
  const correct = answers.filter((a) => keys[a.questionId] === a.choice).length;
  const firstWrong = answers.find((a) => keys[a.questionId] !== a.choice);
  return {
    correct: null,
    finished: true,
    parcheScore: correct * config.parchePerCorrect,
    xp: 0,
    headline: correct === ids.length ? '¡Trivia perfecta!' : 'Terminaste la trivia',
    summary: `${correct} de ${ids.length} respuestas correctas`,
    fact: (firstWrong && facts[firstWrong.questionId]) || Object.values(facts)[0] || null,
    outcome: null,
  };
}

// ─────────────── Ruleta ───────────────

export function prepareWheel(config: WheelConfig, manifest: GameManifest): Prepared {
  return {
    play: { kind: 'wheel', segments: config.segments.map((s) => ({ label: s.label })) },
    state: {},
    maxSeconds: Math.min(manifest.scoring.maxSeconds, 120),
  };
}

/** El giro lo decide el servidor al recibir el pedido, no el celular. */
export function evaluateWheel(config: WheelConfig): Evaluation {
  const segment = config.segments[randomInt(config.segments.length)] as WheelConfig['segments'][number];
  return {
    correct: null,
    finished: true,
    parcheScore: segment.score,
    xp: 0,
    headline: `Salió: ${segment.label}`,
    summary: segment.score > 0 ? `+${segment.score} al marcador del Parche` : 'Esta vez no suma al marcador',
    fact: null,
    outcome: { label: segment.label, challenge: segment.challenge ?? null },
  };
}

// ─────────────── Juegos de fiesta ───────────────

/**
 * Juegos de fiesta: el cliente recibe la configuración completa (textos, listas, aspecto) y juega sin enviar nada: no hay
 * resultado que decidir ni nada que acreditar (no puntúan, no dan XP y jamás Puntos ILC). El sorteo de retos lo hace el
 * dispositivo, porque no tiene consecuencias económicas.
 */
export function prepareParty(config: PartyConfig, manifest: GameManifest): Prepared {
  return { play: { kind: 'party', config }, state: {}, maxSeconds: manifest.scoring.maxSeconds };
}

// ─────────────── Capítulos (Ruta B) ───────────────

/** Primer capítulo que la persona aún no completó (los capítulos se desbloquean en orden). */
export function nextChapter(config: ChaptersConfig, completedIds: readonly string[]) {
  const done = new Set(completedIds);
  const index = config.chapters.findIndex((c) => !done.has(c.id));
  return index < 0 ? null : { index, chapter: config.chapters[index] as ChaptersConfig['chapters'][number] };
}

export function prepareChapters(config: ChaptersConfig, manifest: GameManifest, completedIds: readonly string[]): Prepared {
  const next = nextChapter(config, completedIds);
  if (!next) throw new DomainError('GAME_NOT_AVAILABLE', 'Ya completaste todos los capítulos.');
  const { chapter, index } = next;
  return {
    play: {
      kind: 'chapters',
      index,
      total: config.chapters.length,
      completedIds: [...completedIds],
      chapter: {
        id: chapter.id,
        title: chapter.title,
        icon: chapter.icon,
        story: chapter.story,
        xp: chapter.xp,
        question: { prompt: chapter.question.prompt, options: chapter.question.options },
      },
    },
    state: { chapterId: chapter.id, correctIndex: chapter.question.correctIndex },
    maxSeconds: Math.min(manifest.scoring.maxSeconds, 900),
  };
}

export function evaluateChapter(
  config: ChaptersConfig,
  state: Record<string, unknown>,
  submission: SubmitMission,
  completedIds: readonly string[],
): Evaluation {
  if (submission.choice === undefined) throw new DomainError('VALIDATION_FAILED', 'Elige una respuesta.');
  const chapter = config.chapters.find((c) => c.id === state.chapterId);
  if (!chapter) throw new DomainError('GAME_NOT_AVAILABLE', 'Este capítulo ya no está disponible.');
  if (submission.choice !== state.correctIndex) {
    return {
      correct: false,
      finished: false,
      parcheScore: 0,
      xp: 0,
      headline: 'Todavía no',
      summary: 'Esa no es la respuesta. Lee el relato otra vez y vuelve a intentarlo.',
      fact: null,
      outcome: null,
      chapterId: chapter.id,
    };
  }
  const remaining = config.chapters.filter((c) => c.id !== chapter.id && !completedIds.includes(c.id)).length;
  return {
    correct: true,
    finished: true,
    parcheScore: 0,
    xp: chapter.xp,
    headline: remaining === 0 ? '¡Completaste la ruta!' : `Capítulo completado: ${chapter.title}`,
    summary: remaining === 0 ? 'Terminaste todos los capítulos.' : `Te ${remaining === 1 ? 'queda 1 capítulo' : `quedan ${remaining} capítulos`}.`,
    fact: chapter.fact ?? null,
    outcome: null,
    chapterId: chapter.id,
  };
}
