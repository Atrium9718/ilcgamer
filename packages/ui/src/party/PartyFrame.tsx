import { type CSSProperties, createContext, type ReactNode, useContext, useEffect, useRef } from 'react';
import type { PartyLookView } from './types.ts';

/** Colores del juego como variables CSS (acento, acento 2 y fondo): el aspecto sale de la configuración que edita Marca. */
export const lookVars = (look: PartyLookView): CSSProperties =>
  ({ '--p-accent': look.accent, '--p-accent2': look.accent2, '--p-from': look.bgFrom, '--p-to': look.bgTo }) as CSSProperties;

/** Modo compacto: el juego se dibuja dentro de un contenedor (vista previa del editor) en vez de ocupar toda la pantalla. */
export const PartyCompactContext = createContext(false);
export const useCompact = (): boolean => useContext(PartyCompactContext);

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * Marco común de los juegos de fiesta: fondo oscuro degradado, título con degradado de los dos colores de acento, insignia y
 * botón para salir. Es el aspecto de los juegos originales; los colores y textos vienen de la configuración.
 */
export function PartyFrame({
  look,
  heading,
  badge,
  subtitle,
  onExit,
  children,
  footer,
  center,
}: {
  look: PartyLookView;
  heading: string;
  badge?: string;
  subtitle?: string;
  onExit: () => void;
  children: ReactNode;
  footer?: ReactNode;
  center?: boolean;
}) {
  const compact = useCompact();
  return (
    <div
      style={{ ...lookVars(look), fontFamily: FONT, background: 'radial-gradient(circle at center, var(--p-from) 0%, var(--p-to) 100%)', color: '#fff' }}
      className={`relative flex flex-col items-center justify-between overflow-x-hidden px-5 pt-4 pb-5 ${compact ? 'min-h-full' : 'min-h-dvh'}`}
    >
      <button
        type="button"
        onClick={onExit}
        className="absolute left-3 top-3 z-20 min-h-12 min-w-12 rounded-full border border-white/25 bg-white/10 px-3 text-sm font-bold text-white active:scale-95"
      >
        <span aria-hidden="true">✕ </span>Salir
      </button>
      <header className="w-full text-center pt-10 z-10">
        <h1
          className="text-[1.9rem] leading-tight font-black tracking-wide"
          style={{
            background: 'linear-gradient(90deg, var(--p-accent2), var(--p-accent))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {heading}
        </h1>
        {badge && (
          <span
            className="inline-block mt-1 rounded-full px-3 py-[3px] text-[0.75rem] font-bold uppercase"
            style={{ background: 'color-mix(in srgb, var(--p-accent) 22%, transparent)', border: '1px solid var(--p-accent)', color: 'var(--p-accent2)' }}
          >
            {badge}
          </span>
        )}
        {subtitle && <p className="mt-1 text-[0.85rem] text-[#c4c4c4]">{subtitle}</p>}
      </header>
      <div className={center ? 'flex-1 w-full flex flex-col items-center justify-center py-4' : 'contents'}>{children}</div>
      {footer}
    </div>
  );
}

/** Botón principal de los juegos (degradado del color de acento). */
export function PartyButton({
  children,
  onClick,
  tone = 'accent',
  className = '',
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'accent' | 'green' | 'gray' | 'ghost' | 'gold';
  className?: string;
  disabled?: boolean;
}) {
  const bg =
    tone === 'green'
      ? 'linear-gradient(135deg, #00A878, #00704F)'
      : tone === 'gray'
        ? '#3a3a3f'
        : tone === 'ghost'
          ? 'rgba(255,255,255,0.1)'
          : tone === 'gold'
            ? 'rgba(255,215,0,0.15)'
            : 'linear-gradient(135deg, var(--p-accent), color-mix(in srgb, var(--p-accent) 65%, #000))';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{ background: bg, ...(tone === 'gold' ? { border: '1px solid var(--p-accent2)', color: 'var(--p-accent2)' } : {}) }}
      className={`min-h-14 rounded-2xl px-5 py-4 text-[1.1rem] font-extrabold text-white shadow-[0_4px_15px_rgba(0,0,0,0.45)] active:scale-[0.97] transition-transform disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

/** Diálogo accesible para resultados y avisos (reemplaza a `alert()`): enfoca el botón, se cierra con Escape. */
export function PartyDialog({ tag, text, actionLabel, onClose }: { tag?: string; text: string; actionLabel: string; onClose: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="party-dialog-text"
        style={{ background: '#18181b', border: '2px solid var(--p-accent)', boxShadow: '0 0 35px color-mix(in srgb, var(--p-accent) 50%, transparent)' }}
        className="w-full max-w-[380px] rounded-[20px] px-5 py-7 text-center"
      >
        {tag && (
          <p className="mb-2 text-[0.8rem] font-bold uppercase" style={{ color: 'var(--p-accent2)' }}>
            {tag}
          </p>
        )}
        <p id="party-dialog-text" className="my-4 mb-6 text-[1.35rem] font-bold leading-snug text-white">
          {text}
        </p>
        <button
          ref={ref}
          type="button"
          onClick={onClose}
          style={{ background: 'linear-gradient(135deg, var(--p-accent), color-mix(in srgb, var(--p-accent) 65%, #000))' }}
          className="min-h-14 w-full rounded-2xl text-[1.1rem] font-extrabold text-white active:scale-[0.97]"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
