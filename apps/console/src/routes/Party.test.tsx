import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App.tsx';
import { SessionProvider } from '../lib/session.tsx';
import { installFakeApi } from '../test/fakeApi.ts';
import { nextVersionOf } from './Party.tsx';

afterEach(() => vi.unstubAllGlobals());

function open(path: string, roles = ['ADMIN_MARCA']) {
  const api = installFakeApi({ roles });
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </SessionProvider>,
  );
  return api;
}

describe('Juegos de fiesta en la consola', () => {
  it('calcula la siguiente versión', () => {
    expect(nextVersionOf([])).toBe('1.0.0');
    expect(nextVersionOf(['1.0.0', '1.0.9', '1.0.10'])).toBe('1.0.11');
  });

  it('lista los juegos instalados y deja personalizarlos', async () => {
    open('/fiesta');
    expect(await screen.findByRole('heading', { name: 'Juegos de fiesta' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Personalizar/ })).toBeInTheDocument();
  });

  it('valida el contenido en vivo, bloquea guardar y registra la versión siguiente', async () => {
    const api = open('/fiesta/verdad-o-reto');
    const dares = await screen.findByLabelText(/Retos \(uno por línea\)/);
    const save = () => screen.getByRole('button', { name: /Guardar versión 1\.0\.1/ });
    expect(save()).toBeEnabled();

    await userEvent.type(dares, '{enter}Hazte un shot de aguardiente');
    await waitFor(() => expect(save()).toBeDisabled());
    expect(screen.getByText(/Hay campos por corregir/)).toBeInTheDocument();

    await userEvent.clear(dares);
    await userEvent.type(dares, 'Canta una copla\nCuenta un chiste\nBaila 10 segundos');
    await waitFor(() => expect(save()).toBeEnabled());
    await userEvent.click(save());

    await waitFor(() => expect(api.requests.some((r) => r.method === 'POST' && r.url === '/admin/games/modules')).toBe(true));
    const post = api.requests.find((r) => r.method === 'POST' && r.url === '/admin/games/modules');
    expect(post?.body).toMatchObject({ manifest: { moduleId: 'verdad-o-reto', version: '1.0.1' } });
    expect(await screen.findByText(/Guardado como versión 1\.0\.1/)).toBeInTheDocument();
  });
});
