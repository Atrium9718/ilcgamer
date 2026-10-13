import type { ContestScreen, ContestView, PublicEvent } from '@ilc/contracts';
import { type ContestDetail, ContestDetailView, type ContestPhaseView, ContestScreenView, type EventRow, EventsListView } from '@ilc/ui';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ApiRequestError } from '../lib/api.ts';
import { contestsApi, preparePhoto } from '../lib/contests.ts';
import { useSession } from '../lib/session.tsx';

const messageOf = (err: unknown) => (err instanceof ApiRequestError ? err.message : 'Ocurrió un error inesperado. Intenta de nuevo.');
const dayFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
const whenFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
const timeFmt = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

export function toEventRows(events: PublicEvent[]): EventRow[] {
  return events.map((e) => ({
    slug: e.slug,
    title: e.title,
    description: e.description,
    meta: `${e.city ? `${e.city} · ` : ''}${dayFmt.format(new Date(e.startsAt))} – ${dayFmt.format(new Date(e.endsAt))}`,
    contests: e.contests,
  }));
}

function phaseNote(c: ContestView): string {
  switch (c.phase) {
    case 'INSCRIPCION':
      return `Inscripciones hasta: ${whenFmt.format(new Date(c.uploadsCloseAt))} · La votación abre: ${whenFmt.format(new Date(c.votingOpensAt))}`;
    case 'ENTRE_FASES':
      return `La votación abre: ${whenFmt.format(new Date(c.votingOpensAt))}`;
    case 'VOTACION':
      return `Vota hasta: ${whenFmt.format(new Date(c.votingClosesAt))} · Un voto por persona`;
    case 'TERMINADO':
      return 'El concurso terminó.';
    default:
      return '';
  }
}

export function toContestDetail(c: ContestView): ContestDetail {
  return {
    title: c.title,
    eventTitle: c.eventTitle,
    description: c.description,
    prize: c.prize,
    prizeConditions: c.prizeConditions,
    phase: c.phase,
    phaseNote: phaseNote(c),
    guidelines: c.guidelines,
    entries: c.entries.map((e) => ({
      id: e.id,
      title: e.title,
      caption: e.caption,
      alias: e.alias,
      photoUrl: e.photoUrl,
      mine: e.mine,
      status: e.status,
      rejectionReason: e.rejectionReason,
    })),
    myEntry: c.myEntry && {
      id: c.myEntry.id,
      title: c.myEntry.title,
      caption: c.myEntry.caption,
      alias: c.myEntry.alias,
      photoUrl: c.myEntry.photoUrl,
      mine: true,
      status: c.myEntry.status,
      rejectionReason: c.myEntry.rejectionReason,
    },
    votedEntryId: c.votedEntryId,
    prizeCode: c.prizeCode,
    winner: c.winner && { title: c.winner.title, alias: c.winner.alias, photoUrl: c.winner.photoUrl },
  };
}

export function EventsRoute() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<PublicEvent[] | 'loading' | 'error'>('loading');
  const load = useCallback(() => {
    setEvents('loading');
    contestsApi.events().then(setEvents, () => setEvents('error'));
  }, []);
  useEffect(load, [load]);
  return (
    <EventsListView
      events={Array.isArray(events) ? toEventRows(events) : []}
      loading={events === 'loading'}
      error={events === 'error'}
      onOpenContest={(id) => navigate(`/concursos/${id}`)}
      onRetry={load}
      onBack={() => navigate('/jugar')}
    />
  );
}

