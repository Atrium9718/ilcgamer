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
      <MemoryRouter initialEntries={['/juegos']}>
        <AppRoutes />
      </MemoryRouter>
    </SessionProvider>,
  );
  return api;
}

describe('Juegos en la consola', () => {
  it('quien revisa Marca puede aprobar, y la solicitud lleva el tipo de aprobación', async () => {
    const api = open(['REVISOR_MARCA']);
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar Marca' }));
    await waitFor(() => expect(api.requests.some((r) => r.url.endsWith('/approvals'))).toBe(true));
    expect(api.requests.find((r) => r.url.endsWith('/approvals'))?.body).toEqual({ kind: 'MARCA', decision: 'APROBADO' });
    expect(await screen.findByText('Aprobación registrada.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar Jurídica' })).not.toBeInTheDocument();
  });

  it('la guía de integración se muestra en la consola', async () => {
    open(['ADMIN_MARCA']);
    await userEvent.click(await screen.findByRole('tab', { name: 'Guía de integración' }));
    expect(await screen.findByLabelText('Guía de integración de juegos')).toHaveTextContent('Guía de integración de juegos');
    expect(screen.queryByRole('tab', { name: 'Registrar módulo' })).not.toBeInTheDocument();
  });

  it('TI ve la pestaña de registro y avisa si el manifiesto no es JSON', async () => {
    open(['SUPERADMIN']);
    await userEvent.click(await screen.findByRole('tab', { name: 'Registrar módulo' }));
    await userEvent.click(screen.getByLabelText('Manifiesto del módulo'));
    await userEvent.paste('{ no es json');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar versión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no es un JSON válido');
  });
});
