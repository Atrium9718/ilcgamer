import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import bosqueNiebla from '../assets/placeholders/bosque-niebla.jpg';
import botellaBarrica from '../assets/placeholders/botella-barrica.jpg';
import type { LedgerEntryView } from '../components/Ledger.tsx';
import type { RewardView } from '../components/RewardCard.tsx';
import { GameResultView, type ResultState } from './GameResultView.tsx';
import { GamesCatalogView } from './GamesCatalogView.tsx';
import { type ClaimRow, MyClaimsView } from './MyClaimsView.tsx';
import { ProfileView } from './ProfileView.tsx';
import { ProgressView } from './ProgressView.tsx';
import { type RewardCategory, type RewardDetail, RewardsView } from './RewardsView.tsx';
import { ShareCardView, type ShareTemplate } from './ShareCardView.tsx';
import { SignUpView } from './SignUpView.tsx';
import { type WalletFilter, WalletView } from './WalletView.tsx';

const meta = { title: 'Vistas/06-13 · App' } satisfies Meta;
export default meta;
type Story = StoryObj;

const QUICK = [
  { id: 'trivia', title: 'Trivia del origen', icon: 'psychology', minutes: 3, players: '1-8' },
  { id: 'ruleta', title: 'La ruleta ILC', icon: 'rotate_right', minutes: 1, players: '2-8' },
  { id: 'charadas', title: 'Charadas de Caldas', icon: 'theater_comedy', minutes: 5, players: '3-10' },
  { id: 'verdad-reto', title: 'Verdad o reto cultural', icon: 'forum', minutes: 5, players: '2-8' },
];
const EXPERIENCES = [
  {
    id: 'explorador',
    title: 'El Explorador · Ruta del Origen',
    subtitle: 'Recorre por capítulos el agua, el paisaje, el roble y la historia de Caldas.',
    imageUrl: bosqueNiebla,
    progress: { current: 2, total: 6 },
    tag: 'En progreso',
  },
  {
    id: 'mixologia',
    title: 'Maestros de sabor · Mixología',
    subtitle: 'Aromas, ingredientes y preparaciones, con alternativas sin alcohol.',
    imageUrl: botellaBarrica,
    tag: 'Nuevo',
  },
];

export const CatalogoDeJuegos: Story = {
  render: () => (
    <GamesCatalogView
      campaignLabel="Feria de Manizales"
      quickGames={QUICK}
      experiences={EXPERIENCES}
      onSelectGame={fn()}
      onSelectExperience={fn()}
      onNavigate={fn()}
    />
  ),
};

function Result({ initial }: { initial: ResultState }) {
  return <GameResultView gameTitle="Trivia del origen" state={initial} onClose={fn()} onBackToParche={fn()} onShare={fn()} onPlayAgain={fn()} onRetry={fn()} />;
}
const VERIFIED: ResultState = {
  status: 'verified',
  result: {
    headline: '¡El Parche resolvió el origen!',
    summary: '8 de 10 respuestas correctas',
    xpEarned: 120,
    badgeName: 'Guardianes del bosque de niebla',
    pointsEarned: 0,
    pointsNote: 'Esta partida no otorga Puntos ILC en esta campaña.',
  },
};
export const ResultadoVerificado: Story = { render: () => <Result initial={VERIFIED} /> };
export const ResultadoVerificando: Story = { render: () => <Result initial={{ status: 'verifying' }} /> };
export const ResultadoError: Story = { render: () => <Result initial={{ status: 'error' }} /> };

const LEDGER: LedgerEntryView[] = [
  { id: '1', kind: 'credit', amount: 500, description: 'Código activado', detail: 'Ron Viejo de Caldas · Feria de Manizales', dateLabel: '11 oct.' },
  { id: '2', kind: 'debit', amount: -1200, description: 'Canje: Gorra oficial ILC', detail: 'Recompensa', dateLabel: '5 oct.' },
  { id: '3', kind: 'credit', amount: 300, description: 'Código activado', detail: 'Aguardiente Amarillo', dateLabel: '2 oct.' },
  { id: '4', kind: 'credit', amount: 50, description: 'Referido completó su perfil', dateLabel: '28 sep.' },
  { id: '5', kind: 'reversal', amount: -50, description: 'Reverso: código anulado', dateLabel: '27 sep.' },
];
function Wallet() {
  const [filter, setFilter] = useState<WalletFilter>('all');
  return (
    <WalletView
      balance={2300}
      expiringNotice="300 Puntos ILC vencen el 30 nov. 2026"
      entries={LEDGER}
      filter={filter}
      onFilterChange={setFilter}
      onConditions={fn()}
      onRewards={fn()}
      onHowToEarn={fn()}
      onNavigate={fn()}
    />
  );
}
export const MiBilletera: Story = { render: () => <Wallet /> };

