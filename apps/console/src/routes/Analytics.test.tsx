import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App.tsx';
import { SessionProvider } from '../lib/session.tsx';
import { installFakeApi } from '../test/fakeApi.ts';

afterEach(() => vi.unstubAllGlobals());

function open(roles: string[]) {
  const api = installFakeApi({ roles });
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/analitica']}>
        <AppRoutes />
      </MemoryRouter>
    </SessionProvider>,
  );
  return api;
}

describe('Analítica en la consola', () => {
  it('Marca ve los tableros y guarda las reglas de referidos', async () => {
    const api = open(['ADMIN_MARCA']);
    expect((await screen.findAllByText('1.240')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('tab', { name: 'Referidos' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Bonificar a quien invita' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar reglas' }));
    await waitFor(() => expect(api.requests.some((r) => r.method === 'PUT' && r.url === '/admin/referrals/settings')).toBe(true));
    expect(await screen.findByText('Reglas de referidos guardadas.')).toBeInTheDocument();
    expect(api.requests.find((r) => r.method === 'PUT')?.body).toMatchObject({ enabled: true });
  });

  it('quien no es de Marca ni TI no tiene la sección', async () => {
    open(['REVISOR_MARCA']);
    expect((await screen.findAllByText('Sin acceso')).length).toBe(8);
  });
});
