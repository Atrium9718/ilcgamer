import { Icon } from './Icon.tsx';

export interface InviteCardProps {
  pin: string;
  onShowQr: () => void;
  onShare?: () => void;
}

/** Tarjeta para invitar al Parche: PIN grande + QR + compartir. */
export function InviteCard({ pin, onShowQr, onShare }: InviteCardProps) {
  return (
    <section aria-label="Invitar al Parche" className="flex items-center gap-3 rounded-2xl border border-primary/35 bg-surface-container p-3.5">
      <div className="flex-1 min-w-0">
        <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">PIN del Parche</p>
        <p className="font-numeric-xl text-[30px] leading-tight text-primary tabular-nums tracking-[0.3em]">
          <span aria-hidden="true">{pin}</span>
          <span className="sr-only">{pin.split('').join(' ')}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onShowQr}
        aria-label="Mostrar QR del Parche"
        className="w-12 h-12 rounded-xl border border-outline-variant flex items-center justify-center text-on-surface hover:border-primary"
      >
        <Icon name="qr_code_2" className="text-[24px]" />
      </button>
      {onShare && (
        <button
          type="button"
          onClick={onShare}
          aria-label="Compartir invitación"
          className="w-12 h-12 rounded-xl border border-outline-variant flex items-center justify-center text-on-surface hover:border-primary"
        >
          <Icon name="share" className="text-[22px]" />
        </button>
      )}
    </section>
  );
}
