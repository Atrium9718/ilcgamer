import { BottomNav, type NavTab } from '../components/BottomNav.tsx';
import { Icon } from '../components/Icon.tsx';
import { BalanceCard, type LedgerEntryView, type LedgerKind, LedgerRow } from '../components/Ledger.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { cx } from '../lib/cx.ts';

export type WalletFilter = 'all' | 'earned' | 'redeemed' | 'adjustments';

const FILTERS: ReadonlyArray<{ id: WalletFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'earned', label: 'Ganados' },
  { id: 'redeemed', label: 'Canjeados' },
  { id: 'adjustments', label: 'Ajustes' },
];

const MATCH: Record<WalletFilter, (k: LedgerKind) => boolean> = {
  all: () => true,
  earned: (k) => k === 'credit',
  redeemed: (k) => k === 'debit',
  adjustments: (k) => k === 'reversal' || k === 'adjustment',
};

/**
 * Vista pura: billetera de Puntos ILC (ledger).
 * Diseño: Stitch "08 · Mi billetera". Fuentes: Instrucciones §6; Guía Técnica §5.7 (ledger inmutable), §7 GET /wallet.
 */
export interface WalletViewProps {
  balance: number;
  currencyName?: string;
  expiringNotice?: string;
  entries: LedgerEntryView[];
  filter: WalletFilter;
  onFilterChange: (f: WalletFilter) => void;
  onConditions: () => void;
  onRewards: () => void;
  onHowToEarn: () => void;
  onNavigate: (tab: NavTab) => void;
}

export function WalletView({ balance, currencyName = 'Puntos ILC', expiringNotice, entries, filter, onFilterChange, onConditions, onRewards, onHowToEarn, onNavigate }: WalletViewProps) {
  const shown = entries.filter((e) => MATCH[filter](e.kind));
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar title={<span className="font-headline-md text-headline-md text-primary">Mi billetera</span>} />
        <main className="flex-1 px-4 pt-4 pb-6 space-y-5">
          <BalanceCard balance={balance} unit={currencyName} expiringNotice={expiringNotice} onConditions={onConditions} />
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Canjear recompensas', icon: 'redeem', onClick: onRewards },
              { label: 'Cómo ganar puntos', icon: 'help', onClick: onHowToEarn },
            ].map((a) => (
              <button key={a.label} type="button" onClick={a.onClick} className="min-h-14 flex items-center gap-2 px-3 rounded-xl border border-outline-variant bg-surface-container text-left font-label-lg text-[14px] text-on-surface hover:border-primary/60">
                <Icon name={a.icon} className="text-[22px] text-primary" />
                {a.label}
              </button>
            ))}
          </div>
          <section aria-labelledby="movimientos" className="space-y-2">
            <h2 id="movimientos" className="font-title-md text-title-md text-on-surface">
              Movimientos
            </h2>
            <div role="group" aria-label="Filtrar movimientos" className="flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => onFilterChange(f.id)}
                  className={cx('min-h-10 px-3.5 rounded-full border font-label-lg text-[13px] whitespace-nowrap', filter === f.id ? 'bg-secondary-container border-secondary/50 text-on-secondary-container' : 'border-outline-variant text-on-surface-variant')}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {shown.length ? (
              <ul className="divide-y divide-outline-variant">
                {shown.map((e) => (
                  <LedgerRow key={e.id} entry={e} unit={currencyName} />
                ))}
              </ul>
            ) : (
              <StatusMessage kind="empty" title="Sin movimientos" body="Cuando actives un código o canjees una recompensa, lo verás aquí." />
            )}
            <p className="font-body-md text-[12px] text-on-surface-variant">Tu saldo se calcula a partir de movimientos registrados; ningún movimiento se borra.</p>
          </section>
        </main>
        <BottomNav active="billetera" onNavigate={onNavigate} />
      </div>
    </div>
  );
}
