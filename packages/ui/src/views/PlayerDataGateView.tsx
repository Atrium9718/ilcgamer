import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { TopBar } from '../components/TopBar.tsx';

export interface PlayerDataGateViewProps {
  gameTitle: string;
  /** Qué falta: crear/guardar la cuenta o autorizar las novedades de ILC. */
  need: 'account' | 'marketing';
  busy?: boolean;
  error?: string;
  privacyHref: string;
  onSaveAccount: () => void;
  onAccept: () => void;
  onPrivacy: () => void;
  onBack: () => void;
}

/**
 * Pantalla previa a un juego que exige datos (p. ej. El Impostor). Es explícita: dice qué se pide, para qué, que se puede retirar
 * y qué pasa si no se acepta (no se juega este juego; el resto de la app no cambia). El servidor es quien decide si se puede jugar.
 */
export function PlayerDataGateView({ gameTitle, need, busy, error, onSaveAccount, onAccept, onPrivacy, onBack }: PlayerDataGateViewProps) {
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar title={gameTitle} onBack={onBack} />
        <main className="flex-1 px-5 pt-6 pb-8 space-y-5">
          <div className="w-16 h-16 rounded-full border border-outline-variant bg-surface-container flex items-center justify-center">
            <Icon name={need === 'account' ? 'person_add' : 'campaign'} className="text-[32px] text-primary" />
          </div>
          <h1 className="font-headline-lg text-[28px] leading-8">{need === 'account' ? 'Guarda tu progreso para jugar' : 'Un último paso para jugar'}</h1>
          {need === 'account' ? (
            <p className="font-body-md text-body-md text-on-surface-variant">
              {gameTitle} se juega con una cuenta. Regístrate con tu celular o correo (te enviamos un código) y volverás aquí para jugar.
            </p>
          ) : (
            <div className="space-y-3 font-body-md text-body-md text-on-surface-variant">
              <p>
                Para jugar {gameTitle} autorizas que <strong className="text-on-surface">ILC y sus marcas te envíen novedades y promociones</strong> al celular
                o correo que registraste.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Usamos tu contacto solo para eso y no lo compartimos con terceros para su propio uso.</li>
                <li>Puedes retirar esta autorización cuando quieras en Perfil → Autorizaciones.</li>
                <li>Si la retiras, este juego se bloquea; el resto de la app sigue igual.</li>
              </ul>
            </div>
          )}
          {error && (
            <p role="alert" className="font-body-md text-[13px] text-error">
              {error}
            </p>
          )}
          <div className="space-y-3 pt-2">
            {need === 'account' ? (
              <Button fullWidth onClick={onSaveAccount}>
                Guardar mi progreso
              </Button>
            ) : (
              <Button fullWidth onClick={onAccept} loading={busy}>
                Acepto y quiero jugar
              </Button>
            )}
            <Button fullWidth variant="secondary" onClick={onBack}>
              {need === 'account' ? 'Ahora no' : 'No acepto'}
            </Button>
            <button type="button" onClick={onPrivacy} className="min-h-12 w-full font-label-lg text-label-lg text-primary underline">
              Leer el aviso de privacidad
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
