import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { cx } from '../lib/cx.ts';
import { ApprovalDots, type ApprovalState, type CampaignStatusView, RouteChip, type RouteView, STATUS_LABEL, StatusChip } from './chips.tsx';

export interface CampaignRow {
  slug: string;
  internalName: string;
  route: RouteView;
  status: CampaignStatusView;
  brandLabels: string[];
  windowLabel: string;
  version: number;
  approvals: Array<{ kind: string; status: ApprovalState }>;
}

const FILTERS: ReadonlyArray<CampaignStatusView | 'todas'> = ['todas', 'BORRADOR', 'EN_REVISION', 'APROBADA', 'PROGRAMADA', 'ACTIVA', 'PAUSADA', 'CERRADA'];

/**
 * Vista pura: lista de campañas de la consola. Diseño: Stitch "16 · Consola · Lista de campañas".
 * Fuentes: Instrucciones §2, §3.5; Guía Técnica §5.3, §5.11.
 */
export interface CampaignListViewProps {
  rows: CampaignRow[];
  filter: CampaignStatusView | 'todas';
  onFilterChange: (f: CampaignStatusView | 'todas') => void;
  search: string;
  onSearchChange: (v: string) => void;
  canCreate: boolean;
  onCreate: () => void;
  onOpen: (slug: string) => void;
  loading?: boolean;
}

export function CampaignListView({
  rows,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  canCreate,
  onCreate,
  onOpen,
  loading = false,
}: CampaignListViewProps) {
  const q = search.trim().toLowerCase();
  const visible = rows.filter((r) => !q || r.internalName.toLowerCase().includes(q) || r.slug.includes(q));
  const count = (s: CampaignStatusView) => rows.filter((r) => r.status === s).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Campañas</h1>
          <p className="mt-1 max-w-2xl font-body-md text-body-md text-on-surface-variant">
            Temporadas, reglas, temas y aprobaciones editoriales sin desplegar código. Ninguna campaña se publica sin las aprobaciones y el checklist completos.
          </p>
        </div>
        {canCreate && (
          <Button fullWidth={false} leadingIcon="add_circle" onClick={onCreate} className="px-5">
            Nueva campaña
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-4 gap-4">
        {[
          { label: 'Campañas', value: rows.length, icon: 'folder_special' },
          { label: 'Activas', value: count('ACTIVA'), icon: 'sensors' },
          { label: 'En revisión', value: count('EN_REVISION'), icon: 'pending_actions' },
          { label: 'Programadas', value: count('PROGRAMADA'), icon: 'event' },
        ].map((k) => (
          <div key={k.label} className="relative p-4 rounded-2xl border border-outline-variant bg-surface-container-low">
            <dt className="font-label-sm text-label-sm uppercase text-on-surface-variant">{k.label}</dt>
            <dd className="mt-1 font-numeric-xl text-[32px] leading-none text-on-surface tabular-nums">
              {k.value}
              <Icon name={k.icon} className="absolute top-4 right-4 text-[24px] text-primary" />
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="relative flex-1 min-w-64">
          <span className="sr-only">Buscar campaña</span>
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre o identificador"
            className="w-full h-11 pl-10 pr-3 rounded-xl border border-outline-variant bg-surface-container-lowest font-body-md text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </label>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Filtrar por estado</legend>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => onFilterChange(f)}
              className={cx(
                'min-h-9 px-3 rounded-full border font-label-lg text-[13px]',
                filter === f ? 'bg-secondary text-on-secondary border-secondary' : 'border-outline-variant text-on-surface-variant hover:border-outline',
              )}
            >
              {f === 'todas' ? 'Todas' : STATUS_LABEL[f]}
            </button>
          ))}
        </fieldset>
      </div>

      {loading ? (
        <StatusMessage kind="pending" title="Cargando campañas…" />
      ) : visible.length === 0 ? (
        <StatusMessage kind="empty" title="No hay campañas con este filtro" body="Crea una campaña nueva o cambia el filtro." />
      ) : (
        <div className="rounded-2xl border border-outline-variant overflow-hidden bg-surface-container-lowest">
          <table className="w-full text-left">
            <thead className="bg-surface-container font-label-sm text-label-sm uppercase text-on-surface-variant">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Campaña
                </th>
                <th scope="col" className="px-4 py-3">
                  Ruta
                </th>
                <th scope="col" className="px-4 py-3">
                  Marca
                </th>
                <th scope="col" className="px-4 py-3">
                  Ventana
                </th>
                <th scope="col" className="px-4 py-3">
                  Versión
                </th>
                <th scope="col" className="px-4 py-3">
                  Estado
                </th>
                <th scope="col" className="px-4 py-3">
                  Aprobaciones <span className="normal-case tracking-normal">(M · J · P)</span>
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {visible.map((r) => (
                <tr key={r.slug} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3">
                    <p className="font-headline-md text-[17px] leading-6 text-on-surface">{r.internalName}</p>
                    <p className="font-body-md text-[12px] text-on-surface-variant">{r.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <RouteChip route={r.route} />
                  </td>
                  <td className="px-4 py-3 font-body-md text-[14px]">{r.brandLabels.join(', ')}</td>
                  <td className="px-4 py-3 font-body-md text-[14px] tabular-nums whitespace-nowrap">{r.windowLabel}</td>
                  <td className="px-4 py-3 font-label-lg text-[14px] tabular-nums">v{r.version}</td>
                  <td className="px-4 py-3">
                    <StatusChip status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    <ApprovalDots approvals={r.approvals} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onOpen(r.slug)}
                      className="min-h-10 px-3 rounded-lg font-label-lg text-[13px] text-primary hover:bg-surface-container"
                    >
                      Abrir <span className="sr-only">{r.internalName}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
