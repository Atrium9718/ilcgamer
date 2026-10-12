import type { AdminRewardClaim, RewardAdminView } from '@ilc/contracts';
import { type ClaimAdminRow, type ClaimStatusView, type NewRewardValue, type RewardAdminRow, type RewardsAdminTab, RewardsAdminView } from '@ilc/ui';
import { useCallback, useEffect, useState } from 'react';
import { adminApi, rewardsAdminApi } from '../lib/adminApi.ts';
import { ApiRequestError } from '../lib/api.ts';
import { emptyRewardForm, rewardFormToInput } from '../lib/mapping.ts';
import { errorMessage } from '../lib/session.tsx';

const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });

export const toRewardRow = (r: RewardAdminView): RewardAdminRow => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  type: r.type,
  cost: r.cost,
  active: r.active,
  fulfillment: r.fulfillment,
  campaignSlug: r.campaignSlug,
  zones: r.zones,
  counts: r.counts,
});

export const toClaimRow = (c: AdminRewardClaim): ClaimAdminRow => ({
  id: c.id,
  code: c.code,
  rewardName: c.rewardName,
  zone: c.zone,
  status: c.status,
  cost: c.cost,
  userAlias: c.userAlias,
  createdLabel: dateFmt.format(new Date(c.createdAt)),
  expiresLabel: c.status === 'RESERVADO' && c.expiresAt ? `Vence el ${dateFmt.format(new Date(c.expiresAt))}` : undefined,
  cancelReason: c.cancelReason,
});

/** Contenedor de Recompensas: conecta la vista pura con /admin/rewards. La API vuelve a validar roles y separación de funciones. */
export function Rewards() {
  const [tab, setTab] = useState<RewardsAdminTab>('catalogo');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [rewards, setRewards] = useState<RewardAdminRow[]>([]);
  const [claims, setClaims] = useState<ClaimAdminRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<ClaimStatusView | 'ALL'>('ALL');
  const [form, setForm] = useState<NewRewardValue>(emptyRewardForm());
  const [deliverCode, setDeliverCode] = useState('');
  const [campaignOptions, setCampaignOptions] = useState<Array<{ slug: string; label: string }>>([]);

  const reload = useCallback(async (status: ClaimStatusView | 'ALL') => {
    const [r, c] = await Promise.all([rewardsAdminApi.list(), rewardsAdminApi.claims(status === 'ALL' ? undefined : status)]);
    setRewards(r.map(toRewardRow));
    setClaims(c.map(toClaimRow));
  }, []);

  useEffect(() => {
    reload('ALL')
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    adminApi.list().then(
      (cs) => setCampaignOptions(cs.map((c) => ({ slug: c.slug, label: c.internalName }))),
      () => undefined,
    );
  }, [reload]);

  const act = async (key: string, fn: () => Promise<string | undefined>, status = statusFilter) => {
    setBusy(key);
    setError(undefined);
    setNotice(undefined);
    setFieldErrors({});
    try {
      const message = await fn();
      await reload(status);
      if (message) setNotice(message);
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setFieldErrors(err.fields);
      setError(errorMessage(err));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <RewardsAdminView
      tab={tab}
      onTabChange={(t) => {
        setTab(t);
        setError(undefined);
        setNotice(undefined);
        setFieldErrors({});
      }}
      loading={loading}
      error={error}
      notice={notice}
      busy={busy}
      fieldErrors={fieldErrors}
      rewards={rewards}
      onActivate={(id) =>
        void act(`activate:${id}`, async () => {
          await rewardsAdminApi.activate(id);
          return 'Recompensa activa: ya se ofrece a las personas.';
        })
      }
      onDeactivate={(id, reason) =>
        void act(`deactivate:${id}`, async () => {
          await rewardsAdminApi.deactivate(id, reason);
          return 'Recompensa desactivada: dejó de ofrecerse.';
        })
      }
      onAdjustStock={(id, v) =>
        void act(`stock:${id}`, async () => {
          await rewardsAdminApi.stock(id, v);
          return 'Stock actualizado.';
        })
      }
      form={form}
      onFormChange={setForm}
      onCreate={() =>
        void act('create', async () => {
          const input = rewardFormToInput(form);
          if (!input.startsAt || !input.endsAt) {
            setFieldErrors({ startsAt: ['Elige las fechas de disponibilidad.'] });
            throw new Error('Elige las fechas de disponibilidad.');
          }
          await rewardsAdminApi.create(input);
          setForm(emptyRewardForm());
          setTab('catalogo');
          return 'Recompensa creada como inactiva. Otra persona de Marca debe activarla.';
        })
      }
      campaignOptions={campaignOptions}
      claims={claims}
      statusFilter={statusFilter}
      onStatusFilterChange={(s) => {
        setStatusFilter(s);
        void act('filter', async () => undefined, s);
      }}
      deliverCode={deliverCode}
      onDeliverCodeChange={setDeliverCode}
      onDeliver={() =>
        void act('deliver', async () => {
          const c = await rewardsAdminApi.deliver(deliverCode.trim());
          setDeliverCode('');
          return `Entregado: ${c.rewardName} a ${c.userAlias}.`;
        })
      }
      onCancelClaim={(id, reason) =>
        void act(`cancel:${id}`, async () => {
          await rewardsAdminApi.cancel(id, reason);
          return 'Canje anulado: se devolvieron los puntos y el stock.';
        })
      }
    />
  );
}
