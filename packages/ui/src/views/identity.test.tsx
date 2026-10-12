import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConsentsView } from './ConsentsView.tsx';
import { OtpView, type OtpViewProps } from './OtpView.tsx';
import { SignUpView } from './SignUpView.tsx';

const otpBase: OtpViewProps = {
  step: 'code',
  channel: 'whatsapp',
  destination: '3001234567',
  onDestinationChange: vi.fn(),
  maskedDestination: '+57 300 •••• 567',
  code: '',
  onCodeChange: vi.fn(),
  onRequest: vi.fn(),
  onVerify: vi.fn(),
  onResend: vi.fn(),
  onChangeDestination: vi.fn(),
  onBack: vi.fn(),
};

describe('OtpView', () => {
  it('muestra el destino enmascarado, nunca el número completo', () => {
    render(<OtpView {...otpBase} />);
    expect(screen.getByText('+57 300 •••• 567')).toBeInTheDocument();
    expect(screen.queryByText(/3001234567/)).not.toBeInTheDocument();
  });

  it('solo verifica con 6 dígitos y bloquea el reenvío durante la espera', async () => {
    const onVerify = vi.fn();
    const { rerender } = render(<OtpView {...otpBase} code="123" resendInSeconds={30} onVerify={onVerify} />);
    expect(screen.getByRole('button', { name: 'Verificar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /reenviar código en 00:30/i })).toBeDisabled();
    rerender(<OtpView {...otpBase} code="123456" resendInSeconds={0} onVerify={onVerify} />);
    await userEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(onVerify).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Reenviar código' })).toBeEnabled();
  });

  it('el primer dígito permite autocompletar el código del SMS', () => {
    render(<OtpView {...otpBase} />);
    expect(screen.getByLabelText('Dígito 1 de 6')).toHaveAttribute('autocomplete', 'one-time-code');
  });
});

describe('ConsentsView', () => {
  it('cada interruptor registra su finalidad por separado', async () => {
    const onToggle = vi.fn();
    render(
      <ConsentsView
        terms={{ granted: true, noticeVersion: '1.0', updatedLabel: '12 oct. 2026' }}
        marketing={{ granted: false }}
        location={{ granted: false }}
        onToggle={onToggle}
        termsHref="#"
        privacyHref="#"
        onRight={vi.fn()}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    const marketing = screen.getByRole('switch', { name: /novedades y promociones/i });
    expect(marketing).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(marketing);
    expect(onToggle).toHaveBeenCalledWith('MARKETING', true);
    expect(screen.getByText(/Versión 1.0 · Aceptado el 12 oct. 2026/)).toBeInTheDocument();
  });
});

describe('SignUpView con proveedores no configurados', () => {
  it('marca Google/Apple como "próximamente" y deja disponible WhatsApp', () => {
    render(
      <SignUpView
        tempAlias="Andrés"
        pending={{ points: 0, xp: 0, badges: 0 }}
        termsAccepted
        onTermsAcceptedChange={vi.fn()}
        marketingOptIn={false}
        onMarketingOptInChange={vi.fn()}
        termsHref="#"
        privacyHref="#"
        availableProviders={['whatsapp', 'email']}
        onAuth={vi.fn()}
        onSkip={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeDisabled();
    expect(screen.getAllByText('Próximamente')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /código por whatsapp/i })).toBeEnabled();
  });
});
