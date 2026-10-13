import { useState } from 'react';
import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { TextField } from '../components/TextField.tsx';
import { cx } from '../lib/cx.ts';
import { formatNumber } from '../lib/format.ts';
import { type ContestPhaseView, phaseLabel } from '../views/ContestViews.tsx';

export interface AdminContestSummaryRow {
  id: string;
  title: string;
  prize: string;
  status: 'BORRADOR' | 'ABIERTO' | 'CERRADO';
  phase: ContestPhaseView;
  entries: number;
  pending: number;
  votes: number;
}

export interface AdminEventRow {
  id: string;
  slug: string;
  title: string;
  city: string;
  status: 'BORRADOR' | 'PUBLICADO' | 'CERRADO';
  /** Ya formateado: "12 ene – 15 ene" */
  periodLabel: string;
  contests: AdminContestSummaryRow[];
}

export interface AdminEntryRow {
  id: string;
  alias: string;
  title: string;
  caption: string;
  status: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  rejectionReason: string | null;
  hasPhoto: boolean;
  votes: number;
  photoUrl: string | null;
}

export interface AdminContestDetail {
  id: string;
  title: string;
  eventTitle: string;
  prize: string;
  status: 'BORRADOR' | 'ABIERTO' | 'CERRADO';
  phase: ContestPhaseView;
  /** Ya formateado con las fechas del concurso. */
  datesLabel: string;
  /** Enlace completo de la pantalla pública (secreto: quien lo tiene la ve). */
  screenUrl: string;
  entries: AdminEntryRow[];
  winner: { alias: string; title: string; votes: number; delivered: boolean } | null;
}

export interface NewEventValue {
  slug: string;
  title: string;
  city: string;
  startsAt: string;
  endsAt: string;
}
export interface NewContestValue {
  slug: string;
  title: string;
  prize: string;
  prizeConditions: string;
  uploadsCloseAt: string;
  votingOpensAt: string;
  votingClosesAt: string;
}

export interface EventsAdminViewProps {
  events: AdminEventRow[];
  selected?: AdminContestDetail;
  loading?: boolean;
  error?: boolean;
  notice?: string;
  busy?: string;
  fieldErrors?: Record<string, string[]>;
  onCreateEvent: (value: NewEventValue) => void;
  onEventStatus: (eventId: string, status: 'PUBLICADO' | 'CERRADO') => void;
  onCreateContest: (eventId: string, value: NewContestValue) => void;
  onSelectContest: (contestId: string) => void;
  onOpenContest: (contestId: string) => void;
  onCloseContest: (contestId: string) => void;
  onModerate: (contestId: string, entryId: string, decision: 'APROBADA' | 'RECHAZADA', reason?: string) => void;
  onRotateScreen: (contestId: string) => void;
  onCopy: (text: string) => void;
  onDeliverPrize: (contestId: string, code: string) => void;
  onRetry: () => void;
}

const STATUS_TONE: Record<string, string> = {
  BORRADOR: 'bg-surface-container-high text-on-surface-variant',
  PUBLICADO: 'bg-secondary-container text-on-secondary-container',
  ABIERTO: 'bg-secondary-container text-on-secondary-container',
  CERRADO: 'bg-surface-container-high text-on-surface-variant',
  PENDIENTE: 'bg-tertiary-container text-on-tertiary-container',
  APROBADA: 'bg-secondary-container text-on-secondary-container',
  RECHAZADA: 'bg-error-container text-on-error-container',
};
const chip = (s: string) => cx('rounded-full px-3 py-1 font-label-sm text-[11px]', STATUS_TONE[s]);
const firstError = (e: Record<string, string[]> | undefined, k: string) => e?.[k]?.[0];

const EMPTY_EVENT: NewEventValue = { slug: '', title: '', city: '', startsAt: '', endsAt: '' };
const EMPTY_CONTEST: NewContestValue = { slug: '', title: '', prize: '', prizeConditions: '', uploadsCloseAt: '', votingOpensAt: '', votingClosesAt: '' };

/**
 * Vista pura de la consola: eventos y concursos. Marca crea y modera (toda foto se revisa antes de mostrarse), abre el concurso
 * (otra persona distinta a quien lo creó), cierra, y registra la entrega del premio con el código del ganador.
 */
