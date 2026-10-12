import { cx } from '../lib/cx.ts';
import { formatNumber } from '../lib/format.ts';
import { Icon } from './Icon.tsx';

export interface RewardView {
  id: string;
  name: string;
  cost: number;
  imageUrl?: string;
  icon?: string;
  /** Texto de disponibilidad por zona, ej. "Quedan 14 en Manizales". */
  availability?: string;
  soldOut?: boolean;
}

export interface RewardCardProps {
  reward: RewardView;
  balance: number;
  unit: string;
  onSelect: () => void;
}

/** Recompensa del catálogo. Si falta saldo muestra cuánto falta (sin incentivar consumo). */
export function RewardCard({ reward, balance, unit, onSelect }: RewardCardProps) {
  const missing = Math.max(0, reward.cost - balance);
  const locked = missing > 0 || reward.soldOut;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        'flex flex-col rounded-2xl overflow-hidden border text-left active:scale-[0.98] transition-all',
        locked ? 'border-outline-variant bg-surface-container-low' : 'border-primary/35 bg-surface-container hover:border-primary/70',
      )}
    >
      <span className="relative aspect-square bg-surface-container-high">
        {reward.imageUrl ? (
          <img src={reward.imageUrl} alt="" className={cx('absolute inset-0 w-full h-full object-cover', locked && 'opacity-60')} />
        ) : (
          <Icon name={reward.icon ?? 'redeem'} className="absolute inset-0 m-auto h-fit w-fit text-[40px] text-primary" />
        )}
        {reward.soldOut && (
          <span className="absolute top-2 left-2 px-2 rounded-full bg-surface-container-highest font-label-sm text-[10px] uppercase text-on-surface">
            Agotado
          </span>
        )}
      </span>
      <span className="p-3 flex flex-col gap-1">
        <span className="font-title-md text-[15px] leading-5 text-on-surface">{reward.name}</span>
        <span className="font-label-lg text-[14px] text-primary tabular-nums">
          {formatNumber(reward.cost)} <span className="font-body-md text-[12px]">{unit}</span>
        </span>
        {missing > 0 && !reward.soldOut ? (
          <>
            <span className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden" aria-hidden="true">
              <span className="block h-full bg-primary/70" style={{ width: `${Math.min(100, (balance / reward.cost) * 100)}%` }} />
            </span>
            <span className="font-body-md text-[12px] text-on-surface-variant tabular-nums">Te faltan {formatNumber(missing)}</span>
          </>
        ) : (
          reward.availability && <span className="font-body-md text-[12px] text-on-surface-variant">{reward.availability}</span>
        )}
      </span>
    </button>
  );
}
