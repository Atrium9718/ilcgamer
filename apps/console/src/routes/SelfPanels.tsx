import type { DealerDashboard, StaffDashboard } from '@ilc/contracts';
import { DealerPanelView, type DealerProfileValue, type DealerTab, StaffPanelView } from '@ilc/ui';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import { rewardsAdminApi, venueSelfApi } from '../lib/adminApi.ts';
import { errorMessage } from '../lib/session.tsx';

const CHANNEL_LABEL = { ON_PREMISE: 'On-premise', OFF_PREMISE: 'Off-premise', EVENTO: 'Evento', DIGITAL: 'Digital' } as const;
const PWA_URL = (import.meta.env.VITE_PWA_URL as string | undefined) ?? 'http://localhost:5173';
const timeFmt = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' });
const dayFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', timeZone: 'UTC' });

/** Panel del Staff: su código y su actividad. Nunca muestra personas. */
export function StaffPanel() {
  const [data, setData] = useState<StaffDashboard>();
  const [error, setError] = useState<string>();
  const [qr, setQr] = useState<string>();
  useEffect(() => {
    venueSelfApi.staff().then(
      (d) => {
        setData(d);
        void QRCode.toDataURL(`${PWA_URL}${d.qrPath}`, { margin: 1, width: 320 }).then(setQr);
      },
      (err) => setError(errorMessage(err)),
    );
  }, []);
  return (
    <StaffPanelView
      loading={!data && !error}
      error={error}
      venueName={data?.venue.name ?? ''}
      city={data?.venue.city ?? ''}
      code={data?.code ?? ''}
      qr={qr ? <img src={qr} alt="Código QR de tu Staff" className="w-40 h-40 rounded-xl bg-white p-1.5 border border-outline-variant" /> : undefined}
      counts={data?.counts ?? { today: 0, week: 0 }}
      weeklyGoal={data?.weeklyGoal ?? 0}
      recent={(data?.recent ?? []).map((r) => ({ timeLabel: timeFmt.format(new Date(r.at)), campaignTitle: r.campaignTitle, tableName: r.tableName }))}
    />
  );
}

/** Panel del Comercio: resumen agregado, perfil público y entrega de recompensas de su ciudad. */
export function DealerPanel() {
  const [tab, setTab] = useState<DealerTab>('resumen');
  const [data, setData] = useState<DealerDashboard>();
  const [profile, setProfile] = useState<DealerProfileValue>({ description: '', hours: '', address: '', listed: false });
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [code, setCode] = useState('');

  const load = useCallback(async () => {
    const d = await venueSelfApi.dealer();
    setData(d);
    setProfile(d.profile);
  }, []);
  useEffect(() => {
    load().catch((err) => setError(errorMessage(err)));
  }, [load]);

  const act = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setError(undefined);
    setNotice(undefined);
    try {
      setNotice(await fn());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <DealerPanelView
      tab={tab}
      onTabChange={(t) => {
        setTab(t);
        setError(undefined);
        setNotice(undefined);
      }}
      loading={!data && !error}
      error={error}
      notice={notice}
      busy={busy}
      venueName={data?.venue.name ?? ''}
      city={data?.venue.city ?? ''}
      channelLabel={data ? CHANNEL_LABEL[data.venue.channel] : ''}
      counts={data?.counts ?? { today: 0, week: 0, month: 0 }}
      series={(data?.series ?? []).map((s) => ({ label: dayFmt.format(new Date(`${s.date}T00:00:00Z`)), count: s.count }))}
      rank={data?.rank ?? null}
      campaigns={(data?.campaigns ?? []).map((c) => c.title)}
      profile={profile}
      onProfileChange={setProfile}
      onSaveProfile={() =>
        void act('profile', async () => {
          setData(await venueSelfApi.saveProfile(profile));
          return 'Perfil guardado.';
        })
      }
      deliverCode={code}
      onDeliverCodeChange={setCode}
      onDeliver={() =>
        void act('deliver', async () => {
          const c = await rewardsAdminApi.deliver(code.trim());
          setCode('');
          return `Entregado: ${c.rewardName}.`;
        })
      }
    />
  );
}
