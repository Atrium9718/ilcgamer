import { type FormEvent, useState } from 'react';
import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { TextField } from '../components/TextField.tsx';
import { cx } from '../lib/cx.ts';

export type SmartTagsTab = 'lotes' | 'importar' | 'generar' | 'productos' | 'configuracion';

export interface BatchRow {
  id: string;
  productName: string;
  sku: string;
  label: string;
  supplier: string | null;
  total: number;
  counts: { asignados: number; distribuidos: number; alerta: number; revocados: number };
  revoked: boolean;
  campaigns: Array<{ slug: string; title: string; codes: number; claimed: number }>;
}

export interface ProductRow {
  sku: string;
  name: string;
  brandLabel: string;
  codes: number;
}

export interface ImportPreviewView {
  fileName: string;
  status: 'PREVISTA' | 'CONFIRMADA' | 'DESCARTADA';
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  errorRows: number;
  warnings: string[];
  issues: Array<{ line: number; tokenHint: string; message: string }>;
  groups: Array<{ sku: string; batch: string; rows: number }>;
}

export interface GenerateValue {
  sku: string;
  batchLabel: string;
  supplier: string;
  count: number;
}

export interface NewProductValue {
  sku: string;
  name: string;
  brandSlug: string;
}

export interface SmartTagsViewProps {
  tab: SmartTagsTab;
  onTabChange: (tab: SmartTagsTab) => void;
  /** Catálogo y lotes (Admin de Marca). */
  canManageCatalog: boolean;
  /** Generar, importar, revocar y editar la plantilla (SuperAdmin / TI — Instrucciones §3.6). */
  isMaster: boolean;
  loading?: boolean;
  error?: string;
  notice?: string;
  busy?: string;
  fieldErrors?: Record<string, string[]>;

  batches: BatchRow[];
  campaignOptions: Array<{ slug: string; label: string }>;
  onLink: (batchId: string, campaignSlug: string) => void;
  onDistribute: (batchId: string) => void;
  onRevoke: (batchId: string, reason: string) => void;
  onExport: (batchId: string) => void;

  preview: ImportPreviewView | null;
  onFile: (file: File) => void;
  onConfirmImport: () => void;
  onDiscardImport: () => void;
  onDownloadIssues: () => void;

  generate: GenerateValue;
  onGenerateChange: (v: GenerateValue) => void;
  onGenerate: () => void;

  products: ProductRow[];
  newProduct: NewProductValue;
  onNewProductChange: (v: NewProductValue) => void;
  onCreateProduct: () => void;
  brandOptions: Array<{ slug: string; label: string }>;

  urlTemplate: string;
  onUrlTemplateChange: (v: string) => void;
  onSaveUrlTemplate: () => void;
}

const TABS: ReadonlyArray<{ id: SmartTagsTab; label: string; master?: boolean }> = [
  { id: 'lotes', label: 'Lotes' },
  { id: 'importar', label: 'Importar', master: true },
  { id: 'generar', label: 'Generar', master: true },
  { id: 'productos', label: 'Productos' },
  { id: 'configuracion', label: 'Configuración' },
];

const fmt = (n: number) => n.toLocaleString('es-CO');
const inputClass =
  'w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-lowest font-body-md text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary';

/**
 * Vista pura: administración de Smart Tags (códigos de producto).
 * Diseño: Stitch "18 · Consola · Smart Tags". Fuentes: Instrucciones §3.6, §4.1, §10; Guía Técnica §5.6.
 * Los tokens nunca se muestran completos: solo el último tramo. Consultar un código no consume promociones.
 */
