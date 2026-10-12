import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LEGAL_COPY } from '../components/LegalNotice.tsx';
import { CODE_STATUS_COPY, type CodeStatus } from '../components/VerificationSeal.tsx';
import { AgeGateView } from './AgeGateView.tsx';
import { CodeLandingView } from './CodeLandingView.tsx';

const landingProps = {
  brandLabel: 'Ron Viejo de Caldas',
  status: 'recognized' as CodeStatus,
  canActivate: true,
  onBack: vi.fn(),
  onExplainCode: vi.fn(),
  onSelectRouteA: vi.fn(),
  onSelectRouteB: vi.fn(),
  onActivate: vi.fn(),
  onJoinWithPin: vi.fn(),
};

describe('VerificationSeal (Guía Técnica §5.6)', () => {
  it('ningún estado afirma autenticidad absoluta', () => {
    for (const copy of Object.values(CODE_STATUS_COPY)) {
      expect(copy.toLowerCase()).not.toMatch(/auténtic|autentic|100 ?%|seguro|original/);
    }
  });
});

describe('CodeLandingView', () => {
  it('muestra la advertencia legal obligatoria', () => {
    render(<CodeLandingView {...landingProps} />);
    expect(screen.getByText(LEGAL_COPY)).toBeInTheDocument();
  });

  it('consultar no reclama: activar exige una acción explícita', async () => {
    const onActivate = vi.fn();
    render(<CodeLandingView {...landingProps} onActivate={onActivate} />);
    expect(onActivate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /activar código y crear mi parche/i }));
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('sin campaña elegible oculta la Ruta A pero mantiene la Ruta B (sin compra)', () => {
    render(<CodeLandingView {...landingProps} canActivate={false} status="already_claimed" />);
    expect(screen.queryByText(/ruta a/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activar código/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ruta b · explora el origen/i)).toBeInTheDocument();
    expect(screen.getByText(/no requiere compra/i)).toBeInTheDocument();
  });

  it('bloquea doble toque mientras se activa', () => {
    render(<CodeLandingView {...landingProps} activating />);
    expect(screen.getByRole('button', { name: /activar código/i })).toBeDisabled();
  });
});

describe('AgeGateView', () => {
  const base = {
    birthDate: { day: '', month: '', year: '' },
    onBirthDateChange: vi.fn(),
    confirmed: false,
    onConfirmedChange: vi.fn(),
    onUnderage: vi.fn(),
    privacyHref: '#p',
    termsHref: '#t',
  };

  it('no permite continuar hasta que el contenedor lo habilite', async () => {
    const onSubmit = vi.fn();
    render(<AgeGateView {...base} canSubmit={false} onSubmit={onSubmit} />);
    const cta = screen.getByRole('button', { name: /continuar/i });
    expect(cta).toBeDisabled();
    await userEvent.click(cta);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envía cuando está habilitado', async () => {
    const onSubmit = vi.fn();
    render(<AgeGateView {...base} confirmed canSubmit onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('solo acepta dígitos en la fecha', async () => {
    const onBirthDateChange = vi.fn();
    render(<AgeGateView {...base} canSubmit={false} onSubmit={vi.fn()} onBirthDateChange={onBirthDateChange} />);
    await userEvent.type(screen.getByLabelText('Día'), 'a');
    expect(onBirthDateChange).toHaveBeenLastCalledWith({ day: '', month: '', year: '' });
  });

  it('ofrece la salida para menores y muestra la advertencia legal', async () => {
    const onUnderage = vi.fn();
    render(<AgeGateView {...base} canSubmit={false} onSubmit={vi.fn()} onUnderage={onUnderage} />);
    await userEvent.click(screen.getByRole('button', { name: /soy menor de edad/i }));
    expect(onUnderage).toHaveBeenCalledOnce();
    expect(screen.getByText(LEGAL_COPY)).toBeInTheDocument();
  });
});
