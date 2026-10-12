import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DealerPanelView, type DealerPanelViewProps } from './DealerPanelView.tsx';
import { VENUES_DEMO } from './fixtures.ts';
import { StaffPanelView } from './StaffPanelView.tsx';
import { VenuesAdminView, type VenuesAdminViewProps } from './VenuesAdminView.tsx';

function admin(over: Partial<VenuesAdminViewProps> = {}): VenuesAdminViewProps {
  return {
    tab: 'lista',
    onTabChange: vi.fn(),
    venues: VENUES_DEMO,
    campaignOptions: [{ slug: 'feria-manizales-2027', label: 'Feria de Manizales 2027' }],
    onApprove: vi.fn(),
    onSuspend: vi.fn(),
    onLinkCampaigns: vi.fn(),
    onAddPersonnel: vi.fn(),
    onRemovePersonnel: vi.fn(),
    form: { name: '', channel: 'ON_PREMISE', city: '', department: '', address: '' },
    onFormChange: vi.fn(),
    onCreate: vi.fn(),
    ...over,
  };
}

describe('VenuesAdminView (Instrucciones §3.5)', () => {
  it('aprueba un pendiente y suspende un aprobado solo con motivo', async () => {
    const p = admin();
    render(<VenuesAdminView {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }));
    expect(p.onApprove).toHaveBeenCalledWith('v2');
    await userEvent.click(screen.getByRole('button', { name: 'Suspender' }));
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Motivo de la suspensión/), 'Incumplió las condiciones');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(p.onSuspend).toHaveBeenCalledWith('v1', 'Incumplió las condiciones');
  });

  it('muestra el personal con su código, permite retirar y agregar por correo, y guardar campañas', async () => {
    const p = admin();
    render(<VenuesAdminView {...p} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Personal y campañas' })[0] as HTMLElement);
    const table = screen.getByRole('table', { name: 'Personal de Bar de prueba' });
    expect(within(table).getByText('K7M2Q9XD')).toBeInTheDocument();
    expect(within(table).getByText('Retirado')).toBeInTheDocument();
    await userEvent.click(within(table).getAllByRole('button', { name: 'Retirar' })[0] as HTMLElement);
    expect(p.onRemovePersonnel).toHaveBeenCalledWith('v1', 'u1');
    await userEvent.type(screen.getByLabelText('Correo de la persona'), 'nueva@ilc.test');
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'DEALER');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar personal' }));
    expect(p.onAddPersonnel).toHaveBeenCalledWith('v1', { email: 'nueva@ilc.test', role: 'DEALER' });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar campañas' }));
    expect(p.onLinkCampaigns).toHaveBeenCalledWith('v1', ['feria-manizales-2027']);
  });
});

describe('StaffPanelView (Guía Técnica §5.9)', () => {
  it('muestra el código, el avance de la meta y las vinculaciones sin datos de personas', () => {
    render(
      <StaffPanelView
        venueName="Bar de prueba"
        city="Manizales"
        code="K7M2Q9XD"
        counts={{ today: 3, week: 14 }}
        weeklyGoal={40}
        recent={[{ timeLabel: '9:42 p. m.', campaignTitle: 'Feria', tableName: 'Mesa 4' }]}
      />,
    );
    expect(screen.getByText('K7M2Q9XD')).toBeInTheDocument();
    expect(screen.getByText('14 de 40')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Avance de la meta semanal' })).toHaveAttribute('aria-valuenow', '14');
    expect(screen.getByText('Mesa 4')).toBeInTheDocument();
  });
});

describe('DealerPanelView', () => {
  const base = (over: Partial<DealerPanelViewProps> = {}): DealerPanelViewProps => ({
    tab: 'resumen',
    onTabChange: vi.fn(),
    venueName: 'Bar de prueba',
    city: 'Manizales',
    channelLabel: 'On-premise',
    counts: { today: 4, week: 21, month: 80 },
    series: [{ label: '1', count: 2 }],
    rank: { position: 3, total: 12 },
    campaigns: ['Feria'],
    profile: { description: '', hours: '', address: '', listed: false },
    onProfileChange: vi.fn(),
    onSaveProfile: vi.fn(),
    deliverCode: '',
    onDeliverCodeChange: vi.fn(),
    onDeliver: vi.fn(),
    ...over,
  });

  it('el resumen muestra solo la posición propia y los conteos', () => {
    render(<DealerPanelView {...base()} />);
    expect(screen.getByText('3.º de 12')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('entrega por código solo con al menos 6 caracteres', async () => {
    const p = base({ tab: 'entregar', deliverCode: 'K7M2Q9XD' });
    const { rerender } = render(<DealerPanelView {...base({ tab: 'entregar', deliverCode: 'K7M' })} />);
    expect(screen.getByRole('button', { name: 'Entregar' })).toBeDisabled();
    rerender(<DealerPanelView {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Entregar' }));
    expect(p.onDeliver).toHaveBeenCalled();
  });

  it('el perfil se guarda con el interruptor del directorio', async () => {
    const p = base({ tab: 'perfil' });
    render(<DealerPanelView {...p} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Mostrar en el directorio' }));
    expect(p.onProfileChange).toHaveBeenCalledWith(expect.objectContaining({ listed: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(p.onSaveProfile).toHaveBeenCalled();
  });
});
