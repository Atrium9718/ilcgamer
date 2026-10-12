import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { ConsoleLayout } from './ConsoleLayout.tsx';
import { BATCHES_DEMO, BRAND_OPTIONS, PREVIEW_DEMO, PRODUCTS_DEMO } from './fixtures.ts';
import { type GenerateValue, type NewProductValue, type SmartTagsTab, SmartTagsView, type SmartTagsViewProps } from './SmartTagsView.tsx';

const meta = {
  title: 'Consola/Smart Tags',
  parameters: { viewport: { defaultViewport: 'responsive' } },
  globals: { theme: 'light' },
} satisfies Meta;
export default meta;
type Story = StoryObj;

function Screen({ initialTab, master = true, overrides = {} }: { initialTab: SmartTagsTab; master?: boolean; overrides?: Partial<SmartTagsViewProps> }) {
  const [tab, setTab] = useState(initialTab);
  const [generate, setGenerate] = useState<GenerateValue>({ sku: 'RVC-8', batchLabel: '4094', supplier: 'Imprenta A', count: 5000 });
  const [product, setProduct] = useState<NewProductValue>({ sku: '', name: '', brandSlug: '' });
  const [template, setTemplate] = useState('https://ilc.app/v/{token}');
  return (
    <ConsoleLayout
      active="smart-tags"
      sections={['campanas', 'smart-tags']}
      userAlias={master ? 'TI' : 'Laura'}
      roleLabel={master ? 'Superadministración' : 'Administración de marca'}
      onNavigate={fn()}
      onLogout={fn()}
      breadcrumbs={[{ label: 'Smart Tags' }]}
    >
      <SmartTagsView
        tab={tab}
        onTabChange={setTab}
        canManageCatalog
        isMaster={master}
        batches={BATCHES_DEMO}
        campaignOptions={[{ slug: 'feria-manizales-2027', label: 'Feria de Manizales 2027 (activa)' }]}
        onLink={fn()}
        onDistribute={fn()}
        onRevoke={fn()}
        onExport={fn()}
        preview={PREVIEW_DEMO}
        onFile={fn()}
        onConfirmImport={fn()}
        onDiscardImport={fn()}
        onDownloadIssues={fn()}
        generate={generate}
        onGenerateChange={setGenerate}
        onGenerate={fn()}
        products={PRODUCTS_DEMO}
        newProduct={product}
        onNewProductChange={setProduct}
        onCreateProduct={fn()}
        brandOptions={BRAND_OPTIONS}
        urlTemplate={template}
        onUrlTemplateChange={setTemplate}
        onSaveUrlTemplate={fn()}
        {...overrides}
      />
    </ConsoleLayout>
  );
}

export const Lotes: Story = { render: () => <Screen initialTab="lotes" /> };
export const LotesAdminMarca: Story = { name: 'Lotes (Admin de Marca)', render: () => <Screen initialTab="lotes" master={false} /> };
export const ImportarVistaPrevia: Story = { name: 'Importar · vista previa', render: () => <Screen initialTab="importar" /> };
export const Generar: Story = { render: () => <Screen initialTab="generar" /> };
export const Productos: Story = { render: () => <Screen initialTab="productos" /> };
export const Configuracion: Story = { name: 'Configuración', render: () => <Screen initialTab="configuracion" /> };
export const SinLotes: Story = { name: 'Sin lotes', render: () => <Screen initialTab="lotes" overrides={{ batches: [] }} /> };
export const ConError: Story = {
  name: 'Error de la API',
  render: () => <Screen initialTab="lotes" overrides={{ error: 'La campaña no incluye la submarca Aguardiente Amarillo de Manzanares.' }} />,
};
