import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import type { Participant } from '../components/ParticipantList.tsx';
import { CreateParcheView, type ParcheMode } from './CreateParcheView.tsx';
import { type JoinMethod, JoinParcheView } from './JoinParcheView.tsx';
import { ParcheRoomView } from './ParcheRoomView.tsx';

function CreateDemo({ submitting = false }: { submitting?: boolean }) {
  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [mode, setMode] = useState<ParcheMode>('multi');
  return (
    <CreateParcheView
      brandLabel="Ron Viejo de Caldas"
      parcheName={name}
      onParcheNameChange={setName}
      alias={alias}
      onAliasChange={setAlias}
      mode={mode}
      onModeChange={setMode}
      energyMinutes={45}
      canSubmit={name.trim().length > 1 && alias.trim().length > 1}
      submitting={submitting}
      onSubmit={fn()}
      onBack={fn()}
    />
  );
}

function JoinDemo({ initialMethod = 'pin', attemptsLeft = 4, pinError, withPreview = false }: { initialMethod?: JoinMethod; attemptsLeft?: number; pinError?: string; withPreview?: boolean }) {
  const [method, setMethod] = useState<JoinMethod>(initialMethod);
  const [pin, setPin] = useState('47');
  const [alias, setAlias] = useState('Valentina');
  return (
    <JoinParcheView
      method={method}
      onMethodChange={setMethod}
      pin={pin}
      onPinChange={setPin}
      attemptsLeft={attemptsLeft}
      pinError={pinError}
      alias={alias}
      onAliasChange={setAlias}
      preview={withPreview ? { name: 'Los del bosque de niebla', brandLabel: 'Ron Viejo de Caldas', members: 4 } : undefined}
      canSubmit={pin.length === 4 && alias.trim().length > 1}
      onSubmit={fn()}
      onBack={fn()}
      cameraDenied={method === 'qr'}
    />
  );
}

const PARTICIPANTS: Participant[] = [
  { id: 'u1', alias: 'Andrés', isHost: true, status: 'connected' },
  { id: 'u2', alias: 'Valentina', status: 'connected' },
  { id: 'u3', alias: 'Juan', status: 'connected' },
  { id: 'u4', alias: 'Caro', status: 'reconnecting' },
];

const meta = { title: 'Vistas/03-05 · El Parche' } satisfies Meta;
export default meta;
type Story = StoryObj;

export const CrearParche: Story = { render: () => <CreateDemo /> };
export const CrearParcheEnviando: Story = { render: () => <CreateDemo submitting /> };
export const UnirseConPin: Story = { render: () => <JoinDemo /> };
export const UnirsePinEncontrado: Story = { render: () => <JoinDemo withPreview /> };
export const UnirsePinIncorrecto: Story = { render: () => <JoinDemo attemptsLeft={2} pinError="PIN incorrecto. Te quedan 2 intentos." /> };
export const UnirseSinCamara: Story = { render: () => <JoinDemo initialMethod="qr" /> };

const roomArgs = {
  name: 'Los del bosque de niebla',
  connection: 'live' as const,
  pin: '4729',
  isHost: true,
  energy: { remainingSeconds: 32 * 60 + 15, totalSeconds: 45 * 60 },
  challenge: { xp: 1250, completed: 3 },
  commercial: { points: 500, activatedCodes: 1 },
  multiplierLabel: 'x1,5 · Feria de Manizales',
  participants: PARTICIPANTS,
  selfId: 'u1',
  games: [
    { id: 'trivia', title: 'Trivia del origen', subtitle: '3 min · historia y saberes de Caldas', route: 'A' as const, icon: 'quiz' },
    { id: 'acertijo', title: 'El Parche resuelve', subtitle: 'Acertijo cooperativo de bosque y barricas', route: 'B' as const, icon: 'menu_book' },
  ],
  sessionEndsAt: '6:00 a. m.',
  canActivateCode: true,
  onShowQr: fn(),
  onShare: fn(),
  onPlayGame: fn(),
  onChooseGame: fn(),
  onActivateCode: fn(),
  onOpenMenu: fn(),
};

export const SalaAnfitrion: Story = { render: () => <ParcheRoomView {...roomArgs} /> };
export const SalaInvitado: Story = { render: () => <ParcheRoomView {...roomArgs} isHost={false} selfId="u2" /> };
/** Parche nacido en Ruta B (sin activación comercial): no hay Puntos ILC ni multiplicador. */
export const SalaSoloRutaB: Story = { render: () => <ParcheRoomView {...roomArgs} commercial={undefined} canActivateCode={false} games={roomArgs.games.filter((g) => g.route === 'B')} /> };
export const SalaSinConexion: Story = { render: () => <ParcheRoomView {...roomArgs} connection="offline" /> };
export const MonedaPersonalizada: Story = { render: () => <ParcheRoomView {...roomArgs} currencyName="Chupitos" /> };
