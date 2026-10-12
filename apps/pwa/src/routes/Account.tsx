import type { Progress } from '@ilc/contracts';
import {
  Button,
  type Chapter,
  ProfileView,
  ProgressView,
  ShareCardView,
  type ShareTemplate,
  Sheet,
  StatusMessage,
  type WalletFilter,
  WalletView,
} from '@ilc/ui';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { DEMO } from '../demo/fixtures.ts';
import { ApiRequestError } from '../lib/api.ts';
import { data, type WalletData } from '../lib/data.ts';
import { identityApi } from '../lib/identity.ts';
import { useSession } from '../lib/session.tsx';
import { useTabNavigate } from './shell.tsx';

export function WalletRoute() {
  const navigate = useNavigate();
  const onNavigate = useTabNavigate();
  const [filter, setFilter] = useState<WalletFilter>('all');
  const [wallet, setWallet] = useState<WalletData | 'loading' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const load = useCallback(() => {
    setWallet('loading');
    data.wallet().then(setWallet, () => setWallet('error'));
  }, []);
  useEffect(load, [load]);
  if (wallet === 'loading') return <StatusMessage kind="pending" title="Cargando tu billetera…" className="min-h-dvh justify-center bg-surface" />;
  if (wallet === 'error')
    return <StatusMessage kind="error" className="min-h-dvh justify-center bg-surface" action={<Button onClick={load}>Reintentar</Button>} />;
  const loadMore = async () => {
    if (!wallet.nextCursor) return;
    setLoadingMore(true);
    try {
      const next = await data.wallet(wallet.nextCursor);
      setWallet({ ...wallet, entries: [...wallet.entries, ...next.entries], nextCursor: next.nextCursor });
    } finally {
      setLoadingMore(false);
    }
  };
  return (
    <WalletView
      balance={wallet.balance}
      currencyName={wallet.currencyName}
      expiringNotice={wallet.expiringNotice}
      entries={wallet.entries}
      filter={filter}
      onFilterChange={setFilter}
      onConditions={() => navigate('/legal/terminos')}
      onRewards={() => navigate('/recompensas')}
      onHowToEarn={() => navigate('/jugar')}
      onNavigate={onNavigate}
      hasMore={wallet.nextCursor !== null}
      loadingMore={loadingMore}
      onLoadMore={() => void loadMore()}
    />
  );
}

/** Capítulos y relatos de la Ruta del Origen llegan con el motor de juegos (Paso 9); en demostración se ilustran. */
const DEMO_CHAPTERS: Chapter[] = [
  { id: 'agua', title: 'Agua', icon: 'water_drop', state: 'done' },
  { id: 'paisaje', title: 'Paisaje', icon: 'landscape', state: 'done' },
  { id: 'roble', title: 'Roble', icon: 'park', state: 'current' },
  { id: 'tiempo', title: 'Tiempo', icon: 'hourglass_empty', state: 'locked' },
  { id: 'maestria', title: 'Maestría', icon: 'workspace_premium', state: 'locked' },
  { id: 'caldas', title: 'Caldas', icon: 'location_city', state: 'locked' },
];

export function ProgressRoute() {
  const navigate = useNavigate();
  const onNavigate = useTabNavigate();
  const [progress, setProgress] = useState<Progress | 'loading' | 'error'>('loading');
  const load = useCallback(() => {
    setProgress('loading');
    data.progress().then(setProgress, () => setProgress('error'));
  }, []);
  useEffect(load, [load]);
  if (progress === 'loading') return <StatusMessage kind="pending" title="Cargando tu progreso…" className="min-h-dvh justify-center bg-surface" />;
  if (progress === 'error')
    return <StatusMessage kind="error" className="min-h-dvh justify-center bg-surface" action={<Button onClick={load}>Reintentar</Button>} />;
  const { level } = progress;
  return (
    <ProgressView
      level={level.number}
      // Los nombres de nivel son contenido de marca pendiente de aprobación: se muestra el número.
      levelName={`Nivel ${level.number}`}
      xp={progress.xp}
      nextLevelXp={level.nextAt}
      nextLevelName={`Nivel ${level.number + 1}`}
      chapters={data.demo ? DEMO_CHAPTERS : []}
      badges={progress.badges.map((b) => ({ id: b.slug, name: b.name, icon: b.icon, earned: b.earned }))}
      stories={data.demo ? Array.from({ length: 12 }, (_, i) => ({ id: `r${i + 1}`, unlocked: i < 2 })) : []}
      onOpenStory={() => undefined}
      onBack={() => navigate(-1)}
      onNavigate={onNavigate}
    />
  );
}

