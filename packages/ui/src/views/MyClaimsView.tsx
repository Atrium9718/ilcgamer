import { BottomNav, type NavTab } from '../components/BottomNav.tsx';
import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { LegalNotice } from '../components/LegalNotice.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { cx } from '../lib/cx.ts';
import { formatNumber } from '../lib/format.ts';

export type ClaimState = 'RESERVADO' | 'RECLAMADO' | 'ENTREGADO' | 'EXPIRADO' | 'ANULADO';

export interface ClaimRow {
  id: string;
  rewardName: string;
  icon: string;
  status: ClaimState;
  /** Código de entrega (solo mientras sirve para retirar o como comprobante). */
  code: string | null;
  cost: number;
  zone: string;
  /** Texto ya formateado: "Retíralo antes del 30 nov." */
  deadline?: string;
}

const STATUS: Record<ClaimState, { label: string; tone: string }> = {
  RESERVADO: { label: 'Por retirar', tone: 'bg-tertiary-container text-on-tertiary-container' },
  RECLAMADO: { label: 'Por retirar', tone: 'bg-tertiary-container text-on-tertiary-container' },
  ENTREGADO: { label: 'Entregado', tone: 'bg-secondary-container text-on-secondary-container' },
  EXPIRADO: { label: 'Vencido', tone: 'bg-surface-container-high text-on-surface-variant' },
  ANULADO: { label: 'Anulado', tone: 'bg-surface-container-high text-on-surface-variant' },
};

export interface MyClaimsViewProps {
  claims: ClaimRow[];
  loading?: boolean;
  error?: boolean;
  currencyName?: string;
  /** Mensaje breve tras copiar un código. */
  notice?: string;
  onCopy: (code: string) => void;
  onRetry: () => void;
  onSeeRewards: () => void;
  onBack: () => void;
  onNavigate: (tab: NavTab) => void;
}

/**
 * Vista pura: "Mis canjes". Diseño: Stitch "25 · Mis canjes". Fuentes: Guía Técnica §5.8, §5.7.
 * El código de entrega es lo único que la persona necesita para retirar; los puntos de un canje vencido o anulado se devuelven.
 */
export function MyClaimsView({
  claims,
  loading,
  error,
  currencyName = 'Puntos ILC',
  notice,
  onCopy,
  onRetry,
  onSeeRewards,
  onBack,
  onNavigate,
}: MyClaimsViewProps) {
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar title="Mis canjes" onBack={onBack} />
        <main className="flex-1 px-4 pt-4 pb-6 space-y-3">
          {loading && <StatusMessage kind="pending" title="Cargando tus canjes…" />}
          {error && <StatusMessage kind="error" title="No pudimos cargar tus canjes" action={<Button onClick={onRetry}>Reintentar</Button>} />}
          {!loading && !error && claims.length === 0 && (
            <StatusMessage kind="empty" title="Todavía no has canjeado recompensas" action={<Button onClick={onSeeRewards}>Ver recompensas</Button>} />
          )}
          {notice && (
            <p role="status" className="font-body-md text-[13px] text-secondary">
              {notice}
            </p>
          )}
          <ul className="space-y-3">
            {claims.map((c) => {
              const pending = c.status === 'RESERVADO' || c.status === 'RECLAMADO';
              return (
                <li key={c.id} className="p-4 rounded-2xl border border-outline-variant bg-surface-container-low space-y-3">
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="w-11 h-11 shrink-0 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                      <Icon name={c.icon} className="text-[24px]" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-title-md text-title-md truncate">{c.rewardName}</h2>
                      <p className="font-body-md text-[13px] text-on-surface-variant tabular-nums">
                        {formatNumber(c.cost)} {currencyName} · {c.zone}
                      </p>
                    </div>
                    <span className={cx('px-2.5 py-0.5 rounded-full font-label-sm text-[11px] whitespace-nowrap', STATUS[c.status].tone)}>
                      {STATUS[c.status].label}
                    </span>
                  </div>
                  {pending && c.code && (
                    <div className="space-y-2">
                      <p className="font-body-md text-[13px] text-on-surface-variant">Muestra este código para retirar tu recompensa</p>
                      <p className="text-center py-3 rounded-xl border border-primary/60 font-headline-md text-[28px] tracking-[0.3em] text-primary tabular-nums">
                        <span className="sr-only">Código de entrega: {c.code.split('').join(' ')}</span>
                        <span aria-hidden="true">{c.code}</span>
                      </p>
                      {c.deadline && <p className="font-body-md text-[13px] text-on-surface">{c.deadline}</p>}
                      <Button variant="secondary" leadingIcon="content_copy" onClick={() => onCopy(c.code as string)}>
                        Copiar código
                      </Button>
                    </div>
                  )}
                  {(c.status === 'EXPIRADO' || c.status === 'ANULADO') && (
                    <p className="font-body-md text-[13px] text-on-surface-variant">
                      Te devolvimos {formatNumber(c.cost)} {currencyName}.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </main>
        <BottomNav active="billetera" onNavigate={onNavigate} />
        <LegalNotice />
      </div>
    </div>
  );
}
