import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { ConsoleLayout } from './ConsoleLayout.tsx';
import { DealerPanelView, type DealerProfileValue, type DealerTab } from './DealerPanelView.tsx';
import { VENUES_DEMO } from './fixtures.ts';
import { StaffPanelView } from './StaffPanelView.tsx';
import { type NewVenueValue, VenuesAdminView, type VenuesTab } from './VenuesAdminView.tsx';

const meta = { title: 'Consola/Comercios y Staff', parameters: { viewport: { defaultViewport: 'responsive' } }, globals: { theme: 'light' } } satisfies Meta;
export default meta;
type Story = StoryObj;

function Admin({ initialTab }: { initialTab: VenuesTab }) {
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState<NewVenueValue>({ name: '', channel: 'ON_PREMISE', city: '', department: '', address: '' });
  return (
    <ConsoleLayout
      active="comercios"
      sections={['campanas', 'comercios']}
      userAlias="Laura"
      roleLabel="Administración de marca"
      onNavigate={fn()}
      onLogout={fn()}
      breadcrumbs={[{ label: 'Comercios' }]}
    >
      <VenuesAdminView
        tab={tab}
        onTabChange={setTab}
        venues={VENUES_DEMO}
        campaignOptions={[{ slug: 'feria-manizales-2027', label: 'Feria de Manizales 2027' }]}
        onApprove={fn()}
        onSuspend={fn()}
        onLinkCampaigns={fn()}
        onAddPersonnel={fn()}
        onRemovePersonnel={fn()}
        form={form}
        onFormChange={setForm}
        onCreate={fn()}
      />
    </ConsoleLayout>
  );
}
export const Establecimientos: Story = { render: () => <Admin initialTab="lista" /> };
export const NuevoEstablecimiento: Story = { render: () => <Admin initialTab="nuevo" /> };

const QR = <div role="img" aria-label="Código QR de tu Staff" className="w-40 h-40 rounded-xl bg-white border border-outline-variant" />;
export const PanelDeStaff: Story = {
  render: () => (
    <ConsoleLayout
      active="mi-actividad"
      only={['mi-actividad']}
      sections={['mi-actividad']}
      userAlias="Mesera 1"
      roleLabel="Staff"
      onNavigate={fn()}
      onLogout={fn()}
      breadcrumbs={[{ label: 'Mi actividad' }]}
    >
      <StaffPanelView
        venueName="Bar de prueba"
        city="Manizales"
        code="K7M2Q9XD"
        qr={QR}
        counts={{ today: 3, week: 14 }}
        weeklyGoal={40}
        recent={[
          { timeLabel: '9:42 p. m.', campaignTitle: 'Feria de Manizales 2027', tableName: 'Mesa 4' },
          { timeLabel: '8:15 p. m.', campaignTitle: 'Feria de Manizales 2027', tableName: null },
        ]}
      />
    </ConsoleLayout>
  ),
};

function Dealer({ initialTab }: { initialTab: DealerTab }) {
  const [tab, setTab] = useState(initialTab);
  const [profile, setProfile] = useState<DealerProfileValue>({
    description: 'Bar cultural de prueba',
    hours: 'Mar a sáb 6 p. m. – 2 a. m.',
    address: 'Cra 23 # 10-20',
    listed: true,
  });
  const [code, setCode] = useState('');
  return (
    <ConsoleLayout
      active="mi-comercio"
      only={['mi-comercio']}
      sections={['mi-comercio']}
      userAlias="Dueño 1"
      roleLabel="Comercio"
      onNavigate={fn()}
      onLogout={fn()}
      breadcrumbs={[{ label: 'Mi establecimiento' }]}
    >
      <DealerPanelView
        tab={tab}
        onTabChange={setTab}
        venueName="Bar de prueba"
        city="Manizales"
        channelLabel="On-premise"
        counts={{ today: 4, week: 21, month: 80 }}
        series={Array.from({ length: 14 }, (_, i) => ({ label: String(i + 1), count: (i * 3) % 7 }))}
        rank={{ position: 3, total: 12 }}
        campaigns={['Feria de Manizales 2027']}
        profile={profile}
        onProfileChange={setProfile}
        onSaveProfile={fn()}
        deliverCode={code}
        onDeliverCodeChange={setCode}
        onDeliver={fn()}
      />
    </ConsoleLayout>
  );
}
export const PanelDeComercio: Story = { render: () => <Dealer initialTab="resumen" /> };
export const PerfilDelComercio: Story = { render: () => <Dealer initialTab="perfil" /> };
export const EntregarRecompensa: Story = { render: () => <Dealer initialTab="entregar" /> };
