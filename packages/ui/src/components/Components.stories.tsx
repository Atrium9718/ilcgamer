import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { BottomNav, type NavTab } from './BottomNav.tsx';
import { BrandChip } from './BrandChip.tsx';
import { Button } from './Button.tsx';
import { LegalNotice } from './LegalNotice.tsx';
import { PinInput } from './PinInput.tsx';
import { QrScannerFrame } from './QrScannerFrame.tsx';
import { RouteCard } from './RouteCard.tsx';
import { SealMark } from './SealMark.tsx';
import { Sheet } from './Sheet.tsx';
import { StatusMessage } from './StatusMessage.tsx';
import { Toast } from './Toast.tsx';
import { VerificationSeal } from './VerificationSeal.tsx';

function Catalogo() {
  return (
    <div className="min-h-dvh bg-surface p-4 space-y-8 max-w-md mx-auto">
      <section className="space-y-3">
        <h2 className="font-headline-md text-headline-md text-primary">Botones</h2>
        <Button leadingIcon="lock_open">Activar código</Button>
        <Button loading>Procesando</Button>
        <Button disabled>No disponible</Button>
        <Button variant="secondary">Acción secundaria</Button>
        <Button variant="text">Acción de texto</Button>
      </section>
      <section className="space-y-3">
        <h2 className="font-headline-md text-headline-md text-primary">Sello y submarca</h2>
        <div className="flex items-center gap-4">
          <SealMark />
          <SealMark size="sm" />
          <BrandChip label="Ron Viejo de Caldas" />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-headline-md text-headline-md text-primary">Estados de verificación</h2>
        <VerificationSeal status="recognized" productLabel="Producto · Lote #0000" onExplain={fn()} />
        <VerificationSeal status="already_claimed" />
        <VerificationSeal status="needs_review" />
        <VerificationSeal status="unrecognized" />
      </section>
      <section className="space-y-3">
        <h2 className="font-headline-md text-headline-md text-primary">Rutas</h2>
        <RouteCard
          route="A"
          title="Ruta A · Activa tu código"
          description="Conoce tu beneficio."
          badge="+300 Puntos ILC"
          footerLabel="Ver condiciones"
          onSelect={fn()}
        />
        <RouteCard
          route="B"
          title="Ruta B · Explora el origen"
          description="No requiere compra."
          badge="Insignias"
          footerLabel="Relato interactivo"
          footerIcon="menu_book"
          onSelect={fn()}
        />
      </section>
      <section className="space-y-3">
        <h2 className="font-headline-md text-headline-md text-primary">PIN</h2>
        <PinDemo />
      </section>
      <section className="space-y-3">
        <h2 className="font-headline-md text-headline-md text-primary">Avisos</h2>
        <Toast tone="success" message="Te uniste al Parche." />
        <Toast tone="warning" message="La campaña termina hoy a las 11:59 p. m." actionLabel="Ver" onAction={fn()} />
        <Toast tone="error" message="No pudimos conectar. Reintenta." onDismiss={fn()} />
      </section>
      <section className="space-y-3">
        <h2 className="font-headline-md text-headline-md text-primary">Estados</h2>
        <StatusMessage kind="pending" />
        <StatusMessage kind="offline" />
        <StatusMessage kind="error" action={<Button>Reintentar</Button>} />
        <StatusMessage kind="empty" title="Aún no tienes insignias" body="Explora el origen para ganar la primera." />
      </section>
      <section className="space-y-3">
        <h2 className="font-headline-md text-headline-md text-primary">Visor QR</h2>
        <QrScannerFrame cameraDenied onManualEntry={fn()} />
      </section>
      <LegalNotice showCompany links={[{ label: 'Consumo responsable', href: '#' }]} />
    </div>
  );
}

function PinDemo() {
  const [pin, setPin] = useState('');
  return <PinInput value={pin} onChange={setPin} hint="Te quedan 4 intentos." />;
}

function NavDemo() {
  const [tab, setTab] = useState<NavTab>('inicio');
  return (
    <div className="min-h-dvh bg-surface flex flex-col justify-end">
      <BottomNav active={tab} onNavigate={setTab} />
    </div>
  );
}

function SheetDemo() {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-dvh bg-surface p-4">
      <Button onClick={() => setOpen(true)}>Abrir hoja</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="¿Qué verifica este código?" actions={<Button onClick={() => setOpen(false)}>Entendido</Button>}>
        Confirma que el código existe en el sistema de ILC y su estado. Por sí solo no prueba que el envase físico sea auténtico.
      </Sheet>
    </div>
  );
}

const meta = { title: 'Sistema/Catálogo de componentes', component: Catalogo } satisfies Meta<typeof Catalogo>;
export default meta;
export const Todos: StoryObj<typeof meta> = {};
export const NavegacionInferior: StoryObj<typeof meta> = { render: () => <NavDemo /> };
export const HojaInferior: StoryObj<typeof meta> = { render: () => <SheetDemo /> };
