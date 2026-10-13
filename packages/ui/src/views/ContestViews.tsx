import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button.tsx';
import { Checkbox } from '../components/Checkbox.tsx';
import { Icon } from '../components/Icon.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { TextField } from '../components/TextField.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { cx } from '../lib/cx.ts';
import { formatNumber } from '../lib/format.ts';

export type ContestPhaseView = 'PROXIMAMENTE' | 'INSCRIPCION' | 'ENTRE_FASES' | 'VOTACION' | 'TERMINADO';

const PHASE: Record<ContestPhaseView, { label: string; tone: string }> = {
  PROXIMAMENTE: { label: 'Próximamente', tone: 'bg-surface-container-high text-on-surface-variant' },
  INSCRIPCION: { label: 'Inscripciones abiertas', tone: 'bg-secondary-container text-on-secondary-container' },
  ENTRE_FASES: { label: 'Pronto abre la votación', tone: 'bg-tertiary-container text-on-tertiary-container' },
  VOTACION: { label: 'Votación abierta', tone: 'bg-primary-container text-on-primary-container' },
  TERMINADO: { label: 'Terminado', tone: 'bg-surface-container-high text-on-surface-variant' },
};

/** «1 voto», «2 votos». */
export const votesLabel = (n: number): string => `${formatNumber(n)} ${n === 1 ? 'voto' : 'votos'}`;

export const phaseLabel = (p: ContestPhaseView): string => PHASE[p].label;

// ───────────────────────── Lista de eventos ─────────────────────────

export interface EventRow {
  slug: string;
  title: string;
  description: string;
  /** Ya formateado: "Manizales · 12–15 ene." */
  meta: string;
  contests: Array<{ id: string; title: string; prize: string; phase: ContestPhaseView }>;
}

export interface EventsListViewProps {
  events: EventRow[];
  loading?: boolean;
  error?: boolean;
  onOpenContest: (contestId: string) => void;
  onRetry: () => void;
  onBack: () => void;
}

