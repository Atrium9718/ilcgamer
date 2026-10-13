import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { CATEGORIES, HEADBAND, NEVER_NEVER, SPINNER, STEADY_HAND, TRUTH_DARE } from './fixtures.ts';
import { PartyGameView } from './PartyGames.tsx';

const meta = { title: 'Vistas/15 · Juegos de fiesta' } satisfies Meta;
export default meta;
type Story = StoryObj;

export const GiradorFlecha: Story = { render: () => <PartyGameView config={SPINNER} onExit={fn()} /> };
export const GiradorAguja: Story = {
  render: () => (
    <PartyGameView
      config={{
        ...SPINNER,
        heading: 'PICO DE AGUJA',
        spinner: { ...SPINNER.spinner, shape: 'aguja', body: '#4361EE', tip: '#EC0E15', labelColor: '#111111', labelTop: 'ILC', labelBottom: 'CALDAS' },
      }}
      onExit={fn()}
    />
  ),
};
export const VerdadOReto: Story = { render: () => <PartyGameView config={TRUTH_DARE} onExit={fn()} /> };
export const CategoriasConCronometro: Story = { render: () => <PartyGameView config={CATEGORIES} onExit={fn()} /> };
export const YoNuncaNunca: Story = { render: () => <PartyGameView config={NEVER_NEVER} onExit={fn()} /> };
export const AdivinaEnLaFrente: Story = { render: () => <PartyGameView config={HEADBAND} onExit={fn()} /> };
export const PulsoFirme: Story = { render: () => <PartyGameView config={STEADY_HAND} onExit={fn()} /> };
