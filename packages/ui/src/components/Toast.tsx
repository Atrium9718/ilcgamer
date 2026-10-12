import { cx } from '../lib/cx.ts';
import { Icon } from './Icon.tsx';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

export interface ToastProps {
  tone?: ToastTone;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

const TONE: Record<ToastTone, { icon: string; className: string }> = {
  success: { icon: 'check_circle', className: 'border-secondary/50 text-secondary' },
  info: { icon: 'info', className: 'border-outline text-on-surface-variant' },
  warning: { icon: 'warning', className: 'border-warning/50 text-warning' },
  error: { icon: 'error', className: 'border-error/50 text-error' },
};

/** Aviso breve. Errores usan role="alert"; el resto, role="status" (no interrumpe al lector de pantalla). */
export function Toast({ tone = 'info', message, actionLabel, onAction, onDismiss }: ToastProps) {
  const t = TONE[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('flex items-center gap-3 w-full rounded-xl border bg-surface-container-highest px-4 py-3 shadow-lg', t.className)}
    >
      <Icon name={t.icon} filled className="text-[22px] shrink-0" />
      <p className="flex-1 font-body-md text-body-md text-on-surface">{message}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="min-h-12 px-2 font-label-lg text-label-lg text-primary hover:underline">
          {actionLabel}
        </button>
      )}
      {onDismiss && (
        <button type="button" aria-label="Cerrar aviso" onClick={onDismiss} className="w-12 h-12 -mr-3 shrink-0 flex items-center justify-center text-on-surface-variant">
          <Icon name="close" className="text-[20px]" />
        </button>
      )}
    </div>
  );
}
