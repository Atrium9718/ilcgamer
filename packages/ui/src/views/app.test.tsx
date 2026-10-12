import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LedgerEntryView } from '../components/Ledger.tsx';
import { formatSigned } from '../lib/format.ts';
import { GameResultView } from './GameResultView.tsx';
import { GamesCatalogView } from './GamesCatalogView.tsx';
import { type RewardDetail, RewardsView } from './RewardsView.tsx';
import { ShareCardView } from './ShareCardView.tsx';
import { SignUpView } from './SignUpView.tsx';
import { WalletView } from './WalletView.tsx';

const experience = (id: string) => ({ id, title: `Experiencia ${id}`, subtitle: 's' });

describe('GamesCatalogView (Guía Técnica §5.4)', () => {
  it('muestra como máximo 2 experiencias de Ruta B aunque el servidor envíe más', () => {
    render(<GamesCatalogView quickGames={[]} experiences={['1', '2', '3'].map(experience)} onSelectGame={vi.fn()} onSelectExperience={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByText('Experiencia 1')).toBeInTheDocument();
    expect(screen.getByText('Experiencia 2')).toBeInTheDocument();
    expect(screen.queryByText('Experiencia 3')).not.toBeInTheDocument();
  });
});

describe('GameResultView', () => {
  const handlers = { onClose: vi.fn(), onBackToParche: vi.fn(), onShare: vi.fn(), onPlayAgain: vi.fn(), onRetry: vi.fn() };

  it('mientras verifica no muestra recompensas ni permite seguir (Guía Técnica §12.2)', () => {
    render(<GameResultView gameTitle="Trivia" state={{ status: 'verifying' }} {...handlers} />);
    expect(screen.getByText('Verificando tu resultado…')).toBeInTheDocument();
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /volver al parche/i })).not.toBeInTheDocument();
  });

  it('con error ofrece reintento seguro', async () => {
    const onRetry = vi.fn();
    render(<GameResultView gameTitle="Trivia" state={{ status: 'error' }} {...handlers} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('WalletView (ledger)', () => {
  const entries: LedgerEntryView[] = [
    { id: '1', kind: 'credit', amount: 500, description: 'Código activado', dateLabel: 'hoy' },
    { id: '2', kind: 'debit', amount: -1200, description: 'Canje gorra', dateLabel: 'ayer' },
    { id: '3', kind: 'reversal', amount: -50, description: 'Código anulado', dateLabel: 'antes' },
  ];
  const props = { balance: 2300, entries, onFilterChange: vi.fn(), onConditions: vi.fn(), onRewards: vi.fn(), onHowToEarn: vi.fn(), onNavigate: vi.fn() };

  it('formatea cantidades con signo', () => {
    expect(formatSigned(500)).toBe('+500');
    expect(formatSigned(-1200)).toBe('−1.200');
  });

  it('filtra por tipo de movimiento', () => {
    const { rerender } = render(<WalletView {...props} filter="all" />);
    const list = screen.getByRole('region', { name: 'Movimientos' }).querySelector('ul') as HTMLElement;
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    rerender(<WalletView {...props} filter="adjustments" />);
    expect(screen.getByText('Código anulado')).toBeInTheDocument();
    expect(screen.queryByText('Canje gorra')).not.toBeInTheDocument();
  });
});

describe('RewardsView (Guía Técnica §5.8)', () => {
  const reward: RewardDetail = { id: 'gorra', name: 'Gorra', cost: 1200, conditions: ['Máximo 1 por persona'], termsHref: '#t' };
  const props = { category: 'all' as const, onCategoryChange: vi.fn(), rewards: [reward], onSelect: vi.fn(), onCloseDetail: vi.fn(), onNavigate: vi.fn() };

  it('exige leer las condiciones antes de confirmar el canje', async () => {
    const onConfirmRedeem = vi.fn();
    render(<RewardsView {...props} balance={2300} selected={reward} onConfirmRedeem={onConfirmRedeem} />);
    const confirm = screen.getByRole('button', { name: /confirmar canje/i });
    expect(confirm).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Leí las condiciones'));
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onConfirmRedeem).toHaveBeenCalledWith('gorra');
  });

  it('sin saldo suficiente no permite canjear e informa cuánto falta', () => {
    render(<RewardsView {...props} balance={500} selected={reward} onConfirmRedeem={vi.fn()} />);
    expect(screen.getByRole('button', { name: /confirmar canje/i })).toBeDisabled();
    expect(screen.getAllByText(/te faltan 700/i).length).toBeGreaterThan(0);
  });
});

describe('ShareCardView (Guía Técnica §5.10)', () => {
  it('la tarjeta no incluye cifras de puntos', () => {
    const { container } = render(
      <ShareCardView content={{ badgeName: 'Guardianes', badgeIcon: 'eco', headline: 'Guardianes', message: "El Parche 'X' completó la ruta" }} template="bosque" onTemplateChange={vi.fn()} onShare={vi.fn()} onClose={vi.fn()} />,
    );
    const card = container.querySelector('.aspect-\\[9\\/16\\]') as HTMLElement;
    expect(within(card).queryByText(/\bpuntos\b|\bxp\b/i)).not.toBeInTheDocument();
  });
});

describe('SignUpView (Guía Técnica §5.2)', () => {
  const base = {
    tempAlias: 'Andrés',
    pending: { points: 500, xp: 1250, badges: 2 },
    onTermsAcceptedChange: vi.fn(),
    onMarketingOptInChange: vi.fn(),
    termsHref: '#t',
    privacyHref: '#p',
    onAuth: vi.fn(),
    onBack: vi.fn(),
  };

  it('marketing es independiente y no bloquea crear la cuenta', async () => {
    const onAuth = vi.fn();
    render(<SignUpView {...base} termsAccepted marketingOptIn={false} onAuth={onAuth} onSkip={vi.fn()} />);
    expect(screen.getByLabelText(/novedades y promociones/i)).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: /continuar con google/i }));
    expect(onAuth).toHaveBeenCalledWith('google');
  });

  it('sin aceptar términos no se crea cuenta, pero se puede seguir jugando', async () => {
    const onSkip = vi.fn();
    render(<SignUpView {...base} termsAccepted={false} marketingOptIn={false} onSkip={onSkip} />);
    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /seguir jugando sin registrarme/i }));
    expect(onSkip).toHaveBeenCalledOnce();
  });
});
