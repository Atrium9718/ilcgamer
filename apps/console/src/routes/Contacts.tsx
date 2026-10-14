import type { Registrations } from '@ilc/contracts';
import { ContactsView } from '@ilc/ui';
import { useCallback, useEffect, useState } from 'react';
import { contactsAdminApi } from '../lib/adminApi.ts';
import { errorMessage } from '../lib/session.tsx';

const whenFmt = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});
const dayFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Una celda de CSV: se protege contra fórmulas de hoja de cálculo (=, +, -, @) y comillas. */
export const csvCell = (v: string | null): string => {
  // Un +/- seguido de dígitos (p. ej. un celular +57…) es un número, no una fórmula.
  const t = (v ?? '').replace(/^(?:[=@\t\r]|[+-](?!\d))/, "'$&");
  return `"${t.replace(/"/g, '""')}"`;
};
export const registrationsCsv = (data: Registrations): string =>
  [
    'nombre,correo,celular,autorizo_tratamiento_de_datos,acepta_novedades,fecha_novedades,origen',
    ...data.rows.map((r) => [r.fullName, r.email, r.phone, r.registeredAt, r.marketing ? 'si' : 'no', r.marketingAt, r.source].map(csvCell).join(',')),
  ].join('\r\n');

export function Contacts() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Registrations>();
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    setError(undefined);
    contactsAdminApi.registrations(days).then(setData, (e) => setError(errorMessage(e)));
  }, [days]);
  useEffect(load, [load]);

  const download = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([`﻿${registrationsCsv(data)}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `registros-ilc-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ContactsView
      summary={data?.summary ?? { total: 0, withMarketing: 0, withEmail: 0, withPhone: 0, inPeriod: 0, today: 0 }}
      byDay={(data?.byDay ?? []).map((d) => ({ label: dayFmt.format(new Date(`${d.date}T00:00:00Z`)), count: d.count }))}
      days={days}
      onDaysChange={setDays}
      rows={(data?.rows ?? []).map((r) => ({
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        registeredLabel: whenFmt.format(new Date(r.registeredAt)),
        marketing: r.marketing,
        source: r.source,
      }))}
      loading={!data && !error}
      error={error}
      onDownload={download}
      onRetry={load}
    />
  );
}
