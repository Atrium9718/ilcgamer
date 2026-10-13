import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App.tsx';
import { parseZones, rewardFormToInput } from '../lib/mapping.ts';
import { SessionProvider } from '../lib/session.tsx';
import { installFakeApi } from '../test/fakeApi.ts';

afterEach(() => vi.unstubAllGlobals());

function open(roles: string[]) {
  const api = installFakeApi({ roles });
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/recompensas']}>
        <AppRoutes />
      </MemoryRouter>
    </SessionProvider>,
  );
  return api;
}

describe('Recompensas en la consola', () => {
  it('muestra el stock bajo por zona y activa una recompensa', async () => {
    const api = open(['ADMIN_MARCA']);
    expect(await screen.findByText('Stock bajo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(api.requests.some((r) => r.url.endsWith('/activate'))).toBe(true));
    expect(await screen.findByText(/ya se ofrece a las personas/)).toBeInTheDocument();
  });

  it('quien no es de Marca ni TI no tiene la sección', async () => {
    open(['REVISOR_JURIDICO']);
    expect(await screen.findAllByText('Sin acceso')).toHaveLength(8);
  });
});

describe('formulario de recompensa → contrato', () => {
  it('interpreta zonas con y sin umbral, condiciones por línea y fechas como días completos de Colombia', () => {
    expect(parseZones('Manizales: 10\nPereira: 5: 2\n\n')).toEqual([
      { zone: 'Manizales', available: 10, lowStockAlert: 5 },
      { zone: 'Pereira', available: 5, lowStockAlert: 2 },
    ]);
    const input = rewardFormToInput({
      slug: ' gorra ',
      name: 'Gorra',
      description: '',
      type: 'MERCHANDISING',
      cost: 300,
      conditionsText: 'Una\n\n Dos ',
      maxPerUser: 1,
      startsAt: '2026-11-01',
      endsAt: '2026-11-30',
      fulfillment: 'Trade',
      campaignSlug: '',
      zonesText: 'Manizales: 3',
    });
    expect(input).toMatchObject({ slug: 'gorra', conditions: ['Una', 'Dos'], startsAt: '2026-11-01T05:00:00.000Z', endsAt: '2026-12-01T05:00:00.000Z' });
    expect(input).not.toHaveProperty('campaignSlug');
  });
});
