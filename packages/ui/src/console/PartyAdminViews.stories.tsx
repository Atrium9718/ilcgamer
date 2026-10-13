import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { SPINNER, TRUTH_DARE } from '../party/fixtures.ts';
import type { PartyConfigView } from '../party/types.ts';
import { PartyEditorView, PartyListView } from './PartyAdminViews.tsx';

const meta = { title: 'Consola/15 · Juegos de fiesta' } satisfies Meta;
export default meta;
type Story = StoryObj;

export const Lista: Story = {
  render: () => (
    <PartyListView
      rows={[
        {
          moduleId: 'verdad-o-reto',
          title: 'Verdad o Reto',
          game: 'truth-dare',
          gameLabel: 'Verdad o reto',
          activeVersion: '1.0.0',
          latestVersion: '1.0.1',
          latestStatus: 'BORRADOR',
        },
      ]}
      templates={[
        { game: 'spinner', label: 'Girador de retos' },
        { game: 'truth-dare', label: 'Verdad o reto' },
      ]}
      onEdit={fn()}
      onNew={fn()}
      onGoToCatalog={fn()}
      onRetry={fn()}
    />
  ),
};
export const ListaVacia: Story = {
  render: () => (
    <PartyListView rows={[]} templates={[{ game: 'spinner', label: 'Girador de retos' }]} onEdit={fn()} onNew={fn()} onGoToCatalog={fn()} onRetry={fn()} />
  ),
};

function Editor({ game, initial, errors = {} }: { game: 'spinner' | 'truth-dare'; initial: PartyConfigView; errors?: Record<string, string[]> }) {
  const [config, setConfig] = useState<PartyConfigView>(initial);
  const [title, setTitle] = useState('Juego de fiesta');
  const [description, setDescription] = useState('Personalizado desde la consola');
  return (
    <PartyEditorView
      game={game}
      gameLabel={game === 'spinner' ? 'Girador de retos' : 'Verdad o reto'}
      isNew={false}
      moduleId="juego-de-fiesta"
      onModuleIdChange={fn()}
      title={title}
      onTitleChange={setTitle}
      description={description}
      onDescriptionChange={setDescription}
      config={config}
      onConfigChange={setConfig}
      nextVersion="1.0.1"
      errors={errors}
      onSave={fn()}
      onBack={fn()}
      onGoToCatalog={fn()}
    />
  );
}
export const EditorGirador: Story = { render: () => <Editor game="spinner" initial={SPINNER} /> };
export const EditorVerdadOReto: Story = { render: () => <Editor game="truth-dare" initial={TRUTH_DARE} /> };
export const EditorConErrores: Story = {
  render: () => <Editor game="truth-dare" initial={TRUTH_DARE} errors={{ 'delivery.config.dares.0': ['Menciona «shot». Reescríbelo.'] }} />,
};
