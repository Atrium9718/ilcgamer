import type { BatchView, CampaignSummary, ImportPreview } from '@ilc/contracts';
import { type BatchRow, type GenerateValue, type NewProductValue, type SmartTagsTab, SmartTagsView } from '@ilc/ui';
import { useCallback, useEffect, useState } from 'react';
import { adminApi, smartTagsApi } from '../lib/adminApi.ts';
import { ApiRequestError } from '../lib/api.ts';
import { saveFile } from '../lib/download.ts';
import { BRANDS } from '../lib/mapping.ts';
import { errorMessage, useSession } from '../lib/session.tsx';

const toRow = (b: BatchView): BatchRow => ({
  id: b.id,
  productName: b.productName,
  sku: b.sku,
  label: b.label,
  supplier: b.supplier,
  total: b.total,
  counts: {
    asignados: (b.byStatus.ASIGNADO_A_LOTE ?? 0) + (b.byStatus.GENERADO ?? 0),
    distribuidos: b.byStatus.DISTRIBUIDO ?? 0,
    alerta: b.byStatus.ALERTA_DE_ANOMALIA ?? 0,
    revocados: b.byStatus.REVOCADO ?? 0,
  },
  revoked: b.revokedAt !== null,
  campaigns: b.campaigns,
});

const fmt = (n: number) => n.toLocaleString('es-CO');

/** Contenedor de Smart Tags: conecta la vista pura con /admin/smarttags. La API vuelve a validar cada permiso. */
export function SmartTags() {
  const { me } = useSession();
  const roles = me?.roles ?? [];
  const isMaster = roles.includes('SUPERADMIN');
  const canManageCatalog = isMaster || roles.includes('ADMIN_MARCA');

  const [tab, setTab] = useState<SmartTagsTab>('lotes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [batches, setBatches] = useState<BatchView[]>([]);
  const [products, setProducts] = useState<Awaited<ReturnType<typeof smartTagsApi.products>>>([]);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [generate, setGenerate] = useState<GenerateValue>({ sku: '', batchLabel: '', supplier: '', count: 1000 });
  const [newProduct, setNewProduct] = useState<NewProductValue>({ sku: '', name: '', brandSlug: '' });
  const [urlTemplate, setUrlTemplate] = useState('');

  const reload = useCallback(async () => {
    const [b, p, c, s] = await Promise.all([smartTagsApi.batches(), smartTagsApi.products(), adminApi.list(), smartTagsApi.settings()]);
    setBatches(b);
    setProducts(p);
    setCampaigns(c);
    setUrlTemplate(s.urlTemplate);
  }, []);

  useEffect(() => {
    reload()
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [reload]);

  /** Ejecuta una acción mostrando su estado y el resultado (o el error de la API con sus campos). */
  const act = async (key: string, fn: () => Promise<string | undefined>) => {
    setBusy(key);
    setError(undefined);
    setNotice(undefined);
    setFieldErrors({});
    try {
      const message = await fn();
      if (message) setNotice(message);
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setFieldErrors(err.fields);
      setError(errorMessage(err));
    } finally {
      setBusy(undefined);
    }
  };

  const campaignOptions = campaigns
    .filter((c) => c.route !== 'B_EXPERIENCIAL' && c.status !== 'CERRADA' && c.status !== 'ARCHIVADA')
    .map((c) => ({ slug: c.slug, label: `${c.internalName} (${c.status.toLowerCase().replace('_', ' ')})` }));

  return (
    <SmartTagsView
      tab={tab}
      onTabChange={(t) => {
        setTab(t);
        setError(undefined);
        setNotice(undefined);
        setFieldErrors({});
      }}
      canManageCatalog={canManageCatalog}
      isMaster={isMaster}
      loading={loading}
      error={error}
      notice={notice}
      busy={busy}
      fieldErrors={fieldErrors}
      batches={batches.map(toRow)}
      campaignOptions={campaignOptions}
      onLink={(id, slug) =>
        act(`link:${id}`, async () => {
          const r = await smartTagsApi.link(id, slug);
          await reload();
          return `Se vincularon ${fmt(r.created)} botellas a la promoción${r.skipped ? ` (${fmt(r.skipped)} ya estaban vinculadas o no están en circulación)` : ''}.`;
        })
      }
      onDistribute={(id) =>
        act(`distribute:${id}`, async () => {
          const r = await smartTagsApi.distribute(id);
          await reload();
          return `${fmt(r.updated)} códigos marcados como distribuidos.`;
        })
      }
      onRevoke={(id, reason) =>
        act(`revoke:${id}`, async () => {
          const r = await smartTagsApi.revoke(id, reason);
          await reload();
          return `Lote revocado: ${fmt(r.codes)} códigos y ${fmt(r.campaignCodes)} promociones sin reclamar anuladas.`;
        })
      }
      onExport={(id) =>
        act(`export:${id}`, async () => {
          saveFile(await smartTagsApi.exportBatch(id));
          return undefined;
        })
      }
      preview={preview}
      onFile={(file) =>
        act('upload', async () => {
          setPreview(null);
          setPreview(await smartTagsApi.upload(file));
          return undefined;
        })
      }
      onConfirmImport={() =>
        preview &&
        act('confirm', async () => {
          const done = await smartTagsApi.confirmImport(preview.id);
          setPreview(done);
          await reload();
          return `Importación confirmada: ${fmt(done.validRows)} códigos en inventario.`;
        })
      }
      onDiscardImport={() =>
        preview &&
        act('discard', async () => {
          setPreview(await smartTagsApi.discardImport(preview.id));
          return 'Importación descartada. No se guardó ningún código.';
        })
      }
      onDownloadIssues={() =>
        preview &&
        act('issues', async () => {
          saveFile(await smartTagsApi.importIssues(preview.id));
          return undefined;
        })
      }
      generate={generate}
      onGenerateChange={setGenerate}
      onGenerate={() =>
        act('generate', async () => {
          saveFile(await smartTagsApi.generate({ ...generate, batchLabel: generate.batchLabel.trim(), supplier: generate.supplier.trim() || undefined }));
          await reload();
          return `Se generaron ${fmt(generate.count)} códigos. Guarda el archivo descargado: no se puede volver a descargar.`;
        })
      }
      products={products.map((p) => ({ sku: p.sku, name: p.name, brandLabel: p.brandLabel, codes: p.codes }))}
      newProduct={newProduct}
      onNewProductChange={setNewProduct}
      onCreateProduct={() =>
        act('product', async () => {
          const p = await smartTagsApi.createProduct({ ...newProduct, name: newProduct.name.trim() });
          setNewProduct({ sku: '', name: '', brandSlug: '' });
          await reload();
          return `Producto ${p.sku} registrado.`;
        })
      }
      brandOptions={[...BRANDS]}
      urlTemplate={urlTemplate}
      onUrlTemplateChange={setUrlTemplate}
      onSaveUrlTemplate={() =>
        act('template', async () => {
          await smartTagsApi.saveSettings({ urlTemplate: urlTemplate.trim() });
          return 'Plantilla guardada. Aplica a los próximos códigos generados.';
        })
      }
    />
  );
}
