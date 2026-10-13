import type { GameCatalog, MissionResult, MissionStart } from '@ilc/contracts';
import {
  type Chapter,
  ChapterPlayView,
  type Experience,
  GameResultView,
  GamesCatalogView,
  IframeGameView,
  PartyGameView,
  PlayerDataGateView,
  type QuickGame,
  type ResultState,
  StatusMessage,
  TriviaPlayView,
  WheelPlayView,
} from '@ilc/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiRequestError, newIdempotencyKey } from '../lib/api.ts';
import { GameFrame } from '../lib/gameFrame.tsx';
import { gamesApi } from '../lib/games.ts';
import { identityApi } from '../lib/identity.ts';
import { useSession } from '../lib/session.tsx';
import { KEYS, writeLocal } from '../lib/storage.ts';
import { useTabNavigate } from './shell.tsx';

/** Contexto de juego: el Parche (`?parche=`) o la campaña del evento (`?evento=`). Nunca ambos. */
function useGameContext() {
  const [params] = useSearchParams();
  const sessionId = params.get('parche') ?? undefined;
  const campaignSlug = sessionId ? undefined : (params.get('evento') ?? undefined);
  const search = sessionId ? `?parche=${encodeURIComponent(sessionId)}` : campaignSlug ? `?evento=${encodeURIComponent(campaignSlug)}` : '';
  return { sessionId, campaignSlug, search };
}

const messageOf = (err: unknown) => (err instanceof ApiRequestError ? err.message : 'Ocurrió un error inesperado.');

export function GamesRoute() {
  const navigate = useNavigate();
  const onNavigate = useTabNavigate();
  const { sessionId, campaignSlug, search } = useGameContext();
  const [catalog, setCatalog] = useState<GameCatalog>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    gamesApi.catalog({ sessionId, campaignSlug }).then(setCatalog, (e) => setError(messageOf(e)));
  }, [sessionId, campaignSlug]);

  if (error) return <StatusMessage kind="error" title="No pudimos cargar los juegos" body={error} />;
  if (!catalog) return <StatusMessage kind="pending" title="Cargando juegos…" />;

  const quickGames: QuickGame[] = catalog.games
    .filter((g) => g.route === 'A')
    .map((g) => ({ id: g.moduleId, title: g.title, icon: g.icon, minutes: g.minutes, players: `${g.players.min}-${g.players.max}` }));
  const experiences: Experience[] = catalog.games
    .filter((g) => g.route === 'B')
    .map((g) => ({
      id: g.moduleId,
      title: g.title,
      subtitle: g.description,
      progress: g.progress ?? undefined,
      tag: g.progress && g.progress.current > 0 ? 'En progreso' : undefined,
    }));
  const play = (id: string) => navigate(`/jugar/${encodeURIComponent(id)}/partida${search}`);
  return (
    <GamesCatalogView
      campaignLabel={catalog.campaign?.title}
      quickGames={quickGames}
      experiences={experiences}
      onSelectGame={play}
      onSelectExperience={play}
      onOpenEvents={() => navigate('/eventos')}
      onNavigate={onNavigate}
    />
  );
}

