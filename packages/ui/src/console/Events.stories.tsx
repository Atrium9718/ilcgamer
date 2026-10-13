import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import bosque from '../assets/placeholders/bosque-niebla.jpg';
import { ConsoleLayout } from './ConsoleLayout.tsx';
import { EventsAdminView, type EventsAdminViewProps } from './EventsAdminView.tsx';

const meta = { title: 'Consola/Eventos', parameters: { viewport: { defaultViewport: 'responsive' } }, globals: { theme: 'light' } } satisfies Meta;
export default meta;
type Story = StoryObj;

const base: EventsAdminViewProps = {
  events: [
    {
      id: 'ev1',
      slug: 'feria-2027',
      title: 'Feria de Manizales 2027',
      city: 'Manizales',
      status: 'PUBLICADO',
      periodLabel: '12 ene – 15 ene',
      contests: [
        { id: 'c1', title: 'Concurso de disfraces', prize: 'Palco para la feria', status: 'ABIERTO', phase: 'VOTACION', entries: 3, pending: 1, votes: 41 },
      ],
    },
  ],
  selected: {
    id: 'c1',
    title: 'Concurso de disfraces',
    eventTitle: 'Feria de Manizales 2027',
    prize: 'Palco para la feria',
    status: 'ABIERTO',
    phase: 'VOTACION',
    datesLabel: 'Inscripción hasta 12 ene, 6:00 p. m. · Votación 13 ene, 8:00 a. m. a 15 ene, 8:00 p. m.',
    screenUrl: 'https://ilc.fusioncg.com/pantalla/Zk3p9Q0wXJm4t7bLr2Yv',
    entries: [
      {
        id: 'e1',
        alias: 'Ana',
        title: 'El pirata del Cable',
        caption: 'Hecho a mano',
        status: 'APROBADA',
        rejectionReason: null,
        hasPhoto: true,
        votes: 25,
        photoUrl: bosque,
      },
      { id: 'e2', alias: 'Beto', title: 'Robot de lata', caption: '', status: 'PENDIENTE', rejectionReason: null, hasPhoto: true, votes: 0, photoUrl: bosque },
      {
        id: 'e3',
        alias: 'Cata',
        title: 'La mariposa',
        caption: '',
        status: 'RECHAZADA',
        rejectionReason: 'Se ven copas en la foto',
        hasPhoto: true,
        votes: 0,
        photoUrl: null,
      },
    ],
    winner: null,
  },
  onCreateEvent: fn(),
  onEventStatus: fn(),
  onCreateContest: fn(),
  onSelectContest: fn(),
  onOpenContest: fn(),
  onCloseContest: fn(),
  onModerate: fn(),
  onRotateScreen: fn(),
  onCopy: fn(),
  onDeliverPrize: fn(),
  onRetry: fn(),
};

const framed = (props: EventsAdminViewProps) => (
  <ConsoleLayout active="eventos" sections={['campanas', 'eventos']} userAlias="Laura" roleLabel="Admin de Marca" onNavigate={fn()} onLogout={fn()}>
    <EventsAdminView {...props} />
  </ConsoleLayout>
);

export const Gestion: Story = { render: () => framed(base) };
export const Vacio: Story = { render: () => framed({ ...base, events: [], selected: undefined }) };
export const EntregaDelPremio: Story = {
  render: () =>
    framed({
      ...base,
      selected: base.selected && {
        ...base.selected,
        status: 'CERRADO',
        phase: 'TERMINADO',
        winner: { alias: 'Ana', title: 'El pirata del Cable', votes: 25, delivered: false },
      },
    }),
};
