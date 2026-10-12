-- CreateEnum
CREATE TYPE "CodeImportStatus" AS ENUM ('PREVISTA', 'CONFIRMADA', 'DESCARTADA');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ageVerifiedMinAge" INTEGER;

-- CreateTable
CREATE TABLE "code_imports" (
    "id" UUID NOT NULL,
    "fileName" VARCHAR(200) NOT NULL,
    "fileSha256" VARCHAR(64) NOT NULL,
    "status" "CodeImportStatus" NOT NULL DEFAULT 'PREVISTA',
    "createdById" UUID NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "code_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_import_rows" (
    "id" UUID NOT NULL,
    "importId" UUID NOT NULL,
    "line" INTEGER NOT NULL,
    "tokenHash" VARCHAR(64),
    "tokenHint" VARCHAR(8) NOT NULL,
    "sku" VARCHAR(40),
    "batchLabel" VARCHAR(40),
    "supplier" VARCHAR(60),
    "error" VARCHAR(200),
    "duplicate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "code_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "code_imports_fileSha256_idx" ON "code_imports"("fileSha256");

-- CreateIndex
CREATE INDEX "code_import_rows_importId_line_idx" ON "code_import_rows"("importId", "line");

-- AddForeignKey
ALTER TABLE "code_import_rows" ADD CONSTRAINT "code_import_rows_importId_fkey" FOREIGN KEY ("importId") REFERENCES "code_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Importaciones (§9.2 "importación de archivos repetidos"): un mismo archivo solo se confirma una vez.
CREATE UNIQUE INDEX "code_imports_one_confirmed_per_file" ON "code_imports" ("fileSha256") WHERE status = 'CONFIRMADA';

-- ── Edad: el umbral demostrado es legal (≥ 18) cuando existe.
ALTER TABLE "users" ADD CONSTRAINT "users_age_verified_min_age" CHECK ("ageVerifiedMinAge" IS NULL OR "ageVerifiedMinAge" >= 18);

-- ── Límites de activación por persona y día (§5.7 regla 2): conteo por usuario y fecha.
CREATE INDEX "claims_user_created" ON "claims" ("userId", "createdAt");
