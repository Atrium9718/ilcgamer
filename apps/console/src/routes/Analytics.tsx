import type { AnalyticsDashboard } from '@ilc/contracts';
import { type AnalyticsData, type AnalyticsTab, AnalyticsView, type ReferralSettingsValue } from '@ilc/ui';
import { useCallback, useEffect, useState } from 'react';
import { analyticsApi } from '../lib/adminApi.ts';
import { ApiRequestError } from '../lib/api.ts';
import { errorMessage } from '../lib/session.tsx';

const CAMPAIGN_STATUS: Record<string, string> = {
  BORRADOR: 'Borrador',
  EN_REVISION: 'En revisión',
  APROBADA: 'Aprobada',
  PROGRAMADA: 'Programada',
  ACTIVA: 'Activa',
  PAUSADA: 'Pausada',
  CERRADA: 'Cerrada',
  ARCHIVADA: 'Archivada',
};
const dayLabel = (iso: string) => String(Number(iso.slice(8, 10)));

/** Contrato de la API → modelo de la vista. */
export function toAnalyticsData(d: AnalyticsDashboard): AnalyticsData {
  const series = (s: Array<{ date: string; count: number }>) => s.map((x) => ({ label: dayLabel(x.date), count: x.count }));
  return {
    routeA: { ...d.routeA, byDay: series(d.routeA.byDay) },
    routeB: { ...d.routeB, byDay: series(d.routeB.byDay) },
    ops: {
      codeChecks: d.ops.codeChecks,
      ageGatePassed: d.ops.ageGate.passed,
      consentUpdates: d.ops.consentUpdates,
      securityEvents: d.ops.securityEvents,
      campaignsByStatus: Object.entries(d.ops.campaignsByStatus).map(([k, count]) => ({ label: CAMPAIGN_STATUS[k] ?? k, count })),
      rewardZonesLowStock: d.ops.rewardZonesLowStock,
      modulesAwaitingApproval: d.ops.modulesAwaitingApproval,
      shareCards: d.ops.shareCards,
    },
  };
}

const DEFAULT_RULES: ReferralSettingsValue = { enabled: false, referrerPoints: 0, referrerXp: 0, dailyCap: 5, weeklyCap: 20, attributionWindowDays: 7 };

/** Contenedor de Analítica: tableros separados y reglas de referidos. Solo Marca y TI; la API vuelve a validar. */
export function Analytics() {
  const [tab, setTab] = useState<AnalyticsTab>('ruta-a');
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [rules, setRules] = useState<ReferralSettingsValue>(DEFAULT_RULES);
  const [summary, setSummary] = useState<{ attributed: number; rewardedByClaim: number; rewardedByMission: number; capped: number } | null>(null);

  const load = useCallback(async (period: number) => {
    setLoading(true);
    setError(undefined);
    try {
      const [dash, settings, sum] = await Promise.all([analyticsApi.dashboard(period), analyticsApi.referralSettings(), analyticsApi.referralSummary(period)]);
      setData(toAnalyticsData(dash));
      setRules(settings);
      setSummary(sum);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load(days);
  }, [load, days]);

  const save = async () => {
    setBusy('referrals');
    setError(undefined);
    setNotice(undefined);
    setFieldErrors({});
    try {
      setRules(await analyticsApi.saveReferralSettings(rules));
      setNotice('Reglas de referidos guardadas.');
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setFieldErrors(err.fields);
      setError(errorMessage(err));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <AnalyticsView
      tab={tab}
      onTabChange={(t) => {
        setTab(t);
        setNotice(undefined);
      }}
      days={days}
      onDaysChange={setDays}
      loading={loading}
      error={error}
      notice={notice}
      busy={busy}
      fieldErrors={fieldErrors}
      data={data}
      referralSettings={rules}
      onReferralSettingsChange={setRules}
      onSaveReferralSettings={() => void save()}
      referralSummary={summary}
    />
  );
}
