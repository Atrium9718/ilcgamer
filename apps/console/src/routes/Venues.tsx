import type { VenueAdminView } from '@ilc/contracts';
import { type NewVenueValue, VenuesAdminView, type VenuesTab } from '@ilc/ui';
import { useCallback, useEffect, useState } from 'react';
import { adminApi, venuesAdminApi } from '../lib/adminApi.ts';
import { ApiRequestError } from '../lib/api.ts';
import { emptyVenueForm } from '../lib/mapping.ts';
import { errorMessage } from '../lib/session.tsx';

/** Contenedor de Comercios: conecta la vista pura con /admin/venues. La API vuelve a validar cada permiso. */
export function Venues() {
  const [tab, setTab] = useState<VenuesTab>('lista');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [venues, setVenues] = useState<VenueAdminView[]>([]);
  const [form, setForm] = useState<NewVenueValue>(emptyVenueForm());
  const [campaignOptions, setCampaignOptions] = useState<Array<{ slug: string; label: string }>>([]);

  const reload = useCallback(async () => setVenues(await venuesAdminApi.list()), []);
  useEffect(() => {
    reload()
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    adminApi.list().then(
      (cs) => setCampaignOptions(cs.map((c) => ({ slug: c.slug, label: c.internalName }))),
      () => undefined,
    );
  }, [reload]);

  const act = async (key: string, fn: () => Promise<string | undefined>) => {
    setBusy(key);
    setError(undefined);
    setNotice(undefined);
    setFieldErrors({});
    try {
      const message = await fn();
      await reload();
      if (message) setNotice(message);
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setFieldErrors(err.fields);
      setError(errorMessage(err));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <VenuesAdminView
      tab={tab}
      onTabChange={(t) => {
        setTab(t);
        setError(undefined);
        setNotice(undefined);
        setFieldErrors({});
      }}
      loading={loading}
      error={error}
      notice={notice}
      busy={busy}
      fieldErrors={fieldErrors}
      venues={venues}
      campaignOptions={campaignOptions}
      onApprove={(id) =>
        void act(`approve:${id}`, async () => {
          await venuesAdminApi.approve(id);
          return 'Establecimiento aprobado: ya puede vincular botellas y entregar recompensas de su ciudad.';
        })
      }
      onSuspend={(id, reason) =>
        void act(`suspend:${id}`, async () => {
          await venuesAdminApi.suspend(id, reason);
          return 'Establecimiento suspendido: dejó de operar y salió del directorio.';
        })
      }
      onLinkCampaigns={(id, slugs) =>
        void act(`link:${id}`, async () => {
          await venuesAdminApi.linkCampaigns(id, slugs);
          return 'Campañas actualizadas.';
        })
      }
      onAddPersonnel={(id, v) =>
        void act(`add:${id}`, async () => {
          await venuesAdminApi.addPersonnel(id, v);
          return v.role === 'STAFF' ? 'Staff agregado: su código ya aparece en la tabla.' : 'Persona de Comercio agregada.';
        })
      }
      onRemovePersonnel={(id, userId) =>
        void act(`remove:${userId}`, async () => {
          await venuesAdminApi.removePersonnel(id, userId);
          return 'Persona retirada del establecimiento.';
        })
      }
      form={form}
      onFormChange={setForm}
      onCreate={() =>
        void act('create', async () => {
          await venuesAdminApi.create({
            ...form,
            name: form.name.trim(),
            city: form.city.trim(),
            department: form.department.trim(),
            address: form.address.trim(),
          });
          setForm(emptyVenueForm());
          setTab('lista');
          return 'Establecimiento registrado como pendiente. Apruébalo para que pueda operar.';
        })
      }
    />
  );
}
