-- DropIndex
DROP INDEX "mission_progress_daily";

-- AlterTable
ALTER TABLE "module_versions" ADD COLUMN     "createdById" UUID,
ADD COLUMN     "manifestHash" VARCHAR(64) NOT NULL DEFAULT '',
ADD COLUMN     "submittedById" UUID;
