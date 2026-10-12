import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { formatClock } from '../components/EnergyMeter.tsx';
import { PinInput } from '../components/PinInput.tsx';
import { JoinParcheView } from './JoinParcheView.tsx';
import { ParcheRoomView, type ParcheRoomViewProps } from './ParcheRoomView.tsx';

function ControlledPin({ onComplete }: { onComplete?: (v: string) => void }) {
  const [v, setV] = useState('');
  return <PinInput value={v} onChange={setV} onComplete={onComplete} />;
}

describe('PinInput', () => {
  it('escribe dígito a dígito, avanza el foco y avisa al completar', async () => {
    const onComplete = vi.fn();
    render(<ControlledPin onComplete={onComplete} />);
    await userEvent.click(screen.getByLabelText('Dígito 1 de 4'));
    await userEvent.keyboard('4729');
    expect(onComplete).toHaveBeenCalledWith('4729');
    expect(screen.getByLabelText('Dígito 4 de 4')).toHaveValue('9');
  });

  it('acepta pegar el PIN completo e ignora letras', () => {
    const onComplete = vi.fn();
    render(<ControlledPin onComplete={onComplete} />);
    fireEvent.paste(screen.getByLabelText('Dígito 1 de 4'), { clipboardData: { getData: () => '4a7-29' } });
    expect(onComplete).toHaveBeenCalledWith('4729');
  });
});

describe('EnergyMeter', () => {
  it('formatea el reloj', () => {
    expect(formatClock(32 * 60 + 15)).toBe('32:15');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-5)).toBe('00:00');
  });
});

describe('JoinParcheView', () => {
  it('bloquea el PIN cuando no quedan intentos', () => {
    render(
      <JoinParcheView method="pin" onMethodChange={vi.fn()} pin="" onPinChange={vi.fn()} attemptsLeft={0} alias="" onAliasChange={vi.fn()} canSubmit={false} onSubmit={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.getByLabelText('Dígito 1 de 4')).toBeDisabled();
  });

  it('la vista previa del Parche no muestra nombres de personas', () => {
    render(
      <JoinParcheView
        method="pin"
        onMethodChange={vi.fn()}
        pin="4729"
        onPinChange={vi.fn()}
        alias="Vale"
        onAliasChange={vi.fn()}
        preview={{ name: 'Los del bosque de niebla', members: 4 }}
        canSubmit
        onSubmit={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const preview = screen.getByRole('region', { name: 'Parche encontrado' });
    expect(preview).toHaveTextContent('Los del bosque de niebla');
    expect(preview).toHaveTextContent('4 integrantes');
  });
});

const room: ParcheRoomViewProps = {
  name: 'Los del bosque de niebla',
  connection: 'live',
  pin: '4729',
  isHost: true,
  energy: { remainingSeconds: 1935, totalSeconds: 2700 },
  challenge: { xp: 1250, completed: 3 },
  commercial: { points: 500, activatedCodes: 1 },
  participants: [
    { id: 'u1', alias: 'Andrés', isHost: true, status: 'connected' },
    { id: 'u2', alias: 'Caro', status: 'reconnecting' },
  ],
  games: [],
  sessionEndsAt: '6:00 a. m.',
  canActivateCode: true,
  onShowQr: vi.fn(),
  onPlayGame: vi.fn(),
  onChooseGame: vi.fn(),
  onActivateCode: vi.fn(),
  onOpenMenu: vi.fn(),
};

describe('ParcheRoomView (Guía Técnica §5.5)', () => {
  it('muestra XP y Puntos ILC en marcadores separados, sin total combinado', () => {
    render(<ParcheRoomView {...room} />);
    expect(screen.getByRole('region', { name: 'Marcador del reto' })).toHaveTextContent('1.250');
    expect(screen.getByRole('region', { name: 'Puntos ILC de la mesa' })).toHaveTextContent('500');
    expect(screen.queryByText('1.750')).not.toBeInTheDocument();
  });

  it('usa el nombre de moneda configurado por el CMS', () => {
    render(<ParcheRoomView {...room} currencyName="Chupitos" />);
    expect(screen.getByRole('region', { name: 'Chupitos de la mesa' })).toBeInTheDocument();
  });

  it('sin activación comercial (Ruta B) no muestra Puntos ILC ni invita a activar códigos', () => {
    render(<ParcheRoomView {...room} commercial={undefined} canActivateCode={false} multiplierLabel="x2" />);
    expect(screen.queryByText(/puntos ilc/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activar otro código/i })).not.toBeInTheDocument();
  });

  it('solo el anfitrión ve el PIN para invitar', () => {
    const { rerender } = render(<ParcheRoomView {...room} />);
    expect(screen.getByRole('region', { name: 'Invitar al Parche' })).toBeInTheDocument();
    rerender(<ParcheRoomView {...room} isHost={false} />);
    expect(screen.queryByRole('region', { name: 'Invitar al Parche' })).not.toBeInTheDocument();
  });

  it('no incentiva consumo: sin "+ energía" ni alusiones a la botella', () => {
    const { container } = render(<ParcheRoomView {...room} />);
    expect(container.textContent?.toLowerCase()).not.toMatch(/\+ ?energ|botella|trago|ronda/);
  });

  it('sin conexión deshabilita elegir juego', () => {
    render(<ParcheRoomView {...room} connection="offline" />);
    expect(screen.getByRole('button', { name: /elegir juego/i })).toBeDisabled();
  });
});
