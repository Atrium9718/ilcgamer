import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EventsAdminView, type EventsAdminViewProps } from '../console/EventsAdminView.tsx';
import {
  type ContestDetail,
  ContestDetailView,
  type ContestDetailViewProps,
  ContestScreenView,
  type ContestScreenViewProps,
  EventsListView,
} from './ContestViews.tsx';

const entry = (id: string, title: string, over = {}) => ({ id, title, caption: '', alias: `Alias ${id}`, photoUrl: `/foto/${id}`, mine: false, ...over });
const contest = (over: Partial<ContestDetail> = {}): ContestDetail => ({
  title: 'Concurso de disfraces',
  eventTitle: 'Feria 2027',
  description: 'El mejor disfraz',
  prize: 'Palco para la feria',
  prizeConditions: 'Se entrega en persona',
  phase: 'VOTACION',
  phaseNote: 'Vota hasta: 15 de enero · Un voto por persona',
  guidelines: ['Solo tu disfraz: sin copas, botellas ni consumo de alcohol en la foto.'],
  entries: [entry('a', 'Pirata'), entry('b', 'Robot', { mine: true, status: 'APROBADA' })],
  myEntry: entry('b', 'Robot', { mine: true, status: 'APROBADA' }),
  votedEntryId: null,
  prizeCode: null,
  winner: null,
  ...over,
});
const props = (over: Partial<ContestDetailViewProps> = {}): ContestDetailViewProps => ({
  contest: contest(),
  hasAccount: true,
  onSubmitEntry: vi.fn(),
  onVote: vi.fn(),
  onWithdraw: vi.fn(),
  onSaveAccount: vi.fn(),
  onRetry: vi.fn(),
  onBack: vi.fn(),
  ...over,
});

describe('EventsListView', () => {
  it('lista los concursos de cada evento con su premio y su fase, y abre el elegido', async () => {
    const onOpenContest = vi.fn();
    render(
      <EventsListView
        events={[
          {
            slug: 'feria',
            title: 'Feria 2027',
            description: '',
            meta: 'Manizales · 12 ene – 15 ene',
            contests: [{ id: 'c1', title: 'Disfraces', prize: 'Palco', phase: 'VOTACION' }],
          },
        ]}
        onOpenContest={onOpenContest}
        onRetry={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('Votación abierta')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Disfraces/ }));
    expect(onOpenContest).toHaveBeenCalledWith('c1');
  });

  it('sin eventos explica que aún no hay nada', () => {
    render(<EventsListView events={[]} onOpenContest={vi.fn()} onRetry={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('Aún no hay eventos')).toBeInTheDocument();
  });
});

