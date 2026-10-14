import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App.tsx';
import { SessionProvider } from '../lib/session.tsx';
import { installFakeApi } from '../test/fakeApi.ts';
import { csvCell, registrationsCsv } from './Contacts.tsx';

afterEach(() => vi.unstubAllGlobals());

describe('Registros y contactos', () => {
  it('Marca ve el resumen, la lista, filtra y puede descargar', async () => {
    const api = installFakeApi({ roles: ['ADMIN_MARCA'] });
    render(
      <SessionProvider>
        <MemoryRouter initialEntries={['/contactos']}>
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Registros y contactos' })).toBeInTheDocument();
    expect(await screen.findByText('50%')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Ana Gómez')).toBeInTheDocument();
    expect(within(table).getByText('Beto Ruiz')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Buscar'), 'beto');
    expect(within(screen.getByRole('table')).queryByText('Ana Gómez')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar CSV' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: '7 días' }));
    expect(api.requests.some((r) => r.url === '/admin/contacts/registrations?days=7')).toBe(true);
  });
  it('el CSV protege comillas y fórmulas de hoja de cálculo e incluye las autorizaciones', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    const csv = registrationsCsv({
      days: 30,
      summary: { total: 1, withMarketing: 1, withEmail: 1, withPhone: 1, inPeriod: 1, today: 1 },
      byDay: [],
      rows: [
        {
          fullName: 'Ana',
          email: 'a@b.co',
          phone: '+573001112233',
          registeredAt: '2026-10-01T00:00:00.000Z',
          marketing: true,
          marketingAt: '2026-10-01T00:00:00.000Z',
          source: 'registro',
        },
      ],
    });
    expect(csv).toBe(
      'nombre,correo,celular,autorizo_tratamiento_de_datos,acepta_novedades,fecha_novedades,origen\r\n"Ana","a@b.co","+573001112233","2026-10-01T00:00:00.000Z","si","2026-10-01T00:00:00.000Z","registro"',
    );
  });
});
