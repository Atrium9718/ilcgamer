import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App.tsx';
import { SessionProvider } from '../lib/session.tsx';
import { installFakeApi } from '../test/fakeApi.ts';
import { contactsCsv, csvCell } from './Contacts.tsx';

afterEach(() => vi.unstubAllGlobals());

describe('Contactos con autorización', () => {
  it('Marca ve la lista con su total y puede descargarla', async () => {
    installFakeApi({ roles: ['ADMIN_MARCA'] });
    render(
      <SessionProvider>
        <MemoryRouter initialEntries={['/contactos']}>
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>,
    );
    expect(await screen.findByText('1 contacto')).toBeInTheDocument();
    expect(screen.getByText('ana@ejemplo.test')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar CSV' })).toBeEnabled();
  });
  it('el CSV protege comillas y fórmulas de hoja de cálculo', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(contactsCsv({ total: 1, rows: [{ alias: 'Ana', email: 'a@b.co', phone: null, optedInAt: '2026-10-01T00:00:00.000Z', source: 'registro' }] })).toBe(
      'alias,correo,celular,autorizo,origen\r\n"Ana","a@b.co","","2026-10-01T00:00:00.000Z","registro"',
    );
  });
});
