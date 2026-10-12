import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EconomyView, type EconomyViewProps } from './EconomyView.tsx';
import { ACCOUNT_DEMO, BADGES_DEMO } from './fixtures.ts';

const props = (over: Partial<EconomyViewProps> = {}): EconomyViewProps => ({
  tab: 'movimientos',
  onTabChange: vi.fn(),
  currencyName: 'Puntos ILC',
  query: 'x',
  onQueryChange: vi.fn(),
  onSearch: vi.fn(),
  account: ACCOUNT_DEMO,
  onReverse: vi.fn(),
  badges: BADGES_DEMO,
  newBadge: { slug: '', name: '', icon: '' },
  onNewBadgeChange: vi.fn(),
  onCreateBadge: vi.fn(),
  reconciliation: null,
  onReconcile: vi.fn(),
  ...over,
});

describe('EconomyView', () => {
  it('solo ofrece reversar créditos con saldo disponible y sin compensar', () => {
    render(<EconomyView {...props()} />);
    expect(screen.getAllByRole('button', { name: /^Reversar/ })).toHaveLength(2);
    expect(screen.getByText('Compensado')).toBeInTheDocument();
    expect(screen.getByText('Conciliado')).toBeInTheDocument();
    expect(screen.getByText(/420/)).toBeInTheDocument();
  });

  it('el reverso exige motivo de al menos 10 caracteres', async () => {
    const p = props();
    render(<EconomyView {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reversar 500 del 10 oct. 2026' }));
    const submit = screen.getByRole('button', { name: 'Registrar reverso' });
    await userEvent.type(screen.getByLabelText('Motivo (queda en auditoría)'), 'corto');
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Motivo (queda en auditoría)'), ' pero ahora sí');
    await userEvent.click(submit);
    expect(p.onReverse).toHaveBeenCalledWith('e2', 'corto pero ahora sí');
  });

  it('la conciliación destaca las diferencias', () => {
    render(
      <EconomyView
        {...props({
          tab: 'conciliacion',
          reconciliation: { checkedAccounts: 3, checkedLabel: 'hoy', mismatches: [{ idHint: '…1', balance: 9, ledgerSum: 5 }] },
        })}
      />,
    );
    expect(screen.getByText(/1 cuentas con diferencia/)).toBeInTheDocument();
  });
});
