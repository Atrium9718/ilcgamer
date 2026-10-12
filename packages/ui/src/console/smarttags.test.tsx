import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BATCHES_DEMO, BRAND_OPTIONS, PREVIEW_DEMO, PRODUCTS_DEMO } from './fixtures.ts';
import { SmartTagsView, type SmartTagsViewProps } from './SmartTagsView.tsx';

function props(over: Partial<SmartTagsViewProps> = {}): SmartTagsViewProps {
  return {
    tab: 'lotes',
    onTabChange: vi.fn(),
    canManageCatalog: true,
    isMaster: true,
    batches: BATCHES_DEMO,
    campaignOptions: [{ slug: 'feria', label: 'Feria' }],
    onLink: vi.fn(),
    onDistribute: vi.fn(),
    onRevoke: vi.fn(),
    onExport: vi.fn(),
    preview: PREVIEW_DEMO,
    onFile: vi.fn(),
    onConfirmImport: vi.fn(),
    onDiscardImport: vi.fn(),
    onDownloadIssues: vi.fn(),
    generate: { sku: 'RVC-8', batchLabel: '1', supplier: '', count: 10 },
    onGenerateChange: vi.fn(),
    onGenerate: vi.fn(),
    products: PRODUCTS_DEMO,
    newProduct: { sku: '', name: '', brandSlug: '' },
    onNewProductChange: vi.fn(),
    onCreateProduct: vi.fn(),
    brandOptions: BRAND_OPTIONS,
    urlTemplate: 'https://ilc.app/v/{token}',
    onUrlTemplateChange: vi.fn(),
    onSaveUrlTemplate: vi.fn(),
    ...over,
  };
}

describe('SmartTagsView', () => {
  it('Admin de Marca no ve generar ni importar, ni puede revocar', () => {
    render(<SmartTagsView {...props({ isMaster: false })} />);
    expect(screen.queryByRole('tab', { name: 'Generar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Importar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Revocar lote/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Vincular a promoción/ })).toHaveLength(2);
  });

  it('vincular pide elegir la promoción', async () => {
    const p = props();
    render(<SmartTagsView {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Vincular a promoción, lote 118' }));
    const submit = screen.getByRole('button', { name: /Vincular 8.000 botellas/ });
    expect(submit).toBeDisabled();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'feria');
    await userEvent.click(submit);
    expect(p.onLink).toHaveBeenCalledWith('b2', 'feria');
  });

  it('revocar exige un motivo', async () => {
    const p = props();
    render(<SmartTagsView {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Revocar lote, lote 4092' }));
    const submit = screen.getByRole('button', { name: 'Revocar lote 4092' });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Motivo de la revocación'), 'Etiquetas robadas');
    await userEvent.click(submit);
    expect(p.onRevoke).toHaveBeenCalledWith('b1', 'Etiquetas robadas');
  });

  it('la vista previa muestra el resumen, advertencias y solo el último tramo de los tokens', async () => {
    const p = props({ tab: 'importar' });
    render(<SmartTagsView {...p} />);
    expect(screen.getByText('9.980')).toBeInTheDocument();
    expect(screen.getByText(/menos de 10 caracteres/)).toBeInTheDocument();
    expect(screen.getByText('••••7K2Q')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Confirmar importación de 9.980 códigos/ }));
    expect(p.onConfirmImport).toHaveBeenCalled();
  });

  it('la plantilla de URL es solo lectura para quien no es TI', () => {
    render(<SmartTagsView {...props({ tab: 'configuracion', isMaster: false })} />);
    expect(screen.getByLabelText('Estructura de la URL')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Guardar plantilla' })).not.toBeInTheDocument();
  });
});