export function SmartTagsView(p: SmartTagsViewProps) {
  const tabs = TABS.filter((t) => !t.master || p.isMaster);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Smart Tags</h1>
        <p className="mt-1 max-w-3xl font-body-md text-body-md text-on-surface-variant">
          Códigos de producto impresos en cada botella. Consultarlos no consume ninguna promoción; las promociones se vinculan por lote y se reclaman una sola
          vez.
        </p>
      </div>

      <div role="tablist" aria-label="Secciones de Smart Tags" className="flex gap-1 border-b border-outline-variant">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={p.tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => p.onTabChange(t.id)}
            className={cx(
              'min-h-11 px-4 -mb-px border-b-2 font-label-lg text-[14px]',
              p.tab === t.id ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {p.error && (
        <p
          role="alert"
          className="flex items-start gap-2 p-3 rounded-xl border border-error/50 bg-error-container text-on-error-container font-body-md text-[14px]"
        >
          <Icon name="error" className="text-[20px]" />
          {p.error}
        </p>
      )}
      {p.notice && (
        <p
          role="status"
          className="flex items-start gap-2 p-3 rounded-xl border border-secondary/50 bg-secondary-container text-on-secondary-container font-body-md text-[14px]"
        >
          <Icon name="check_circle" className="text-[20px]" />
          {p.notice}
        </p>
      )}

      <section role="tabpanel" id={`panel-${p.tab}`} aria-labelledby={`tab-${p.tab}`}>
        {p.loading ? (
          <StatusMessage kind="pending" title="Cargando…" />
        ) : p.tab === 'lotes' ? (
          <BatchesPanel {...p} />
        ) : p.tab === 'importar' ? (
          <ImportPanel {...p} />
        ) : p.tab === 'generar' ? (
          <GeneratePanel {...p} />
        ) : p.tab === 'productos' ? (
          <ProductsPanel {...p} />
        ) : (
          <SettingsPanel {...p} />
        )}
      </section>
    </div>
  );
}

function BatchesPanel(p: SmartTagsViewProps) {
  const [open, setOpen] = useState<{ id: string; action: 'link' | 'revoke' } | null>(null);
  const [campaign, setCampaign] = useState('');
  const [reason, setReason] = useState('');
  if (p.batches.length === 0) {
    return (
      <StatusMessage
        kind="empty"
        title="Aún no hay lotes"
        body={p.isMaster ? 'Importa o genera códigos para crear el primer lote.' : 'TI debe importar o generar los códigos.'}
      />
    );
  }
  const toggle = (id: string, action: 'link' | 'revoke') => {
    setOpen(open?.id === id && open.action === action ? null : { id, action });
    setCampaign('');
    setReason('');
  };
  return (
    <div className="rounded-2xl border border-outline-variant overflow-hidden bg-surface-container-lowest">
      <table className="w-full text-left">
        <thead className="bg-surface-container font-label-sm text-label-sm uppercase text-on-surface-variant">
          <tr>
            <th scope="col" className="px-4 py-3">
              Producto
            </th>
            <th scope="col" className="px-4 py-3">
              Lote
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Códigos
            </th>
            <th scope="col" className="px-4 py-3">
              Estado de los códigos
            </th>
            <th scope="col" className="px-4 py-3">
              Promoción vinculada
            </th>
            <th scope="col" className="px-4 py-3">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {p.batches.map((b) => (
            <BatchRowItem
              key={b.id}
              b={b}
              p={p}
              open={open?.id === b.id ? open.action : null}
              onToggle={(a) => toggle(b.id, a)}
              campaign={campaign}
              onCampaign={setCampaign}
              reason={reason}
              onReason={setReason}
              onDone={() => setOpen(null)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatchRowItem(props: {
  b: BatchRow;
  p: SmartTagsViewProps;
  open: 'link' | 'revoke' | null;
  onToggle: (a: 'link' | 'revoke') => void;
  campaign: string;
  onCampaign: (v: string) => void;
  reason: string;
  onReason: (v: string) => void;
  onDone: () => void;
}) {
  const { b, p, open } = props;
  const chips = [
    { label: 'Asignados', n: b.counts.asignados, cls: 'border-outline text-on-surface-variant' },
    { label: 'Distribuidos', n: b.counts.distribuidos, cls: 'border-secondary text-secondary' },
    { label: 'Con alerta', n: b.counts.alerta, cls: 'border-warning text-warning' },
    { label: 'Revocados', n: b.counts.revocados, cls: 'border-error text-error' },
  ].filter((c) => c.n > 0);
  return (
    <>
      <tr className={cx(b.revoked && 'bg-surface-container-low')}>
        <td className="px-4 py-3">
          <p className="font-headline-md text-[17px] leading-6 text-on-surface">{b.productName}</p>
          <p className="font-body-md text-[12px] text-on-surface-variant">{b.sku}</p>
        </td>
        <td className="px-4 py-3">
          <p className="font-label-lg text-[14px]">{b.label}</p>
          <p className="font-body-md text-[12px] text-on-surface-variant">{b.supplier ?? 'Sin proveedor'}</p>
        </td>
        <td className="px-4 py-3 text-right font-label-lg text-[14px] tabular-nums">{fmt(b.total)}</td>
        <td className="px-4 py-3">
          <ul className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <li key={c.label} className={cx('px-2 py-0.5 rounded-full border font-label-sm text-[11px]', c.cls)}>
                {c.label} {fmt(c.n)}
              </li>
            ))}
          </ul>
        </td>
        <td className="px-4 py-3 font-body-md text-[13px]">
          {b.campaigns.length === 0 ? (
            <span className="text-on-surface-variant">Sin promoción</span>
          ) : (
            <ul className="space-y-0.5">
              {b.campaigns.map((c) => (
                <li key={c.slug}>
                  {c.title} · <span className="tabular-nums">{fmt(c.claimed)}</span> de <span className="tabular-nums">{fmt(c.codes)}</span> reclamados
                </li>
              ))}
            </ul>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap justify-end gap-1">
            {!b.revoked && p.canManageCatalog && (
              <>
                <RowAction label="Vincular a promoción" onClick={() => props.onToggle('link')} expanded={open === 'link'} batch={b.label} />
                {b.counts.asignados > 0 && (
                  <RowAction label="Marcar distribuido" onClick={() => p.onDistribute(b.id)} busy={p.busy === `distribute:${b.id}`} batch={b.label} />
                )}
              </>
            )}
            {p.canManageCatalog && <RowAction label="Exportar auditoría" onClick={() => p.onExport(b.id)} busy={p.busy === `export:${b.id}`} batch={b.label} />}
            {!b.revoked && p.isMaster && (
              <RowAction label="Revocar lote" danger onClick={() => props.onToggle('revoke')} expanded={open === 'revoke'} batch={b.label} />
            )}
            {b.revoked && <span className="px-2 py-0.5 rounded-full border border-error text-error font-label-sm text-[11px]">Lote revocado</span>}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="px-4 pb-4">
            {open === 'link' ? (
              <form
                className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-outline-variant bg-surface-container"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  if (!props.campaign) return;
                  p.onLink(b.id, props.campaign);
                  props.onDone();
                }}
              >
                <label className="flex-1 min-w-64 space-y-1.5">
                  <span className="font-label-lg text-label-lg text-on-surface">Promoción (Ruta A o mixta, misma submarca)</span>
                  <select value={props.campaign} onChange={(e) => props.onCampaign(e.target.value)} className={inputClass}>
                    <option value="">Elige una promoción</option>
                    {p.campaignOptions.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" fullWidth={false} disabled={!props.campaign} className="px-5 h-11">
                  Vincular {fmt(b.total)} botellas
                </Button>
              </form>
            ) : (
              <form
                className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-error/50 bg-error-container/40"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  if (props.reason.trim().length < 5) return;
                  p.onRevoke(b.id, props.reason.trim());
                  props.onDone();
                }}
              >
                <TextField
                  label="Motivo de la revocación"
                  value={props.reason}
                  onChange={props.onReason}
                  maxLength={500}
                  hint="Queda en la auditoría. Los códigos dejan de confirmarse y sus promociones sin reclamar se anulan."
                  className="flex-1 min-w-64"
                />
                <Button type="submit" variant="danger" fullWidth={false} disabled={props.reason.trim().length < 5} className="px-5 h-11">
                  Revocar lote {b.label}
                </Button>
              </form>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function RowAction({
  label,
  onClick,
  danger,
  expanded,
  busy,
  batch,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  expanded?: boolean;
  busy?: boolean;
  batch: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-expanded={expanded}
      aria-label={`${label}, lote ${batch}`}
      className={cx(
        'min-h-10 px-3 rounded-lg font-label-lg text-[13px] hover:bg-surface-container disabled:opacity-60',
        danger ? 'text-error' : 'text-primary',
      )}
    >
      {label}
    </button>
  );
}

function ImportPanel(p: SmartTagsViewProps) {
  const pv = p.preview;
  return (
    <div className="grid grid-cols-[1fr_22rem] gap-6 items-start">
      <div className="space-y-4">
        <label className="block p-6 rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-lowest text-center cursor-pointer hover:border-primary">
          <Icon name="upload_file" className="text-[36px] text-primary" />
          <span className="block mt-2 font-label-lg text-[15px] text-on-surface">Cargar archivo de la imprenta (.csv o .xlsx)</span>
          <span className="block mt-1 font-body-md text-[13px] text-on-surface-variant">
            Columnas: token, sku, lote y (opcional) proveedor. Máximo 50.000 filas y 10 MB. Nada se guarda hasta confirmar.
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={p.busy === 'upload'}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) p.onFile(f);
              e.target.value = '';
            }}
          />
        </label>
        {p.busy === 'upload' && <StatusMessage kind="pending" title="Validando el archivo…" body="Revisamos cada fila sin guardar nada todavía." />}
        {pv && (
          <div className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-headline-md text-[20px] text-on-surface">{pv.fileName}</p>
                <p className="font-body-md text-[13px] text-on-surface-variant">
                  {pv.status === 'PREVISTA' ? 'Vista previa · sin importar' : pv.status === 'CONFIRMADA' ? 'Importación confirmada' : 'Importación descartada'}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-4 gap-3">
              {[
                ['Filas', pv.totalRows],
                ['Válidas', pv.validRows],
                ['Duplicadas', pv.duplicateRows],
                ['Con error', pv.errorRows],
              ].map(([label, n]) => (
                <div key={label} className="p-3 rounded-xl bg-surface-container">
                  <dt className="font-label-sm text-label-sm uppercase text-on-surface-variant">{label}</dt>
                  <dd className="font-numeric-xl text-[24px] tabular-nums text-on-surface">{fmt(Number(n))}</dd>
                </div>
              ))}
            </dl>
            {pv.groups.length > 0 && (
              <p className="font-body-md text-[14px]">
                Se crearán o completarán: {pv.groups.map((g) => `${g.sku} · lote ${g.batch} (${fmt(g.rows)})`).join('; ')}.
              </p>
            )}
            {pv.warnings.map((w) => (
              <p key={w} className="flex gap-2 p-3 rounded-xl border border-warning/50 bg-surface-container-high font-body-md text-[13px]">
                <Icon name="warning" className="text-[18px] text-warning" />
                {w}
              </p>
            ))}
            {pv.issues.length > 0 && (
              <table className="w-full text-left font-body-md text-[13px]">
                <caption className="text-left font-label-lg text-[14px] pb-2">Primeros problemas encontrados</caption>
                <thead className="text-on-surface-variant">
                  <tr>
                    <th scope="col" className="py-1">
                      Línea
                    </th>
                    <th scope="col" className="py-1">
                      Código
                    </th>
                    <th scope="col" className="py-1">
                      Motivo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pv.issues.map((i) => (
                    <tr key={i.line} className="border-t border-outline-variant">
                      <td className="py-1 tabular-nums">{i.line}</td>
                      <td className="py-1 tabular-nums">{i.tokenHint}</td>
                      <td className="py-1">{i.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex flex-wrap gap-3">
              {pv.status === 'PREVISTA' && (
                <>
                  <Button
                    fullWidth={false}
                    leadingIcon="task_alt"
                    disabled={pv.validRows === 0}
                    loading={p.busy === 'confirm'}
                    onClick={p.onConfirmImport}
                    className="px-5"
                  >
                    Confirmar importación de {fmt(pv.validRows)} códigos
                  </Button>
                  <Button variant="secondary" fullWidth={false} onClick={p.onDiscardImport} className="px-5">
                    Descartar
                  </Button>
                </>
              )}
              {pv.duplicateRows + pv.errorRows > 0 && (
                <Button variant="text" fullWidth={false} leadingIcon="download" onClick={p.onDownloadIssues}>
                  Descargar errores (CSV)
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      <aside className="p-5 rounded-2xl border border-outline-variant bg-surface-container-low space-y-2 font-body-md text-[13px] text-on-surface-variant">
        <p className="font-label-lg text-[14px] text-on-surface">Cómo se protege</p>
        <p>El archivo no se guarda. De cada token solo conservamos su huella (hash) y los últimos 4 caracteres.</p>
        <p>Un mismo archivo no se puede importar dos veces y, si el inventario cambia antes de confirmar, no se importa nada.</p>
        <p>El cifrado del archivo en tránsito desde la imprenta lo define TI con el proveedor.</p>
      </aside>
    </div>
  );
}

function GeneratePanel(p: SmartTagsViewProps) {
  const g = p.generate;
  const fe = (k: string) => p.fieldErrors?.[k]?.[0];
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (p.busy !== 'generate') p.onGenerate();
      }}
      className="max-w-2xl p-6 rounded-2xl border border-outline-variant bg-surface-container-lowest space-y-4"
    >
      <p className="font-body-md text-[14px] text-on-surface-variant">
        Genera tokens aleatorios de 12 caracteres para la imprenta. La descarga es la <strong className="text-on-surface">única</strong> vez que verás los
        tokens completos: guárdala de forma segura y entrégala por el canal acordado con TI.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-1.5">
          <span className="font-label-lg text-label-lg text-on-surface">Producto</span>
          <select
            value={g.sku}
            onChange={(e) => p.onGenerateChange({ ...g, sku: e.target.value })}
            className={inputClass}
            aria-invalid={fe('sku') ? true : undefined}
          >
            <option value="">Elige un producto</option>
            {p.products.map((pr) => (
              <option key={pr.sku} value={pr.sku}>
                {pr.name} · {pr.sku}
              </option>
            ))}
          </select>
          {fe('sku') && <span className="block font-label-lg text-[13px] text-error">{fe('sku')}</span>}
        </label>
        <TextField label="Lote" value={g.batchLabel} onChange={(v) => p.onGenerateChange({ ...g, batchLabel: v })} maxLength={40} error={fe('batchLabel')} />
        <TextField label="Proveedor (opcional)" value={g.supplier} onChange={(v) => p.onGenerateChange({ ...g, supplier: v })} maxLength={60} />
        <label className="space-y-1.5">
          <span className="font-label-lg text-label-lg text-on-surface">Cantidad</span>
          <input
            type="number"
            min={1}
            max={10000}
            value={g.count}
            onChange={(e) => p.onGenerateChange({ ...g, count: Number(e.target.value) })}
            className={inputClass}
            aria-invalid={fe('count') ? true : undefined}
          />
          <span className="block font-body-md text-[12px] text-on-surface-variant">Hasta 10.000 por descarga.</span>
        </label>
      </div>
      <Button
        type="submit"
        fullWidth={false}
        leadingIcon="qr_code_2"
        loading={p.busy === 'generate'}
        disabled={!g.sku || !g.batchLabel.trim()}
        className="px-5"
      >
        Generar y descargar CSV
      </Button>
    </form>
  );
}

function ProductsPanel(p: SmartTagsViewProps) {
  const np = p.newProduct;
  const fe = (k: string) => p.fieldErrors?.[k]?.[0];
  return (
    <div className="grid grid-cols-[1fr_22rem] gap-6 items-start">
      {p.products.length === 0 ? (
        <StatusMessage kind="empty" title="Aún no hay productos" body="Registra las referencias vigentes (SKU) antes de importar o generar códigos." />
      ) : (
        <div className="rounded-2xl border border-outline-variant overflow-hidden bg-surface-container-lowest">
          <table className="w-full text-left">
            <thead className="bg-surface-container font-label-sm text-label-sm uppercase text-on-surface-variant">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Producto
                </th>
                <th scope="col" className="px-4 py-3">
                  SKU
                </th>
                <th scope="col" className="px-4 py-3">
                  Submarca
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Códigos
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-body-md text-[14px]">
              {p.products.map((pr) => (
                <tr key={pr.sku}>
                  <td className="px-4 py-3">{pr.name}</td>
                  <td className="px-4 py-3 tabular-nums">{pr.sku}</td>
                  <td className="px-4 py-3">{pr.brandLabel}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(pr.codes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {p.canManageCatalog && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (p.busy !== 'product') p.onCreateProduct();
          }}
          className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest space-y-4"
        >
          <p className="font-headline-md text-[20px] text-on-surface">Nuevo producto</p>
          <TextField
            label="SKU"
            value={np.sku}
            onChange={(v) => p.onNewProductChange({ ...np, sku: v.toUpperCase() })}
            maxLength={40}
            hint="Referencia vigente confirmada por ILC"
            error={fe('sku')}
          />
          <TextField label="Nombre" value={np.name} onChange={(v) => p.onNewProductChange({ ...np, name: v })} maxLength={120} error={fe('name')} />
          <label className="block space-y-1.5">
            <span className="font-label-lg text-label-lg text-on-surface">Submarca</span>
            <select value={np.brandSlug} onChange={(e) => p.onNewProductChange({ ...np, brandSlug: e.target.value })} className={inputClass}>
              <option value="">Elige una submarca</option>
              {p.brandOptions.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" leadingIcon="add_circle" loading={p.busy === 'product'} disabled={!np.sku || !np.name || !np.brandSlug}>
            Registrar producto
          </Button>
        </form>
      )}
    </div>
  );
}

function SettingsPanel(p: SmartTagsViewProps) {
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (p.isMaster && p.busy !== 'template') p.onSaveUrlTemplate();
      }}
      className="max-w-2xl p-6 rounded-2xl border border-outline-variant bg-surface-container-lowest space-y-4"
    >
      <p className="font-headline-md text-[20px] text-on-surface">Plantilla de URL del QR</p>
      <TextField
        label="Estructura de la URL"
        value={p.urlTemplate}
        onChange={p.onUrlTemplateChange}
        maxLength={200}
        disabled={!p.isMaster}
        hint="Debe empezar por https:// e incluir {token} una vez. Cambiarla solo afecta los próximos códigos generados: los QR ya impresos siguen funcionando."
        error={p.fieldErrors?.urlTemplate?.[0]}
      />
      {p.isMaster ? (
        <Button type="submit" variant="secondary" fullWidth={false} leadingIcon="save" loading={p.busy === 'template'} className="px-5">
          Guardar plantilla
        </Button>
      ) : (
        <p className="font-body-md text-[13px] text-on-surface-variant">Solo TI (SuperAdmin) puede cambiar la plantilla.</p>
      )}
    </form>
  );
}
