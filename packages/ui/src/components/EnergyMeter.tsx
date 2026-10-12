export interface EnergyMeterProps {
  /** Segundos restantes de energía (lo calcula el servidor; el cliente solo muestra la cuenta). */
  remainingSeconds: number;
  /** Duración total configurada por la campaña (Instrucciones §5 paso 5: configurable). */
  totalSeconds: number;
  label?: string;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Medidor circular de energía del Parche. No implica ninguna meta de consumo. */
export function EnergyMeter({ remainingSeconds, totalSeconds, label = 'Energía del Parche' }: EnergyMeterProps) {
  const ratio = totalSeconds > 0 ? Math.min(1, Math.max(0, remainingSeconds / totalSeconds)) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const minutes = Math.ceil(Math.max(0, remainingSeconds) / 60);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={totalSeconds}
      aria-valuenow={Math.max(0, Math.round(remainingSeconds))}
      aria-valuetext={`${minutes} minutos restantes`}
      className="relative w-32 h-32 shrink-0"
    >
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="8" className="stroke-surface-container-highest" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          className="stroke-primary transition-[stroke-dashoffset] duration-1000"
        />
      </svg>
      <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-numeric-xl text-[26px] leading-none text-on-surface tabular-nums">{formatClock(remainingSeconds)}</span>
        <span className="mt-1 font-label-sm text-[10px] uppercase text-on-surface-variant">restantes</span>
      </div>
    </div>
  );
}
