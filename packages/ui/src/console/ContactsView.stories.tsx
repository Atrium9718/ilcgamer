import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ContactsView } from './ContactsView.tsx';

const meta = { title: 'Consola/16 · Registros y contactos' } satisfies Meta;
export default meta;
type Story = StoryObj;

const base = { days: 30, onDaysChange: fn(), onDownload: fn(), onRetry: fn() };
const summary = { total: 128, withMarketing: 96, withEmail: 128, withPhone: 127, inPeriod: 64, today: 9 };
const byDay = Array.from({ length: 14 }, (_, i) => ({ label: `${i + 1} oct`, count: [2, 5, 3, 8, 12, 9, 4, 6, 10, 7, 3, 11, 14, 9][i] as number }));

export const Panel: Story = {
  render: () => (
    <ContactsView
      {...base}
      summary={summary}
      byDay={byDay}
      rows={[
        {
          fullName: 'Ana Gómez',
          email: 'ana@ejemplo.test',
          phone: '+573001112233',
          registeredLabel: '13 oct 2026, 10:00 a. m.',
          marketing: true,
          source: 'registro',
        },
        {
          fullName: 'Beto Ruiz',
          email: 'beto@ejemplo.test',
          phone: '+573009998877',
          registeredLabel: '12 oct 2026, 3:30 p. m.',
          marketing: false,
          source: 'registro',
        },
      ]}
    />
  ),
};
export const SinRegistros: Story = {
  render: () => <ContactsView {...base} summary={{ total: 0, withMarketing: 0, withEmail: 0, withPhone: 0, inPeriod: 0, today: 0 }} byDay={[]} rows={[]} />,
};
export const ConError: Story = {
  render: () => <ContactsView {...base} summary={summary} byDay={[]} rows={[]} error="No tienes permiso." />,
};
