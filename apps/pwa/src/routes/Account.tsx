import {
  Button,
  ProfileView,
  ProgressView,
  type RewardCategory,
  type RewardDetail,
  RewardsView,
  ShareCardView,
  type ShareTemplate,
  SignUpView,
  StatusMessage,
  type WalletFilter,
  WalletView,
} from '@ilc/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { DEMO, demoRewardDetail } from '../demo/fixtures.ts';
import { data, type WalletData } from '../lib/data.ts';
import { KEYS, readLocal } from '../lib/storage.ts';
import { useTabNavigate } from './shell.tsx';

export function WalletRoute() {
  const navigate = useNavigate();
  const onNavigate = useTabNavigate();
  const [filter, setFilter] = useState<WalletFilter>('all');
  const [wallet, setWallet] = useState<WalletData | 'loading' | 'error'>('loading');
  useEffect(() => {
    data.wallet().then(setWallet, () => setWallet('error'));
  }, []);
  if (wallet === 'loading') return <StatusMessage kind="pending" title="Cargando tu billetera…" className="min-h-dvh justify-center bg-surface" />;
  if (wallet === 'error')
    return <StatusMessage kind="error" className="min-h-dvh justify-center bg-surface" action={<Button onClick={() => navigate(0)}>Reintentar</Button>} />;
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
    />
  );
}

export function RewardsRoute() {
  const onNavigate = useTabNavigate();
  const [category, setCategory] = useState<RewardCategory>('all');
  const [selected, setSelected] = useState<RewardDetail>();
  return (
    <RewardsView
      balance={DEMO.balance}
      currencyName={DEMO.currencyName}
      category={category}
      onCategoryChange={setCategory}
      rewards={[...DEMO.rewards]}
      selected={selected}
      onSelect={(id) => setSelected(demoRewardDetail(id))}
      onCloseDetail={() => setSelected(undefined)}
      onConfirmRedeem={() => setSelected(undefined)}
      onNavigate={onNavigate}
    />
  );
}

export function ProgressRoute() {
  const navigate = useNavigate();
  const onNavigate = useTabNavigate();
  return (
    <ProgressView
      level={3}
      levelName="Explorador del origen"
      xp={1840}
      nextLevelXp={2500}
      nextLevelName="Nivel 4"
      chapters={[
        { id: 'agua', title: 'Agua', icon: 'water_drop', state: 'done' },
        { id: 'paisaje', title: 'Paisaje', icon: 'landscape', state: 'done' },
        { id: 'roble', title: 'Roble', icon: 'park', state: 'current' },
        { id: 'tiempo', title: 'Tiempo', icon: 'hourglass_empty', state: 'locked' },
        { id: 'maestria', title: 'Maestría', icon: 'workspace_premium', state: 'locked' },
        { id: 'caldas', title: 'Caldas', icon: 'location_city', state: 'locked' },
      ]}
      badges={[
        { id: 'b1', name: 'Guardianes del bosque', icon: 'filter_vintage', earned: true },
        { id: 'b2', name: 'Lector de pistas', icon: 'menu_book', earned: true },
        { id: 'b3', name: 'Parche cooperativo', icon: 'diversity_3', earned: true },
        { id: 'b4', name: 'Alquimia del roble', icon: 'park', earned: false },
        { id: 'b5', name: 'Custodio del tiempo', icon: 'hourglass_empty', earned: false },
        { id: 'b6', name: 'Gran maestro', icon: 'workspace_premium', earned: false },
      ]}
      stories={Array.from({ length: 12 }, (_, i) => ({ id: `r${i + 1}`, unlocked: i < 2 }))}
      onOpenStory={() => undefined}
      onBack={() => navigate(-1)}
      onNavigate={onNavigate}
    />
  );
}

export function ProfileRoute() {
  const navigate = useNavigate();
  const onNavigate = useTabNavigate();
  const alias = readLocal(KEYS.tempAlias, 'Jugador');
  return (
    <ProfileView
      alias={alias}
      verified={false}
      referral={{
        code: 'DEMO-7K2Q',
        rewardText: `Ganas 50 ${DEMO.currencyName} cuando tu invitado (+18) completa su perfil o se une a su primer Parche. Máximo 5 bonificaciones por semana.`,
        joined: 0,
      }}
      marketingOptIn={false}
      onEdit={() => navigate('/registro')}
      onCopyCode={() => navigator.clipboard?.writeText('DEMO-7K2Q').catch(() => undefined)}
      onShareLink={() => navigator.share?.({ title: 'ILC Origen', url: `${location.origin}/r/DEMO-7K2Q` }).catch(() => undefined)}
      onShowQr={() => undefined}
      onOpenSetting={(id) => (id === 'datos' ? navigate('/registro') : navigate(`/legal/${id}`))}
      onLogout={() => navigate('/')}
      onDeleteAccount={() => undefined}
      onNavigate={onNavigate}
    />
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

export function SignUpRoute() {
  const navigate = useNavigate();
  const [terms, setTerms] = useState(false);
  // Marketing SIEMPRE empieza desmarcado (Guía Técnica §5.2).
  const [marketing, setMarketing] = useState(false);
  return (
    <SignUpView
      tempAlias={readLocal(KEYS.tempAlias, 'Jugador')}
      pending={{ points: 500, xp: 1250, badges: 2 }}
      currencyName={DEMO.currencyName}
      termsAccepted={terms}
      onTermsAcceptedChange={setTerms}
      marketingOptIn={marketing}
      onMarketingOptInChange={setMarketing}
      termsHref="/legal/terminos"
      privacyHref="/legal/privacidad"
      onAuth={() => undefined}
      onSkip={() => navigate(-1)}
      onBack={() => navigate(-1)}
    />
  );
}
