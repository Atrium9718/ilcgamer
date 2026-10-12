-- AlterTable
ALTER TABLE "mission_progress" ADD COLUMN     "chapterId" VARCHAR(30),
ADD COLUMN     "moduleId" UUID,
ADD COLUMN     "preview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "state" JSONB;

-- AlterTable
ALTER TABLE "modules" ADD COLUMN     "secretEpoch" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "mission_progress" ADD CONSTRAINT "mission_progress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Catálogo de juegos (§5.4): una sola versión ACTIVA por módulo; activar otra desactiva la anterior en el servicio.
CREATE UNIQUE INDEX "module_versions_one_active" ON "module_versions" ("moduleId") WHERE status = 'ACTIVO';

-- ── Misiones (§5.4, §5.7): un capítulo de la Ruta B se completa una sola vez por persona (el XP no se repite),
--    sin importar la versión del módulo. Las pruebas editoriales (preview) no cuentan.
CREATE UNIQUE INDEX "mission_progress_chapter_once" ON "mission_progress" ("userId", "moduleId", "chapterId")
  WHERE status = 'VERIFICADA' AND "chapterId" IS NOT NULL AND NOT preview;
CREATE INDEX "mission_progress_daily" ON "mission_progress" ("userId", "moduleId", "startedAt");
