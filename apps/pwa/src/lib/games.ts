import type { GameCatalog, MissionResult, MissionStart, StartMission, SubmitMission } from '@ilc/contracts';
import { DEMO } from '../demo/fixtures.ts';
import { apiRequest } from './api.ts';
import { data } from './data.ts';

/**
 * Cliente de juegos (Guía Técnica §5.4). El celular nunca decide el resultado: envía respuestas y el servidor
 * evalúa; en los módulos de proveedor el resultado llega por callback firmado y aquí solo se consulta.
 */
const realApi = {
  catalog: (ctx: { sessionId?: string; campaignSlug?: string }) => {
    const q = new URLSearchParams();
    if (ctx.sessionId) q.set('sessionId', ctx.sessionId);
    if (ctx.campaignSlug) q.set('campaignSlug', ctx.campaignSlug);
    return apiRequest<GameCatalog>(`/games${q.size ? `?${q}` : ''}`);
  },
  start: (body: StartMission, idempotencyKey: string) => apiRequest<MissionStart>('/games/start', { method: 'POST', body, idempotencyKey }),
  submit: (missionId: string, body: SubmitMission) => apiRequest<MissionResult>(`/missions/${encodeURIComponent(missionId)}/submit`, { method: 'POST', body }),
  mission: (missionId: string) => apiRequest<MissionResult>(`/missions/${encodeURIComponent(missionId)}`),
};

// ── Demostración (VITE_DEMO_DATA=true): datos de prueba en memoria, sin servidor ──
const DEMO_QUESTIONS = [
  { id: 'q1', prompt: '¿Qué ingrediente da origen al ron? (contenido de demostración)', options: ['La caña de azúcar', 'La papa', 'El maíz'] },
  { id: 'q2', prompt: '¿En qué se añeja? (contenido de demostración)', options: ['En barricas de roble', 'En vidrio', 'En plástico'] },
];
const demoResult = (missionId: string, over: Partial<MissionResult> = {}): MissionResult => ({
  missionId,
  status: 'VERIFICADA',
  preview: false,
  headline: '¡El Parche resolvió el origen!',
  summary: 'Resultado de demostración',
  correct: null,
  parcheScore: 20,
  xp: 0,
  pointsEarned: 0,
  badge: null,
  fact: null,
  outcome: null,
  hasNext: false,
  completedModule: false,
  ...over,
});

const demoApi: typeof realApi = {
  async catalog(): Promise<GameCatalog> {
    return {
      campaign: { slug: 'feria', title: DEMO.campaignLabel },
      games: [
        ...DEMO.quickGames.map((g) => ({
          moduleId: g.id,
          title: g.title,
          description: '',
          route: 'A' as const,
          icon: g.icon,
          minutes: g.minutes,
          players: { min: Number(g.players.split('-')[0]), max: Number(g.players.split('-')[1]) },
          kind: 'engine' as const,
          progress: null,
        })),
        ...DEMO.experiences.map((e) => ({
          moduleId: e.id,
          title: e.title,
          description: e.subtitle,
          route: 'B' as const,
          icon: 'explore',
          minutes: 10,
          players: { min: 1, max: 1 },
          kind: 'engine' as const,
          progress: 'progress' in e && e.progress ? e.progress : null,
        })),
      ],
    };
  },
  async start(body) {
    const base = { missionId: '00000000-0000-7000-8000-0000000000a1', moduleId: body.moduleId, preview: false, maxSeconds: 600 };
    if (body.moduleId === 'ruleta')
      return {
        ...base,
        title: 'La ruleta ILC',
        route: 'A',
        play: { kind: 'wheel', segments: [{ label: 'Dato curioso' }, { label: 'Brindis cultural' }, { label: 'Pasa turno' }] },
      };
    if (body.moduleId === 'explorador')
      return {
        ...base,
        title: 'El Explorador',
        route: 'B',
        play: {
          kind: 'chapters',
          index: 0,
          total: 2,
          completedIds: [],
          chapter: {
            id: 'c1',
            title: 'La caña',
            icon: 'grass',
            story: 'Contenido de demostración sobre el origen.',
            question: { prompt: '¿Qué se cosecha aquí?', options: ['Caña', 'Papa'] },
            xp: 40,
          },
        },
      };
    return { ...base, title: 'Trivia del origen', route: 'A', play: { kind: 'trivia', questions: DEMO_QUESTIONS, secondsPerQuestion: 30 } };
  },
  async submit(missionId) {
    return demoResult(missionId, { outcome: { label: 'Dato curioso', challenge: 'Cuenta un dato que conozcas del origen.' } });
  },
  async mission(missionId) {
    return demoResult(missionId);
  },
};

export const gamesApi = data.demo ? demoApi : realApi;
