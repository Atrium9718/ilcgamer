import bosqueNiebla from '../assets/placeholders/bosque-niebla.jpg';
import { BadgeSeal } from '../components/BadgeSeal.tsx';
import { Icon } from '../components/Icon.tsx';
import { LEGAL_COPY } from '../components/LegalNotice.tsx';
import { SealMark } from '../components/SealMark.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { cx } from '../lib/cx.ts';

export type ShareTemplate = 'bosque' | 'roble' | 'montana';
export type ShareTarget = 'instagram' | 'whatsapp' | 'tiktok' | 'download';

/** Contenido permitido en una tarjeta social: logro cultural, sin PII, sin cifras comerciales ni de consumo. */
export interface ShareCardContent {
  badgeName: string;
  badgeIcon: string;
  headline: string;
  /** Ej.: "El Parche 'Los del bosque de niebla' completó la Ruta del Origen". Solo nombre del Parche/alias. */
  message: string;
}

const TEMPLATES: ReadonlyArray<{ id: ShareTemplate; label: string; overlay: string }> = [
  { id: 'bosque', label: 'Bosque', overlay: 'from-surface/30 via-surface/70 to-surface' },
  { id: 'roble', label: 'Roble', overlay: 'from-tertiary-container/40 via-surface/75 to-surface' },
  { id: 'montana', label: 'Montaña', overlay: 'from-secondary-container/50 via-surface/70 to-surface' },
];

const TARGETS: ReadonlyArray<{ id: ShareTarget; label: string; icon: string }> = [
  { id: 'instagram', label: 'Stories', icon: 'auto_stories' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'chat_bubble' },
  { id: 'tiktok', label: 'TikTok', icon: 'videocam' },
  { id: 'download', label: 'Guardar', icon: 'download' },
];

/** Tarjeta 9:16 (objetivo 1080×1920 al exportar). El servidor genera la imagen final con el mismo contenido. */
export function ShareCard({ content, template, backgroundUrl = bosqueNiebla }: { content: ShareCardContent; template: ShareTemplate; backgroundUrl?: string }) {
  const t = TEMPLATES.find((x) => x.id === template) ?? { overlay: 'from-surface/30 via-surface/70 to-surface' };
  return (
    <div className="relative aspect-[9/16] w-full rounded-2xl overflow-hidden border border-outline-variant shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
      <img src={backgroundUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div aria-hidden="true" className={cx('absolute inset-0 bg-gradient-to-b', t.overlay)} />
      <div className="relative h-full flex flex-col items-center text-center px-5 py-6">
        <SealMark size="sm" className="w-10 h-10" />
        <p className="mt-1 font-label-sm text-[9px] uppercase text-on-surface-variant">Industria Licorera de Caldas</p>
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <BadgeSeal name="" icon={content.badgeIcon} earned size="lg" />
          <h2 className="font-headline-lg text-[26px] leading-tight text-primary">{content.headline}</h2>
          <p className="font-body-md text-[13px] text-on-surface">{content.message}</p>
        </div>
        <p className="font-label-sm text-[11px] text-on-surface-variant">ilc.app</p>
        <p className="mt-1 font-label-sm text-[7px] leading-tight uppercase text-on-surface-variant">{LEGAL_COPY}</p>
      </div>
    </div>
  );
}

/**
 * Vista pura: compartir logro.
 * Diseño: Stitch "12 · Compartir logro". Fuentes: Instrucciones §12; Guía Técnica §5.10; Guía Gamificación §16.1.
 * Compartir es siempre voluntario y con vista previa.
 */
export interface ShareCardViewProps {
  content: ShareCardContent;
  template: ShareTemplate;
  onTemplateChange: (t: ShareTemplate) => void;
  onShare: (target: ShareTarget) => void;
  onClose: () => void;
}

export function ShareCardView({ content, template, onTemplateChange, onShare, onClose }: ShareCardViewProps) {
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar
          title="Compartir logro"
          trailing={
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="w-12 h-12 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
            >
              <Icon name="close" className="text-[22px]" />
            </button>
          }
        />
        <main className="flex-1 px-4 pt-4 pb-6 space-y-5">
          <div className="mx-auto w-full max-w-64">
            <ShareCard content={content} template={template} />
          </div>
          <fieldset>
            <legend className="font-label-lg text-label-lg text-on-surface mb-2">Diseño de la tarjeta</legend>
            <div className="flex justify-center gap-2">
              {TEMPLATES.map((t) => (
                <label
                  key={t.id}
                  className={cx(
                    'min-h-12 px-4 flex items-center rounded-full border cursor-pointer font-label-lg text-[13px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
                    template === t.id
                      ? 'bg-secondary-container border-secondary/50 text-on-secondary-container'
                      : 'border-outline-variant text-on-surface-variant',
                  )}
                >
                  <input
                    type="radio"
                    name="share-template"
                    value={t.id}
                    checked={template === t.id}
                    onChange={() => onTemplateChange(t.id)}
                    className="sr-only"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-4 gap-2">
            {TARGETS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onShare(t.id)}
                className="min-h-18 flex flex-col items-center justify-center gap-1 rounded-xl border border-outline-variant bg-surface-container font-label-sm text-[11px] text-on-surface hover:border-primary/60"
              >
                <Icon name={t.icon} className="text-[24px] text-primary" />
                {t.label}
              </button>
            ))}
          </div>
          <p className="flex items-start gap-2 font-body-md text-[13px] text-on-surface-variant">
            <Icon name="verified_user" className="text-[18px] text-secondary" />
            Tú decides si compartes. No incluimos tu nombre, tu ubicación ni cifras de puntos.
          </p>
        </main>
      </div>
    </div>
  );
}
