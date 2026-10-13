import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATEGORIES, HEADBAND, NEVER_NEVER, SPINNER, STEADY_HAND, TRUTH_DARE } from './fixtures.ts';
import { PartyGameView, SpinnerArt } from './PartyGames.tsx';

const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('juegos de fiesta: marco', () => {
  it('cada juego muestra su título y tiene salida; el aviso legal está presente', async () => {
    const onExit = vi.fn();
    render(<PartyGameView config={TRUTH_DARE} onExit={onExit} />);
    expect(screen.getByRole('heading', { level: 1, name: 'VERDAD O RETO' })).toBeInTheDocument();
    expect(screen.getByText(/El exceso de alcohol es perjudicial/)).toBeInTheDocument();
    await setup().click(screen.getByRole('button', { name: /Salir/ }));
    expect(onExit).toHaveBeenCalled();
  });
});

describe('girador de retos', () => {
  it('gira, no deja girar dos veces a la vez y al terminar muestra un reto de la lista', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    const user = setup();
    render(<PartyGameView config={SPINNER} onExit={vi.fn()} />);
    const spin = screen.getByRole('button', { name: '¡GIRAR!' });
    await user.click(spin);
    expect(spin).toBeDisabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3700);
    });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('EL DESTINO DECIDIÓ')).toBeInTheDocument();
    expect(SPINNER.prompts).toContain(within(dialog).getByText(/Reto de prueba/).textContent);
    await user.click(within(dialog).getByRole('button', { name: '¡CONTINUAR LA RUMBA!' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '¡GIRAR!' })).toBeEnabled();
  });

  it('el girador es una flecha o una aguja con el nombre que define la configuración (nunca una botella)', () => {
    const { container, rerender } = render(
      <svg aria-hidden="true">
        <SpinnerArt spinner={SPINNER.spinner} />
      </svg>,
    );
    expect(container.textContent).toContain('AMARILLO');
    expect(container.textContent).toContain('DE MANZANARES');
    rerender(
      <svg aria-hidden="true">
        <SpinnerArt spinner={{ ...SPINNER.spinner, shape: 'aguja', labelTop: 'RON', labelBottom: 'VIEJO' }} />
      </svg>,
    );
    expect(container.textContent).toContain('RON');
    expect(container.querySelector('polygon')).not.toBeNull();
  });
});

describe('verdad o reto', () => {
  it('VERDAD y RETO sacan de su lista y la penitencia reemplaza al trago', async () => {
    const user = setup();
    render(<PartyGameView config={TRUTH_DARE} onExit={vi.fn()} />);
    expect(screen.getByText(TRUTH_DARE.intro)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'VERDAD' }));
    expect(TRUTH_DARE.truths.some((t) => screen.queryByText(t))).toBe(true);
    await user.click(screen.getByRole('button', { name: 'RETO' }));
    expect(TRUTH_DARE.dares.some((t) => screen.queryByText(t))).toBe(true);
    await user.click(screen.getByRole('button', { name: '¿SE REHUSÓ? ¡PENITENCIA!' }));
    expect(screen.getByText('¡PENITENCIA!')).toBeInTheDocument();
    expect(screen.getByText(TRUTH_DARE.skipText)).toBeInTheDocument();
  });
});

describe('categorías con cronómetro', () => {
  it('cuenta 5 segundos, al llegar a 0 avisa y reinicia al continuar; «respondió bien» reinicia el tiempo', async () => {
    const user = setup();
    render(<PartyGameView config={CATEGORIES} onExit={vi.fn()} />);
    expect(screen.getByRole('timer')).toHaveAccessibleName('Quedan 5 segundos');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole('timer')).toHaveAccessibleName('Quedan 3 segundos');
    await user.click(screen.getByRole('button', { name: /RESPONDIÓ BIEN/ }));
    expect(screen.getByRole('timer')).toHaveAccessibleName('Quedan 5 segundos');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(CATEGORIES.lostMessage)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Continuar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveAccessibleName('Quedan 5 segundos');
  });

  it('«se equivocó» avisa de inmediato y «cambiar tema» sortea otro y reinicia', async () => {
    const user = setup();
    render(<PartyGameView config={CATEGORIES} onExit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /SE EQUIVOCÓ/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByRole('button', { name: 'CAMBIAR TEMA' }));
    expect(CATEGORIES.topics.some((t) => screen.queryByText(t.topic))).toBe(true);
    expect(screen.getByRole('timer')).toHaveAccessibleName('Quedan 5 segundos');
  });
});

describe('yo nunca nunca', () => {
  it('recorre las confesiones en orden y vuelve al principio', async () => {
    const user = setup();
    render(<PartyGameView config={NEVER_NEVER} onExit={vi.fn()} />);
    expect(screen.getByText(NEVER_NEVER.phrases[0] as string)).toBeInTheDocument();
    expect(screen.getByText(/LEVANTA LA MANO/)).toBeInTheDocument();
    for (const i of [1, 2, 0]) {
      await user.click(screen.getByRole('button', { name: /SIGUIENTE CONFESIÓN/ }));
      expect(screen.getByText(NEVER_NEVER.phrases[i] as string)).toBeInTheDocument();
    }
  });
});

describe('adivina en la frente', () => {
  it('cuenta aciertos (pasar no suma) y al acabar el tiempo muestra el total', async () => {
    const user = setup();
    render(<PartyGameView config={{ ...HEADBAND, seconds: 20 }} onExit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '¡INICIAR RONDA!' }));
    expect(screen.getByText(/Ponte el celular en la frente/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });
    expect(screen.getByRole('timer')).toHaveAccessibleName('Quedan 20 segundos');
    await user.click(screen.getByRole('button', { name: /ACERTÓ/ }));
    await user.click(screen.getByRole('button', { name: /PASAR/ }));
    await user.click(screen.getByRole('button', { name: /ACERTÓ/ }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(21_000);
    });
    expect(within(screen.getByRole('dialog')).getByText('¡TIEMPO! Acertaste: 2 palabras.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('button', { name: '¡INICIAR RONDA!' })).toBeInTheDocument();
  });
});

describe('adivina en la frente con el sensor de movimiento', () => {
  const tilt = (beta: number) =>
    act(() => {
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta, gamma: 0 }));
    });
  it('inclinar hacia el piso acierta, hacia el techo pasa, y exige volver a la frente entre gestos', async () => {
    vi.stubGlobal('DeviceOrientationEvent', class {});
    const user = setup();
    render(<PartyGameView config={{ ...HEADBAND, seconds: 60 }} onExit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '¡INICIAR RONDA!' }));
    await tilt(90); // recto en la frente
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });
    expect(screen.getByText(/Sensor activo/)).toBeInTheDocument();
    await tilt(150); // hacia el piso → acierta
    expect(screen.getByText('¡ACERTÓ!', { selector: 'p' })).toBeInTheDocument();
    await tilt(160); // sigue abajo: no cuenta otra vez
    await tilt(90); // vuelve a la frente
    await tilt(30); // hacia el techo → pasa
    expect(screen.getByText('PASÓ', { selector: 'p' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe('pulso firme', () => {
  it('muestra las instrucciones, el cronómetro y el área de juego', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<PartyGameView config={STEADY_HAND} onExit={vi.fn()} />);
    expect(screen.getByText(STEADY_HAND.instructions)).toBeInTheDocument();
    expect(screen.getByText('Toca el círculo para empezar')).toBeInTheDocument();
    expect(screen.getByLabelText(/Área de juego/)).toBeInTheDocument();
    expect(screen.getByText(STEADY_HAND.footer)).toBeInTheDocument();
  });
});
