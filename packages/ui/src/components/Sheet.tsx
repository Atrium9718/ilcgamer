import { type ReactNode, useEffect, useId, useRef } from 'react';
import { Icon } from './Icon.tsx';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Acciones al pie (botones). */
  actions?: ReactNode;
}

/**
 * Hoja inferior modal sobre <dialog> nativo: foco atrapado, Escape para cerrar y fondo inerte
 * los da el navegador. Radio superior 24px (DESIGN.md: Elevation 4).
 */
export function Sheet({ open, onClose, title, children, actions }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-0 mt-auto w-full max-w-md mx-auto p-0 bg-transparent text-on-surface backdrop:bg-black/60 open:flex"
    >
      <div className="w-full rounded-t-3xl bg-surface-container-high border-t border-outline-variant px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-outline-variant" />
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 id={titleId} className="font-headline-md text-headline-md text-on-surface">
            {title}
          </h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="w-12 h-12 -mr-2 -mt-2 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container">
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>
        <div className="font-body-md text-body-md text-on-surface-variant">{children}</div>
        {actions && <div className="mt-5 flex flex-col gap-2">{actions}</div>}
      </div>
    </dialog>
  );
}
