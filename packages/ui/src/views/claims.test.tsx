import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type ClaimRow, MyClaimsView, type MyClaimsViewProps } from './MyClaimsView.tsx';

const base: ClaimRow = {
  id: '1',
  rewardName: 'Gorra de prueba',
  icon: 'styler',
  status: 'RESERVADO',
  code: 'K7M2Q9XD',
  cost: 300,
  zone: 'Manizales',
  deadline: 'Retíralo antes del 30 nov.',
};
const props = (over: Partial<MyClaimsViewProps> = {}): MyClaimsViewProps => ({
  claims: [base],
  onCopy: vi.fn(),
  onRetry: vi.fn(),
  onSeeRewards: vi.fn(),
  onBack: vi.fn(),
  onNavigate: vi.fn(),
  ...over,
});

describe('MyClaimsView (Guía Técnica §5.8)', () => {
  it('destaca el código y la fecha límite de lo que está por retirar, y permite copiarlo', async () => {
    const p = props();
    render(<MyClaimsView {...p} />);
    expect(screen.getByText('Por retirar')).toBeInTheDocument();
    expect(screen.getByText('K7M2Q9XD')).toBeInTheDocument();
    expect(screen.getByText('Retíralo antes del 30 nov.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    expect(p.onCopy).toHaveBeenCalledWith('K7M2Q9XD');
  });

  it('un canje vencido o anulado no muestra código y avisa que se devolvieron los puntos', () => {
    render(<MyClaimsView {...props({ claims: [{ ...base, status: 'EXPIRADO', code: null }] })} />);
    expect(screen.getByText('Vencido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar código' })).not.toBeInTheDocument();
    expect(screen.getByText(/Te devolvimos 300/)).toBeInTheDocument();
  });

  it('el estado vacío invita a ver recompensas', async () => {
    const p = props({ claims: [] });
    render(<MyClaimsView {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ver recompensas' }));
    expect(p.onSeeRewards).toHaveBeenCalled();
  });
});
