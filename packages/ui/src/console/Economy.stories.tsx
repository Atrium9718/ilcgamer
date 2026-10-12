import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { ConsoleLayout } from './ConsoleLayout.tsx';
import { type EconomyTab, EconomyView, type EconomyViewProps } from './EconomyView.tsx';
import { ACCOUNT_DEMO, BADGES_DEMO } from './fixtures.ts';

const meta = {
  title: 'Consola/Economía',
  parameters: { viewport: { defaultViewport: 'responsive' } },
  globals: { theme: 'light' },
} satisfies Meta;
export default meta;
type Story = StoryObj;

function Screen({ initialTab, overrides = {} }: { initialTab: EconomyTab; overrides?: Partial<EconomyViewProps> }) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState('0192f0c1-2b6e-7c41-9a3f-1c2d3e4f3f9a');
  const [badge, setBadge] = useState({ slug: '', name: '', icon: '' });
  return (
    <ConsoleLayout
      active="economia"
      sections={['campanas', 'smart-tags', 'economia']}
      userAlias="Laura"
      roleLabel="Administración de marca"
      onNavigate={fn()}
      onLogout={fn()}
      breadcrumbs={[{ label: 'Economía' }]}
    >
      <EconomyView
        tab={tab}
        onTabChange={setTab}
        currencyName="Puntos ILC"
        query={query}
        onQueryChange={setQuery}
        onSearch={fn()}
        account={ACCOUNT_DEMO}
        onReverse={fn()}
        badges={BADGES_DEMO}
        newBadge={badge}
        onNewBadgeChange={setBadge}
        onCreateBadge={fn()}
        reconciliation={{ checkedAccounts: 1520, checkedLabel: '12 oct. 2026, 14:00', mismatches: [] }}
        onReconcile={fn()}
        {...overrides}
      />
    </ConsoleLayout>
  );
}

export const Movimientos: Story = { render: () => <Screen initialTab="movimientos" /> };
export const SinBusqueda: Story = { name: 'Sin búsqueda', render: () => <Screen initialTab="movimientos" overrides={{ account: null, query: '' }} /> };
export const Insignias: Story = { render: () => <Screen initialTab="insignias" /> };
export const Conciliacion: Story = { name: 'Conciliación', render: () => <Screen initialTab="conciliacion" /> };
export const ConciliacionConDiferencias: Story = {
  name: 'Conciliación con diferencias',
  render: () => (
    <Screen
      initialTab="conciliacion"
      overrides={{
        reconciliation: { checkedAccounts: 1520, checkedLabel: '12 oct. 2026, 15:00', mismatches: [{ idHint: '…77c2', balance: 999, ledgerSum: 500 }] },
      }}
    />
  ),
};
