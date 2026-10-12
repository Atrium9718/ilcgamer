import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { ConsoleLayout } from './ConsoleLayout.tsx';
import { MODULES_DEMO } from './fixtures.ts';
import { type GamesTab, GamesView, type GamesViewProps } from './GamesView.tsx';

const meta = { title: 'Consola/Juegos', parameters: { viewport: { defaultViewport: 'responsive' } }, globals: { theme: 'light' } } satisfies Meta;
export default meta;
type Story = StoryObj;

function Screen({ initialTab, master = true, overrides = {} }: { initialTab: GamesTab; master?: boolean; overrides?: Partial<GamesViewProps> }) {
  const [tab, setTab] = useState(initialTab);
  const [defaults, setDefaults] = useState(['trivia-origen']);
  const [manifest, setManifest] = useState('');
  return (
    <ConsoleLayout
      active="juegos"
      sections={['campanas', 'juegos']}
      userAlias="Laura"
      roleLabel="Administración de marca"
      onNavigate={fn()}
      onLogout={fn()}
      breadcrumbs={[{ label: 'Juegos' }]}
    >
      <GamesView
        tab={tab}
        onTabChange={setTab}
        isMaster={master}
        canManage
        approvalKinds={['MARCA']}
        modules={MODULES_DEMO}
        onTest={fn()}
        onApprove={fn()}
        onActivate={fn()}
        onDeactivate={fn()}
        defaults={defaults}
        onDefaultsChange={setDefaults}
        onSaveDefaults={fn()}
        manifestText={manifest}
        onManifestChange={setManifest}
        onRegister={fn()}
        secret={null}
        onShowSecret={fn()}
        onRotateSecret={fn()}
        onHideSecret={fn()}
        guide={'# Guía de integración de juegos\n\nEsta guía es para el equipo de Marca y los proveedores.\n\n## 1. Las dos rutas\n'}
        {...overrides}
      />
    </ConsoleLayout>
  );
}

export const Catalogo: Story = { render: () => <Screen initialTab="catalogo" /> };
export const RegistrarConErrores: Story = {
  render: () => (
    <Screen
      initialTab="registrar"
      overrides={{ manifestText: '{ "moduleId": "x" }', fieldErrors: { 'scoring.xpMax': ['El XP es de la Ruta B'], version: ['Debe ser x.y.z'] } }}
    />
  ),
};
export const Guia: Story = { render: () => <Screen initialTab="guia" /> };
export const SecretoDelProveedor: Story = {
  render: () => <Screen initialTab="catalogo" overrides={{ secret: { moduleId: 'maestros-sabor', secret: 'ilcps_9f2c…demo', epoch: 2 } }} />,
};