export function EventsAdminView(p: EventsAdminViewProps) {
  const [newEvent, setNewEvent] = useState<NewEventValue>(EMPTY_EVENT);
  const [contestFor, setContestFor] = useState<string>();
  const [newContest, setNewContest] = useState<NewContestValue>(EMPTY_CONTEST);
  const [rejecting, setRejecting] = useState<string>();
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const sel = p.selected;

  return (
    <div className="p-8 space-y-8 max-w-6xl">
      <header>
        <h1 className="font-headline-lg text-[28px] leading-8 text-on-surface">Eventos y concursos</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Concurso de disfraces con fotos moderadas, votación y pantalla para proyectar. No otorga Puntos ILC ni XP.
        </p>
      </header>

      <div aria-live="polite">
        {p.notice && (
          <p role="status" className="rounded-xl bg-secondary-container text-on-secondary-container px-4 py-3 font-body-md text-body-md">
            {p.notice}
          </p>
        )}
      </div>
      {p.loading && <StatusMessage kind="pending" title="Cargando eventos…" />}
      {p.error && <StatusMessage kind="error" title="No pudimos cargar los eventos" action={<Button onClick={p.onRetry}>Reintentar</Button>} />}

      <details className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
        <summary className="cursor-pointer font-label-lg text-label-lg text-on-surface min-h-12 flex items-center">Crear un evento</summary>
        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            p.onCreateEvent(newEvent);
            setNewEvent(EMPTY_EVENT);
          }}
        >
          <TextField
            label="Identificador (sin espacios)"
            value={newEvent.slug}
            onChange={(v) => setNewEvent({ ...newEvent, slug: v })}
            error={firstError(p.fieldErrors, 'slug')}
            hint="Ej.: feria-manizales-2027"
          />
          <TextField
            label="Nombre del evento"
            value={newEvent.title}
            onChange={(v) => setNewEvent({ ...newEvent, title: v })}
            error={firstError(p.fieldErrors, 'title')}
          />
          <TextField label="Ciudad" value={newEvent.city} onChange={(v) => setNewEvent({ ...newEvent, city: v })} />
          <span />
          <TextField
            label="Empieza"
            type="datetime-local"
            value={newEvent.startsAt}
            onChange={(v) => setNewEvent({ ...newEvent, startsAt: v })}
            error={firstError(p.fieldErrors, 'startsAt')}
          />
          <TextField
            label="Termina"
            type="datetime-local"
            value={newEvent.endsAt}
            onChange={(v) => setNewEvent({ ...newEvent, endsAt: v })}
            error={firstError(p.fieldErrors, 'endsAt')}
          />
          <div>
            <Button type="submit" loading={p.busy === 'event'}>
              Crear evento
            </Button>
          </div>
        </form>
      </details>

      {p.events.length === 0 && !p.loading && !p.error && (
        <StatusMessage kind="empty" title="Aún no hay eventos" body="Crea el primero para agregar un concurso." />
      )}

      {p.events.map((ev) => (
        <section key={ev.id} aria-labelledby={`ev-${ev.id}`} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id={`ev-${ev.id}`} className="font-headline-md text-headline-md text-on-surface">
                {ev.title}
              </h2>
              <p className="font-body-md text-[13px] text-on-surface-variant">
                {ev.city ? `${ev.city} · ` : ''}
                {ev.periodLabel}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={chip(ev.status)}>{ev.status === 'BORRADOR' ? 'Borrador' : ev.status === 'PUBLICADO' ? 'Publicado' : 'Cerrado'}</span>
              {ev.status === 'BORRADOR' && (
                <Button variant="secondary" onClick={() => p.onEventStatus(ev.id, 'PUBLICADO')} loading={p.busy === `pub-${ev.id}`}>
                  Publicar
                </Button>
              )}
              {ev.status === 'PUBLICADO' && (
                <Button variant="secondary" onClick={() => p.onEventStatus(ev.id, 'CERRADO')}>
                  Cerrar evento
                </Button>
              )}
            </div>
          </div>

          <ul className="divide-y divide-outline-variant">
            {ev.contests.map((c) => (
              <li key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-label-lg text-label-lg text-on-surface">{c.title}</p>
                  <p className="font-body-md text-[13px] text-on-surface-variant">
                    Premio: {c.prize} · {formatNumber(c.entries)} inscritos ({formatNumber(c.pending)} por revisar) · {formatNumber(c.votes)} votos
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={chip(c.status)}>{c.status === 'BORRADOR' ? 'Sin abrir' : c.status === 'ABIERTO' ? phaseLabel(c.phase) : 'Cerrado'}</span>
                  <Button variant="secondary" onClick={() => p.onSelectContest(c.id)}>
                    Gestionar
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {ev.status !== 'CERRADO' &&
            (contestFor === ev.id ? (
              <form
                className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl bg-surface-container-low p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  p.onCreateContest(ev.id, newContest);
                  setNewContest(EMPTY_CONTEST);
                  setContestFor(undefined);
                }}
              >
                <TextField
                  label="Identificador del concurso"
                  value={newContest.slug}
                  onChange={(v) => setNewContest({ ...newContest, slug: v })}
                  error={firstError(p.fieldErrors, 'slug')}
                  hint="Ej.: disfraces"
                />
                <TextField
                  label="Nombre del concurso"
                  value={newContest.title}
                  onChange={(v) => setNewContest({ ...newContest, title: v })}
                  error={firstError(p.fieldErrors, 'title')}
                />
                <TextField
                  label="Premio"
                  value={newContest.prize}
                  onChange={(v) => setNewContest({ ...newContest, prize: v })}
                  error={firstError(p.fieldErrors, 'prize')}
                  hint="Ej.: Palco para la feria"
                />
                <TextField
                  label="Condiciones del premio"
                  value={newContest.prizeConditions}
                  onChange={(v) => setNewContest({ ...newContest, prizeConditions: v })}
                />
                <TextField
                  label="Inscripción cierra"
                  type="datetime-local"
                  value={newContest.uploadsCloseAt}
                  onChange={(v) => setNewContest({ ...newContest, uploadsCloseAt: v })}
                  error={firstError(p.fieldErrors, 'uploadsCloseAt')}
                />
                <TextField
                  label="Votación abre"
                  type="datetime-local"
                  value={newContest.votingOpensAt}
                  onChange={(v) => setNewContest({ ...newContest, votingOpensAt: v })}
                  error={firstError(p.fieldErrors, 'votingOpensAt')}
                />
                <TextField
                  label="Votación cierra"
                  type="datetime-local"
                  value={newContest.votingClosesAt}
                  onChange={(v) => setNewContest({ ...newContest, votingClosesAt: v })}
                  error={firstError(p.fieldErrors, 'votingClosesAt')}
                />
                <div className="flex gap-3 items-end">
                  <Button type="submit" loading={p.busy === 'contest'}>
                    Crear concurso
                  </Button>
                  <Button type="button" variant="text" onClick={() => setContestFor(undefined)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <Button variant="secondary" leadingIcon="add" onClick={() => setContestFor(ev.id)}>
                Agregar concurso de disfraces
              </Button>
            ))}
        </section>
      ))}

      {sel && (
        <section aria-labelledby="gestion" className="rounded-2xl border-2 border-primary/40 bg-surface-container-lowest p-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="gestion" className="font-headline-md text-headline-md text-on-surface">
                {sel.title} · {sel.eventTitle}
              </h2>
              <p className="font-body-md text-[13px] text-on-surface-variant">
                Premio: {sel.prize} · {sel.datesLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {sel.status === 'BORRADOR' && <Button onClick={() => p.onOpenContest(sel.id)}>Abrir concurso</Button>}
              {sel.status === 'ABIERTO' && sel.phase === 'TERMINADO' && <Button onClick={() => p.onCloseContest(sel.id)}>Cerrar y declarar ganador</Button>}
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-low p-4 space-y-2">
            <p className="font-label-lg text-label-lg text-on-surface flex items-center gap-2">
              <Icon name="cast" className="text-[20px]" /> Pantalla del evento
            </p>
            <p className="font-body-md text-[13px] text-on-surface-variant">
              Abre este enlace en la pantalla o el proyector. Es secreto: quien lo tenga ve el ranking en vivo. Si se filtra, genera uno nuevo.
            </p>
            <p className="font-body-md text-body-md break-all text-on-surface">{sel.screenUrl}</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" leadingIcon="content_copy" onClick={() => p.onCopy(sel.screenUrl)}>
                Copiar enlace
              </Button>
              <Button variant="secondary" onClick={() => p.onRotateScreen(sel.id)}>
                Generar enlace nuevo
              </Button>
            </div>
          </div>

          {sel.winner && (
            <div className="rounded-xl border border-outline-variant p-4 space-y-3">
              <p className="font-label-lg text-label-lg text-on-surface">
                Ganador: «{sel.winner.title}» de {sel.winner.alias} · {formatNumber(sel.winner.votes)} votos
              </p>
              {sel.winner.delivered ? (
                <p className="font-body-md text-body-md text-on-surface-variant">Premio entregado.</p>
              ) : (
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    p.onDeliverPrize(sel.id, code);
                    setCode('');
                  }}
                >
                  <TextField label="Código que presenta la persona ganadora" value={code} onChange={setCode} maxLength={12} autoCapitalize="characters" />
                  <Button type="submit" disabled={code.trim().length < 6} loading={p.busy === 'deliver'}>
                    Registrar entrega
                  </Button>
                </form>
              )}
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-label-lg text-label-lg text-on-surface">Inscripciones ({sel.entries.length})</h3>
            {sel.entries.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">Todavía no hay inscripciones.</p>}
            <ul className="space-y-3">
              {sel.entries.map((e) => (
                <li key={e.id} className="rounded-xl border border-outline-variant p-3 flex flex-wrap gap-4">
                  {e.photoUrl ? (
                    <img
                      src={e.photoUrl}
                      alt={`Foto de «${e.title}» de ${e.alias}`}
                      loading="lazy"
                      width={120}
                      height={120}
                      className="w-28 h-28 rounded-lg object-cover bg-surface-container-high"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                      <Icon name="hide_image" className="text-[28px]" />
                      <span className="sr-only">Sin foto</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-48 space-y-1">
                    <p className="font-label-lg text-label-lg text-on-surface">
                      {e.title} <span className="font-body-md text-[13px] text-on-surface-variant">· {e.alias}</span>
                    </p>
                    {e.caption && <p className="font-body-md text-[13px] text-on-surface-variant">{e.caption}</p>}
                    <p className="flex items-center gap-2 font-body-md text-[13px]">
                      <span className={chip(e.status)}>{e.status === 'PENDIENTE' ? 'Por revisar' : e.status === 'APROBADA' ? 'Aprobada' : 'Rechazada'}</span>
                      {formatNumber(e.votes)} votos
                      {e.rejectionReason && <span className="text-on-surface-variant">· {e.rejectionReason}</span>}
                    </p>
                    {sel.phase !== 'TERMINADO' && rejecting === e.id ? (
                      <form
                        className="flex flex-wrap items-end gap-3 pt-2"
                        onSubmit={(ev) => {
                          ev.preventDefault();
                          p.onModerate(sel.id, e.id, 'RECHAZADA', reason);
                          setRejecting(undefined);
                          setReason('');
                        }}
                      >
                        <TextField label="Motivo del rechazo" value={reason} onChange={setReason} maxLength={200} />
                        <Button type="submit" variant="danger" disabled={reason.trim().length < 3}>
                          Rechazar
                        </Button>
                        <Button type="button" variant="text" onClick={() => setRejecting(undefined)}>
                          Cancelar
                        </Button>
                      </form>
                    ) : (
                      sel.phase !== 'TERMINADO' && (
                        <div className="flex flex-wrap gap-3 pt-2">
                          <Button variant="secondary" disabled={!e.hasPhoto || e.status === 'APROBADA'} onClick={() => p.onModerate(sel.id, e.id, 'APROBADA')}>
                            Aprobar
                          </Button>
                          <Button variant="secondary" disabled={e.status === 'RECHAZADA'} onClick={() => setRejecting(e.id)}>
                            Rechazar
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
