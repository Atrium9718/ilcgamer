import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CLAIMS_ADMIN_DEMO, REWARDS_ADMIN_DEMO } from './fixtures.ts';
import { type NewRewardValue, RewardsAdminView, type RewardsAdminViewProps } from './RewardsAdminView.tsx';

const EMPTY: NewRewardValue = {
  slug: '',
  name: '',
  description: '',
  type: 'DIGITAL',
  cost: 0,
  conditionsText: '',
  maxPerUser: 1,
  startsAt: '',
  endsAt: '',
  fulfillment: '',
  campaignSlug: '',
  zonesText: '',
};
function props(over: Partial<RewardsAdminViewProps> = {}): RewardsAdminViewProps {
  return {
    tab: 'catalogo',
    onTabChange: vi.fn(),
    rewards: REWARDS_ADMIN_DEMO,
    onActivate: vi.fn(),
    onDeactivate: vi.fn(),
    onAdjustStock: vi.fn(),
    form: EMPTY,
    onFormChange: vi.fn(),
    onCreate: vi.fn(),
    campaignOptions: [],
    claims: CLAIMS_ADMIN_DEMO,
    statusFilter: 'ALL',
    onStatusFilterChange: vi.fn(),
    deliverCode: '',
    onDeliverCodeChange: vi.fn(),
    onDeliver: vi.fn(),
    onCancelClaim: vi.fn(),
    ...over,
  };
}

describe('RewardsAdminView (Guía Técnica §5.8)', () => {
  it('marca el stock bajo y agotado por zona y avisa que quien crea no activa', () => {
    render(<RewardsAdminView {...props()} />);
    const table = screen.getByRole('table', { name: 'Stock por zona de Gorra de prueba' });
    expect(within(table).getByText('Stock bajo')).toBeInTheDocument();
    expect(within(table).getByText('Agotada')).toBeInTheDocument();
    expect(screen.getByText(/Quien crea una recompensa no puede activarla/)).toBeInTheDocument();
  });

  it('activa directo, pero desactivar exige motivo', async () => {
    const p = props();
    render(<RewardsAdminView {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    expect(p.onActivate).toHaveBeenCalledWith('r2');
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Motivo/), 'Error en el costo');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(p.onDeactivate).toHaveBeenCalledWith('r1', 'Error en el costo');
  });

  it('el ajuste de stock pide zona, cambio distinto de cero y motivo', async () => {
    const p = props();
    render(<RewardsAdminView {...p} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Ajustar stock' })[0] as HTMLElement);
    await userEvent.selectOptions(screen.getByLabelText('Zona'), 'Pereira');
    await userEvent.type(screen.getByLabelText(/Motivo/), 'Reposición');
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    const delta = screen.getByLabelText(/Cambio/);
    await userEvent.clear(delta);
    await userEvent.type(delta, '10');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(p.onAdjustStock).toHaveBeenCalledWith('r1', { zone: 'Pereira', delta: 10, reason: 'Reposición' });
  });

  it('en canjes entrega por código y solo deja anular lo pendiente', async () => {
    const p = props({ tab: 'canjes', deliverCode: 'K7M2Q9XD' });
    render(<RewardsAdminView {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Entregar' }));
    expect(p.onDeliver).toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: 'Anular' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Anular' }));
    await userEvent.type(screen.getByLabelText(/Motivo/), 'Producto dañado');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(p.onCancelClaim).toHaveBeenCalledWith('c1', 'Producto dañado');
  });

  it('el formulario muestra los errores por campo del servidor', () => {
    render(<RewardsAdminView {...props({ tab: 'nueva', fieldErrors: { conditions: ['Indica al menos una condición'] } })} />);
    expect(screen.getByText('Indica al menos una condición')).toBeInTheDocument();
  });
});
