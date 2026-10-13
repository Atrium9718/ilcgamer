import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlayerDataGateView } from './PlayerDataGateView.tsx';

const base = { gameTitle: 'El Impostor', privacyHref: '/legal/privacidad', onSaveAccount: vi.fn(), onAccept: vi.fn(), onPrivacy: vi.fn(), onBack: vi.fn() };

describe('PlayerDataGateView', () => {
  it('pide guardar el progreso cuando no hay cuenta', async () => {
    const onSaveAccount = vi.fn();
    render(<PlayerDataGateView {...base} need="account" onSaveAccount={onSaveAccount} />);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar mi progreso' }));
    expect(onSaveAccount).toHaveBeenCalled();
  });
  it('explica qué se autoriza, que se puede retirar y qué pasa si no se acepta', async () => {
    const onAccept = vi.fn();
    const onBack = vi.fn();
    render(<PlayerDataGateView {...base} need="marketing" onAccept={onAccept} onBack={onBack} />);
    expect(screen.getByText(/ILC y sus marcas te envíen novedades y promociones/)).toBeInTheDocument();
    expect(screen.getByText(/retirar esta autorización cuando quieras/)).toBeInTheDocument();
    expect(screen.getByText(/este juego se bloquea; el resto de la app sigue igual/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Acepto y quiero jugar' }));
    expect(onAccept).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'No acepto' }));
    expect(onBack).toHaveBeenCalled();
  });
});
