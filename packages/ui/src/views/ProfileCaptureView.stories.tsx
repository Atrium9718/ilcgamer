import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { type ProfileCaptureValue, ProfileCaptureView } from './ProfileCaptureView.tsx';

const meta = { title: 'Vistas/16 · Registro al entrar' } satisfies Meta;
export default meta;
type Story = StoryObj;

function Demo({ initial, errors }: { initial: ProfileCaptureValue; errors?: Parameters<typeof ProfileCaptureView>[0]['errors'] }) {
  const [value, setValue] = useState(initial);
  return <ProfileCaptureView value={value} onChange={setValue} onSubmit={fn()} privacyHref="/legal/privacidad" errors={errors} />;
}
const empty: ProfileCaptureValue = { fullName: '', email: '', phone: '', acceptDataTreatment: false, acceptMarketing: false };

export const Vacio: Story = { render: () => <Demo initial={empty} /> };
export const ConErrores: Story = {
  render: () => (
    <Demo
      initial={{ ...empty, fullName: 'An', email: 'no-es-correo' }}
      errors={{
        fullName: 'Escribe tu nombre completo.',
        email: 'Escribe un correo válido.',
        phone: 'Escribe un celular colombiano de 10 dígitos que empiece por 3.',
        acceptDataTreatment: 'Debes autorizar el tratamiento de tus datos para continuar.',
      }}
    />
  ),
};
export const Completo: Story = {
  render: () => (
    <Demo initial={{ fullName: 'Ana Gómez', email: 'ana@ejemplo.test', phone: '300 111 2233', acceptDataTreatment: true, acceptMarketing: true }} />
  ),
};
