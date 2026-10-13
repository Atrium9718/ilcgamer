import type { OptInContacts } from '@ilc/contracts';
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

/** Una celda de CSV: se protege contra fórmulas de hoja de cálculo (=, +, -, @) y comillas. */
export const csvCell = (v: string | null): string => {
  const t = (v ?? '').replace(/^[=+\-@\t\r]/, "'$&");
  return `"${t.replace(/"/g, '""')}"`;
};
export const contactsCsv = (data: OptInContacts): string =>
  ['alias,correo,celular,autorizo,origen', ...data.rows.map((r) => [r.alias, r.email, r.phone, r.optedInAt, r.source].map(csvCell).join(','))].join('\r\n');

export function Contacts() {
  const [data, setData] = useState<OptInContacts>();
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    setError(undefined);
    contactsAdminApi.optIns().then(setData, (e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const download = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([`﻿${contactsCsv(data)}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `contactos-con-autorizacion-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ContactsView
      total={data?.total ?? 0}
      rows={(data?.rows ?? []).map((r) => ({
        alias: r.alias,
        email: r.email,
        phone: r.phone,
        optedInLabel: whenFmt.format(new Date(r.optedInAt)),
        source: r.source,
      }))}
      loading={!data && !error}
      error={error}
      onDownload={download}
      onRetry={load}
    />
  );
}
