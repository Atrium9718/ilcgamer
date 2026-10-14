import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type ProfileCaptureValue, ProfileCaptureView } from './ProfileCaptureView.tsx';

function Harness({ onSubmit, errors }: { onSubmit: () => void; errors?: Partial<Record<keyof ProfileCaptureValue, string>> }) {
  const [value, setValue] = useState<ProfileCaptureValue>({ fullName: '', email: '', phone: '', acceptDataTreatment: false, acceptMarketing: false });
  return <ProfileCaptureView value={value} onChange={setValue} onSubmit={onSubmit} privacyHref="/legal/privacidad" errors={errors} />;
}

describe('ProfileCaptureView (registro al entrar)', () => {
  it('pide nombre, correo, celular y el tratamiento de datos; las novedades son aparte y opcionales', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Ana Gómez');
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@ejemplo.test');
    await userEvent.type(screen.getByLabelText('Celular'), '3001112233');
    const data = screen.getByRole('checkbox', { name: /Autorizo a la Industria Licorera de Caldas el tratamiento de mis datos personales/ });
    const marketing = screen.getByRole('checkbox', { name: /novedades y promociones/ });
    expect(data).not.toBeChecked();
    expect(marketing).not.toBeChecked();
    await userEvent.click(data);
    expect(data).toBeChecked();
    expect(marketing).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: /política de tratamiento de datos/ })).toHaveAttribute('href', '/legal/privacidad');
  });
  it('muestra los errores de cada campo y de la autorización', () => {
    render(
      <Harness
        onSubmit={vi.fn()}
        errors={{ email: 'Escribe un correo válido.', acceptDataTreatment: 'Debes autorizar el tratamiento de tus datos para continuar.' }}
      />,
    );
    expect(screen.getByText('Escribe un correo válido.')).toBeInTheDocument();
    expect(screen.getByText('Debes autorizar el tratamiento de tus datos para continuar.')).toBeInTheDocument();
  });
});