describe('ContestDetailView: votación', () => {
  it('permite votar por otros, nunca por el propio disfraz, y avisa que no suma puntos', async () => {
    const p = props();
    render(<ContestDetailView {...p} />);
    expect(screen.getByText(/no suma Puntos ILC ni XP/)).toBeInTheDocument();
    expect(screen.getByText('Tu disfraz')).toBeInTheDocument();
    const votes = screen.getAllByRole('button', { name: 'Votar' });
    expect(votes).toHaveLength(1);
    await userEvent.click(votes[0] as HTMLElement);
    expect(p.onVote).toHaveBeenCalledWith('a');
  });

  it('tras votar queda un solo voto: el botón pasa a «Tu voto» y está deshabilitado', () => {
    render(<ContestDetailView {...props({ contest: contest({ votedEntryId: 'a' }) })} />);
    const done = screen.getByRole('button', { name: 'Tu voto' });
    expect(done).toBeDisabled();
    expect(screen.getByText(/Hay un solo voto por persona/)).toBeInTheDocument();
  });

  it('sin cuenta guardada pide guardar el progreso en vez de votar', async () => {
    const p = props({ hasAccount: false });
    render(<ContestDetailView {...p} />);
    expect(screen.queryByRole('button', { name: 'Votar' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar mi progreso' }));
    expect(p.onSaveAccount).toHaveBeenCalled();
  });

  it('muestra al ganador y, si eres tú, tu código para reclamar el premio', () => {
    render(
      <ContestDetailView
        {...props({ contest: contest({ phase: 'TERMINADO', prizeCode: 'K7M2Q9XD', winner: { title: 'Robot', alias: 'Alias b', photoUrl: '/foto/b' } }) })}
      />,
    );
    expect(screen.getByRole('heading', { name: '¡Ganaste el concurso!' })).toBeInTheDocument();
    expect(screen.getByText('Código del premio: K 7 M 2 Q 9 X D')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ganador' })).toBeInTheDocument();
  });
});

describe('ContestDetailView: inscripción', () => {
  const inscripcion = (over: Partial<ContestDetail> = {}) => contest({ phase: 'INSCRIPCION', entries: [], myEntry: null, ...over });

  it('exige nombre, foto y la autorización expresa antes de poder enviar', async () => {
    const p = props({ contest: inscripcion() });
    render(<ContestDetailView {...p} />);
    const send = screen.getByRole('button', { name: 'Enviar mi disfraz' });
    expect(send).toBeDisabled();
    expect(screen.getByText(/sin copas, botellas ni consumo de alcohol/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Nombre de tu disfraz/), 'El pirata');
    await userEvent.upload(screen.getByLabelText('Foto de tu disfraz'), new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
    expect(send).toBeDisabled(); // falta autorizar que se muestre la foto
    await userEvent.click(screen.getByRole('checkbox', { name: /Autorizo que se muestre mi foto/ }));
    expect(send).toBeEnabled();
    await userEvent.click(send);
    expect(p.onSubmitEntry).toHaveBeenCalledWith(expect.objectContaining({ title: 'El pirata', consent: true, file: expect.any(File) }));
  });

  it('muestra el estado de la propia inscripción, el motivo si se rechazó y permite retirarla', async () => {
    const mine = entry('m', 'Mi disfraz', { mine: true, status: 'RECHAZADA', rejectionReason: 'Se ven copas en la foto' });
    const p = props({ contest: inscripcion({ myEntry: mine }) });
    render(<ContestDetailView {...p} />);
    expect(screen.getByText('No aprobada')).toBeInTheDocument();
    expect(screen.getByText(/Se ven copas en la foto/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retirar mi inscripción' }));
    expect(p.onWithdraw).toHaveBeenCalled();
  });

  it('sin cuenta guardada no muestra el formulario', () => {
    render(<ContestDetailView {...props({ contest: inscripcion(), hasAccount: false })} />);
    expect(screen.queryByLabelText('Foto de tu disfraz')).not.toBeInTheDocument();
  });
});

describe('ContestScreenView (pantalla del evento)', () => {
  const base: ContestScreenViewProps = {
    title: 'Concurso de disfraces',
    eventTitle: 'Feria 2027',
    prize: 'Palco para la feria',
    phase: 'VOTACION',
    closesLabel: 'La votación cierra a las 8:00 p. m.',
    totalVotes: 12,
    entries: [
      { id: 'a', rank: 1, title: 'Pirata', alias: 'Ana', votes: 8, photoUrl: '/foto/a' },
      { id: 'b', rank: 2, title: 'Robot', alias: 'Beto', votes: 4, photoUrl: null },
    ],
    winner: null,
    voteAddress: 'ilc.fusioncg.com/concursos/abc',
    qrDataUrl: 'data:image/png;base64,AAAA',
  };

  it('muestra la clasificación en vivo, el total de votos y el QR con la dirección para votar', () => {
    render(<ContestScreenView {...base} />);
    const list = screen.getByRole('list', { name: 'Clasificación en vivo' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Pirata');
    expect(items[0]).toHaveTextContent('8');
    expect(screen.getByText('12 votos en total')).toBeInTheDocument();
    expect(screen.getByAltText(/Código QR para votar/)).toBeInTheDocument();
    expect(screen.getByText('ilc.fusioncg.com/concursos/abc')).toBeInTheDocument();
  });

  it('al terminar anuncia al ganador y, sin conexión, avisa que muestra lo último', () => {
    render(<ContestScreenView {...base} phase="TERMINADO" winner={{ title: 'Pirata', alias: 'Ana', votes: 8 }} offline />);
    expect(screen.getByText('¡Ganador!')).toBeInTheDocument();
    expect(screen.getByText(/Reconectando/)).toBeInTheDocument();
  });

  it('nunca muestra correos ni teléfonos', () => {
    const { container } = render(<ContestScreenView {...base} />);
    expect(container.textContent).not.toMatch(/@|\+57|\d{10}/);
  });
});

describe('EventsAdminView (consola)', () => {
  const sel = {
    id: 'c1',
    title: 'Disfraces',
    eventTitle: 'Feria 2027',
    prize: 'Palco',
    status: 'ABIERTO' as const,
    phase: 'VOTACION' as const,
    datesLabel: 'Fechas de prueba',
    screenUrl: 'https://ilc.fusioncg.com/pantalla/secreto',
    entries: [
      {
        id: 'e1',
        alias: 'Ana',
        title: 'Pirata',
        caption: '',
        status: 'PENDIENTE' as const,
        rejectionReason: null,
        hasPhoto: true,
        votes: 0,
        photoUrl: '/f/e1',
      },
      {
        id: 'e2',
        alias: 'Beto',
        title: 'Sin foto',
        caption: '',
        status: 'PENDIENTE' as const,
        rejectionReason: null,
        hasPhoto: false,
        votes: 0,
        photoUrl: null,
      },
    ],
    winner: null,
  };
  const p = (over: Partial<EventsAdminViewProps> = {}): EventsAdminViewProps => ({
    events: [
      {
        id: 'ev1',
        slug: 'feria',
        title: 'Feria 2027',
        city: 'Manizales',
        status: 'BORRADOR',
        periodLabel: '12 ene – 15 ene',
        contests: [{ id: 'c1', title: 'Disfraces', prize: 'Palco', status: 'ABIERTO', phase: 'VOTACION', entries: 2, pending: 2, votes: 0 }],
      },
    ],
    selected: sel,
    onCreateEvent: vi.fn(),
    onEventStatus: vi.fn(),
    onCreateContest: vi.fn(),
    onSelectContest: vi.fn(),
    onOpenContest: vi.fn(),
    onCloseContest: vi.fn(),
    onModerate: vi.fn(),
    onRotateScreen: vi.fn(),
    onCopy: vi.fn(),
    onDeliverPrize: vi.fn(),
    onRetry: vi.fn(),
    ...over,
  });

  it('modera: aprueba lo que tiene foto, no deja aprobar sin foto y exige motivo para rechazar', async () => {
    const props = p();
    render(<EventsAdminView {...props} />);
    const approve = screen.getAllByRole('button', { name: 'Aprobar' });
    expect(approve[1]).toBeDisabled(); // sin foto
    await userEvent.click(approve[0] as HTMLElement);
    expect(props.onModerate).toHaveBeenCalledWith('c1', 'e1', 'APROBADA');
    await userEvent.click(screen.getAllByRole('button', { name: 'Rechazar' })[0] as HTMLElement);
    const form = screen.getByLabelText('Motivo del rechazo').closest('form') as HTMLElement;
    const reject = within(form).getByRole('button', { name: 'Rechazar' });
    expect(reject).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Motivo del rechazo'), 'Se ven copas');
    await userEvent.click(reject);
    expect(props.onModerate).toHaveBeenCalledWith('c1', 'e1', 'RECHAZADA', 'Se ven copas');
  });

  it('muestra el enlace secreto de la pantalla, permite copiarlo y generar uno nuevo', async () => {
    const props = p();
    render(<EventsAdminView {...props} />);
    expect(screen.getByText('https://ilc.fusioncg.com/pantalla/secreto')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(props.onCopy).toHaveBeenCalledWith('https://ilc.fusioncg.com/pantalla/secreto');
    await userEvent.click(screen.getByRole('button', { name: 'Generar enlace nuevo' }));
    expect(props.onRotateScreen).toHaveBeenCalledWith('c1');
  });

  it('un evento en borrador se publica; el concurso terminado se cierra y se registra la entrega con el código', async () => {
    const props = p({ selected: { ...sel, phase: 'TERMINADO' } });
    const { rerender } = render(<EventsAdminView {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(props.onEventStatus).toHaveBeenCalledWith('ev1', 'PUBLICADO');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar y declarar ganador' }));
    expect(props.onCloseContest).toHaveBeenCalledWith('c1');
    rerender(
      <EventsAdminView
        {...props}
        selected={{ ...sel, status: 'CERRADO', phase: 'TERMINADO', winner: { alias: 'Ana', title: 'Pirata', votes: 5, delivered: false } }}
      />,
    );
    const deliver = screen.getByRole('button', { name: 'Registrar entrega' });
    expect(deliver).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Código que presenta/), 'K7M2Q9XD');
    await userEvent.click(deliver);
    expect(props.onDeliverPrize).toHaveBeenCalledWith('c1', 'K7M2Q9XD');
  });
});
