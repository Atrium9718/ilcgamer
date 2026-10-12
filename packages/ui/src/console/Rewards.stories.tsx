import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { ConsoleLayout } from './ConsoleLayout.tsx';
import { CLAIMS_ADMIN_DEMO, REWARDS_ADMIN_DEMO } from './fixtures.ts';
import { type NewRewardValue, type RewardsAdminTab, RewardsAdminView, type RewardsAdminViewProps } from './RewardsAdminView.tsx';

const meta = { title: 'Consola/Recompensas', parameters: { viewport: { defaultViewport: 'responsive' } }, globals: { theme: 'light' } } satisfies Meta;
export default meta;
type Story = StoryObj;

const EMPTY: NewRewardValue = {
  slug: '',
  name: '',
  description: '',
  type: 'MERCHANDISING',
  cost: 300,
  conditionsText: '',
  maxPerUser: 1,
  startsAt: '',
  endsAt: '',
  fulfillment: '',
  campaignSlug: '',
  zonesText: '',
};

function Screen({ initialTab, overrides = {} }: { initialTab: RewardsAdminTab; overrides?: Partial<RewardsAdminViewProps> }) {
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState(EMPTY);
  const [code, setCode] = useState('');
  return (
    <ConsoleLayout
      active="recompensas"
      sections={['campanas', 'juegos', 'recompensas']}
      userAlias="Laura"
      roleLabel="Administración de marca"
      onNavigate={fn()}
      onLogout={fn()}
      breadcrumbs={[{ label: 'Recompensas' }]}
    >
      <RewardsAdminView
        tab={tab}
        onTabChange={setTab}
        rewards={REWARDS_ADMIN_DEMO}
        onActivate={fn()}
        onDeactivate={fn()}
        onAdjustStock={fn()}
        form={form}
        onFormChange={setForm}
        onCreate={fn()}
        campaignOptions={[{ slug: 'feria-manizales-2027', label: 'Feria de Manizales 2027' }]}
        claims={CLAIMS_ADMIN_DEMO}
        statusFilter="ALL"
        onStatusFilterChange={fn()}
        deliverCode={code}
        onDeliverCodeChange={setCode}
        onDeliver={fn()}
        onCancelClaim={fn()}
        {...overrides}
      />
    </ConsoleLayout>
  );
}

export const Catalogo: Story = { render: () => <Screen initialTab="catalogo" /> };
export const NuevaConErrores: Story = {
  render: () => (
    <Screen
      initialTab="nueva"
      overrides={{ fieldErrors: { conditions: ['Indica al menos una condición visible para la persona'], cost: ['Número inválido'] } }}
    />
  ),
};
export const Canjes: Story = { render: () => <Screen initialTab="canjes" /> };
