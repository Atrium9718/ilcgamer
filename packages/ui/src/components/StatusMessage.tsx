import type { ReactNode } from 'react';
import { cx } from '../lib/cx.ts';
import { Icon } from './Icon.tsx';

export type StatusKind = 'empty' | 'error' | 'offline' | 'pending';

const PRESET: Record<StatusKind, { icon: string; title: string; body: string; iconClass: string }> = {
  empty: { icon: 'explore', title: 'Aún no hay nada por aquí', body: 'Cuando tengas actividad, la verás en este lugar.', iconClass: 'text-tertiary' },
  error: {
    icon: 'error',
    title: 'Algo no salió bien',
    body: 'No pudimos completar la acción. Puedes intentarlo de nuevo con seguridad.',
    iconClass: 'text-error',
  },
  offline: {
    icon: 'cloud_off',
    title: 'Sin conexión',
    body: 'Revisa tu señal. Guardamos tu avance y reintentaremos al reconectar.',
    iconClass: 'text-warning',
  },
  // Guía Técnica §12.2: nunca afirmar que algo se completó si el backend no lo confirmó.
  pending: {
    icon: 'hourglass_top',
    title: 'Verificando…',
    body: 'Estamos confirmando el resultado con el servidor. No repitas la acción.',
    iconClass: 'text-primary',
  },
};

export interface StatusMessageProps {
  kind: StatusKind;
  title?: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}

/** Estados vacío / error recuperable / sin conexión / operación incierta. */
export function StatusMessage({ kind, title, body, action, className }: StatusMessageProps) {
  const p = PRESET[kind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={cx('flex flex-col items-center text-center px-6 py-10', className)}>
      <div className="w-16 h-16 rounded-full border border-outline-variant bg-surface-container flex items-center justify-center mb-4">
        <Icon name={p.icon} className={cx('text-[32px]', p.iconClass, kind === 'pending' && 'animate-pulse')} />
      </div>
      <h2 className="font-headline-md text-headline-md text-on-surface">{title ?? p.title}</h2>
      <p className="mt-1 max-w-xs font-body-md text-body-md text-on-surface-variant">{body ?? p.body}</p>
      {action && <div className="mt-5 w-full max-w-xs">{action}</div>}
    </div>
  );
}

/** Banner fijo superior cuando el dispositivo pierde conexión. */
export function OfflineBanner() {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 px-4 py-2 bg-surface-container-highest border-b border-warning/40 font-label-lg text-[13px] text-warning"
    >
      <Icon name="cloud_off" className="text-[18px]" />
      Sin conexión · reintentaremos automáticamente
    </div>
  );
}
