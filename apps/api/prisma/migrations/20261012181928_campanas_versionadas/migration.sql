-- Campañas versionadas con aprobaciones ligadas al contenido exacto revisado (Guía Técnica §5.11).
-- Las columnas obligatorias nuevas se agregan con un valor temporal para no fallar si ya hay filas
-- (entornos de prueba) y luego se retira el valor por defecto.

CREATE TYPE "CampaignVersionState" AS ENUM ('BORRADOR', 'EN_REVISION', 'APROBADA', 'PUBLICADA', 'REEMPLAZADA');

ALTER TABLE "approval_records" ADD COLUMN "contentHash" VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE "approval_records" ALTER COLUMN "contentHash" DROP DEFAULT;

ALTER TABLE "campaign_versions"
  ADD COLUMN "content" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "contentHash" VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN "publishChecklist" JSONB,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "publishedById" UUID,
  ADD COLUMN "state" "CampaignVersionState" NOT NULL DEFAULT 'BORRADOR',
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "submittedById" UUID,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "campaign_versions" ALTER COLUMN "content" DROP DEFAULT, ALTER COLUMN "contentHash" DROP DEFAULT;

-- Una sola versión publicada vigente por campaña.
CREATE UNIQUE INDEX "campaign_versions_one_published" ON "campaign_versions" ("campaignId") WHERE state = 'PUBLICADA';
-- Una sola versión en edición o revisión a la vez por campaña.
CREATE UNIQUE INDEX "campaign_versions_one_working" ON "campaign_versions" ("campaignId") WHERE state IN ('BORRADOR', 'EN_REVISION', 'APROBADA');