/** Partida: inicia la misión en el servidor y muestra el motor que corresponda. El servidor decide todo resultado. */
export function GamePlayRoute() {
  const { gameId = '' } = useParams();
  const navigate = useNavigate();
  const { sessionId, campaignSlug, search } = useGameContext();
  const [mission, setMission] = useState<MissionStart>();
  const [error, setError] = useState<string>();
  const [need, setNeed] = useState<'account' | 'marketing'>();
  const [gateBusy, setGateBusy] = useState(false);
  const { me, setMe, config } = useSession();
  const key = useRef(newIdempotencyKey());

  const start = useCallback(async () => {
    try {
      setMission(await gamesApi.start({ moduleId: gameId, sessionId, campaignSlug }, key.current));
    } catch (e) {
      // Juegos que exigen datos: el servidor dice qué falta (cuenta o autorización de novedades).
      if (e instanceof ApiRequestError && e.code === 'CONSENT_REQUIRED') {
        setNeed(e.fields?.need?.includes('account') ? 'account' : 'marketing');
        return;
      }
      setError(messageOf(e));
    }
  }, [gameId, sessionId, campaignSlug]);

  useEffect(() => {
    void start();
  }, [start]);

  const exit = () => navigate(`/jugar${search}`);
  const finish = (missionId: string) => navigate(`/jugar/${encodeURIComponent(gameId)}/resultado?m=${missionId}${search ? `&${search.slice(1)}` : ''}`);

  if (need)
    return (
      <PlayerDataGateView
        gameTitle="El Impostor"
        need={need}
        busy={gateBusy}
        error={error}
        privacyHref="/legal/privacidad"
        onPrivacy={() => navigate('/legal/privacidad')}
        onBack={exit}
        onSaveAccount={() => {
          // Al terminar el registro vuelve a este juego.
          writeLocal(KEYS.afterSignup, `/jugar/${encodeURIComponent(gameId)}${search}`, 'session');
          navigate('/registro');
        }}
        onAccept={() => {
          void (async () => {
            setGateBusy(true);
            setError(undefined);
            try {
              const consents = await identityApi.recordConsent({
                purpose: 'MARKETING',
                granted: true,
                noticeVersion: config.legalNoticeVersion,
                source: 'campana',
              });
              if (me) setMe({ ...me, consents });
              setNeed(undefined);
              key.current = newIdempotencyKey();
              await start();
            } catch (e) {
              setError(messageOf(e));
            } finally {
              setGateBusy(false);
            }
          })();
        }}
      />
    );
  if (error) return <StatusMessage kind="error" title="No pudimos iniciar el juego" body={error} />;
  if (!mission) return <StatusMessage kind="pending" title="Preparando tu partida…" />;

  const { play } = mission;
  if (play.kind === 'trivia')
    return <TriviaFlow mission={mission} questions={play.questions} secondsPerQuestion={play.secondsPerQuestion} onDone={finish} onClose={exit} />;
  if (play.kind === 'wheel') return <WheelFlow mission={mission} segments={play.segments.map((s) => s.label)} onDone={finish} onClose={exit} />;
  if (play.kind === 'chapters') {
    return (
      <ChapterFlow
        mission={mission}
        onNext={() => {
          key.current = newIdempotencyKey();
          setMission(undefined);
          void start();
        }}
        onDone={finish}
        onClose={exit}
      />
    );
  }
  // Juegos de fiesta: se juegan en el dispositivo con la configuración que define Marca; no envían resultado ni acreditan nada.
  if (play.kind === 'party') return <PartyGameView config={play.config} onExit={exit} />;
  return <ProviderFlow mission={mission} entryUrl={play.entryUrl} allowedOrigin={play.allowedOrigin} onDone={finish} onClose={exit} />;
}

