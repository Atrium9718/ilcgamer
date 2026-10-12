-- AlterTable
ALTER TABLE "reward_claims" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "code" VARCHAR(12),
ADD COLUMN     "cost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveredById" UUID,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "refundEntryId" UUID;

-- AlterTable
ALTER TABLE "rewards" ADD COLUMN     "activatedById" UUID,
ADD COLUMN     "campaignId" UUID,
ADD COLUMN     "createdById" UUID,
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "fulfillment" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "icon" TEXT NOT NULL DEFAULT 'redeem';

-- CreateIndex
CREATE UNIQUE INDEX "reward_claims_code_key" ON "reward_claims"("code");

-- CreateIndex
CREATE UNIQUE INDEX "reward_claims_refundEntryId_key" ON "reward_claims"("refundEntryId");

-- CreateIndex
CREATE INDEX "reward_claims_rewardId_status_idx" ON "reward_claims"("rewardId", "status");

-- CreateIndex
CREATE INDEX "reward_claims_status_expiresAt_idx" ON "reward_claims"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

