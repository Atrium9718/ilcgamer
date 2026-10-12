import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App.tsx';
import { SessionProvider } from './lib/session.tsx';
import { campaignView, installFakeApi } from './test/fakeApi.ts';

function renderAt(path: string) {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </SessionProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('Consola', () => {
  it('sin sesión pide el correo y el código, y luego muestra las campañas', async () => {
    const api = installFakeApi({ loggedIn: false });
    renderAt('/campanas');
    await userEvent.type(await screen.findByLabelText('Correo corporativo'), 'ana@ilc.com.co');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    await screen.findByText(/a•••@ilc.com.co/);
    await userEvent.click(screen.getByLabelText('Dígito 1 de 6'));
    await userEvent.keyboard('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect((await screen.findAllByText('Ruta del Origen')).length).toBeGreaterThan(0);
    expect(api.requests.find((r) => r.url === '/auth/otp/request')?.body).toEqual({ channel: 'email', destination: 'ana@ilc.com.co' });
  });

  it('una cuenta sin rol de consola no entra', async () => {
    installFakeApi({ roles: [] });
    renderAt('/campanas');
    expect(await screen.findByText('Tu cuenta no tiene acceso a la consola')).toBeInTheDocument();
  });

  it('la revisión jurídica solo puede decidir su propia aprobación', async () => {
    const api = installFakeApi({ roles: ['REVISOR_JURIDICO'] });
    renderAt('/campanas/ruta-origen');
    const approve = await screen.findAllByRole('button', { name: 'Aprobar' });
    expect(approve).toHaveLength(1);
    await userEvent.click(approve[0] as HTMLElement);
    await waitFor(() => expect(api.requests.some((r) => r.url === '/admin/campaigns/ruta-origen/approvals')).toBe(true));
    expect(api.requests.find((r) => r.url.endsWith('/approvals'))?.body).toEqual({ kind: 'JURIDICA', decision: 'APROBADO' });
    const publish = screen.queryByRole('button', { name: /Publicar versión/ });
    if (publish) expect(publish).toBeDisabled();
  });

  it('publicar exige completar el checklist y envía todos los puntos confirmados', async () => {
    const api = installFakeApi({ roles: ['ADMIN_MARCA'], campaign: campaignView({ state: 'APROBADA' }) });
    renderAt('/campanas/ruta-origen');
    const publish = await screen.findByRole('button', { name: 'Publicar versión 1' });
    expect(publish).toBeDisabled();
    const list = screen.getAllByRole('checkbox');
    for (const box of list) await userEvent.click(box);
    expect(publish).toBeEnabled();
    await userEvent.click(publish);
    await waitFor(() => expect(api.requests.some((r) => r.url.endsWith('/publish'))).toBe(true));
    const sent = api.requests.find((r) => r.url.endsWith('/publish'))?.body as { checklist: Record<string, boolean> };
    expect(Object.keys(sent.checklist)).toHaveLength(11);
    expect(await screen.findAllByText('Programada')).not.toHaveLength(0);
  });

  it('al crear, los errores de validación de la API se muestran en su campo', async () => {
    const api = installFakeApi({ roles: ['EDITOR_CONTENIDO'] });
    renderAt('/campanas/nueva');
    await userEvent.click(await screen.findByRole('button', { name: 'Crear borrador' }));
    expect(await screen.findByText(/Revisa el campo marcado/)).toBeInTheDocument();
    expect(screen.getAllByText('Mínimo 3 caracteres').length).toBeGreaterThan(0);
    expect(api.requests.find((r) => r.method === 'POST' && r.url === '/admin/campaigns')).toBeDefined();
  });
});
