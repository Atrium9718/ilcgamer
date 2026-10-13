import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ContactsView } from './ContactsView.tsx';

const meta = { title: 'Consola/16 · Contactos' } satisfies Meta;
export default meta;
type Story = StoryObj;

export const Lista: Story = {
  render: () => (
    <ContactsView
      total={2}
      rows={[
        { alias: 'Ana', email: 'ana@ejemplo.test', phone: null, optedInLabel: '1 oct 2026, 10:00 a. m.', source: 'registro' },
        { alias: 'Beto', email: null, phone: '3001112233', optedInLabel: '2 oct 2026, 3:30 p. m.', source: 'campana' },
      ]}
      onDownload={fn()}
      onRetry={fn()}
    />
  ),
};
export const Vacia: Story = { render: () => <ContactsView total={0} rows={[]} onDownload={fn()} onRetry={fn()} /> };
export const ConError: Story = { render: () => <ContactsView total={0} rows={[]} error="No tienes permiso." onDownload={fn()} onRetry={fn()} /> };
