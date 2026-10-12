import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App.tsx';
import { SessionProvider } from '../lib/session.tsx';
import { installFakeApi } from '../test/fakeApi.ts';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AAAA') } }));
afterEach(() => vi.unstubAllGlobals());

function open(roles: string[], path = '/') {
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

describe('Comercios, Staff y Comercio en la consola', () => {
  it('Marca aprueba un establecimiento pendiente', async () => {
    const api = open(['ADMIN_MARCA'], '/comercios');
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    await waitFor(() => expect(api.requests.some((r) => r.url.endsWith('/approve'))).toBe(true));
    expect(await screen.findByText(/ya puede vincular botellas/)).toBeInTheDocument();
  });

  it('el Staff aterriza en su panel, ve su código y QR y solo su sección', async () => {
    open(['STAFF']);
    expect(await screen.findByRole('heading', { name: 'Mi actividad' })).toBeInTheDocument();
    expect(await screen.findByText('K7M2Q9XD')).toBeInTheDocument();
    expect(await screen.findByAltText('Código QR de tu Staff')).toBeInTheDocument();
    expect(screen.getByText('14 de 40')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Campañas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Smart Tags/ })).not.toBeInTheDocument();
  });

  it('el Comercio aterriza en su panel con conteos y su posición', async () => {
    open(['DEALER']);
    expect(await screen.findByRole('heading', { name: 'Bar de prueba' })).toBeInTheDocument();
    expect(screen.getByText('3.º de 12')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Juegos/ })).not.toBeInTheDocument();
  });
});