export function ProfileRoute() {
  const navigate = useNavigate();
  const onNavigate = useTabNavigate();
  const [params] = useSearchParams();
  const { me, setMe, config } = useSession();
  const [confirmDelete, setConfirmDelete] = useState(params.get('eliminar') === '1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!me) return null;
  const marketing = me.consents.find((c) => c.purpose === 'MARKETING')?.granted ?? false;

  const logout = async () => {
    await identityApi.logout().catch(() => undefined);
    setMe(null);
    navigate('/edad', { replace: true });
  };
  const deleteAccount = async () => {
    setBusy(true);
    try {
      await identityApi.deleteAccount();
      setMe(null);
      navigate('/edad', { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No pudimos eliminar la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ProfileView
        alias={me.alias}
        verified={me.status === 'ACTIVA'}
        referral={{
          code: 'DEMO-7K2Q',
          rewardText: `Ganas 50 ${config.currencyName} cuando tu invitado (+18) completa su perfil o se une a su primer Parche. Máximo 5 bonificaciones por semana.`,
          joined: 0,
        }}
        marketingOptIn={marketing}
        onEdit={() => navigate(me.status === 'ACTIVA' ? '/perfil/autorizaciones' : '/registro')}
        onCopyCode={() => navigator.clipboard?.writeText('DEMO-7K2Q').catch(() => undefined)}
        onShareLink={() => navigator.share?.({ title: 'ILC Origen', url: `${location.origin}/r/DEMO-7K2Q` }).catch(() => undefined)}
        onShowQr={() => undefined}
        onOpenSetting={(id) =>
          id === 'consentimientos'
            ? navigate('/perfil/autorizaciones')
            : id === 'datos'
              ? navigate(me.status === 'ACTIVA' ? '/perfil/autorizaciones' : '/registro')
              : navigate(`/legal/${id}`)
        }
        onLogout={() => void logout()}
        onDeleteAccount={() => setConfirmDelete(true)}
        onNavigate={onNavigate}
      />
      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="¿Eliminar tu cuenta?"
        actions={
          <>
            <Button variant="danger" loading={busy} onClick={() => void deleteAccount()}>
              Sí, eliminar mi cuenta
            </Button>
            <Button variant="text" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <p>Borraremos tus datos personales y tus métodos de acceso, y cerraremos tu sesión en todos los dispositivos. Esta acción no se puede deshacer.</p>
        <p className="mt-2">Conservamos solo el registro de tus autorizaciones, como exige la ley, sin datos de contacto.</p>
        {error && <p className="mt-2 text-error">{error}</p>}
      </Sheet>
    </>
  );
}

export function ShareRoute() {
  const navigate = useNavigate();
  const [template, setTemplate] = useState<ShareTemplate>('bosque');
  return (
    <ShareCardView
      content={{
        badgeName: 'Guardianes del bosque de niebla',
        badgeIcon: 'filter_vintage',
        headline: 'Guardianes del bosque de niebla',
        message: `El Parche '${DEMO.parche.name}' completó la Ruta del Origen`,
      }}
      template={template}
      onTemplateChange={setTemplate}
      onShare={() => undefined}
      onClose={() => navigate(-1)}
    />
  );
}
