import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import bosque from '../assets/placeholders/bosque-niebla.jpg';
import { type ContestDetail, ContestDetailView, ContestScreenView, EventsListView } from './ContestViews.tsx';

const meta = { title: 'Vistas/14 · Eventos y concursos' } satisfies Meta;
export default meta;
type Story = StoryObj;

const entry = (id: string, title: string, over = {}) => ({ id, title, caption: 'Hecho a mano', alias: `Alias ${id}`, photoUrl: bosque, mine: false, ...over });
const contest = (over: Partial<ContestDetail> = {}): ContestDetail => ({
  title: 'Concurso de disfraces',
  eventTitle: 'Feria de Manizales 2027',
  description: 'Muéstranos el mejor disfraz de la feria.',
  prize: 'Palco para la feria',
  prizeConditions: 'El premio se entrega en persona con el código del ganador.',
  phase: 'VOTACION',
  phaseNote: 'Vota hasta el 15 de enero, 8:00 p. m. Un voto por persona.',
  guidelines: [
    'Solo tu disfraz: sin copas, botellas ni consumo de alcohol en la foto.',
    'Sin menores de edad ni datos personales visibles (documentos, teléfonos).',
    'La foto es tuya o tienes permiso de quien aparece.',
  ],
  entries: [entry('a', 'El pirata del Cable'), entry('b', 'Robot de lata', { mine: true, status: 'APROBADA' }), entry('c', 'La mariposa andina')],
  myEntry: entry('b', 'Robot de lata', { mine: true, status: 'APROBADA' }),
  votedEntryId: null,
  prizeCode: null,
  winner: null,
  ...over,
});
const actions = { onSubmitEntry: fn(), onVote: fn(), onWithdraw: fn(), onSaveAccount: fn(), onRetry: fn(), onBack: fn() };

export const ListaDeEventos: Story = {
  render: () => (
    <EventsListView
      events={[
        {
          slug: 'feria',
          title: 'Feria de Manizales 2027',
          description: 'Concursos y actividades de la feria.',
          meta: 'Manizales · 12 ene – 15 ene',
          contests: [{ id: 'c1', title: 'Concurso de disfraces', prize: 'Palco para la feria', phase: 'VOTACION' }],
        },
      ]}
      onOpenContest={fn()}
      onRetry={fn()}
      onBack={fn()}
    />
  ),
};
export const Inscripcion: Story = {
  render: () => (
    <ContestDetailView
      {...actions}
      hasAccount
      contest={contest({ phase: 'INSCRIPCION', phaseNote: 'Inscripciones hasta el 12 de enero.', entries: [], myEntry: null })}
    />
  ),
};
export const InscripcionRechazada: Story = {
  render: () => (
    <ContestDetailView
      {...actions}
      hasAccount
      contest={contest({
        phase: 'INSCRIPCION',
        entries: [],
        myEntry: entry('m', 'Mi disfraz', { mine: true, status: 'RECHAZADA', rejectionReason: 'Se ven copas en la foto' }),
      })}
    />
  ),
};
export const Votacion: Story = { render: () => <ContestDetailView {...actions} hasAccount contest={contest()} /> };
export const VotacionYaVoto: Story = { render: () => <ContestDetailView {...actions} hasAccount contest={contest({ votedEntryId: 'a' })} /> };
export const VotacionSinCuenta: Story = { render: () => <ContestDetailView {...actions} hasAccount={false} contest={contest()} /> };
export const GanasteElPremio: Story = {
  render: () => (
    <ContestDetailView
      {...actions}
      hasAccount
      contest={contest({
        phase: 'TERMINADO',
        phaseNote: 'El concurso terminó.',
        prizeCode: 'K7M2Q9XD',
        winner: { title: 'Robot de lata', alias: 'Alias b', photoUrl: bosque },
      })}
    />
  ),
};
export const Cargando: Story = { render: () => <ContestDetailView {...actions} hasAccount loading /> };

const SCREEN = {
  title: 'Concurso de disfraces',
  eventTitle: 'Feria de Manizales 2027',
  prize: 'Palco para la feria',
  closesLabel: 'La votación cierra a las 8:00 p. m.',
  totalVotes: 128,
  voteAddress: 'ilc.fusioncg.com/concursos/0194-demo',
  qrDataUrl: null,
};
export const PantallaEnVivo: Story = {
  parameters: { viewport: { defaultViewport: 'responsive' } },
  render: () => (
    <ContestScreenView
      {...SCREEN}
      phase="VOTACION"
      winner={null}
      entries={[
        { id: 'a', rank: 1, title: 'El pirata del Cable', alias: 'Ana', votes: 48, photoUrl: bosque },
        { id: 'b', rank: 2, title: 'Robot de lata', alias: 'Beto', votes: 41, photoUrl: bosque },
        { id: 'c', rank: 3, title: 'La mariposa andina', alias: 'Cata', votes: 39, photoUrl: null },
      ]}
    />
  ),
};
export const PantallaGanador: Story = {
  parameters: { viewport: { defaultViewport: 'responsive' } },
  render: () => (
    <ContestScreenView
      {...SCREEN}
      phase="TERMINADO"
      winner={{ title: 'El pirata del Cable', alias: 'Ana', votes: 48 }}
      entries={[{ id: 'a', rank: 1, title: 'El pirata del Cable', alias: 'Ana', votes: 48, photoUrl: bosque }]}
    />
  ),
};
