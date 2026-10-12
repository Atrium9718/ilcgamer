import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChapterPlayView, TriviaPlayView, WheelPlayView } from './PlayViews.tsx';

const OPTS = ['uno', 'dos', 'tres'];

describe('TriviaPlayView', () => {
  it('no deja avanzar sin elegir y el último paso dice "Terminar"', async () => {
    const onNext = vi.fn();
    const onSelect = vi.fn();
    const { rerender } = render(
      <TriviaPlayView title="T" index={4} total={5} prompt="¿Cuál?" options={OPTS} selected={null} onSelect={onSelect} onNext={onNext} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Terminar' })).toBeDisabled();
    expect(screen.getByRole('progressbar', { name: 'Avance de la trivia' })).toHaveAttribute('aria-valuetext', 'Pregunta 5 de 5');
    await userEvent.click(screen.getByRole('radio', { name: /dos/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
    rerender(
      <TriviaPlayView title="T" index={4} total={5} prompt="¿Cuál?" options={OPTS} selected={1} onSelect={onSelect} onNext={onNext} onClose={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
    expect(onNext).toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: /dos/ })).toBeChecked();
  });
});

describe('WheelPlayView', () => {
  it('gira, bloquea mientras gira y muestra el reto al terminar', async () => {
    const onSpin = vi.fn();
    const { rerender } = render(<WheelPlayView title="R" segments={['a', 'b']} phase="ready" onSpin={onSpin} onFinish={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Girar' }));
    expect(onSpin).toHaveBeenCalled();
    rerender(<WheelPlayView title="R" segments={['a', 'b']} phase="spinning" onSpin={onSpin} onFinish={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Girar/ })).toBeDisabled();
    rerender(
      <WheelPlayView
        title="R"
        segments={['a', 'b']}
        phase="done"
        outcome={{ label: 'a', challenge: 'Cuenta un dato' }}
        onSpin={onSpin}
        onFinish={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Salió: a')).toBeInTheDocument();
    expect(screen.getByText('Cuenta un dato')).toBeInTheDocument();
  });
});

describe('ChapterPlayView', () => {
  it('muestra el XP del capítulo y el aviso de reintento sin penalidad', () => {
    render(
      <ChapterPlayView
        title="E"
        chapters={[{ id: 'c1', title: 'La tierra', icon: 'landscape', state: 'current' }]}
        chapterTitle="La tierra"
        chapterIcon="landscape"
        story="Relato"
        question="¿Qué?"
        options={OPTS}
        xp={40}
        selected={0}
        retry
        onSelect={vi.fn()}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('+40 XP')).toBeInTheDocument();
    expect(screen.getByText(/sin penalidad/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Responder' })).toBeEnabled();
  });
});
