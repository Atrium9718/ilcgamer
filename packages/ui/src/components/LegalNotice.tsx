import { cx } from '../lib/cx.ts';

/** Leyendas obligatorias (Decreto 120 de 2010; Ley 30 de 1986). Texto tomado de ilc.com.co. */
export const LEGAL_COPY =
  'El exceso de alcohol es perjudicial para la salud. Prohíbase el expendio de bebidas embriagantes a menores de edad (Ley 30 de 1986).';

export interface LegalLink {
  label: string;
  href: string;
}

export interface LegalNoticeProps {
  links?: LegalLink[];
  /** Muestra la razón social antes de la advertencia. */
  showCompany?: boolean;
  className?: string;
}

/** Advertencia legal obligatoria en toda pantalla promocional. Nunca ocultar ni reducir por debajo de AA. */
export function LegalNotice({ links = [], showCompany = false, className }: LegalNoticeProps) {
  return (
    <footer className={cx('w-full px-4 py-6 text-center border-t border-outline-variant', className)}>
      {showCompany && (
        <p className="font-label-sm text-label-sm uppercase text-secondary mb-2">Industria Licorera de Caldas</p>
      )}
      <p className="font-label-sm text-label-sm uppercase leading-relaxed text-on-surface-variant">{LEGAL_COPY}</p>
      {links.length > 0 && (
        <nav aria-label="Enlaces legales" className="flex justify-center flex-wrap gap-x-4 mt-2">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="inline-flex items-center min-h-12 font-label-lg text-[13px] text-on-surface-variant underline-offset-4 hover:text-primary hover:underline">
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </footer>
  );
}
