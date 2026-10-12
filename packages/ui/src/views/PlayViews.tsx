import type { ReactNode } from 'react';
import { Button } from '../components/Button.tsx';
import { type Chapter, ChapterTimeline } from '../components/ChapterTimeline.tsx';
import { Icon } from '../components/Icon.tsx';
import { LegalNotice } from '../components/LegalNotice.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { cx } from '../lib/cx.ts';

/**
 * Vistas puras para jugar. Diseño: Stitch 20 "Trivia · pregunta", 21 "Ruleta", 22 "Explorador · capítulo".
 * Reglas (Guía Gamificación §7; Guía Técnica §5.4): el celular nunca conoce la respuesta correcta ni decide el
 * resultado; el tiempo es un tope, no un premio; ningún texto invita a consumir.
 */
function PlayFrame({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar
          title={title}
          trailing={
            <button
              type="button"
              aria-label="Salir del juego"
              onClick={onClose}
              className="w-12 h-12 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
            >
              <Icon name="close" className="text-[22px]" />
            </button>
          }
        />
        <main className="flex-1 px-4 pt-5 pb-6 space-y-5">{children}</main>
        {footer && (
          <div className="sticky bottom-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
        <LegalNotice />
      </div>
    </div>
  );
}

function Options({
  options,
  selected,
  disabled,
  onSelect,
  name,
}: {
  options: string[];
  selected: number | null;
  disabled?: boolean;
  onSelect: (i: number) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="space-y-3">
      {options.map((text, i) => {
        const on = selected === i;
        return (
          // biome-ignore lint/a11y/useSemanticElements: tarjeta de opción grande (48 px) con semántica de radio
          <button
            key={text}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onSelect(i)}
            className={cx(
              'w-full min-h-14 px-4 py-3 rounded-xl border text-left flex items-center gap-3 font-body-lg text-body-lg transition-colors',
              on ? 'border-primary bg-surface-container-high text-on-surface' : 'border-outline-variant bg-surface-container-low hover:border-primary/50',
              'disabled:opacity-60',
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                'w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center font-label-sm text-[12px]',
                on ? 'border-primary bg-primary text-on-primary' : 'border-outline text-on-surface-variant',
              )}
            >
              {String.fromCharCode(65 + i)}
            </span>
            <span>{text}</span>
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────── Trivia ─────────────────────────

export interface TriviaPlayViewProps {
  title: string;
  /** Posición (0-based) y total de preguntas. */
  index: number;
  total: number;
  prompt: string;
  options: string[];
  selected: number | null;
  /** Segundos restantes de la pregunta (solo tope informativo). */
  secondsLeft?: number;
  /** Marcador actual del Parche, si se juega dentro de uno. */
  parcheLabel?: string;
  submitting?: boolean;
  error?: string;
  onSelect: (choice: number) => void;
  onNext: () => void;
  onClose: () => void;
}

export function TriviaPlayView({
  title,
  index,
  total,
  prompt,
  options,
  selected,
  secondsLeft,
  parcheLabel,
  submitting,
  error,
  onSelect,
  onNext,
  onClose,
}: TriviaPlayViewProps) {
  const last = index === total - 1;
  return (
    <PlayFrame
      title={title}
      onClose={onClose}
      footer={
        <Button onClick={onNext} disabled={selected === null} loading={submitting}>
          {last ? 'Terminar' : 'Siguiente'}
        </Button>
      }
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 font-label-sm text-label-sm text-on-surface-variant">
          <span>
            Pregunta {index + 1} de {total}
          </span>
          {secondsLeft !== undefined && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-outline-variant">
              <Icon name="timer" className="text-[16px]" />
              <span>
                <span className="sr-only">{secondsLeft} segundos restantes</span>
                <span aria-hidden="true">{secondsLeft} s</span>
              </span>
            </span>
          )}
        </div>
        <ProgressBar value={index + 1} max={total} label="Avance de la trivia" valueText={`Pregunta ${index + 1} de ${total}`} />
      </div>
      <h1 className="font-headline-md text-headline-md text-on-surface">{prompt}</h1>
      <Options options={options} selected={selected} onSelect={onSelect} disabled={submitting} name="Opciones de respuesta" />
      {error && <StatusMessage kind="error" title="No pudimos enviar tu respuesta" body={error} />}
      {parcheLabel && (
        <p className="flex items-center gap-2 font-body-md text-[13px] text-on-surface-variant">
          <Icon name="groups" className="text-[18px]" />
          {parcheLabel}
        </p>
      )}
    </PlayFrame>
  );
}

// ───────────────────────── Ruleta ─────────────────────────

export interface WheelPlayViewProps {
  title: string;
  segments: string[];
  /** Estado: listo para girar, girando (esperando al servidor) o con resultado. */
  phase: 'ready' | 'spinning' | 'done';
  outcome?: { label: string; challenge: string | null };
  reducedMotion?: boolean;
  error?: string;
  onSpin: () => void;
  onFinish: () => void;
  onClose: () => void;
}

export function WheelPlayView({ title, segments, phase, outcome, reducedMotion, error, onSpin, onFinish, onClose }: WheelPlayViewProps) {
  return (
    <PlayFrame
      title={title}
      onClose={onClose}
      footer={
        phase === 'done' ? (
          <Button onClick={onFinish}>Ver resultado</Button>
        ) : (
          <Button leadingIcon="autorenew" onClick={onSpin} loading={phase === 'spinning'}>
            Girar
          </Button>
        )
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          aria-hidden="true"
          className={cx(
            'w-56 h-56 rounded-full border-4 border-primary/60 bg-gradient-to-b from-surface-container-high to-surface-container-low flex items-center justify-center text-primary',
            phase === 'spinning' && !reducedMotion && 'animate-spin',
          )}
        >
          <Icon name="casino" filled className="text-[72px]" />
        </div>
        <p aria-live="polite" className="font-title-md text-title-md text-center min-h-8">
          {phase === 'spinning' && 'Girando…'}
          {phase === 'done' && outcome && `Salió: ${outcome.label}`}
        </p>
      </div>
      {phase === 'done' && outcome?.challenge && (
        <section className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant">
          <h2 className="flex items-center gap-1.5 font-label-sm text-label-sm uppercase text-tertiary">
            <Icon name="auto_stories" className="text-[16px]" />
            Reto del Parche
          </h2>
          <p className="mt-1.5 font-body-lg text-body-lg">{outcome.challenge}</p>
        </section>
      )}
      {error && <StatusMessage kind="error" title="No pudimos girar la ruleta" body={error} />}
      <section aria-labelledby="segmentos">
        <h2 id="segmentos" className="font-label-sm text-label-sm uppercase text-on-surface-variant mb-2">
          Casillas de la ruleta
        </h2>
        <ul className="flex flex-wrap gap-2">
          {segments.map((s) => (
            <li key={s} className="px-3 py-1 rounded-full border border-outline-variant font-label-sm text-[12px] text-on-surface-variant">
              {s}
            </li>
          ))}
        </ul>
      </section>
    </PlayFrame>
  );
}

// ───────────────────────── Explorador (Ruta B) ─────────────────────────

export interface ChapterPlayViewProps {
  title: string;
  chapters: Chapter[];
  chapterTitle: string;
  chapterIcon: string;
  story: string;
  question: string;
  options: string[];
  xp: number;
  selected: number | null;
  /** Respuesta anterior incorrecta: se puede reintentar sin penalidad. */
  retry?: boolean;
  submitting?: boolean;
  error?: string;
  onSelect: (choice: number) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function ChapterPlayView({
  title,
  chapters,
  chapterTitle,
  chapterIcon,
  story,
  question,
  options,
  xp,
  selected,
  retry,
  submitting,
  error,
  onSelect,
  onSubmit,
  onClose,
}: ChapterPlayViewProps) {
  return (
    <PlayFrame
      title={title}
      onClose={onClose}
      footer={
        <Button onClick={onSubmit} disabled={selected === null} loading={submitting}>
          Responder
        </Button>
      }
    >
      <ChapterTimeline chapters={chapters} />
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 font-headline-md text-headline-md text-primary">
          <Icon name={chapterIcon} className="text-[26px]" />
          {chapterTitle}
        </h1>
        <span className="px-2.5 py-0.5 rounded-full bg-secondary-container font-label-sm text-[11px] text-on-secondary-container whitespace-nowrap">
          +{xp} XP
        </span>
      </div>
      <p className="font-headline-md italic text-[17px] leading-relaxed text-on-surface">{story}</p>
      <h2 className="font-title-md text-title-md">{question}</h2>
      {retry && <StatusMessage kind="pending" title="Casi" body="Esa no era. Relee el relato y vuelve a intentarlo, sin penalidad." />}
      <Options options={options} selected={selected} onSelect={onSelect} disabled={submitting} name="Opciones de respuesta" />
      {error && <StatusMessage kind="error" title="No pudimos enviar tu respuesta" body={error} />}
    </PlayFrame>
  );
}

// ───────────────────────── Proveedor (iframe) ─────────────────────────

export interface IframeGameViewProps {
  title: string;
  /** El contenedor (iframe aislado) lo aporta la app; la vista solo da el marco y los estados. */
  frame: ReactNode;
  status: 'loading' | 'playing' | 'verifying' | 'error';
  error?: string;
  onClose: () => void;
}

export function IframeGameView({ title, frame, status, error, onClose }: IframeGameViewProps) {
  return (
    <PlayFrame title={title} onClose={onClose}>
      {status === 'error' ? (
        <StatusMessage kind="error" title="No pudimos cargar el juego" body={error ?? 'Intenta de nuevo en un momento.'} />
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden border border-outline-variant bg-surface-container-low">{frame}</div>
          <p aria-live="polite" className="font-body-md text-[13px] text-on-surface-variant">
            {status === 'loading' && 'Cargando el juego…'}
            {status === 'playing' && 'Este juego es de un proveedor externo; no recibe tus datos personales.'}
            {status === 'verifying' && 'Verificando tu resultado…'}
          </p>
        </>
      )}
    </PlayFrame>
  );
}
