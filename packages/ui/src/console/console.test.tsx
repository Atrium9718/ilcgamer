import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampaignDetailView, type CampaignDetailViewProps } from './CampaignDetailView.tsx';
import { type CampaignEditorValue, CampaignEditorView } from './CampaignEditorView.tsx';
import { CampaignListView } from './CampaignListView.tsx';
import { CHECKLIST_DEMO, DETAIL_DEMO, EDITOR_DEMO, ROWS_DEMO } from './fixtures.ts';

const base: CampaignDetailViewProps = {
  data: DETAIL_DEMO,
  approvals: [
    { kind: 'MARCA', required: true, status: 'approved', byAlias: 'Rev', atLabel: 'hoy', note: null },
    { kind: 'JURIDICA', required: true, status: 'pending', byAlias: null, atLabel: null, note: null },
    { kind: 'PRIVACIDAD', required: false, status: 'not_required', byAlias: null, atLabel: null, note: null },
  ],
  missingApprovals: ['aprobación de Jurídica'],
  checklist: CHECKLIST_DEMO,
  checked: {},
  onToggleChecklist: vi.fn(),
  permissions: { canEdit: false, canSubmit: false, canNewVersion: false, canPublish: true, decideKinds: [], transitions: [] },
  tab: 'resumen',
  onTabChange: vi.fn(),
  onEdit: vi.fn(),
  onSubmit: vi.fn(),
  onNewVersion: vi.fn(),
  onPublish: vi.fn(),
  onDecide: vi.fn(),
  onTransition: vi.fn(),
};

describe('CampaignDetailView (Guía Técnica §5.11, §16)', () => {
  it('bloquea publicar e indica qué aprobación falta', () => {
    render(<CampaignDetailView {...base} />);
    expect(screen.getByRole('button', { name: /publicar versión 2/i })).toBeDisabled();
    expect(screen.getByText('Falta: aprobación de Jurídica')).toBeInTheDocument();
  });

  it('con aprobaciones completas, sigue bloqueado hasta completar el checklist', () => {
    const allChecked = Object.fromEntries(CHECKLIST_DEMO.map((c) => [c.key, true]));
    const { rerender } = render(<CampaignDetailView {...base} missingApprovals={[]} checked={{ menores: true }} />);
    expect(screen.getByText(`Completa el checklist (faltan ${CHECKLIST_DEMO.length - 1})`)).toBeInTheDocument();
    rerender(<CampaignDetailView {...base} missingApprovals={[]} checked={allChecked} />);
    expect(screen.getByRole('button', { name: /publicar versión 2/i })).toBeEnabled();
  });

  it('solo muestra controles de decisión para el tipo que la persona puede emitir, y rechazar exige motivo', async () => {
    const onDecide = vi.fn();
    render(<CampaignDetailView {...base} permissions={{ ...base.permissions, decideKinds: ['JURIDICA'] }} onDecide={onDecide} />);
    expect(screen.getAllByRole('button', { name: 'Aprobar' })).toHaveLength(1);
    const reject = screen.getByRole('button', { name: 'Rechazar' });
    expect(reject).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Observación (Jurídica)'), 'Ajustar términos');
    await userEvent.click(reject);
    expect(onDecide).toHaveBeenCalledWith('JURIDICA', 'RECHAZADO', 'Ajustar términos');
  });

  it('las pestañas son accesibles y muestran las reglas', async () => {
    const onTabChange = vi.fn();
    const { rerender } = render(<CampaignDetailView {...base} onTabChange={onTabChange} />);
    await userEvent.click(screen.getByRole('tab', { name: /reglas/i }));
    expect(onTabChange).toHaveBeenCalledWith('reglas');
    rerender(<CampaignDetailView {...base} tab="reglas" />);
    expect(screen.getByRole('tab', { name: /reglas/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('AA-750')).toBeInTheDocument();
    expect(screen.getByText(/valores de prueba/i)).toBeInTheDocument();
  });
});

describe('CampaignListView', () => {
  it('busca por nombre o identificador y describe las aprobaciones con texto', async () => {
    const onSearchChange = vi.fn();
    const { rerender } = render(
      <CampaignListView
        rows={ROWS_DEMO}
        filter="todas"
        onFilterChange={vi.fn()}
        search=""
        onSearchChange={onSearchChange}
        canCreate
        onCreate={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Marca: aprobada').length).toBeGreaterThan(0);
    rerender(
      <CampaignListView
        rows={ROWS_DEMO}
        filter="todas"
        onFilterChange={vi.fn()}
        search="pereira"
        onSearchChange={onSearchChange}
        canCreate
        onCreate={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Piloto Pereira').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ruta del Origen')).not.toBeInTheDocument();
  });

  it('sin permiso de edición no muestra "Nueva campaña"', () => {
    render(
      <CampaignListView
        rows={ROWS_DEMO}
        filter="todas"
        onFilterChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        canCreate={false}
        onCreate={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /nueva campaña/i })).not.toBeInTheDocument();
  });
});

describe('CampaignEditorView · Juegos', () => {
  const OPTIONS = [
    { id: 'trivia', label: 'Trivia', route: 'A' as const },
    { id: 'b1', label: 'Experiencia 1', route: 'B' as const },
    { id: 'b2', label: 'Experiencia 2', route: 'B' as const },
    { id: 'b3', label: 'Experiencia 3', route: 'B' as const },
  ];
  const render1 = (modules: string[], onChange = vi.fn()) =>
    render(
      <CampaignEditorView
        mode="create"
        value={{ ...EDITOR_DEMO, modules } as CampaignEditorValue}
        onChange={onChange}
        brandOptions={[{ slug: 'ilc', label: 'ILC' }]}
        moduleOptions={OPTIONS}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

  it('no deja elegir una tercera experiencia de Ruta B pero sí otro juego de Ruta A', () => {
    render1(['b1', 'b2']);
    expect(screen.getByRole('checkbox', { name: /Experiencia 3/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Trivia/ })).toBeEnabled();
  });

  it('al marcar un juego lo agrega a la campaña', async () => {
    const onChange = vi.fn();
    render1(['b1'], onChange);
    await userEvent.click(screen.getByRole('checkbox', { name: /Trivia/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ modules: ['b1', 'trivia'] }));
  });
});
