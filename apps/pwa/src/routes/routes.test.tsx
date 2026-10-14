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
    expect(await screen.findByText(/PIN incorrecto o vencido. Te quedan \d intentos/)).toBeInTheDocument();
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

describe('El Parche (modo demostración)', () => {
  it('crear lleva a la sala con el PIN para invitar y el menú permite salir', async () => {
    installFakeApi({ loggedIn: true });
    const router = renderAt('/parche/nuevo');
    await userEvent.type(await screen.findByLabelText('Nombre del Parche'), 'Mesa 4');
    await userEvent.type(screen.getByLabelText('Tu alias en el Parche'), 'Ana');
    await userEvent.click(screen.getByRole('button', { name: /crear/i }));
    await vi.waitFor(() => expect(router.state.location.pathname).toMatch(/^\/parche\/[0-9a-f-]{36}$/));
    expect(await screen.findByText('Mesa 4')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Invitar al Parche' })).toHaveTextContent('4729');
    await userEvent.click(screen.getByRole('button', { name: /opciones|menú/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Salir del Parche' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/jugar'));
  });

  it('el modo un solo celular pide los alias de quienes juegan', async () => {
    installFakeApi({ loggedIn: true });
    renderAt('/parche/nuevo');
    await userEvent.type(await screen.findByLabelText('Nombre del Parche'), 'Sala');
    await userEvent.type(screen.getByLabelText('Tu alias en el Parche'), 'Ana');
    await userEvent.click(screen.getByRole('radio', { name: /un solo celular/i }));
    const create = screen.getByRole('button', { name: /crear/i });
    expect(create).toBeDisabled();
    await userEvent.type(screen.getByLabelText('¿Quiénes juegan contigo?'), 'Bea, Ciro');
    expect(create).toBeEnabled();
  });
});

describe('juegos (modo demostración)', () => {
  it('el catálogo lleva a la trivia, se responde y termina en un resultado verificado sin Puntos ILC', async () => {
    installFakeApi({ loggedIn: true });
    const router = renderAt('/jugar');
    await userEvent.click(await screen.findByRole('button', { name: /Trivia del origen/ }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/jugar/trivia/partida'));
    await userEvent.click(await screen.findByRole('radio', { name: /La caña de azúcar/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await userEvent.click(await screen.findByRole('radio', { name: /En barricas de roble/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/jugar/trivia/resultado'));
    expect(await screen.findByText('Resultado verificado')).toBeInTheDocument();
    expect(screen.getByText(/no otorga Puntos ILC/)).toBeInTheDocument();
  });

  it('la ruleta la decide el servidor y muestra el reto cultural', async () => {
    installFakeApi({ loggedIn: true });
    renderAt('/jugar/ruleta/partida');
    await userEvent.click(await screen.findByRole('button', { name: 'Girar' }));
    expect(await screen.findByText('Salió: Dato curioso', undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/Cuenta un dato/)).toBeInTheDocument();
  });

  it('desde el Parche, el catálogo conserva el contexto del Parche', async () => {
    installFakeApi({ loggedIn: true });
    const router = renderAt('/jugar?parche=00000000-0000-7000-8000-00000000da5e');
    await userEvent.click(await screen.findByRole('button', { name: /Trivia del origen/ }));
    await vi.waitFor(() => expect(router.state.location.search).toBe('?parche=00000000-0000-7000-8000-00000000da5e'));
  });
});

describe('recompensas (modo demostración)', () => {
  it('canjea con la zona elegida, muestra el código de entrega y queda en "Mis canjes"', async () => {
    installFakeApi({ loggedIn: true });
    const router = renderAt('/recompensas');
    await userEvent.click(await screen.findByRole('button', { name: /Gorra oficial ILC/ }));
    await userEvent.selectOptions(await screen.findByLabelText('¿Dónde la retiras?'), 'Pereira');
    await userEvent.click(screen.getByLabelText('Leí las condiciones'));
    await userEvent.click(screen.getByRole('button', { name: /Confirmar canje/ }));
    expect(await screen.findByText('¡Canje listo!')).toBeInTheDocument();
    expect(screen.getByText('DEMO0K7M')).toBeInTheDocument();
    expect(screen.getByText(/Retírala antes del/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver mis canjes' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/recompensas/mis-canjes'));
    expect(await screen.findByText('Por retirar')).toBeInTheDocument();
    expect(screen.getByText(/Gorra oficial ILC/)).toBeInTheDocument();
  });

  it('el filtro por categoría muestra solo lo que corresponde', async () => {
    installFakeApi({ loggedIn: true });
    renderAt('/recompensas');
    await screen.findByRole('button', { name: /Gorra oficial ILC/ });
    await userEvent.click(screen.getByRole('button', { name: 'Experiencias' }));
    expect(screen.queryByRole('button', { name: /Gorra oficial ILC/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Visita guiada/ })).toBeInTheDocument();
  });
});

describe('QR del Staff (/s/:code)', () => {
  it('recuerda el código válido para la próxima activación y entra a jugar; ignora un código mal formado', async () => {
    sessionStorage.clear();
    installFakeApi({ loggedIn: true });
    const router = renderAt('/s/k7m2q9xd');
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/jugar'));
    expect(JSON.parse(sessionStorage.getItem('ilc.staff') ?? '{}').code).toBe('K7M2Q9XD');
    sessionStorage.clear();
    installFakeApi({ loggedIn: true });
    renderAt('/s/corto');
    await vi.waitFor(() => expect(sessionStorage.getItem('ilc.staff')).toBeNull());
  });
});

describe('referidos (Guía Gamificación §16.2)', () => {
  it('el perfil muestra el código del servidor y no promete bonificación si no hay una activa', async () => {
    installFakeApi({ loggedIn: true, status: 'ACTIVA' });
    renderAt('/perfil');
    expect(await screen.findByText('K7M2Q9XD')).toBeInTheDocument();
    expect(screen.getByText(/Por ahora no hay bonificación activa/)).toBeInTheDocument();
    expect(screen.getByText('2 invitados se unieron')).toBeInTheDocument();
  });

  it('al guardar la cuenta, el código del enlace /r se atribuye una sola vez y se descarta', async () => {
    localStorage.setItem('ilc.referral', JSON.stringify('ABCD2345'));
    const api = installFakeApi({ loggedIn: true });
    renderAt('/registro');
    await userEvent.click(await screen.findByLabelText(/acepto los términos/i));
    await userEvent.click(screen.getByRole('button', { name: /código por whatsapp/i }));
    await userEvent.type(await screen.findByLabelText('Celular'), '3001234567');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    await screen.findByText('+57 300 •••• 567');
    await userEvent.click(screen.getByLabelText('Dígito 1 de 6'));
    await userEvent.keyboard('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    await vi.waitFor(() => expect(api.requests).toContain('POST /referrals/attribute'));
    expect(localStorage.getItem('ilc.referral')).toBeNull();
  });
});

describe('registro al entrar (requireProfile)', () => {
  it('tras el control de edad pide nombre, correo, celular y tratamiento de datos, y luego sigue al destino', async () => {
    const api = installFakeApi({ requireProfile: true });
    const router = renderAt('/v/demo-reconocido');
    await passAgeGate();
    expect(await screen.findByRole('heading', { name: 'Bienvenido a ILC Origen' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/bienvenida');

    // Sin autorizar el tratamiento de datos no avanza
    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Ana Gómez');
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@ejemplo.test');
    await userEvent.type(screen.getByLabelText('Celular'), '300 111 2233');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText(/Debes autorizar el tratamiento de tus datos/)).toBeInTheDocument();
    expect(api.profile).toBeUndefined();

    await userEvent.click(screen.getByRole('checkbox', { name: /Autorizo a la Industria Licorera de Caldas/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/v/demo-reconocido'));
    expect(api.profile).toMatchObject({ fullName: 'Ana Gómez', email: 'ana@ejemplo.test', acceptDataTreatment: true, acceptMarketing: false });
  });

  it('sin la exigencia, la app se usa directamente (como hasta ahora)', async () => {
    installFakeApi();
    const router = renderAt('/v/demo-reconocido');
    await passAgeGate();
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/v/demo-reconocido'));
  });
});
