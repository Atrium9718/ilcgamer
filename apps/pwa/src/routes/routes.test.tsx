import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../App.tsx';
import { SessionProvider } from '../lib/session.tsx';
import { installFakeApi } from '../test/fakeApi.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>,
  );
  return router;
}

async function passAgeGate() {
  await screen.findByText(/confirma que eres mayor de edad/i);
  await userEvent.type(screen.getByLabelText('Día'), '14');
  await userEvent.type(screen.getByLabelText('Mes'), '08');
  await userEvent.type(screen.getByLabelText('Año'), '1990');
  await userEvent.click(screen.getByLabelText(/confirmo que soy mayor de 18/i));
  await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
}

describe('control de edad (Guía Técnica §5.1, §5.2, §12.2)', () => {
  it('una entrada por QR sin sesión redirige al control de edad', async () => {
    installFakeApi();
    const router = renderAt('/v/demo-reconocido');
    expect(await screen.findByText(/confirma que eres mayor de edad/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/edad');
  });

  it('el control se registra en el servidor y regresa al QR escaneado', async () => {
    const api = installFakeApi();
    const router = renderAt('/v/demo-reconocido');
    await passAgeGate();
    expect(await screen.findByText('Código reconocido')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/v/demo-reconocido');
    expect(api.requests).toContain('POST /age-gate');
  });

  it('una fecha de menor de edad no habilita continuar ni llama a la API', async () => {
    const api = installFakeApi();
    renderAt('/edad');
    await screen.findByText(/confirma que eres mayor de edad/i);
    await userEvent.type(screen.getByLabelText('Día'), '01');
    await userEvent.type(screen.getByLabelText('Mes'), '01');
    await userEvent.type(screen.getByLabelText('Año'), String(new Date().getFullYear() - 10));
    await userEvent.click(screen.getByLabelText(/confirmo que soy mayor de 18/i));
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/solo para mayores de 18/i);
    expect(api.requests).not.toContain('POST /age-gate');
  });

  it('con sesión vigente no vuelve a pedir la edad', async () => {
    installFakeApi({ loggedIn: true });
    renderAt('/v/demo-reconocido');
    expect(await screen.findByText('Código reconocido')).toBeInTheDocument();
  });
});

describe('registro progresivo y consentimientos (§5.2, §9.3)', () => {
  it('registra términos y marketing por separado y verifica por código', async () => {
    const api = installFakeApi({ loggedIn: true });
    const router = renderAt('/registro');
    await userEvent.click(await screen.findByLabelText(/acepto los términos/i));
    await userEvent.click(screen.getByRole('button', { name: /código por whatsapp/i }));
    expect(api.consentLog).toEqual([
      { purpose: 'TERMINOS_Y_PRIVACIDAD', granted: true, noticeVersion: '1.0', source: 'registro' },
      { purpose: 'MARKETING', granted: false, noticeVersion: '1.0', source: 'registro' },
    ]);
    await userEvent.type(await screen.findByLabelText('Celular'), '3001234567');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    expect(await screen.findByText('+57 300 •••• 567')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Dígito 1 de 6'));
    await userEvent.keyboard('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    await screen.findByText(/cuenta verificada/i);
    expect(router.state.location.pathname).toBe('/perfil');
  });

  it('un código incorrecto muestra intentos restantes y limpia el campo', async () => {
    const api = installFakeApi({ loggedIn: true });
    api.consentLog.push({ purpose: 'TERMINOS_Y_PRIVACIDAD', granted: true, source: 'registro' });
    renderAt('/registro/codigo?canal=whatsapp');
    await userEvent.type(await screen.findByLabelText('Celular'), '3001234567');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    await userEvent.click(await screen.findByLabelText('Dígito 1 de 6'));
    await userEvent.keyboard('000000');
    await userEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(await screen.findByText(/código incorrecto. te quedan 4 intentos/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Dígito 1 de 6')).toHaveValue('');
  });

  it('activar marketing desde el perfil registra la decisión con origen "perfil"', async () => {
    const api = installFakeApi({ loggedIn: true });
    renderAt('/perfil/autorizaciones');
    await userEvent.click(await screen.findByRole('switch', { name: /novedades y promociones/i }));
    expect(await screen.findByText('Guardamos tu decisión.')).toBeInTheDocument();
    expect(api.consentLog).toEqual([{ purpose: 'MARKETING', granted: true, noticeVersion: '1.0', source: 'perfil' }]);
  });

  it('eliminar la cuenta pide confirmación y vuelve al control de edad', async () => {
    const api = installFakeApi({ loggedIn: true });
    const router = renderAt('/perfil');
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }));
    expect(await screen.findByText('¿Eliminar tu cuenta?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sí, eliminar mi cuenta/i }));
    await screen.findByText(/confirma que eres mayor de edad/i);
    expect(api.requests).toContain('DELETE /me');
    expect(router.state.location.pathname).toBe('/edad');
  });
});

describe('flujos con datos de demostración', () => {
  it('muestra el aviso de modo demostración', async () => {
    installFakeApi();
    renderAt('/edad');
    expect(await screen.findByText(/modo demostración/i)).toBeInTheDocument();
  });

  it('un código ya reclamado no ofrece activar, pero sí la Ruta B', async () => {
    installFakeApi({ loggedIn: true });
    renderAt('/v/demo-reclamado');
    expect(await screen.findByText('Este código ya registra una reclamación')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activar código/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no requiere compra/i)).toBeInTheDocument();
  });

  it('el enlace /p/:pin precarga el PIN; un PIN incorrecto informa intentos restantes', async () => {
    installFakeApi({ loggedIn: true });
    renderAt('/p/1111');
    expect(await screen.findByLabelText('Dígito 1 de 4')).toHaveValue('1');
    await userEvent.type(screen.getByLabelText('Tu alias'), 'Vale');
    await userEvent.click(screen.getByRole('button', { name: 'Unirme' }));
    expect(await screen.findByText(/PIN incorrecto. Te quedan 3 intentos/)).toBeInTheDocument();
  });

  it('una ruta desconocida muestra página no encontrada', async () => {
    installFakeApi();
    renderAt('/esto-no-existe');
    expect(await screen.findByText('No encontramos esta página')).toBeInTheDocument();
  });
});

describe('entrada por QR de evento (/e/:slug)', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.brand;
  });

  it('envía la campaña al control de edad y aplica su tema al entrar', async () => {
    const api = installFakeApi();
    const router = renderAt('/e/feria-cristal');
    await passAgeGate();
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/jugar'));
    expect(api.lastAgeGate).toMatchObject({ campaignSlug: 'feria-cristal' });
    expect(router.state.location.search).toBe('?evento=feria-cristal');
    expect(document.documentElement.dataset.brand).toBe('aguardiente-cristal');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('activación de un código (Guía Técnica §5.6, §5.7)', () => {
  it('sin cuenta guardada lleva a guardar el progreso y vuelve al código', async () => {
    installFakeApi({ loggedIn: true });
    const router = renderAt('/v/demo-reconocido');
    await userEvent.click(await screen.findByRole('button', { name: /Activar código y crear mi Parche/ }));
    expect(router.state.location.pathname).toBe('/registro');
    expect(JSON.parse(sessionStorage.getItem('ilc.afterSignup') ?? '""')).toBe('/v/demo-reconocido');
  });

  it('con cuenta muestra las condiciones antes de activar y luego el resultado', async () => {
    installFakeApi({ loggedIn: true, status: 'ACTIVA' });
    renderAt('/v/demo-reconocido');
    await userEvent.click(await screen.findByRole('button', { name: /Activar código y crear mi Parche/ }));
    expect(await screen.findByText(/Cada código se activa una sola vez/)).toBeInTheDocument();
    expect(screen.getByText(/vencen 180 días después/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Activar código' }));
    expect(await screen.findByText(/Sumaste 500 Puntos ILC en «Feria de Manizales»/)).toBeInTheDocument();
    expect(await screen.findByText(/Ya activaste este código/)).toBeInTheDocument();
  });
});