export const MiProgreso: Story = {
  render: () => (
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
      onOpenStory={fn()}
      onNavigate={fn()}
    />
  ),
};

const REWARDS: RewardView[] = [
  { id: 'insignia', name: 'Insignia digital Feria', cost: 200, icon: 'military_tech', availability: 'Entrega inmediata' },
  { id: 'gorra', name: 'Gorra oficial ILC', cost: 1200, icon: 'styler', availability: 'Quedan 14 en Manizales' },
  { id: 'camiseta', name: 'Camiseta Ruta del Origen', cost: 1800, icon: 'apparel' },
  { id: 'visita', name: 'Visita guiada a ILC', cost: 5000, icon: 'tour' },
];
const GORRA: RewardDetail = {
  ...(REWARDS[1] as RewardView),
  conditions: ['Disponible en Manizales y Pereira', 'Retiro en punto aliado en 15 días', 'Máximo 1 por persona', 'Vigencia del canje: hasta 31 dic. 2026'],
  termsHref: '#terminos-recompensa',
};
function Rewards({ open }: { open: boolean }) {
  const [category, setCategory] = useState<RewardCategory>('all');
  const [selected, setSelected] = useState<RewardDetail | undefined>(open ? GORRA : undefined);
  return (
    <RewardsView
      balance={2300}
      category={category}
      onCategoryChange={setCategory}
      rewards={REWARDS}
      selected={selected}
      onSelect={(id) => setSelected({ ...(REWARDS.find((r) => r.id === id) as RewardView), conditions: GORRA.conditions, termsHref: GORRA.termsHref })}
      onCloseDetail={() => setSelected(undefined)}
      onConfirmRedeem={fn()}
      onNavigate={fn()}
    />
  );
}
export const Recompensas: Story = { render: () => <Rewards open={false} /> };
export const DetalleDeCanje: Story = { render: () => <Rewards open /> };

export const Perfil: Story = {
  render: () => (
    <ProfileView
      alias="Andrés"
      verified
      referral={{
        code: 'ANDR-7K2Q',
        rewardText: 'Ganas 50 Puntos ILC cuando tu invitado (+18) completa su perfil o se une a su primer Parche. Máximo 5 bonificaciones por semana.',
        joined: 3,
      }}
      marketingOptIn={false}
      onEdit={fn()}
      onCopyCode={fn()}
      onShareLink={fn()}
      onShowQr={fn()}
      onOpenSetting={fn()}
      onLogout={fn()}
      onDeleteAccount={fn()}
      onNavigate={fn()}
    />
  ),
};

function Share() {
  const [template, setTemplate] = useState<ShareTemplate>('bosque');
  return (
    <ShareCardView
      content={{
        badgeName: 'Guardianes del bosque de niebla',
        badgeIcon: 'filter_vintage',
        headline: 'Guardianes del bosque de niebla',
        message: "El Parche 'Los del bosque de niebla' completó la Ruta del Origen",
      }}
      template={template}
      onTemplateChange={setTemplate}
      onShare={fn()}
      onClose={fn()}
    />
  );
}
export const CompartirLogro: Story = { render: () => <Share /> };

function SignUp() {
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  return (
    <SignUpView
      tempAlias="Andrés"
      pending={{ points: 500, xp: 1250, badges: 2 }}
      termsAccepted={terms}
      onTermsAcceptedChange={setTerms}
      marketingOptIn={marketing}
      onMarketingOptInChange={setMarketing}
      termsHref="#terminos"
      privacyHref="#privacidad"
      onAuth={fn()}
      onSkip={fn()}
      onBack={fn()}
    />
  );
}
export const GuardaTuProgreso: Story = { render: () => <SignUp /> };

const CLAIMS: ClaimRow[] = [
  {
    id: '1',
    rewardName: 'Gorra de prueba',
    icon: 'styler',
    status: 'RESERVADO',
    code: 'K7M2Q9XD',
    cost: 300,
    zone: 'Manizales',
    deadline: 'Retíralo antes del 30 nov.',
  },
  { id: '2', rewardName: 'Insignia digital de prueba', icon: 'military_tech', status: 'ENTREGADO', code: 'A1B2C3D4', cost: 100, zone: 'Manizales' },
  { id: '3', rewardName: 'Tour cultural de prueba', icon: 'tour', status: 'EXPIRADO', code: null, cost: 800, zone: 'Pereira' },
];
export const MisCanjes: Story = {
  render: () => <MyClaimsView claims={CLAIMS} onCopy={fn()} onRetry={fn()} onSeeRewards={fn()} onBack={fn()} onNavigate={fn()} />,
};
export const MisCanjesVacio: Story = {
  render: () => <MyClaimsView claims={[]} onCopy={fn()} onRetry={fn()} onSeeRewards={fn()} onBack={fn()} onNavigate={fn()} />,
};
