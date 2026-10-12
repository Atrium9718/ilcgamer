import type { ReactNode } from 'react';
import { Icon } from './Icon.tsx';

export interface TopBarProps {
  title?: ReactNode;
  onBack?: () => void;
  /** Contenido a la derecha (chip de submarca, menú…). */
  trailing?: ReactNode;
}

/** Cabecera fija de 56px con botón atrás de 48px. */
export function TopBar({ title, onBack, trailing }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-surface-container-low/95 backdrop-blur-md border-b border-outline-variant px-2 h-14 flex items-center gap-1">
      {onBack ? (
        <button
          type="button"
          aria-label="Volver"
          onClick={onBack}
          className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary active:scale-95"
        >
          <Icon name="arrow_back" className="text-[20px]" />
        </button>
      ) : (
        <span className="w-2" aria-hidden="true" />
      )}
      <div className="flex-1 min-w-0 font-title-md text-title-md text-on-surface truncate">{title}</div>
      {trailing && <div className="shrink-0 flex items-center gap-1 pr-1">{trailing}</div>}
    </header>
  );
}
