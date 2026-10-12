import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { CodeLandingView } from './CodeLandingView.tsx';

const meta = {
  title: 'Vistas/02 · Landing de código',
  component: CodeLandingView,
  args: {
    brandLabel: 'Ron Viejo de Caldas',
    status: 'recognized',
    productLabel: 'Ron Viejo de Caldas Gran Reserva Especial · Lote #4092',
    routeABadge: '+500 Puntos ILC',
    canActivate: true,
    onBack: fn(),
    onExplainCode: fn(),
    onSelectRouteA: fn(),
    onSelectRouteB: fn(),
    onActivate: fn(),
    onJoinWithPin: fn(),
    footerLinks: [
      { label: 'Consumo responsable', href: '#consumo-responsable' },
      { label: 'Términos y condiciones', href: '#terminos' },
    ],
  },
} satisfies Meta<typeof CodeLandingView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CodigoReconocido: Story = {};

export const Activando: Story = { args: { activating: true } };

/** Código válido pero fuera de campaña/contexto elegible: solo consulta + Ruta B (Guía Técnica §5.1). */
export const SinCampanaActiva: Story = { args: { canActivate: false, routeABadge: undefined } };

export const YaReclamado: Story = { args: { status: 'already_claimed', canActivate: false } };

export const NoReconocido: Story = { args: { status: 'unrecognized', productLabel: undefined, canActivate: false } };

export const RequiereVerificacion: Story = { args: { status: 'needs_review', canActivate: false } };

export const AguardienteAmarillo: Story = {
  args: { brandLabel: 'Aguardiente Amarillo de Manzanares', productLabel: 'Aguardiente Amarillo de Manzanares · Lote #1180', routeABadge: '+300 Puntos ILC' },
  globals: { brand: 'aguardiente-amarillo' },
};
