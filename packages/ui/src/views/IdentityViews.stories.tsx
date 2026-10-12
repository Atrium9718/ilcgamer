import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { ConsentsView } from './ConsentsView.tsx';
import { type OtpStep, OtpView } from './OtpView.tsx';

const meta = { title: 'Vistas/14-15 · Identidad' } satisfies Meta;
export default meta;
type Story = StoryObj;

function Otp({ initialStep = 'destination', codeError }: { initialStep?: OtpStep; codeError?: string }) {
  const [step, setStep] = useState<OtpStep>(initialStep);
  const [destination, setDestination] = useState(initialStep === 'code' ? '300 123 4567' : '');
  const [code, setCode] = useState(initialStep === 'code' ? '481' : '');
  return (
    <OtpView
      step={step}
      channel="whatsapp"
      destination={destination}
      onDestinationChange={setDestination}
      maskedDestination="+57 300 •••• 567"
      code={code}
      onCodeChange={setCode}
      codeError={codeError}
      expiresInSeconds={272}
      resendInSeconds={45}
      onRequest={() => setStep('code')}
      onVerify={fn()}
      onResend={fn()}
      onChangeDestination={() => setStep('destination')}
      alternativeChannel="sms"
      onUseAlternative={fn()}
      onBack={fn()}
    />
  );
}

export const CodigoPaso1Numero: Story = { render: () => <Otp /> };
export const CodigoPaso2Verificar: Story = { render: () => <Otp initialStep="code" /> };
export const CodigoIncorrecto: Story = { render: () => <Otp initialStep="code" codeError="Código incorrecto. Te quedan 3 intentos." /> };

function Consents() {
  const [marketing, setMarketing] = useState(false);
  const [location, setLocation] = useState(false);
  return (
    <ConsentsView
      terms={{ granted: true, noticeVersion: '1.0', updatedLabel: '12 oct. 2026' }}
      marketing={{ granted: marketing }}
      location={{ granted: location }}
      onToggle={(p, v) => (p === 'MARKETING' ? setMarketing(v) : setLocation(v))}
      termsHref="#terminos"
      privacyHref="#privacidad"
      onRight={fn()}
      onBack={fn()}
      onNavigate={fn()}
    />
  );
}
export const Autorizaciones: Story = { render: () => <Consents /> };
