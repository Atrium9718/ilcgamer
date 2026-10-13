import { Button } from '../components/Button.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';

export interface ContactRow {
  alias: string;
  email: string | null;
  phone: string | null;
  optedInLabel: string;
  source: string;
}

export interface ContactsViewProps {
  rows: ContactRow[];
  total: number;
  loading?: boolean;
  error?: string;
  onDownload: () => void;
  onRetry: () => void;
}

/** Contactos que autorizaron recibir novedades de ILC. Solo se muestran con la autorización vigente; cada consulta queda auditada. */
export function ContactsView({ rows, total, loading, error, onDownload, onRetry }: ContactsViewProps) {
  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <header className="space-y-2">
        <h1 className="font-headline-lg text-[28px] leading-8 text-on-surface">Contactos con autorización</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
          Personas que aceptaron recibir novedades y promociones de ILC y sus marcas. Úsalos solo para esa finalidad. Quien retire su autorización desaparece de
          esta lista. Cada consulta o descarga queda registrada en la auditoría.
        </p>
      </header>
      {loading && <StatusMessage kind="pending" title="Cargando contactos…" />}
      {error && <StatusMessage kind="error" title="No pudimos cargar los contactos" body={error} action={<Button onClick={onRetry}>Reintentar</Button>} />}
      {!loading && !error && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <p role="status" className="font-headline-md text-headline-md text-on-surface">
              {total} {total === 1 ? 'contacto' : 'contactos'}
            </p>
            <Button variant="secondary" onClick={onDownload} disabled={total === 0}>
              Descargar CSV
            </Button>
          </div>
          {rows.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant">Todavía no hay contactos con autorización vigente.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-outline-variant">
              <table className="w-full text-left font-body-md text-[14px]">
                <caption className="sr-only">Contactos con autorización de novedades</caption>
                <thead className="bg-surface-container-high text-on-surface">
                  <tr>
                    <th scope="col" className="p-3">
                      Alias
                    </th>
                    <th scope="col" className="p-3">
                      Correo
                    </th>
                    <th scope="col" className="p-3">
                      Celular
                    </th>
                    <th scope="col" className="p-3">
                      Autorizó
                    </th>
                    <th scope="col" className="p-3">
                      Desde
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.alias}-${r.optedInLabel}-${r.email ?? r.phone}`} className="border-t border-outline-variant text-on-surface">
                      <td className="p-3">{r.alias}</td>
                      <td className="p-3">{r.email ?? '—'}</td>
                      <td className="p-3">{r.phone ?? '—'}</td>
                      <td className="p-3">{r.optedInLabel}</td>
                      <td className="p-3">{r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
