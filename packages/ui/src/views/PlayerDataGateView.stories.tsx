import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PlayerDataGateView } from './PlayerDataGateView.tsx';

const meta = { title: 'Vistas/15 · Datos para jugar' } satisfies Meta;
export default meta;
type Story = StoryObj;
const base = { gameTitle: 'El Impostor', privacyHref: '/legal/privacidad', onSaveAccount: fn(), onAccept: fn(), onPrivacy: fn(), onBack: fn() };

export const SinCuenta: Story = { render: () => <PlayerDataGateView {...base} need="account" /> };
export const AutorizarNovedades: Story = { render: () => <PlayerDataGateView {...base} need="marketing" /> };
export const ConError: Story = { render: () => <PlayerDataGateView {...base} need="marketing" error="No pudimos guardar tu decisión. Intenta de nuevo." /> };
