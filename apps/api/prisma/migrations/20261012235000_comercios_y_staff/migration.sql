-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "approvedById" UUID,
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "hours" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "listed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "claims_staffUserId_createdAt_idx" ON "claims"("staffUserId", "createdAt");

