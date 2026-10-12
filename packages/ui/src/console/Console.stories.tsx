import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ReactNode, useState } from 'react';
import { fn } from 'storybook/test';
import { CampaignDetailView, type DetailTab } from './CampaignDetailView.tsx';
import { type CampaignEditorValue, CampaignEditorView } from './CampaignEditorView.tsx';
import { CampaignListView } from './CampaignListView.tsx';
import { ConsoleLayout } from './ConsoleLayout.tsx';
import { ConsoleLoginView } from './ConsoleLoginView.tsx';
import type { CampaignStatusView } from './chips.tsx';
import { BRAND_OPTIONS, CHECKLIST_DEMO, DETAIL_DEMO, EDITOR_DEMO, ROWS_DEMO } from './fixtures.ts';

const meta = {
  title: 'Consola/Campañas',
  parameters: { viewport: { defaultViewport: 'responsive' } },
  globals: { theme: 'light' },
} satisfies Meta;
export default meta;
type Story = StoryObj;

function Shell({ children, crumbs }: { children: ReactNode; crumbs: string[] }) {
  return (
    <ConsoleLayout
      active="campanas"
      userAlias="Laura"
      roleLabel="Admin de Marca"
      onNavigate={fn()}
      onLogout={fn()}
      breadcrumbs={crumbs.map((label) => ({ label, onSelect: fn() }))}
    >
      {children}
    </ConsoleLayout>
  );
}

function List() {
  const [filter, setFilter] = useState<CampaignStatusView | 'todas'>('todas');
  const [search, setSearch] = useState('');
  return (
    <Shell crumbs={['Consola', 'Campañas']}>
      <CampaignListView
        rows={ROWS_DEMO.filter((r) => filter === 'todas' || r.status === filter)}
        filter={filter}
        onFilterChange={setFilter}
        search={search}
        onSearchChange={setSearch}
        canCreate
        onCreate={fn()}
        onOpen={fn()}
      />
    </Shell>
  );
}
export const ListaDeCampanas: Story = { render: () => <List /> };

function Detail({ decideKinds = [] as string[], pendingJuridica = false }) {
  const [tab, setTab] = useState<DetailTab>('reglas');
  const [checked, setChecked] = useState<Record<string, boolean>>({ menores: true, mecanica: true, sinPresion: true, assets: true });
  return (
    <Shell crumbs={['Campañas', DETAIL_DEMO.internalName]}>
      <CampaignDetailView
        data={
          pendingJuridica ? { ...DETAIL_DEMO, status: 'EN_REVISION', working: { version: 2, state: 'EN_REVISION', stateLabel: 'En revisión' } } : DETAIL_DEMO
        }
        approvals={[
          { kind: 'MARCA', required: true, status: 'approved', byAlias: 'Revisor de marca', atLabel: '10 dic. 14:20', note: null },
          pendingJuridica
            ? { kind: 'JURIDICA', required: true, status: 'pending', byAlias: null, atLabel: null, note: null }
            : { kind: 'JURIDICA', required: true, status: 'approved', byAlias: 'Revisor jurídico', atLabel: '11 dic. 09:05', note: null },
          { kind: 'PRIVACIDAD', required: false, status: 'not_required', byAlias: null, atLabel: null, note: null },
        ]}
        missingApprovals={pendingJuridica ? ['aprobación de Jurídica'] : []}
        checklist={CHECKLIST_DEMO}
        checked={checked}
        onToggleChecklist={(k, v) => setChecked({ ...checked, [k]: v })}
        permissions={{ canEdit: false, canSubmit: false, canNewVersion: true, canPublish: !pendingJuridica, decideKinds, transitions: [] }}
        tab={tab}
        onTabChange={setTab}
        onEdit={fn()}
        onSubmit={fn()}
        onNewVersion={fn()}
        onPublish={fn()}
        onDecide={fn()}
        onTransition={fn()}
      />
    </Shell>
  );
}
export const DetalleListoParaPublicar: Story = { render: () => <Detail /> };
export const DetalleRevisionJuridica: Story = { render: () => <Detail pendingJuridica decideKinds={['JURIDICA']} /> };

function Editor() {
  const [value, setValue] = useState<CampaignEditorValue>(EDITOR_DEMO);
  return (
    <Shell crumbs={['Campañas', 'Nueva campaña']}>
      <CampaignEditorView
        mode="create"
        value={value}
        onChange={setValue}
        brandOptions={BRAND_OPTIONS}
        moduleOptions={MODULE_OPTIONS_DEMO}
        onSave={fn()}
        onCancel={fn()}
      />
    </Shell>
  );
}
const MODULE_OPTIONS_DEMO = [
  { id: 'trivia-origen', label: 'Trivia del origen', route: 'A' as const },
  { id: 'explorador', label: 'El Explorador', route: 'B' as const },
  { id: 'maestros-sabor', label: 'Maestros de sabor', route: 'B' as const },
  { id: 'tercero', label: 'Tercera experiencia', route: 'B' as const },
];

export const EditorDeCampana: Story = { render: () => <Editor /> };

function Login() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  return (
    <ConsoleLoginView
      step={step}
      email={email}
      onEmailChange={setEmail}
      code={code}
      onCodeChange={setCode}
      maskedEmail="la•••@ilc.com.co"
      onRequest={() => setStep('code')}
      onVerify={fn()}
      onBack={() => setStep('email')}
    />
  );
}
export const Ingreso: Story = { render: () => <Login /> };