export function ContestRoute() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { me } = useSession();
  const [contest, setContest] = useState<ContestView | 'loading' | 'error'>('loading');
  const [busy, setBusy] = useState<'entry' | 'vote' | 'withdraw'>();
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string }>();

  const load = useCallback(() => {
    contestsApi.contest(id).then(setContest, () => setContest('error'));
  }, [id]);
  useEffect(load, [load]);
  // Durante la votación se refresca solo para ver el estado de la propia inscripción y del resultado.
  useEffect(() => {
    if (typeof contest === 'string' || contest.phase === 'TERMINADO') return;
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [contest, load]);

  const run = async (kind: 'entry' | 'vote' | 'withdraw', action: () => Promise<ContestView | undefined>, ok: string) => {
    setBusy(kind);
    setMessage(undefined);
    try {
      const next = await action();
      if (next) setContest(next);
      else load();
      setMessage({ kind: 'success', text: ok });
    } catch (err) {
      setMessage({ kind: 'error', text: messageOf(err) });
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <ContestDetailView
      contest={typeof contest === 'string' ? undefined : toContestDetail(contest)}
      loading={contest === 'loading'}
      error={contest === 'error'}
      hasAccount={me?.status === 'ACTIVA'}
      busy={busy}
      message={message}
      onSubmitEntry={(v) =>
        void run(
          'entry',
          async () => {
            await contestsApi.saveEntry(id, { title: v.title, caption: v.caption, consentDisplay: true });
            return v.file ? contestsApi.uploadPhoto(id, await preparePhoto(v.file)) : contestsApi.contest(id);
          },
          'Listo: tu disfraz quedó en revisión. Te mostraremos aquí cuando se apruebe.',
        )
      }
      onVote={(entryId) => void run('vote', () => contestsApi.vote(id, entryId), '¡Voto registrado!')}
      onWithdraw={() => void run('withdraw', async () => (await contestsApi.withdraw(id), undefined), 'Retiraste tu inscripción.')}
      onSaveAccount={() => navigate('/registro')}
      onRetry={load}
      onBack={() => navigate('/eventos')}
    />
  );
}

/** Pantalla del evento (se proyecta): sin sesión ni control de edad; se actualiza sola cada 4 s. */
export function ContestScreenRoute() {
  const { token = '' } = useParams();
  // La pantalla del evento siempre es oscura (proyector): ignora el tema que haya elegido la persona o la campaña.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    delete root.dataset.theme;
    return () => {
      if (previous) root.dataset.theme = previous;
    };
  }, []);
  const [screen, setScreen] = useState<ContestScreen>();
  const [state, setState] = useState<'loading' | 'ok' | 'gone' | 'offline'>('loading');
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const tick = () =>
      contestsApi.screen(token, ctrl.signal).then(
        (s) => {
          setScreen(s);
          setState('ok');
        },
        (err) => {
          if (ctrl.signal.aborted) return;
          setState(err instanceof ApiRequestError && err.code === 'NOT_FOUND' ? 'gone' : 'offline');
        },
      );
    void tick();
    const t = setInterval(() => void tick(), 4000);
    return () => {
      ctrl.abort();
      clearInterval(t);
    };
  }, [token]);

  const votePath = screen?.votePath;
  useEffect(() => {
    if (votePath) void QRCode.toDataURL(`${window.location.origin}${votePath}`, { margin: 1, width: 288 }).then(setQr);
  }, [votePath]);

  if (state === 'gone')
    return (
      <main className="min-h-dvh flex items-center justify-center bg-surface text-on-surface p-8 text-center">
        <p className="font-headline-md text-[28px]">Esta pantalla ya no está disponible.</p>
      </main>
    );
  if (!screen)
    return (
      <main className="min-h-dvh flex items-center justify-center bg-surface text-on-surface p-8 text-center">
        <p role="status" className="font-headline-md text-[28px]">
          {state === 'offline' ? 'Reconectando…' : 'Cargando…'}
        </p>
      </main>
    );
  const phase: ContestPhaseView = screen.phase;
  return (
    <ContestScreenView
      title={screen.title}
      eventTitle={screen.eventTitle}
      prize={screen.prize}
      phase={phase}
      closesLabel={`La votación cierra a las ${timeFmt.format(new Date(screen.votingClosesAt))}`}
      totalVotes={screen.totalVotes}
      entries={screen.entries}
      winner={screen.winner}
      voteAddress={`${window.location.host}${screen.votePath}`}
      qrDataUrl={qr}
      offline={state === 'offline'}
    />
  );
}
