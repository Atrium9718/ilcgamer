-- CreateIndex
CREATE INDEX "claims_userId_createdAt_idx" ON "claims"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "campaign_codes" ADD CONSTRAINT "campaign_codes_productCodeId_fkey" FOREIGN KEY ("productCodeId") REFERENCES "product_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
