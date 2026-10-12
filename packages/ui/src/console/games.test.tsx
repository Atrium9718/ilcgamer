import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MODULES_DEMO } from './fixtures.ts';
import { GamesView, type GamesViewProps, type ModuleRow } from './GamesView.tsx';

function props(over: Partial<GamesViewProps> = {}): GamesViewProps {
  return {
    tab: 'catalogo',
    onTabChange: vi.fn(),
    isMaster: true,
    canManage: true,
    approvalKinds: ['MARCA'],
    modules: MODULES_DEMO,
    onTest: vi.fn(),
    onApprove: vi.fn(),
    onActivate: vi.fn(),
    onDeactivate: vi.fn(),
    defaults: ['trivia-origen'],
    onDefaultsChange: vi.fn(),
    onSaveDefaults: vi.fn(),
    manifestText: '',
    onManifestChange: vi.fn(),
    onRegister: vi.fn(),
    secret: null,
    onShowSecret: vi.fn(),
    onRotateSecret: vi.fn(),
    onHideSecret: vi.fn(),
    guide: '# Guía',
    ...over,
  };
}

describe('GamesView', () => {
  it('muestra versiones y aprobaciones, y permite aprobar solo lo que el rol puede', async () => {
    const p = props();
    render(<GamesView {...p} />);
    expect(screen.getByText('Activo v1.0.0')).toBeInTheDocument();
    expect(screen.getByText(/Falta la advertencia legal/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar Marca' }));
    expect(p.onApprove).toHaveBeenCalledWith('explorador', '0.9.0', 'MARCA', 'APROBADO', '');
    expect(screen.queryByRole('button', { name: 'Aprobar Jurídica' })).not.toBeInTheDocument();
  });

  it('desactivar exige un motivo de al menos 5 caracteres', async () => {
    const p = props();
    render(<GamesView {...p} />);
    const row = screen.getByRole('table', { name: 'Versiones de Trivia del origen' });
    await userEvent.click(within(row).getByRole('button', { name: 'Desactivar' }));
    const confirm = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Motivo para desactivar/), 'error en contenido');
    await userEvent.click(confirm);
    expect(p.onDeactivate).toHaveBeenCalledWith('trivia-origen', 'error en contenido');
  });

  it('permite volver a una versión anterior aprobada', async () => {
    const p = props();
    render(<GamesView {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Volver a esta versión' }));
    expect(p.onActivate).toHaveBeenCalledWith('maestros-sabor', '1.0.0');
  });

  it('en los juegos por defecto bloquea una tercera experiencia de Ruta B', () => {
    const base = MODULES_DEMO.find((m) => m.moduleId === 'maestros-sabor') as ModuleRow;
    const modules = [...MODULES_DEMO, { ...base, moduleId: 'otro-b', title: 'Otro B' }, { ...base, moduleId: 'tercero-b', title: 'Tercero B' }];
    render(<GamesView {...props({ modules, defaults: ['maestros-sabor', 'otro-b'] })} />);
    expect(screen.getByRole('checkbox', { name: /Tercero B/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Otro B/ })).toBeEnabled();
  });

  it('sin rol de TI no hay pestaña de registro ni secreto del proveedor', () => {
    render(<GamesView {...props({ isMaster: false })} />);
    expect(screen.queryByRole('tab', { name: 'Registrar módulo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Secreto del proveedor' })).not.toBeInTheDocument();
  });

  it('muestra los errores del manifiesto por campo', () => {
    render(<GamesView {...props({ tab: 'registrar', fieldErrors: { 'scoring.xpMax': ['El XP es de la Ruta B'] } })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('scoring.xpMax');
  });
});
