import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { type AnalyticsTab, AnalyticsView, type ReferralSettingsValue } from './AnalyticsView.tsx';
import { ConsoleLayout } from './ConsoleLayout.tsx';
import { ANALYTICS_DEMO } from './fixtures.ts';

const meta = { title: 'Consola/Analítica', parameters: { viewport: { defaultViewport: 'responsive' } }, globals: { theme: 'light' } } satisfies Meta;
export default meta;
type Story = StoryObj;

function Screen({ initialTab }: { initialTab: AnalyticsTab }) {
  const [tab, setTab] = useState(initialTab);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [rs, setRs] = useState<ReferralSettingsValue>({
    enabled: false,
    referrerPoints: 0,
    referrerXp: 0,
    dailyCap: 5,
    weeklyCap: 20,
    attributionWindowDays: 7,
  });
  return (
    <ConsoleLayout
      active="analitica"
      sections={['campanas', 'analitica']}
      userAlias="Laura"
      roleLabel="Administración de marca"
      onNavigate={fn()}
      onLogout={fn()}
      breadcrumbs={[{ label: 'Analítica' }]}
    >
      <AnalyticsView
        tab={tab}
        onTabChange={setTab}
        days={days}
        onDaysChange={setDays}
        data={ANALYTICS_DEMO}
        referralSettings={rs}
        onReferralSettingsChange={setRs}
        onSaveReferralSettings={fn()}
        referralSummary={{ attributed: 40, rewardedByClaim: 12, rewardedByMission: 9, capped: 2 }}
      />
    </ConsoleLayout>
  );
}
export const RutaA: Story = { render: () => <Screen initialTab="ruta-a" /> };
export const RutaB: Story = { render: () => <Screen initialTab="ruta-b" /> };
export const Operacion: Story = { render: () => <Screen initialTab="operacion" /> };
export const Ejecutiva: Story = { render: () => <Screen initialTab="ejecutiva" /> };
export const Referidos: Story = { render: () => <Screen initialTab="referidos" /> };
