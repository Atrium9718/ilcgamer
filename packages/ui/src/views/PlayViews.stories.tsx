import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import type { Chapter } from '../components/ChapterTimeline.tsx';
import { ChapterPlayView, IframeGameView, TriviaPlayView, WheelPlayView } from './PlayViews.tsx';

const meta = { title: 'Vistas/Jugar', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj;

const OPTIONS = ['En un bosque de niebla', 'En una isla', 'En una ciudad costera', 'En el desierto'];
const CHAPTERS: Chapter[] = [
  { id: 'c1', title: 'La tierra', icon: 'landscape', state: 'done' },
  { id: 'c2', title: 'La caña', icon: 'grass', state: 'current' },
  { id: 'c3', title: 'El barril', icon: 'inventory_2', state: 'locked' },
];

function Trivia() {
  const [sel, setSel] = useState<number | null>(null);
  return (
    <TriviaPlayView
      title="Trivia del origen"
      index={2}
      total={5}
      prompt="¿Dónde nace la caña de nuestro ron? (contenido de prueba)"
      options={OPTIONS}
      selected={sel}
      secondsLeft={18}
      parcheLabel="Marcador del Parche: 30"
      onSelect={setSel}
      onNext={fn()}
      onClose={fn()}
    />
  );
}
function Chapter2({ retry = false }: { retry?: boolean }) {
  const [sel, setSel] = useState<number | null>(null);
  return (
    <ChapterPlayView
      title="El Explorador"
      chapters={CHAPTERS}
      chapterTitle="La caña"
      chapterIcon="grass"
      story="Contenido de prueba: una historia breve sobre el origen."
      question="¿Qué se cosecha aquí?"
      options={OPTIONS}
      xp={40}
      selected={sel}
      retry={retry}
      onSelect={setSel}
      onSubmit={fn()}
      onClose={fn()}
    />
  );
}

export const TriviaPregunta: Story = { render: () => <Trivia /> };
export const RuletaLista: Story = {
  render: () => (
    <WheelPlayView title="Ruleta" segments={['Dato curioso', 'Brindis cultural', 'Pasa turno']} phase="ready" onSpin={fn()} onFinish={fn()} onClose={fn()} />
  ),
};
export const RuletaGirando: Story = {
  render: () => <WheelPlayView title="Ruleta" segments={['Dato curioso', 'Pasa turno']} phase="spinning" onSpin={fn()} onFinish={fn()} onClose={fn()} />,
};
export const RuletaResultado: Story = {
  render: () => (
    <WheelPlayView
      title="Ruleta"
      segments={['Dato curioso', 'Pasa turno']}
      phase="done"
      outcome={{ label: 'Dato curioso', challenge: 'Cuenta un dato que conozcas del origen.' }}
      onSpin={fn()}
      onFinish={fn()}
      onClose={fn()}
    />
  ),
};
export const ExploradorCapitulo: Story = { render: () => <Chapter2 /> };
export const ExploradorReintento: Story = { render: () => <Chapter2 retry /> };
export const ProveedorCargando: Story = {
  render: () => <IframeGameView title="Juego del proveedor" status="loading" frame={<div style={{ height: 320 }} />} onClose={fn()} />,
};
export const ProveedorError: Story = {
  render: () => <IframeGameView title="Juego del proveedor" status="error" frame={null} error="El proveedor no respondió." onClose={fn()} />,
};
