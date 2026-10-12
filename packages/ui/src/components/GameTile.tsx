import { cx } from '../lib/cx.ts';
import { Icon } from './Icon.tsx';

export interface GameTileProps {
  title: string;
  icon: string;
  minutes: number;
  players: string;
  onSelect: () => void;
}

/** Juego rápido de Ruta A en cuadrícula. */
export function GameTile({ title, icon, minutes, players, onSelect }: GameTileProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col items-start gap-2 p-3.5 rounded-2xl bg-surface-container border border-primary/30 text-left hover:border-primary/70 active:scale-[0.98] transition-all"
    >
      <span className="w-11 h-11 rounded-xl border border-primary/40 bg-surface-container-high flex items-center justify-center text-primary">
        <Icon name={icon} className="text-[24px]" />
      </span>
      <span className="font-title-md text-[16px] leading-5 text-on-surface">{title}</span>
      <span className="flex items-center gap-3 font-body-md text-[12px] text-on-surface-variant tabular-nums">
        <span className="inline-flex items-center gap-1">
          <Icon name="schedule" className="text-[14px]" />
          {minutes} min
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon name="group" className="text-[14px]" />
          {players}
        </span>
      </span>
    </button>
  );
}

export interface ExperienceCardProps {
  title: string;
  subtitle: string;
  imageUrl?: string;
  /** Progreso por capítulos; si no se ha empezado, omitir. */
  progress?: { current: number; total: number };
  tag?: string;
  ctaLabel: string;
  onSelect: () => void;
}

/** Experiencia de Ruta B (mayor profundidad). */
export function ExperienceCard({ title, subtitle, imageUrl, progress, tag, ctaLabel, onSelect }: ExperienceCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex gap-3 p-3 rounded-2xl bg-surface-container-low border border-secondary/35 text-left hover:border-secondary/70 active:scale-[0.99] transition-all"
    >
      <span className="relative w-24 shrink-0 rounded-xl overflow-hidden bg-surface-container-high border border-outline-variant">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <Icon name="explore" className="absolute inset-0 m-auto h-fit w-fit text-[32px] text-secondary" />
        )}
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-1">
        {tag && (
          <span className="self-start px-2 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] uppercase">{tag}</span>
        )}
        <span className="font-title-md text-[16px] leading-5 text-on-surface">{title}</span>
        <span className="font-body-md text-[13px] text-on-surface-variant">{subtitle}</span>
        {progress && (
          <span className="mt-1 flex items-center gap-2">
            <span className="flex-1 h-1.5 rounded-full bg-surface-container-highest overflow-hidden" aria-hidden="true">
              <span className="block h-full bg-secondary rounded-full" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
            </span>
            <span className="font-label-sm text-[11px] text-on-surface-variant tabular-nums">
              {progress.current}/{progress.total}
            </span>
          </span>
        )}
        <span className={cx('mt-1 inline-flex items-center gap-1 font-label-lg text-[13px] text-secondary')}>
          {ctaLabel}
          <Icon name="arrow_forward" className="text-[16px]" />
        </span>
      </span>
    </button>
  );
}
