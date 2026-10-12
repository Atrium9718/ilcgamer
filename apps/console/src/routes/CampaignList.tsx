import type { CampaignSummary } from '@ilc/contracts';
import { CampaignListView, type CampaignStatusView, StatusMessage } from '@ilc/ui';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { adminApi } from '../lib/adminApi.ts';
import { canCreateCampaign, summaryToRow } from '../lib/mapping.ts';
import { errorMessage, useSession } from '../lib/session.tsx';

export function CampaignList() {
  const { me } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<CampaignSummary[] | null>(null);
  const [error, setError] = useState<string>();
  const [filter, setFilter] = useState<CampaignStatusView | 'todas'>('todas');
  const [search, setSearch] = useState('');

  useEffect(() => {
    adminApi.list().then(setRows, (err) => setError(errorMessage(err)));
  }, []);

  const viewRows = useMemo(() => (rows ?? []).map(summaryToRow), [rows]);
  if (error) return <StatusMessage kind="error" title="No pudimos cargar las campañas" body={error} />;
  return (
    <CampaignListView
      rows={viewRows}
      loading={rows === null}
      filter={filter}
      onFilterChange={setFilter}
      search={search}
      onSearchChange={setSearch}
      canCreate={canCreateCampaign(me?.roles ?? [])}
      onCreate={() => navigate('/campanas/nueva')}
      onOpen={(slug) => navigate(`/campanas/${slug}`)}
    />
  );
}
