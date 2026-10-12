-- CreateEnum
CREATE TYPE "Route" AS ENUM ('A_COMERCIAL', 'B_EXPERIENCIAL', 'MIXTA');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('BORRADOR', 'EN_REVISION', 'APROBADA', 'PROGRAMADA', 'ACTIVA', 'PAUSADA', 'CERRADA', 'ARCHIVADA');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('ON_PREMISE', 'OFF_PREMISE', 'EVENTO', 'DIGITAL');

-- CreateEnum
CREATE TYPE "ProductCodeStatus" AS ENUM ('GENERADO', 'ASIGNADO_A_LOTE', 'DISTRIBUIDO', 'ALERTA_DE_ANOMALIA', 'REVOCADO');

-- CreateEnum
CREATE TYPE "ProductCodeEventType" AS ENUM ('CONSULTA', 'DISTRIBUCION', 'ANOMALIA', 'REVOCACION');

-- CreateEnum
CREATE TYPE "CampaignCodeStatus" AS ENUM ('CREADO', 'DISPONIBLE', 'RECLAMADO', 'EXPIRADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('CREADA', 'ABIERTA', 'EN_CURSO', 'FINALIZADA', 'EXPIRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('MULTI_DISPOSITIVO', 'UN_DISPOSITIVO');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('CONECTADO', 'RECONECTANDO', 'SALIO');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('CREDITO', 'DEBITO', 'REVERSO', 'AJUSTE');

-- CreateEnum
CREATE TYPE "LedgerOwnerType" AS ENUM ('USUARIO', 'SESION');

-- CreateEnum
CREATE TYPE "RewardClaimStatus" AS ENUM ('RESERVADO', 'RECLAMADO', 'ENTREGADO', 'EXPIRADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('DIGITAL', 'MERCHANDISING', 'EXPERIENCIA', 'CONTENIDO');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('TERMINOS_Y_PRIVACIDAD', 'MARKETING', 'UBICACION');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('TEMPORAL', 'ACTIVA', 'SUSPENDIDA', 'ELIMINADA');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('JUGADOR', 'STAFF', 'DEALER', 'ADMIN_MARCA', 'REVISOR_MARCA', 'REVISOR_JURIDICO', 'RESPONSABLE_PRIVACIDAD', 'EDITOR_CONTENIDO', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "ApprovalKind" AS ENUM ('MARCA', 'JURIDICA', 'PRIVACIDAD', 'TI');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('BORRADOR', 'EN_PRUEBA', 'APROBADO', 'ACTIVO', 'DESACTIVADO');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('INICIADA', 'COMPLETADA_PENDIENTE', 'VERIFICADA', 'RECHAZADA', 'ABANDONADA');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "alias" VARCHAR(20) NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'TEMPORAL',
    "ageVerifiedAt" TIMESTAMP(3),
    "ageGateMethod" VARCHAR(40),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_pii" (
    "userId" UUID NOT NULL,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pii_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "identity_credentials" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "subject" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "noticeVersion" VARCHAR(20) NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "scopeId" VARCHAR(64) NOT NULL DEFAULT '',

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","role","scopeId")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" TEXT NOT NULL,
    "themeId" VARCHAR(60) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "name" TEXT NOT NULL,
    "brandId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "city" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_accounts" (
    "userId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "staffCode" VARCHAR(24) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_accounts_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "venue_campaigns" (
    "venueId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,

    CONSTRAINT "venue_campaigns_pkey" PRIMARY KEY ("venueId","campaignId")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "internalName" TEXT NOT NULL,
    "route" "Route" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'BORRADOR',
    "activeVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_versions" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "objective" TEXT NOT NULL,
    "channels" "Channel"[],
    "territories" TEXT[],
    "minAge" INTEGER NOT NULL DEFAULT 18,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "rules" JSONB NOT NULL,
    "themeId" VARCHAR(60),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_records" (
    "id" UUID NOT NULL,
    "campaignVersionId" UUID,
    "moduleVersionId" UUID,
    "kind" "ApprovalKind" NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "approverId" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "provider" VARCHAR(60) NOT NULL,
    "route" "Route" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_versions" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "status" "ModuleStatus" NOT NULL DEFAULT 'BORRADOR',
    "manifest" JSONB NOT NULL,
    "packageDigest" VARCHAR(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_progress" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "sessionId" UUID,
    "moduleVersionId" UUID NOT NULL,
    "campaignVersionId" UUID,
    "status" "MissionStatus" NOT NULL DEFAULT 'INICIADA',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "result" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "idempotencyKey" VARCHAR(80) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "mission_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" TEXT NOT NULL,
    "icon" VARCHAR(40) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge_awards" (
    "userId" UUID NOT NULL,
    "badgeId" UUID NOT NULL,
    "missionId" UUID,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badge_awards_pkey" PRIMARY KEY ("userId","badgeId")
);

-- CreateTable
CREATE TABLE "xp_entries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" VARCHAR(60) NOT NULL,
    "missionId" UUID,
    "idempotencyKey" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(24) NOT NULL,
    "route" "Route" NOT NULL,
    "mode" "SessionMode" NOT NULL DEFAULT 'MULTI_DISPOSITIVO',
    "status" "SessionStatus" NOT NULL DEFAULT 'CREADA',
    "hostId" UUID NOT NULL,
    "campaignVersionId" UUID,
    "venueId" UUID,
    "pinLookup" VARCHAR(128) NOT NULL,
    "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 12,
    "energyEndsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_participants" (
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "alias" VARCHAR(20) NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'CONECTADO',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "session_participants_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateTable
CREATE TABLE "product_codes" (
    "id" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "tokenHint" VARCHAR(8) NOT NULL,
    "productId" UUID NOT NULL,
    "batchId" UUID,
    "supplier" VARCHAR(60),
    "status" "ProductCodeStatus" NOT NULL DEFAULT 'GENERADO',
    "importId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_code_events" (
    "id" UUID NOT NULL,
    "productCodeId" UUID NOT NULL,
    "type" "ProductCodeEventType" NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_code_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_codes" (
    "id" UUID NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "codeHint" VARCHAR(8) NOT NULL,
    "campaignId" UUID NOT NULL,
    "productCodeId" UUID,
    "status" "CampaignCodeStatus" NOT NULL DEFAULT 'CREADO',
    "singleUse" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" UUID NOT NULL,
    "campaignCodeId" UUID NOT NULL,
    "campaignVersionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID,
    "staffUserId" UUID,
    "confirmed" BOOLEAN NOT NULL DEFAULT true,
    "idempotencyKey" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "ownerType" "LedgerOwnerType" NOT NULL,
    "userId" UUID,
    "sessionId" UUID,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "campaignVersionId" UUID,
    "ruleId" VARCHAR(80),
    "sourceType" VARCHAR(40) NOT NULL,
    "sourceId" VARCHAR(80),
    "originalEntryId" UUID,
    "reason" TEXT,
    "actorId" UUID,
    "idempotencyKey" VARCHAR(80) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RewardType" NOT NULL,
    "cost" INTEGER NOT NULL,
    "conditions" TEXT[],
    "maxPerUser" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_inventory" (
    "rewardId" UUID NOT NULL,
    "zone" VARCHAR(60) NOT NULL,
    "available" INTEGER NOT NULL,
    "lowStockAlert" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "reward_inventory_pkey" PRIMARY KEY ("rewardId","zone")
);

-- CreateTable
CREATE TABLE "reward_claims" (
    "id" UUID NOT NULL,
    "rewardId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "zone" VARCHAR(60) NOT NULL,
    "status" "RewardClaimStatus" NOT NULL DEFAULT 'RESERVADO',
    "ledgerEntryId" UUID,
    "idempotencyKey" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_codes" (
    "userId" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "referral_attributions" (
    "referredId" UUID NOT NULL,
    "referrerId" UUID NOT NULL,
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_attributions_pkey" PRIMARY KEY ("referredId")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(80) NOT NULL,
    "resource" VARCHAR(80) NOT NULL,
    "resourceId" VARCHAR(80),
    "outcome" VARCHAR(20) NOT NULL,
    "reason" TEXT,
    "requestId" VARCHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "severity" "Severity" NOT NULL,
    "subjectId" VARCHAR(80),
    "metadata" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "campaignId" UUID,
    "moduleId" UUID,
    "channel" "Channel",
    "properties" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_pii_email_key" ON "user_pii"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_pii_phone_key" ON "user_pii"("phone");

-- CreateIndex
CREATE INDEX "identity_credentials_userId_idx" ON "identity_credentials"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "identity_credentials_provider_subject_key" ON "identity_credentials"("provider", "subject");

-- CreateIndex
CREATE INDEX "consent_records_userId_purpose_createdAt_idx" ON "consent_records"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "batches_productId_label_key" ON "batches"("productId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "staff_accounts_staffCode_key" ON "staff_accounts"("staffCode");

-- CreateIndex
CREATE INDEX "staff_accounts_venueId_idx" ON "staff_accounts"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_slug_key" ON "campaigns"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_activeVersionId_key" ON "campaigns"("activeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_versions_campaignId_version_key" ON "campaign_versions"("campaignId", "version");

-- CreateIndex
CREATE INDEX "approval_records_campaignVersionId_idx" ON "approval_records"("campaignVersionId");

-- CreateIndex
CREATE INDEX "approval_records_moduleVersionId_idx" ON "approval_records"("moduleVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "modules_slug_key" ON "modules"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "module_versions_moduleId_version_key" ON "module_versions"("moduleId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "mission_progress_idempotencyKey_key" ON "mission_progress"("idempotencyKey");

-- CreateIndex
CREATE INDEX "mission_progress_userId_idx" ON "mission_progress"("userId");

-- CreateIndex
CREATE INDEX "mission_progress_sessionId_idx" ON "mission_progress"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "badges_slug_key" ON "badges"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "xp_entries_idempotencyKey_key" ON "xp_entries"("idempotencyKey");

-- CreateIndex
CREATE INDEX "xp_entries_userId_createdAt_idx" ON "xp_entries"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "sessions_status_expiresAt_idx" ON "sessions"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_codes_tokenHash_key" ON "product_codes"("tokenHash");

-- CreateIndex
CREATE INDEX "product_codes_productId_idx" ON "product_codes"("productId");

-- CreateIndex
CREATE INDEX "product_code_events_productCodeId_createdAt_idx" ON "product_code_events"("productCodeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_codes_codeHash_key" ON "campaign_codes"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_codes_productCodeId_key" ON "campaign_codes"("productCodeId");

-- CreateIndex
CREATE INDEX "campaign_codes_campaignId_status_idx" ON "campaign_codes"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "claims_idempotencyKey_key" ON "claims"("idempotencyKey");

-- CreateIndex
CREATE INDEX "claims_userId_idx" ON "claims"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_userId_key" ON "ledger_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_sessionId_key" ON "ledger_accounts"("sessionId");

-- CreateIndex
CREATE INDEX "ledger_entries_accountId_createdAt_idx" ON "ledger_entries"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_accountId_idempotencyKey_key" ON "ledger_entries"("accountId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_slug_key" ON "rewards"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "reward_claims_ledgerEntryId_key" ON "reward_claims"("ledgerEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "reward_claims_idempotencyKey_key" ON "reward_claims"("idempotencyKey");

-- CreateIndex
CREATE INDEX "reward_claims_userId_idx" ON "reward_claims"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

-- CreateIndex
CREATE INDEX "referral_attributions_referrerId_createdAt_idx" ON "referral_attributions"("referrerId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_resource_resourceId_idx" ON "audit_events"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "audit_events_actorId_createdAt_idx" ON "audit_events"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "security_events_type_createdAt_idx" ON "security_events"("type", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_name_occurredAt_idx" ON "analytics_events"("name", "occurredAt");

-- AddForeignKey
ALTER TABLE "user_pii" ADD CONSTRAINT "user_pii_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_credentials" ADD CONSTRAINT "identity_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_accounts" ADD CONSTRAINT "staff_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_accounts" ADD CONSTRAINT "staff_accounts_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_campaigns" ADD CONSTRAINT "venue_campaigns_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_campaigns" ADD CONSTRAINT "venue_campaigns_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "campaign_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_versions" ADD CONSTRAINT "campaign_versions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "campaign_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_moduleVersionId_fkey" FOREIGN KEY ("moduleVersionId") REFERENCES "module_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_progress" ADD CONSTRAINT "mission_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_progress" ADD CONSTRAINT "mission_progress_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_progress" ADD CONSTRAINT "mission_progress_moduleVersionId_fkey" FOREIGN KEY ("moduleVersionId") REFERENCES "module_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_progress" ADD CONSTRAINT "mission_progress_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "campaign_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_awards" ADD CONSTRAINT "badge_awards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_awards" ADD CONSTRAINT "badge_awards_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_entries" ADD CONSTRAINT "xp_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_codes" ADD CONSTRAINT "product_codes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_codes" ADD CONSTRAINT "product_codes_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_code_events" ADD CONSTRAINT "product_code_events_productCodeId_fkey" FOREIGN KEY ("productCodeId") REFERENCES "product_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_codes" ADD CONSTRAINT "campaign_codes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_campaignCodeId_fkey" FOREIGN KEY ("campaignCodeId") REFERENCES "campaign_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "campaign_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_originalEntryId_fkey" FOREIGN KEY ("originalEntryId") REFERENCES "ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_inventory" ADD CONSTRAINT "reward_inventory_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
