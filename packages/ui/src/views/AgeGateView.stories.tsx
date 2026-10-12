import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import type { DateParts } from '../components/DateOfBirthInput.tsx';
import { AgeGateView, type AgeGateViewProps } from './AgeGateView.tsx';

const LINKS = [
  { label: 'Términos y condiciones', href: '#terminos' },
  { label: 'Política de privacidad', href: '#privacidad' },
  { label: 'Consumo responsable', href: '#consumo-responsable' },
];

/** Envoltorio interactivo solo para Storybook: simula lo que hará el contenedor real. */
function Interactive(props: Partial<AgeGateViewProps>) {
  const [birthDate, setBirthDate] = useState<DateParts>(props.birthDate ?? { day: '', month: '', year: '' });
  const [confirmed, setConfirmed] = useState(props.confirmed ?? false);
  const complete = birthDate.day.length > 0 && birthDate.month.length > 0 && birthDate.year.length === 4;
  return (
    <AgeGateView
      privacyHref="#privacidad"
      termsHref="#terminos"
      footerLinks={LINKS}
      onSubmit={fn()}
      onUnderage={fn()}
      onHelp={fn()}
      {...props}
      birthDate={birthDate}
      onBirthDateChange={setBirthDate}
      confirmed={confirmed}
      onConfirmedChange={setConfirmed}
      canSubmit={props.canSubmit ?? (complete && confirmed)}
    />
  );
}

const meta = {
  title: 'Vistas/01 · Control de edad',
  component: Interactive,
} satisfies Meta<typeof Interactive>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inicial: Story = {};

export const Completo: Story = {
  args: { birthDate: { day: '14', month: '08', year: '1990' }, confirmed: true },
};

export const Enviando: Story = {
  args: { birthDate: { day: '14', month: '08', year: '1990' }, confirmed: true, submitting: true },
};

export const FechaInvalida: Story = {
  args: {
    birthDate: { day: '31', month: '02', year: '1990' },
    confirmed: true,
    canSubmit: false,
    error: 'La fecha no es válida. Revisa el día y el mes.',
  },
};
