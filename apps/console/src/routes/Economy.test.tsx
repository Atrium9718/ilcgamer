import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App.tsx';
import { SessionProvider } from '../lib/session.tsx';
import { installFakeApi } from '../test/fakeApi.ts';

afterEach(() => vi.unstubAllGlobals());

describe('Economía en la consola', () => {
  it('busca por id (reclamación y luego persona) y registra un reverso con motivo', async () => {
    const api = installFakeApi({ roles: ['ADMIN_MARCA'] });
    render(
      <SessionProvider>
        <MemoryRouter initialEntries={['/economia']}>
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>,
    );
    await userEvent.type(await screen.findByLabelText('Id de reclamación o de persona'), '00000000-0000-7000-8000-0000000000aa');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await userEvent.click(await screen.findByRole('button', { name: /^Reversar 500/ }));
    await userEvent.type(screen.getByLabelText('Motivo (queda en auditoría)'), 'Código reportado como robado');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar reverso' }));
    expect(await screen.findByText(/Reverso registrado/)).toBeInTheDocument();
    await waitFor(() => expect(api.requests.some((r) => r.url.endsWith('/reverse'))).toBe(true));
    expect(api.requests.find((r) => r.url.endsWith('/reverse'))?.body).toEqual({ reason: 'Código reportado como robado' });
    expect(api.requests.map((r) => r.url).filter((u) => u.startsWith('/admin/economy/accounts'))).toEqual([
      '/admin/economy/accounts?claimId=00000000-0000-7000-8000-0000000000aa',
      '/admin/economy/accounts?userId=00000000-0000-7000-8000-0000000000aa',
    ]);
  });
});
