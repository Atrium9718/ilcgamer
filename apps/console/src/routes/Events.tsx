import type { ContestAdminView, EventAdminView } from '@ilc/contracts';
import { type AdminContestDetail, type AdminEventRow, EventsAdminView, type NewContestValue, type NewEventValue } from '@ilc/ui';
import { useCallback, useEffect, useState } from 'react';
import { eventsAdminApi } from '../lib/adminApi.ts';
import { ApiRequestError } from '../lib/api.ts';
import { errorMessage } from '../lib/session.tsx';

const PWA_URL = (import.meta.env.VITE_PWA_URL as string | undefined) ?? 'http://localhost:5173';
const dayFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
const whenFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
/** `datetime-local` entrega hora local sin zona; la API recibe ISO (UTC). */
const toIso = (local: string): string => (local ? new Date(local).toISOString() : '');

export const toEventRow = (e: EventAdminView): AdminEventRow => ({
  id: e.id,
  slug: e.slug,
  title: e.title,
  city: e.city,
  status: e.status,
  periodLabel: `${dayFmt.format(new Date(e.startsAt))} – ${dayFmt.format(new Date(e.endsAt))}`,
  contests: e.contests.map((c) => ({
    id: c.id,
    title: c.title,
    prize: c.prize,
    status: c.status,
    phase: c.phase,
    entries: c.entries,
    pending: c.pending,
    votes: c.votes,
  })),
});

export const toContestDetail = (c: ContestAdminView): AdminContestDetail => ({
  id: c.id,
  title: c.title,
  eventTitle: c.eventTitle,
  prize: c.prize,
  status: c.status,
  phase: c.phase,
  datesLabel: `Inscripción hasta ${whenFmt.format(new Date(c.uploadsCloseAt))} · Votación ${whenFmt.format(new Date(c.votingOpensAt))} a ${whenFmt.format(new Date(c.votingClosesAt))}`,
  screenUrl: `${PWA_URL}${c.screenPath}`,
  entries: c.entriesList.map((e) => ({
    id: e.id,
    alias: e.alias,
    title: e.title,
    caption: e.caption,
    status: e.status,
    rejectionReason: e.rejectionReason,
    hasPhoto: e.hasPhoto,
    votes: e.votes,
    photoUrl: e.hasPhoto ? `/api/v1/admin/contests/${c.id}/entries/${e.id}/photo` : null,
  })),
  winner: c.winner && { alias: c.winner.alias, title: c.winner.title, votes: c.winner.votes, delivered: !!c.winner.deliveredAt },
});

/** Contenedor de Eventos: conecta la vista pura con /admin/events y /admin/contests. */
export function Events() {
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [selected, setSelected] = useState<AdminContestDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const reload = useCallback(async (contestId?: string) => {
    const [list, detail] = await Promise.all([eventsAdminApi.list(), contestId ? eventsAdminApi.contest(contestId) : Promise.resolve(undefined)]);
    setEvents(list.map(toEventRow));
    if (detail) setSelected(toContestDetail(detail));
  }, []);

  useEffect(() => {
    reload()
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [reload]);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string, contestId?: string) => {
    setBusy(key);
    setNotice(undefined);
    setFieldErrors({});
    try {
      await fn();
      await reload(contestId ?? selected?.id);
      setNotice(ok);
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setFieldErrors(err.fields);
      setNotice(errorMessage(err));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <EventsAdminView
      events={events}
      selected={selected}
      loading={loading}
      error={error}
      notice={notice}
      busy={busy}
      fieldErrors={fieldErrors}
      onCreateEvent={(v: NewEventValue) =>
        void act(
          'event',
          () =>
            eventsAdminApi.create({
              slug: v.slug.trim(),
              title: v.title.trim(),
              description: '',
              city: v.city.trim(),
              startsAt: toIso(v.startsAt),
              endsAt: toIso(v.endsAt),
            }),
          'Evento creado como borrador. Publícalo cuando esté listo.',
        )
      }
      onEventStatus={(id, status) =>
        void act(`pub-${id}`, () => eventsAdminApi.setStatus(id, status), status === 'PUBLICADO' ? 'Evento publicado.' : 'Evento cerrado.')
      }
      onCreateContest={(eventId, v: NewContestValue) =>
        void act(
          'contest',
          () =>
            eventsAdminApi.createContest(eventId, {
              slug: v.slug.trim(),
              kind: 'DISFRACES',
              title: v.title.trim(),
              description: '',
              prize: v.prize.trim(),
              prizeConditions: v.prizeConditions.trim(),
              uploadsCloseAt: toIso(v.uploadsCloseAt),
              votingOpensAt: toIso(v.votingOpensAt),
              votingClosesAt: toIso(v.votingClosesAt),
            }),
          'Concurso creado. Otra persona de Marca debe abrirlo.',
        )
      }
      onSelectContest={(id) => void act('select', () => Promise.resolve(), '', id)}
      onOpenContest={(id) => void act('open', () => eventsAdminApi.open(id), 'Concurso abierto: ya lo ven las personas.', id)}
      onCloseContest={(id) => void act('close', () => eventsAdminApi.close(id), 'Concurso cerrado y ganador declarado.', id)}
      onModerate={(id, entryId, decision, reason) =>
        void act(
          `mod-${entryId}`,
          () => eventsAdminApi.moderate(id, entryId, decision, reason),
          decision === 'APROBADA' ? 'Inscripción aprobada.' : 'Inscripción rechazada.',
          id,
        )
      }
      onRotateScreen={(id) => void act('rotate', () => eventsAdminApi.rotateScreen(id), 'Enlace de pantalla nuevo. El anterior ya no funciona.', id)}
      onCopy={(text) => void navigator.clipboard?.writeText(text).then(() => setNotice('Enlace copiado.'))}
      onDeliverPrize={(id, code) => void act('deliver', () => eventsAdminApi.deliverPrize(id, code), 'Entrega del premio registrada.', id)}
      onRetry={() => {
        setError(false);
        setLoading(true);
        reload()
          .catch(() => setError(true))
          .finally(() => setLoading(false));
      }}
    />
  );
}
