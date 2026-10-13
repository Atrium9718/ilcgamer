import type { Progress, ReferralMe } from '@ilc/contracts';
import {
  Button,
  type Chapter,
  LEGAL_COPY,
  ProfileView,
  ProgressView,
  ShareCardView,
  type ShareTarget,
  type ShareTemplate,
  Sheet,
  StatusMessage,
  type WalletFilter,
  WalletView,
} from '@ilc/ui';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiRequestError } from '../lib/api.ts';
import { data, type WalletData } from '../lib/data.ts';
import { track } from '../lib/events.ts';
import { identityApi } from '../lib/identity.ts';
import { referralsApi } from '../lib/referrals.ts';
import { useSession } from '../lib/session.tsx';
import { buildCardContent, renderCard } from '../lib/shareCard.ts';
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
  const { me, setMe } = useSession();
  const [confirmDelete, setConfirmDelete] = useState(params.get('eliminar') === '1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [referral, setReferral] = useState<ReferralMe | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    referralsApi.me().then(setReferral, () => setReferral(null));
  }, []);
  if (!me) return null;
  const inviteUrl = referral ? `${location.origin}${referral.linkPath}` : undefined;
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
        referral={referral && { code: referral.code, rewardText: referral.rewardText, joined: referral.joined }}
        marketingOptIn={marketing}
        onEdit={() => navigate(me.status === 'ACTIVA' ? '/perfil/autorizaciones' : '/registro')}
        onCopyCode={() => referral && navigator.clipboard?.writeText(referral.code).catch(() => undefined)}
        onShareLink={() => inviteUrl && navigator.share?.({ title: 'ILC Origen', text: 'Descubre el origen con ILC', url: inviteUrl }).catch(() => undefined)}
        onShowQr={() => {
          if (inviteUrl) void QRCode.toDataURL(inviteUrl, { margin: 1, width: 280 }).then(setQr);
        }}
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
      <Sheet open={qr !== null} onClose={() => setQr(null)} title="Tu código QR de invitación" actions={<Button onClick={() => setQr(null)}>Listo</Button>}>
        <div className="flex flex-col items-center gap-3">
          {qr && <img src={qr} alt="Código QR con tu enlace de invitación" className="w-56 h-56 rounded-xl bg-white p-2" />}
          <p className="text-center">Quien lo escanee puede crear su cuenta con tu invitación. Invitar es voluntario.</p>
        </div>
      </Sheet>
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
  const [badge, setBadge] = useState<{ name: string; icon: string } | null>(null);
  const [referral, setReferral] = useState<ReferralMe | null>(null);
  const [notice, setNotice] = useState<string>();
  useEffect(() => {
    data.progress().then(
      (p) => {
        const earned = p.badges.filter((b) => b.earned).sort((a, b) => (b.awardedAt ?? '').localeCompare(a.awardedAt ?? ''))[0];
        setBadge(earned ? { name: earned.name, icon: earned.icon } : null);
      },
      () => undefined,
    );
    referralsApi.me().then(setReferral, () => undefined);
  }, []);
  const content = buildCardContent(badge);

  const share = async (target: ShareTarget) => {
    try {
      const blob = await renderCard(content, template, LEGAL_COPY);
      const file = new File([blob], 'logro-ilc.png', { type: 'image/png' });
      const url = referral ? `${location.origin}${referral.linkPath}` : undefined;
      if (target !== 'download' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'ILC Origen', text: content.headline, ...(url ? { url } : {}) });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      }
      track({ name: 'share_card_generated', template, target });
      setNotice(target === 'download' ? 'Tarjeta guardada.' : undefined);
    } catch (err) {
      // Cancelar el cuadro de compartir no es un error.
      if (!(err instanceof DOMException && err.name === 'AbortError')) setNotice('No pudimos generar la tarjeta. Intenta de nuevo.');
    }
  };

  return (
    <>
      <ShareCardView content={content} template={template} onTemplateChange={setTemplate} onShare={(t) => void share(t)} onClose={() => navigate(-1)} />
      {notice && (
        <p
          role="status"
          className="fixed bottom-4 inset-x-4 max-w-md mx-auto text-center rounded-xl bg-surface-container-high text-on-surface px-4 py-3 border border-outline-variant"
        >
          {notice}
        </p>
      )}
    </>
  );
}
