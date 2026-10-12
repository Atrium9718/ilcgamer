import type { RewardClaimResult, RewardItem } from '@ilc/contracts';
import { Button, type ClaimRow, MyClaimsView, type RewardCategory, type RewardDetail, RewardsView, Sheet, StatusMessage } from '@ilc/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiRequestError, newIdempotencyKey } from '../lib/api.ts';
import { rewardsApi } from '../lib/rewards.ts';
import { useTabNavigate } from './shell.tsx';

const CATEGORY: Record<RewardCategory, (r: RewardItem) => boolean> = {
  all: () => true,
  digital: (r) => r.type === 'DIGITAL' || r.type === 'CONTENIDO',
  merch: (r) => r.type === 'MERCHANDISING',
  experience: (r) => r.type === 'EXPERIENCIA',
};

const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
const messageOf = (err: unknown) => (err instanceof ApiRequestError ? err.message : 'Ocurrió un error inesperado.');

export function RewardsRoute() {
  const navigate = useNavigate();
  const onNavigate = useTabNavigate();
  const [catalog, setCatalog] = useState<{ balance: number; currencyName: string; rewards: RewardItem[] } | 'loading' | 'error'>('loading');
  const [category, setCategory] = useState<RewardCategory>('all');
  const [selectedId, setSelectedId] = useState<string>();
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<RewardClaimResult>();
  // Una clave por intención de canje: reintentar tras un corte de red no cobra dos veces.
  const key = useRef(newIdempotencyKey());

  const load = useCallback(() => {
    setCatalog('loading');
    rewardsApi.catalog().then(setCatalog, () => setCatalog('error'));
  }, []);
  useEffect(load, [load]);

  if (catalog === 'loading') return <StatusMessage kind="pending" title="Cargando recompensas…" className="min-h-dvh justify-center bg-surface" />;
  if (catalog === 'error')
    return <StatusMessage kind="error" className="min-h-dvh justify-center bg-surface" action={<Button onClick={load}>Reintentar</Button>} />;

  const visible = catalog.rewards.filter(CATEGORY[category]);
  const picked = catalog.rewards.find((r) => r.id === selectedId);
  const detail: RewardDetail | undefined = picked && {
    id: picked.id,
    name: picked.name,
    cost: picked.cost,
    icon: picked.icon,
    conditions: [...picked.conditions, `Máximo ${picked.maxPerUser} por persona`, `Disponible hasta el ${dateFmt.format(new Date(picked.endsAt))}`],
    termsHref: '/legal/terminos',
    soldOut: picked.soldOut,
    zones: picked.zones,
  };

  const confirm = async (id: string, zone?: string) => {
    if (!zone) return;
    setRedeeming(true);
    setError(undefined);
    try {
      const result = await rewardsApi.claim(id, zone, key.current);
      key.current = newIdempotencyKey();
      setSelectedId(undefined);
      setDone(result);
      load();
    } catch (err) {
      setError(messageOf(err));
      // Un rechazo definitivo (sin stock, sin saldo, límite) no se reintenta con la misma clave.
      if (err instanceof ApiRequestError && !err.retryable) key.current = newIdempotencyKey();
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <>
      <RewardsView
        balance={catalog.balance}
        currencyName={catalog.currencyName}
        category={category}
        onCategoryChange={setCategory}
        rewards={visible.map((r) => ({
          id: r.id,
          name: r.name,
          cost: r.cost,
          icon: r.icon,
          soldOut: r.soldOut,
          availability: r.soldOut ? 'Agotada' : r.delivery === 'immediate' ? 'Entrega inmediata' : undefined,
        }))}
        selected={detail}
        onSelect={(id) => {
          setError(undefined);
          setSelectedId(id);
        }}
        onCloseDetail={() => setSelectedId(undefined)}
        redeeming={redeeming}
        error={error}
        onConfirmRedeem={(id, zone) => void confirm(id, zone)}
        onMyClaims={() => navigate('/recompensas/mis-canjes')}
        onNavigate={onNavigate}
      />
      <Sheet
        open={done !== undefined}
        onClose={() => setDone(undefined)}
        title="¡Canje listo!"
        actions={
          <>
            <Button onClick={() => navigate('/recompensas/mis-canjes')}>Ver mis canjes</Button>
            <Button variant="text" onClick={() => setDone(undefined)}>
              Seguir viendo
            </Button>
          </>
        }
      >
        {done && (
          <div className="space-y-2">
            <p>
              {done.rewardName} · {done.cost.toLocaleString('es-CO')} {done.currencyName}
            </p>
            {done.status === 'ENTREGADO' ? (
              <p>Ya está en tu cuenta.</p>
            ) : (
              <>
                <p>Muestra este código para retirarla en {done.zone}:</p>
                <p className="text-center py-3 rounded-xl border border-primary/60 font-headline-md text-[28px] tracking-[0.3em] text-primary">{done.code}</p>
                {done.expiresAt && <p>Retírala antes del {dateFmt.format(new Date(done.expiresAt))}; después se devuelven tus puntos.</p>}
              </>
            )}
            <p className="tabular-nums">
              Tu saldo ahora: {done.balance.toLocaleString('es-CO')} {done.currencyName}.
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}

export function MyClaimsRoute() {
  const navigate = useNavigate();
  const onNavigate = useTabNavigate();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [notice, setNotice] = useState<string>();
  const load = useCallback(() => {
    setState('loading');
    rewardsApi.mine().then(
      (rows) => {
        setClaims(
          rows.map((r) => ({
            id: r.id,
            rewardName: r.rewardName,
            icon: r.icon,
            status: r.status,
            code: r.code,
            cost: r.cost,
            zone: r.zone,
            deadline: r.expiresAt ? `Retíralo antes del ${dateFmt.format(new Date(r.expiresAt))}.` : undefined,
          })),
        );
        setState('ready');
      },
      () => setState('error'),
    );
  }, []);
  useEffect(load, [load]);
  return (
    <MyClaimsView
      claims={claims}
      loading={state === 'loading'}
      error={state === 'error'}
      notice={notice}
      onCopy={(code) => {
        void navigator.clipboard?.writeText(code).then(
          () => setNotice('Código copiado.'),
          () => setNotice('No pudimos copiarlo; anótalo.'),
        );
      }}
      onRetry={load}
      onSeeRewards={() => navigate('/recompensas')}
      onBack={() => navigate('/recompensas')}
      onNavigate={onNavigate}
    />
  );
}
