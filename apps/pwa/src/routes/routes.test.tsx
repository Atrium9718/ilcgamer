import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from '../App.tsx';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

async function passAgeGate() {
  await userEvent.type(screen.getByLabelText('Día'), '14');
  await userEvent.type(screen.getByLabelText('Mes'), '08');
  await userEvent.type(screen.getByLabelText('Año'), '1990');
  await userEvent.click(screen.getByLabelText(/confirmo que soy mayor de 18/i));
  await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
}

describe('control de edad (Guía Técnica §5.1, §12.2)', () => {
  it('una entrada por QR sin control de edad redirige al age gate', async () => {
    const router = renderAt('/v/demo-reconocido');
    expect(await screen.findByText(/confirma que eres mayor de edad/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/edad');
  });

  it('tras pasar el control regresa al QR escaneado', async () => {
    const router = renderAt('/v/demo-reconocido');
    await screen.findByText(/confirma que eres mayor de edad/i);
    await passAgeGate();
    expect(await screen.findByText('Código reconocido')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/v/demo-reconocido');
  });

  it('una fecha de menor de edad no habilita continuar', async () => {
    renderAt('/edad');
    await userEvent.type(screen.getByLabelText('Día'), '01');
    await userEvent.type(screen.getByLabelText('Mes'), '01');
    await userEvent.type(screen.getByLabelText('Año'), String(new Date().getFullYear() - 10));
    await userEvent.click(screen.getByLabelText(/confirmo que soy mayor de 18/i));
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/solo para mayores de 18/i);
  });
});

describe('flujos con datos de demostración', () => {
  it('muestra el aviso de modo demostración', async () => {
    renderAt('/edad');
    expect(await screen.findByText(/modo demostración/i)).toBeInTheDocument();
  });

  it('un código ya reclamado no ofrece activar, pero sí la Ruta B', async () => {
    renderAt('/v/demo-reclamado');
    await screen.findByText(/confirma que eres mayor de edad/i);
    await passAgeGate();
    expect(await screen.findByText('Este código ya registra una reclamación')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activar código/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no requiere compra/i)).toBeInTheDocument();
  });

  it('el enlace /p/:pin precarga el PIN; un PIN incorrecto informa intentos restantes', async () => {
    renderAt('/p/1111');
    await screen.findByText(/confirma que eres mayor de edad/i);
    await passAgeGate();
    expect(await screen.findByLabelText('Dígito 1 de 4')).toHaveValue('1');
    await userEvent.type(screen.getByLabelText('Tu alias'), 'Vale');
    await userEvent.click(screen.getByRole('button', { name: 'Unirme' }));
    expect(await screen.findByText(/PIN incorrecto. Te quedan 3 intentos/)).toBeInTheDocument();
  });

  it('una ruta desconocida muestra página no encontrada', async () => {
    renderAt('/esto-no-existe');
    expect(await screen.findByText('No encontramos esta página')).toBeInTheDocument();
  });
});