function TriviaFlow({
  mission,
  questions,
  secondsPerQuestion,
  onDone,
  onClose,
}: {
  mission: MissionStart;
  questions: Array<{ id: string; prompt: string; options: string[] }>;
  secondsPerQuestion: number;
  onDone: (missionId: string) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Array<{ questionId: string; choice: number }>>([]);
  const [left, setLeft] = useState(secondsPerQuestion);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const q = questions[index];

  const advance = useCallback(
    async (choice: number | null) => {
      if (!q) return;
      // Sin respuesta (se acabó el tiempo): la pregunta queda sin contestar; el tiempo es un tope, no un premio.
      const next = choice === null ? answers : [...answers, { questionId: q.id, choice }];
      setAnswers(next);
      if (index < questions.length - 1) {
        setIndex(index + 1);
        setSelected(null);
        setLeft(secondsPerQuestion);
        return;
      }
      setSubmitting(true);
      setError(undefined);
      try {
        await gamesApi.submit(mission.missionId, { answers: next });
        onDone(mission.missionId);
      } catch (e) {
        setError(messageOf(e));
        setSubmitting(false);
      }
    },
    [q, answers, index, questions.length, secondsPerQuestion, mission.missionId, onDone],
  );

  useEffect(() => {
    if (submitting) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [submitting]);
  useEffect(() => {
    if (left === 0 && !submitting) void advance(selected);
  }, [left, submitting, selected, advance]);

  if (!q) return <StatusMessage kind="error" title="Esta partida no tiene preguntas" />;
  return (
    <TriviaPlayView
      title={mission.title}
      index={index}
      total={questions.length}
      prompt={q.prompt}
      options={q.options}
      selected={selected}
      secondsLeft={left}
      submitting={submitting}
      error={error}
      onSelect={setSelected}
      onNext={() => void advance(selected)}
      onClose={onClose}
    />
  );
}

function WheelFlow({ mission, segments, onDone, onClose }: { mission: MissionStart; segments: string[]; onDone: (id: string) => void; onClose: () => void }) {
  const [phase, setPhase] = useState<'ready' | 'spinning' | 'done'>('ready');
  const [outcome, setOutcome] = useState<MissionResult['outcome']>();
  const [error, setError] = useState<string>();
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const spin = async () => {
    setPhase('spinning');
    setError(undefined);
    try {
      const [result] = await Promise.all([gamesApi.submit(mission.missionId, {}), new Promise((r) => setTimeout(r, reduced ? 0 : 1200))]);
      setOutcome(result.outcome);
      setPhase('done');
    } catch (e) {
      setError(messageOf(e));
      setPhase('ready');
    }
  };
  return (
    <WheelPlayView
      title={mission.title}
      segments={segments}
      phase={phase}
      outcome={outcome ?? undefined}
      reducedMotion={reduced}
      error={error}
      onSpin={() => void spin()}
      onFinish={() => onDone(mission.missionId)}
      onClose={onClose}
    />
  );
}

function ChapterFlow({ mission, onNext, onDone, onClose }: { mission: MissionStart; onNext: () => void; onDone: (id: string) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [retry, setRetry] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  if (mission.play.kind !== 'chapters') return null;
  const { index, total, chapter, completedIds } = mission.play;
  const chapters: Chapter[] = Array.from({ length: total }, (_, i) => ({
    id: i === index ? chapter.id : (completedIds[i] ?? `pendiente-${i}`),
    title: i === index ? chapter.title : `Capítulo ${i + 1}`,
    icon: i === index ? chapter.icon : i < index ? 'check_circle' : 'lock',
    state: i < index ? 'done' : i === index ? 'current' : 'locked',
  }));
  const submit = async () => {
    if (selected === null) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const result = await gamesApi.submit(mission.missionId, { choice: selected });
      if (result.correct === false) {
        setRetry(true);
        setSelected(null);
      } else if (result.hasNext && !result.completedModule) onNext();
      else onDone(mission.missionId);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <ChapterPlayView
      title={mission.title}
      chapters={chapters}
      chapterTitle={chapter.title}
      chapterIcon={chapter.icon}
      story={chapter.story}
      question={chapter.question.prompt}
      options={chapter.question.options}
      xp={chapter.xp}
      selected={selected}
      retry={retry}
      submitting={submitting}
      error={error}
      onSelect={setSelected}
      onSubmit={() => void submit()}
      onClose={onClose}
    />
  );
}

function ProviderFlow({
  mission,
  entryUrl,
  allowedOrigin,
  onDone,
  onClose,
}: {
  mission: MissionStart;
  entryUrl: string;
  allowedOrigin: string;
  onDone: (id: string) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<'loading' | 'playing' | 'verifying' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const finished = useRef(false);
  return (
    <IframeGameView
      title={mission.title}
      status={status}
      error={error}
      onClose={onClose}
      frame={
        <GameFrame
          entryUrl={entryUrl}
          allowedOrigin={allowedOrigin}
          missionId={mission.missionId}
          permissions={[]}
          onReady={() => setStatus('playing')}
          onFinish={() => {
            // El módulo avisa que terminó pero NO informa puntajes: el servidor del proveedor los confirma por callback firmado.
            if (finished.current) return;
            finished.current = true;
            setStatus('verifying');
            onDone(mission.missionId);
          }}
          onError={(m) => {
            setError(m);
            setStatus('error');
          }}
        />
      }
    />
  );
}

const TERMINAL = new Set(['VERIFICADA', 'RECHAZADA', 'ABANDONADA']);

const toVerified = (r: MissionResult) => ({
  headline: r.headline,
  summary: r.outcome ? `${r.summary} · ${r.outcome.label}` : r.summary,
  xpEarned: r.xp,
  badgeName: r.badge?.name,
  pointsEarned: r.pointsEarned,
  pointsNote: r.preview ? 'Partida de prueba: no otorga nada.' : 'Jugar no otorga Puntos ILC: solo se ganan al activar un código de botella.',
  fact: r.fact ?? undefined,
});

/** Resultado: "verificando" hasta que el servidor confirma (en módulos de proveedor puede tardar), y solo entonces se muestra. */
export function GameResultRoute() {
  const { gameId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { config } = useSession();
  const { search } = useGameContext();
  const missionId = params.get('m') ?? '';
  const [state, setState] = useState<ResultState>({ status: 'verifying' });
  const [attempt, setAttempt] = useState(0);
  const [title, setTitle] = useState('Resultado');

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` reinicia la consulta al pulsar "Reintentar"
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const poll = async () => {
      try {
        const r = await gamesApi.mission(missionId);
        if (cancelled) return;
        if (TERMINAL.has(r.status)) {
          setTitle(r.headline);
          setState(r.status === 'VERIFICADA' ? { status: 'verified', result: toVerified(r) } : { status: 'error' });
          return;
        }
      } catch {
        if (cancelled) return;
        if (++tries > 3) return setState({ status: 'error' });
      }
      if (++tries > 40) return setState({ status: 'error' });
      setTimeout(poll, 1500);
    };
    setState({ status: 'verifying' });
    void poll();
    return () => {
      cancelled = true;
    };
  }, [missionId, attempt]);

  const sessionId = new URLSearchParams(search).get('parche');
  return (
    <GameResultView
      gameTitle={title}
      state={state}
      currencyName={config.currencyName}
      onClose={() => navigate(`/jugar${search}`)}
      onBackToParche={() => navigate(sessionId ? `/parche/${sessionId}` : `/jugar${search}`)}
      onShare={() => navigate('/compartir')}
      onPlayAgain={() => navigate(`/jugar/${encodeURIComponent(gameId)}/partida${search}`)}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}
