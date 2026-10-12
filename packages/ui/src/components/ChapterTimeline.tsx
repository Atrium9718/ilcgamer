import { cx } from '../lib/cx.ts';
import { Icon } from './Icon.tsx';

export type ChapterState = 'done' | 'current' | 'locked';

export interface Chapter {
  id: string;
  title: string;
  icon: string;
  state: ChapterState;
}

const STATE_COPY: Record<ChapterState, string> = { done: 'completado', current: 'en curso', locked: 'bloqueado' };

/** Capítulos de la "Ruta del Origen" (Guía Gamificación §9.2). Desplazable en horizontal. */
export function ChapterTimeline({ chapters }: { chapters: Chapter[] }) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: región desplazable debe ser alcanzable con teclado (WCAG 2.1.1)
    <ol tabIndex={0} aria-label="Capítulos de la Ruta del Origen" className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 snap-x rounded-lg">
      {chapters.map((c, i) => (
        <li key={c.id} className="snap-start flex items-start">
          <div className="flex flex-col items-center w-18 gap-1.5 text-center">
            <span
              className={cx(
                'w-12 h-12 rounded-full border-2 flex items-center justify-center',
                c.state === 'done' && 'border-secondary bg-secondary-container text-secondary',
                c.state === 'current' && 'border-primary bg-surface-container-high text-primary',
                c.state === 'locked' && 'border-outline-variant bg-surface-container text-outline',
              )}
            >
              <Icon name={c.state === 'locked' ? 'lock' : c.icon} filled={c.state !== 'locked'} className="text-[22px]" />
            </span>
            <span className={cx('font-label-lg text-[11px] leading-4', c.state === 'locked' ? 'text-on-surface-variant' : 'text-on-surface')}>
              {c.title}
              <span className="sr-only">, {STATE_COPY[c.state]}</span>
            </span>
          </div>
          {i < chapters.length - 1 && <span aria-hidden="true" className={cx('mt-6 h-0.5 w-4', c.state === 'done' ? 'bg-secondary' : 'bg-outline-variant')} />}
        </li>
      ))}
    </ol>
  );
}
