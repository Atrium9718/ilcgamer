import { useState } from 'react';
import { BottomNav, type NavTab } from '../components/BottomNav.tsx';
import { Button } from '../components/Button.tsx';
import { Checkbox } from '../components/Checkbox.tsx';
import { Icon } from '../components/Icon.tsx';
import { RewardCard, type RewardView } from '../components/RewardCard.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { cx } from '../lib/cx.ts';
import { formatNumber } from '../lib/format.ts';

export type RewardCategory = 'all' | 'digital' | 'merch' | 'experience';

export interface RewardDetail extends RewardView {
  /** Condiciones visibles antes de confirmar (Guía Técnica §5.7 regla 6, §5.8). */
  conditions: string[];
  termsHref: string;
  /** Stock por zona; si hay más de una, la persona elige dónde retirar. */
  zones?: Array<{ zone: string; available: number }>;
}

/**
 * Vista pura: catálogo de recompensas + hoja de detalle y confirmación de canje.
 * Diseño: Stitch "10 · Recompensas". Fuentes: Instrucciones §6.2, §9; Guía Técnica §5.8.
 * La reserva de inventario y el débito los confirma el servidor de forma atómica.
 */
export interface RewardsViewProps {
  balance: number;
  currencyName?: string;
  category: RewardCategory;
  onCategoryChange: (c: RewardCategory) => void;
  rewards: RewardView[];
  /** Recompensa abierta en la hoja de detalle. */
  selected?: RewardDetail;
  onSelect: (id: string) => void;
  onCloseDetail: () => void;
  redeeming?: boolean;
  /** Error del servidor al canjear (sin saldo, agotada, límite…). */
  error?: string;
  onConfirmRedeem: (id: string, zone?: string) => void;
  /** Atajo a "Mis canjes" (códigos de entrega). */
  onMyClaims?: () => void;
  onNavigate: (tab: NavTab) => void;
}

const CATEGORIES: ReadonlyArray<{ id: RewardCategory; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'digital', label: 'Digitales' },
  { id: 'merch', label: 'Merchandising' },
  { id: 'experience', label: 'Experiencias' },
];

export function RewardsView({
  balance,
  currencyName = 'Puntos ILC',
  category,
  onCategoryChange,
  rewards,
  selected,
  onSelect,
  onCloseDetail,
  redeeming = false,
  error,
  onConfirmRedeem,
  onMyClaims,
  onNavigate,
}: RewardsViewProps) {
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar
          title={<span className="font-headline-md text-headline-md text-primary">Recompensas</span>}
          trailing={
            <span className="font-label-lg text-[14px] text-primary tabular-nums whitespace-nowrap">
              {formatNumber(balance)} <span className="font-body-md text-[12px]">{currencyName}</span>
            </span>
          }
        />
        <main className="flex-1 px-4 pt-4 pb-6 space-y-4">
          <fieldset className="flex gap-2 overflow-x-auto pb-1">
            <legend className="sr-only">Filtrar recompensas</legend>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => onCategoryChange(c.id)}
                className={cx(
                  'min-h-10 px-3.5 rounded-full border font-label-lg text-[13px] whitespace-nowrap',
                  category === c.id
                    ? 'bg-secondary-container border-secondary/50 text-on-secondary-container'
                    : 'border-outline-variant text-on-surface-variant',
                )}
              >
                {c.label}
              </button>
            ))}
          </fieldset>
          {onMyClaims && (
            <button
              type="button"
              onClick={onMyClaims}
              className="inline-flex items-center gap-1.5 min-h-12 font-label-lg text-[13px] text-primary underline underline-offset-4"
            >
              <Icon name="receipt_long" className="text-[18px]" />
              Mis canjes
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            {rewards.map((r) => (
              <RewardCard key={r.id} reward={r} balance={balance} unit={currencyName} onSelect={() => onSelect(r.id)} />
            ))}
          </div>
        </main>
        <BottomNav active="billetera" onNavigate={onNavigate} />
      </div>
      {selected && (
        <RedeemSheet
          key={selected.id}
          reward={selected}
          balance={balance}
          currencyName={currencyName}
          redeeming={redeeming}
          error={error}
          onClose={onCloseDetail}
          onConfirm={(zone) => onConfirmRedeem(selected.id, zone)}
        />
      )}
    </div>
  );
}

function RedeemSheet({
  reward,
  balance,
  currencyName,
  redeeming,
  error,
  onClose,
  onConfirm,
}: {
  reward: RewardDetail;
  balance: number;
  currencyName: string;
  redeeming: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (zone?: string) => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const zones = reward.zones ?? [];
  const [zone, setZone] = useState(zones.find((z) => z.available > 0)?.zone ?? zones[0]?.zone);
  const inStock = zones.length ? (zones.find((z) => z.zone === zone)?.available ?? 0) > 0 : !reward.soldOut;
  const affordable = balance >= reward.cost && inStock;
  return (
    <Sheet
      open
      onClose={onClose}
      title={reward.name}
      actions={
        <>
          <Button disabled={!affordable || !accepted} loading={redeeming} onClick={() => onConfirm(zone)}>
            Confirmar canje · {formatNumber(reward.cost)} {currencyName}
          </Button>
          <Button variant="text" onClick={onClose}>
            Cancelar
          </Button>
        </>
      }
    >
      <ul className="space-y-2 mb-3">
        {reward.conditions.map((c) => (
          <li key={c} className="flex items-start gap-2 text-on-surface">
            <Icon name="check_circle" className="text-[18px] text-secondary mt-0.5" />
            {c}
          </li>
        ))}
      </ul>
      <a href={reward.termsHref} className="inline-flex items-center min-h-12 font-label-lg text-[13px] text-primary underline underline-offset-4">
        Términos de la recompensa
      </a>
      {zones.length > 1 && (
        <label className="block mt-2 space-y-1">
          <span className="font-label-lg text-[13px] text-on-surface">¿Dónde la retiras?</span>
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className="w-full min-h-12 px-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface"
          >
            {zones.map((z) => (
              <option key={z.zone} value={z.zone} disabled={z.available <= 0}>
                {z.zone} {z.available <= 0 ? '(agotada)' : `· quedan ${z.available}`}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p role="alert" className="mt-2 font-body-md text-[13px] text-error">
          {error}
        </p>
      )}
      {affordable ? (
        <>
          <Checkbox checked={accepted} onChange={setAccepted} label="Leí las condiciones" className="mt-2" />
          <p className="mt-2 font-body-md text-[13px] tabular-nums">
            Tu saldo quedará en {formatNumber(balance - reward.cost)} {currencyName}.
          </p>
        </>
      ) : (
        <p className="mt-2 font-body-md text-[13px] text-warning tabular-nums">
          {!inStock ? 'Esta recompensa está agotada en esa zona.' : `Te faltan ${formatNumber(reward.cost - balance)} ${currencyName}.`}
        </p>
      )}
    </Sheet>
  );
}
