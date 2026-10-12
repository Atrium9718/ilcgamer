import type { CampaignView } from '@ilc/contracts';
import { type CampaignEditorValue, CampaignEditorView, StatusMessage } from '@ilc/ui';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { adminApi } from '../lib/adminApi.ts';
import { ApiRequestError } from '../lib/api.ts';
import { BRANDS, editorToCreate, editorToDraft, emptyEditorValue, viewToEditor } from '../lib/mapping.ts';
import { errorMessage } from '../lib/session.tsx';

/** Crear campaña (sin slug en la URL) o editar el borrador de la versión de trabajo. */
export function CampaignEditor() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [original, setOriginal] = useState<CampaignView | null>(null);
  const [value, setValue] = useState<CampaignEditorValue | null>(slug ? null : emptyEditorValue());
  const [loadError, setLoadError] = useState<string>();
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slug) return;
    adminApi.get(slug).then(
      (c) => {
        if (c.workingVersion.state !== 'BORRADOR') {
          setLoadError('Solo se puede editar una versión en borrador. Crea una nueva versión desde el detalle.');
          return;
        }
        setOriginal(c);
        setValue(viewToEditor(c));
      },
      (err) => setLoadError(errorMessage(err)),
    );
  }, [slug]);

  if (loadError) return <StatusMessage kind="error" title="No se puede editar" body={loadError} />;
  if (!value) return <StatusMessage kind="pending" title="Cargando campaña" body="Un momento…" />;

  const save = async () => {
    setSaving(true);
    setError(undefined);
    setFieldErrors({});
    try {
      const saved = slug
        ? await adminApi.updateDraft(slug, editorToDraft(value, original?.workingVersion.draft))
        : await adminApi.create(editorToCreate(value));
      navigate(`/campanas/${saved.slug}`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'VALIDATION_FAILED' && err.fields) {
        setFieldErrors(err.fields);
        const count = Object.keys(err.fields).length;
        setError(`Revisa ${count === 1 ? 'el campo marcado' : `los ${count} campos marcados`}: ${Object.values(err.fields).flat().slice(0, 3).join(' · ')}`);
      } else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CampaignEditorView
      mode={slug ? 'edit' : 'create'}
      value={value}
      onChange={setValue}
      brandOptions={[...BRANDS]}
      fieldErrors={fieldErrors}
      error={error}
      saving={saving}
      onSave={() => void save()}
      onCancel={() => navigate(slug ? `/campanas/${slug}` : '/campanas')}
    />
  );
}
