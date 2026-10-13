import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App.tsx';
import { SessionProvider } from '../lib/session.tsx';
import { campaignView, installFakeApi } from '../test/fakeApi.ts';

const renderAt = (path: string) =>
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </SessionProvider>,
  );

afterEach(() => vi.unstubAllGlobals());

describe('Smart Tags en la consola', () => {
  it('TI carga un archivo, ve la vista previa y confirma', async () => {
    const api = installFakeApi({ roles: ['SUPERADMIN'] });
    renderAt('/smart-tags');
    await userEvent.click(await screen.findByRole('tab', { name: 'Importar' }));
    const file = new File(['token,sku,lote\nAAAAAAAAAA01,RVC-8,4100\n'], 'lote.csv', { type: 'text/csv' });
    await userEvent.upload(screen.getByLabelText(/Cargar archivo de la imprenta/), file);
    await userEvent.click(await screen.findByRole('button', { name: /Confirmar importación de 2 códigos/ }));
    expect(await screen.findByText(/Importación confirmada: 2 códigos/)).toBeInTheDocument();
    const upload = api.requests.find((r) => r.url.startsWith('/admin/smarttags/imports?'));
    expect(upload?.url).toBe('/admin/smarttags/imports?fileName=lote.csv');
    expect(upload?.body).toBeInstanceOf(File);
  });

  it('Admin de Marca vincula un lote a una promoción, sin acceso a generar ni importar', async () => {
    // Solo se ofrecen promociones de Ruta A o mixtas: la Ruta B no emite puntos por botella.
    const api = installFakeApi({ roles: ['ADMIN_MARCA'], campaign: { ...campaignView(), route: 'MIXTA' } });
    renderAt('/smart-tags');
    await userEvent.click(await screen.findByRole('button', { name: 'Vincular a promoción, lote 4092' }));
    expect(screen.queryByRole('tab', { name: 'Importar' })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'ruta-origen');
    await userEvent.click(screen.getByRole('button', { name: /Vincular 3 botellas/ }));
    await waitFor(() => expect(api.requests.some((r) => r.url.endsWith('/link'))).toBe(true));
    expect(api.requests.find((r) => r.url.endsWith('/link'))?.body).toEqual({ campaignSlug: 'ruta-origen' });
  });

  it('un revisor no tiene acceso a Smart Tags', async () => {
    installFakeApi({ roles: ['REVISOR_MARCA'] });
    renderAt('/campanas');
    expect(await screen.findByRole('button', { name: /Smart Tags/ })).toBeDisabled();
    expect(screen.getAllByText('Sin acceso')).toHaveLength(8);
  });
});