/** Vista pura: eventos y concursos disponibles. Participar y votar nunca da Puntos ILC ni XP. */
export function EventsListView({ events, loading, error, onOpenContest, onRetry, onBack }: EventsListViewProps) {
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar title="Eventos" onBack={onBack} />
        <main className="flex-1 px-4 pt-4 pb-6 space-y-4">
          {loading && <StatusMessage kind="pending" title="Cargando eventos…" />}
          {error && <StatusMessage kind="error" title="No pudimos cargar los eventos" action={<Button onClick={onRetry}>Reintentar</Button>} />}
          {!loading && !error && events.length === 0 && (
            <StatusMessage kind="empty" title="Aún no hay eventos" body="Cuando haya concursos abiertos los verás aquí." />
          )}
          {events.map((e) => (
            <section key={e.slug} aria-labelledby={`ev-${e.slug}`} className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 space-y-3">
              <div>
                <h2 id={`ev-${e.slug}`} className="font-headline-md text-headline-md text-on-surface">
                  {e.title}
                </h2>
                <p className="font-body-md text-[13px] text-on-surface-variant">{e.meta}</p>
                {e.description && <p className="font-body-md text-body-md text-on-surface-variant mt-1">{e.description}</p>}
              </div>
              <ul className="space-y-2">
                {e.contests.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onOpenContest(c.id)}
                      className="w-full min-h-14 text-left rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 active:scale-[0.99] flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="block font-label-lg text-label-lg text-on-surface truncate">{c.title}</span>
                        <span className="block font-body-md text-[13px] text-on-surface-variant truncate">Premio: {c.prize}</span>
                      </span>
                      <span className={cx('shrink-0 rounded-full px-3 py-1 font-label-sm text-[11px]', PHASE[c.phase].tone)}>{PHASE[c.phase].label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}

// ───────────────────────── Detalle del concurso (persona) ─────────────────────────

export interface ContestEntryRow {
  id: string;
  title: string;
  caption: string;
  alias: string;
  photoUrl: string | null;
  mine: boolean;
  status?: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  rejectionReason?: string | null;
}

export interface ContestDetail {
  title: string;
  eventTitle: string;
  description: string;
  prize: string;
  prizeConditions: string;
  phase: ContestPhaseView;
  /** Ya formateado: "Inscripciones hasta el 12 de octubre, 6:00 p. m." */
  phaseNote: string;
  guidelines: string[];
  entries: ContestEntryRow[];
  myEntry: ContestEntryRow | null;
  votedEntryId: string | null;
  prizeCode: string | null;
  winner: { title: string; alias: string; photoUrl: string | null } | null;
}

export interface EntrySubmission {
  title: string;
  caption: string;
  consent: boolean;
  file: File | null;
}

export interface ContestDetailViewProps {
  contest?: ContestDetail;
  loading?: boolean;
  error?: boolean;
  /** Cuenta guardada (número o correo); sin ella no se participa ni se vota. */
  hasAccount: boolean;
  busy?: 'entry' | 'vote' | 'withdraw';
  message?: { kind: 'error' | 'success'; text: string };
  onSubmitEntry: (value: EntrySubmission) => void;
  onVote: (entryId: string) => void;
  onWithdraw: () => void;
  onSaveAccount: () => void;
  onRetry: () => void;
  onBack: () => void;
}

function Photo({ url, alt, className }: { url: string | null; alt: string; className?: string }) {
  if (!url)
    return (
      <div className={cx('flex items-center justify-center bg-surface-container-high text-on-surface-variant', className)}>
        <Icon name="hide_image" className="text-[32px]" />
        <span className="sr-only">Sin foto</span>
      </div>
    );
  return (
    <img src={url} alt={alt} loading="lazy" decoding="async" width={320} height={320} className={cx('object-cover bg-surface-container-high', className)} />
  );
}

const ENTRY_STATE: Record<NonNullable<ContestEntryRow['status']>, { label: string; tone: string }> = {
  PENDIENTE: { label: 'En revisión', tone: 'bg-tertiary-container text-on-tertiary-container' },
  APROBADA: { label: 'Aprobada', tone: 'bg-secondary-container text-on-secondary-container' },
  RECHAZADA: { label: 'No aprobada', tone: 'bg-error-container text-on-error-container' },
};

/**
 * Vista pura: un concurso (p. ej. de disfraces). Participar o votar no da Puntos ILC ni XP: el premio se entrega en persona.
 * La foto se muestra solo tras la aprobación de Marca; el voto es único por cuenta y nunca por el propio disfraz.
 */
export function ContestDetailView({
  contest,
  loading,
  error,
  hasAccount,
  busy,
  message,
  onSubmitEntry,
  onVote,
  onWithdraw,
  onSaveAccount,
  onRetry,
  onBack,
}: ContestDetailViewProps) {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);
  const mine = contest?.myEntry ?? null;
  useEffect(() => {
    if (mine) {
      setTitle(mine.title);
      setCaption(mine.caption);
    }
  }, [mine?.id, mine?.title, mine?.caption, mine]);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null);
  const hasPhoto = !!file || !!mine?.photoUrl;
  const canSend = title.trim().length >= 3 && consent && hasPhoto && !busy;

  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar title={contest?.eventTitle ?? 'Concurso'} onBack={onBack} />
        <main className="flex-1 px-4 pt-4 pb-8 space-y-5">
          {loading && <StatusMessage kind="pending" title="Cargando el concurso…" />}
          {error && <StatusMessage kind="error" title="No pudimos cargar el concurso" action={<Button onClick={onRetry}>Reintentar</Button>} />}
          {contest && (
            <>
              <header className="space-y-2">
                <span className={cx('inline-block rounded-full px-3 py-1 font-label-sm text-[11px]', PHASE[contest.phase].tone)}>
                  {PHASE[contest.phase].label}
                </span>
                <h1 className="font-headline-lg text-[28px] leading-8 text-on-surface">{contest.title}</h1>
                {contest.description && <p className="font-body-md text-body-md text-on-surface-variant">{contest.description}</p>}
                <p className="font-body-md text-[13px] text-on-surface-variant">{contest.phaseNote}</p>
              </header>

              <section aria-labelledby="premio" className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 flex gap-3">
                <Icon name="military_tech" className="text-[28px] text-primary shrink-0" />
                <div>
                  <h2 id="premio" className="font-label-lg text-label-lg text-on-surface">
                    Premio: {contest.prize}
                  </h2>
                  {contest.prizeConditions && <p className="font-body-md text-[13px] text-on-surface-variant mt-1">{contest.prizeConditions}</p>}
                  <p className="font-body-md text-[12px] text-on-surface-variant mt-1">Participar y votar no suma Puntos ILC ni XP.</p>
                </div>
              </section>

              <div aria-live="polite">
                {message && (
                  <p
                    role={message.kind === 'error' ? 'alert' : 'status'}
                    className={cx(
                      'rounded-xl px-4 py-3 font-body-md text-body-md',
                      message.kind === 'error' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container',
                    )}
                  >
                    {message.text}
                  </p>
                )}
              </div>

              {contest.prizeCode && (
                <section aria-labelledby="ganaste" className="rounded-2xl border-2 border-primary bg-primary-container/30 p-4 text-center space-y-1">
                  <h2 id="ganaste" className="font-headline-md text-headline-md text-on-surface">
                    ¡Ganaste el concurso!
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">Presenta este código en el punto de entrega para reclamar tu premio.</p>
                  <p className="font-headline-lg text-[32px] tracking-[0.2em] text-primary">
                    <span className="sr-only">Código del premio: {contest.prizeCode.split('').join(' ')}</span>
                    <span aria-hidden="true">{contest.prizeCode}</span>
                  </p>
                </section>
              )}

              {contest.phase === 'TERMINADO' && contest.winner && (
                <section aria-labelledby="ganador" className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 space-y-3">
                  <h2 id="ganador" className="font-label-lg text-label-lg text-on-surface">
                    Ganador
                  </h2>
                  <Photo url={contest.winner.photoUrl} alt={`Disfraz ganador: ${contest.winner.title}`} className="w-full aspect-square rounded-xl" />
                  <p className="font-body-md text-body-md text-on-surface">
                    «{contest.winner.title}» de {contest.winner.alias}
                  </p>
                </section>
              )}

              {contest.phase === 'INSCRIPCION' && (
                <section aria-labelledby="inscripcion" className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 space-y-4">
                  <h2 id="inscripcion" className="font-headline-md text-headline-md text-on-surface">
                    {mine ? 'Tu disfraz' : 'Inscribe tu disfraz'}
                  </h2>
                  {!hasAccount ? (
                    <div className="space-y-3">
                      <p className="font-body-md text-body-md text-on-surface-variant">Guarda tu progreso con tu número o correo para participar.</p>
                      <Button onClick={onSaveAccount}>Guardar mi progreso</Button>
                    </div>
                  ) : (
                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (canSend) onSubmitEntry({ title: title.trim(), caption: caption.trim(), consent, file });
                      }}
                    >
                      {mine && (
                        <p className="flex items-center gap-2 font-body-md text-[13px]">
                          <span className={cx('rounded-full px-3 py-1 font-label-sm text-[11px]', mine.status ? ENTRY_STATE[mine.status].tone : '')}>
                            {mine.status ? ENTRY_STATE[mine.status].label : ''}
                          </span>
                          {mine.status === 'RECHAZADA' && mine.rejectionReason && (
                            <span className="text-on-surface-variant">Motivo: {mine.rejectionReason}</span>
                          )}
                        </p>
                      )}
                      <ul className="list-disc pl-5 space-y-1 font-body-md text-[13px] text-on-surface-variant">
                        {contest.guidelines.map((g) => (
                          <li key={g}>{g}</li>
                        ))}
                      </ul>
                      <TextField
                        label="Nombre de tu disfraz"
                        value={title}
                        onChange={setTitle}
                        maxLength={60}
                        showCount
                        placeholder="Ej.: El pirata del Cable"
                      />
                      <TextField label="Cuéntanos algo (opcional)" value={caption} onChange={setCaption} maxLength={200} showCount />
                      <div className="space-y-2">
                        <label htmlFor="foto" className="block font-label-lg text-label-lg text-on-surface">
                          Foto de tu disfraz
                        </label>
                        <input
                          id="foto"
                          type="file"
                          accept="image/*"
                          onChange={onFile}
                          className="block w-full font-body-md text-body-md text-on-surface file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:font-label-lg file:text-on-primary"
                        />
                        {(preview || mine?.photoUrl) && (
                          <Photo url={preview ?? mine?.photoUrl ?? null} alt="Vista previa de tu foto" className="w-40 h-40 rounded-xl" />
                        )}
                      </div>
                      <Checkbox
                        checked={consent}
                        onChange={setConsent}
                        label="Autorizo que se muestre mi foto, mi alias y el nombre de mi disfraz en la app y en la pantalla del evento."
                      />
                      <div className="flex flex-wrap gap-3">
                        <Button type="submit" disabled={!canSend} loading={busy === 'entry'}>
                          {mine ? 'Actualizar y enviar a revisión' : 'Enviar mi disfraz'}
                        </Button>
                        {mine && (
                          <Button type="button" variant="secondary" onClick={onWithdraw} loading={busy === 'withdraw'}>
                            Retirar mi inscripción
                          </Button>
                        )}
                      </div>
                      <p className="font-body-md text-[12px] text-on-surface-variant">
                        Tu foto se revisa antes de mostrarse y se elimina del servidor unos días después del concurso.
                      </p>
                    </form>
                  )}
                </section>
              )}

              {contest.phase !== 'INSCRIPCION' && mine && (
                <p className="font-body-md text-[13px] text-on-surface-variant">
                  Tu inscripción: «{mine.title}» · {mine.status ? ENTRY_STATE[mine.status].label : ''}
                </p>
              )}

              <section aria-labelledby="disfraces" className="space-y-3">
                <h2 id="disfraces" className="font-headline-md text-headline-md text-on-surface">
                  Disfraces participantes
                </h2>
                {contest.entries.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">Todavía no hay disfraces aprobados.</p>}
                {contest.phase === 'VOTACION' && !hasAccount && (
                  <div className="space-y-2">
                    <p className="font-body-md text-body-md text-on-surface-variant">Guarda tu progreso con tu número o correo para votar.</p>
                    <Button variant="secondary" onClick={onSaveAccount}>
                      Guardar mi progreso
                    </Button>
                  </div>
                )}
                <ul className="grid grid-cols-2 gap-3">
                  {contest.entries.map((e) => {
                    const voted = contest.votedEntryId === e.id;
                    return (
                      <li key={e.id} className="rounded-2xl border border-outline-variant bg-surface-container-low overflow-hidden flex flex-col">
                        <Photo url={e.photoUrl} alt={`Disfraz «${e.title}» de ${e.alias}`} className="w-full aspect-square" />
                        <div className="p-3 space-y-2 flex-1 flex flex-col">
                          <div className="min-w-0 flex-1">
                            <p className="font-label-lg text-label-lg text-on-surface truncate">{e.title}</p>
                            <p className="font-body-md text-[12px] text-on-surface-variant truncate">{e.alias}</p>
                          </div>
                          {e.mine ? (
                            <p className="font-label-sm text-[11px] text-primary">Tu disfraz</p>
                          ) : (
                            contest.phase === 'VOTACION' &&
                            hasAccount && (
                              <Button
                                variant={voted ? 'secondary' : 'primary'}
                                fullWidth
                                disabled={!!contest.votedEntryId || busy === 'vote'}
                                onClick={() => onVote(e.id)}
                                leadingIcon={voted ? 'check_circle' : 'how_to_vote'}
                              >
                                {voted ? 'Tu voto' : 'Votar'}
                              </Button>
                            )
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {contest.phase === 'VOTACION' && contest.votedEntryId && (
                  <p className="font-body-md text-[13px] text-on-surface-variant">Ya votaste. Hay un solo voto por persona.</p>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ───────────────────────── Pantalla pública (se proyecta) ─────────────────────────

export interface ScreenEntryRow {
  id: string;
  rank: number;
  title: string;
  alias: string;
  votes: number;
  photoUrl: string | null;
}

export interface ContestScreenViewProps {
  title: string;
  eventTitle: string;
  prize: string;
  phase: ContestPhaseView;
  /** Ya formateado: "La votación cierra a las 8:00 p. m." */
  closesLabel: string;
  totalVotes: number;
  entries: ScreenEntryRow[];
  winner: { title: string; alias: string; votes: number } | null;
  /** Dirección corta para votar (se muestra en texto grande) y su código QR ya generado. */
  voteAddress: string;
  qrDataUrl: string | null;
  /** Sin conexión con el servidor: se sigue mostrando lo último y se avisa. */
  offline?: boolean;
}

/**
 * Vista pura de la pantalla del evento: ranking en vivo con alias, disfraz y foto aprobada, más el QR para votar.
 * Texto grande y alto contraste para leerse a distancia. No muestra datos de contacto.
 */
export function ContestScreenView({
  title,
  eventTitle,
  prize,
  phase,
  closesLabel,
  totalVotes,
  entries,
  winner,
  voteAddress,
  qrDataUrl,
  offline,
}: ContestScreenViewProps) {
  const max = Math.max(1, ...entries.map((e) => e.votes));
  const top = entries.slice(0, 8);
  return (
    <main className="min-h-dvh bg-surface text-on-surface p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-10">
      <section aria-labelledby="titulo" className="space-y-6 min-w-0">
        <header className="space-y-2">
          <p className="font-label-lg text-[20px] uppercase tracking-widest text-primary">{eventTitle}</p>
          <h1 id="titulo" className="font-headline-lg text-[48px] leading-[1.05] lg:text-[64px]">
            {title}
          </h1>
          <p className="font-body-md text-[22px]">
            Premio: <strong>{prize}</strong>
          </p>
        </header>

        {winner ? (
          <div role="status" className="rounded-3xl bg-primary text-on-primary p-8">
            <p className="font-label-lg text-[20px] uppercase tracking-widest">¡Ganador!</p>
            <p className="font-headline-lg text-[56px] leading-tight">«{winner.title}»</p>
            <p className="font-body-md text-[28px]">
              {winner.alias} · {votesLabel(winner.votes)}
            </p>
          </div>
        ) : (
          <p className="font-body-md text-[20px] text-primary">
            {PHASE[phase].label} · {closesLabel}
          </p>
        )}

        {entries.length === 0 ? (
          <p className="font-body-md text-[24px]">Aún no hay disfraces aprobados.</p>
        ) : (
          <ol className="space-y-4" aria-label="Clasificación en vivo">
            {top.map((e) => (
              <li key={e.id} className="flex items-center gap-5">
                <span className="w-12 text-center font-headline-lg text-[40px] text-primary" aria-hidden="true">
                  {e.rank}
                </span>
                <Photo url={e.photoUrl} alt={`Disfraz «${e.title}» de ${e.alias}`} className="w-24 h-24 lg:w-28 lg:h-28 rounded-2xl shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="font-headline-md text-[28px] leading-tight truncate">
                    <span className="sr-only">Puesto {e.rank}: </span>
                    {e.title} <span className="font-body-md text-[20px] text-primary">· {e.alias}</span>
                  </p>
                  <div className="h-4 rounded-full bg-surface-container-high overflow-hidden" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-700"
                      style={{ width: `${Math.max(4, Math.round((e.votes / max) * 100))}%` }}
                    />
                  </div>
                </div>
                <p className="w-28 text-right font-headline-lg text-[40px] tabular-nums">
                  {formatNumber(e.votes)}
                  <span className="sr-only">{e.votes === 1 ? ' voto' : ' votos'}</span>
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <aside aria-label="Cómo votar" className="rounded-3xl bg-white text-[#1b1b1b] p-6 flex flex-col items-center text-center gap-4 self-start">
        <h2 className="font-headline-md text-[28px]">Vota con tu celular</h2>
        {qrDataUrl && <img src={qrDataUrl} alt={`Código QR para votar en ${voteAddress}`} width={288} height={288} className="w-72 h-72" />}
        <p className="font-label-lg text-[14px] break-all">{voteAddress}</p>
        <p className="font-body-md text-[18px]" aria-live="polite">
          {votesLabel(totalVotes)} en total
        </p>
        {offline && (
          <p role="status" className="font-body-md text-[16px] text-[#8c1d18]">
            Reconectando… se muestra el último resultado.
          </p>
        )}
      </aside>
    </main>
  );
}
