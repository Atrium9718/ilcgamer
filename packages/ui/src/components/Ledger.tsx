import { cx } from '../lib/cx.ts';
import { formatNumber, formatSigned } from '../lib/format.ts';
import { Icon } from './Icon.tsx';

/** Tipos de movimiento del ledger inmutable (Guía Técnica §5.7). */
export type LedgerKind = 'credit' | 'debit' | 'reversal' | 'adjustment';

export interface LedgerEntryView {
  id: string;
  kind: LedgerKind;
  /** Con signo: positivo crédito, negativo débito. */
  amount: number;
  description: string;
  detail?: string;
  dateLabel: string;
}

const KIND: Record<LedgerKind, { icon: string; iconClass: string; badge?: string }> = {
  credit: { icon: 'add_circle', iconClass: 'text-secondary' },
  debit: { icon: 'redeem', iconClass: 'text-on-surface-variant' },
  reversal: { icon: 'undo', iconClass: 'text-warning', badge: 'Reverso' },
  adjustment: { icon: 'tune', iconClass: 'text-warning', badge: 'Ajuste auditado' },
};

export function LedgerRow({ entry, unit }: { entry: LedgerEntryView; unit: string }) {
  const k = KIND[entry.kind];
  return (
    <li className="flex items-start gap-3 py-3">
      <Icon name={k.icon} className={cx('text-[24px] mt-0.5', k.iconClass)} />
      <div className="flex-1 min-w-0">
        <p className="font-body-md text-body-md text-on-surface">{entry.description}</p>
        <p className="font-body-md text-[12px] text-on-surface-variant">
          {entry.detail ? `${entry.detail} · ` : ''}
          {entry.dateLabel}
        </p>
        {k.badge && <span className="inline-block mt-1 px-2 rounded-full border border-warning/40 font-label-sm text-[10px] uppercase text-warning">{k.badge}</span>}
      </div>
      <p className={cx('font-label-lg text-[15px] tabular-nums whitespace-nowrap', entry.amount > 0 ? 'text-secondary' : 'text-on-surface')}>
        {formatSigned(entry.amount)}
        <span className="sr-only"> {unit}</span>
      </p>
    </li>
  );
}

export interface BalanceCardProps {
  balance: number;
  unit: string;
  /** Aviso de próximo vencimiento, ej. "300 Puntos ILC vencen el 30 nov. 2026". */
  expiringNotice?: string;
  onConditions?: () => void;
}

export function BalanceCard({ balance, unit, expiringNotice, onConditions }: BalanceCardProps) {
  return (
    <section aria-label="Saldo disponible" className="rounded-2xl border border-primary/45 bg-surface-container p-5 shadow-[0_0_28px_color-mix(in_srgb,var(--color-primary)_14%,transparent)]">
      <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">Saldo disponible</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="font-numeric-xl text-[44px] leading-none text-primary tabular-nums">{formatNumber(balance)}</span>
        <span className="font-label-lg text-label-lg text-primary">{unit}</span>
      </p>
      {expiringNotice && (
        <p className="mt-3 flex items-center gap-1.5 font-body-md text-[13px] text-on-surface-variant">
          <Icon name="schedule" className="text-[18px] text-warning" />
          {expiringNotice}
        </p>
      )}
      {onConditions && (
        <button type="button" onClick={onConditions} className="mt-1 min-h-12 font-label-lg text-[13px] text-primary underline underline-offset-4">
          Ver condiciones
        </button>
      )}
    </section>
  );
}
