-- DropIndex
DROP INDEX "public"."api_keys_key_idx";

-- DropIndex
DROP INDEX "public"."api_keys_key_key";

-- AlterTable
ALTER TABLE "api_keys" DROP COLUMN "key",
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "keyHash" TEXT NOT NULL,
ADD COLUMN     "keyPrefix" TEXT NOT NULL,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "scopes" TEXT[];

-- AlterTable
ALTER TABLE "budgets" DROP COLUMN "currentSpend",
DROP COLUMN "lastResetAt",
DROP COLUMN "monthlyCap",
ADD COLUMN     "capExceeded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentMonthCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "monthlyCapCents" INTEGER,
ADD COLUMN     "periodEnd" TIMESTAMP(3),
ADD COLUMN     "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "totalCapCents" INTEGER,
ADD COLUMN     "totalCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "casts" DROP COLUMN "duration",
ADD COLUMN     "billingStatus" TEXT,
ADD COLUMN     "cpuCycles" BIGINT,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "githubRunAttempt" INTEGER,
ADD COLUMN     "githubRunId" TEXT,
ADD COLUMN     "idempotencyKey" TEXT NOT NULL,
ADD COLUMN     "memoryPeakBytes" BIGINT,
ADD COLUMN     "mode" TEXT,
ADD COLUMN     "networkBytesReceived" BIGINT,
ADD COLUMN     "networkBytesSent" BIGINT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "runUrl" TEXT,
ADD COLUMN     "spellKey" TEXT NOT NULL,
ADD COLUMN     "spellVersion" TEXT NOT NULL,
ALTER COLUMN "inputHash" SET NOT NULL;

-- AlterTable
ALTER TABLE "spells" DROP COLUMN "priceAmount",
ADD COLUMN     "dependencyScanPassed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "executionConfig" JSONB,
ADD COLUMN     "license" TEXT,
ADD COLUMN     "priceAmountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "repository" TEXT,
ADD COLUMN     "sbomFormat" TEXT,
ADD COLUMN     "sbomIncluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sbomUrl" TEXT,
ADD COLUMN     "signatureUrl" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'public',
ALTER COLUMN "status" SET DEFAULT 'draft';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ccpaDoNotSell" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "consentedAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletionReason" TEXT,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'caster',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "requestHash" TEXT,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_violations" (
    "id" TEXT NOT NULL,
    "spellKey" TEXT NOT NULL,
    "spellId" TEXT NOT NULL,
    "castId" TEXT,
    "violationType" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_transfer_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transferType" TEXT NOT NULL,
    "mechanism" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_transfer_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_endpoint_scope_key" ON "idempotency_keys"("key", "endpoint", "scope");

-- CreateIndex
CREATE INDEX "policy_violations_spellKey_idx" ON "policy_violations"("spellKey");

-- CreateIndex
CREATE INDEX "policy_violations_spellId_idx" ON "policy_violations"("spellId");

-- CreateIndex
CREATE INDEX "policy_violations_createdAt_idx" ON "policy_violations"("createdAt");

-- CreateIndex
CREATE INDEX "data_transfer_consents_userId_idx" ON "data_transfer_consents"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "budgets_userId_idx" ON "budgets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "casts_idempotencyKey_key" ON "casts"("idempotencyKey");

-- CreateIndex
CREATE INDEX "casts_spellKey_idx" ON "casts"("spellKey");

-- CreateIndex
CREATE INDEX "spells_category_idx" ON "spells"("category");

-- CreateIndex
CREATE UNIQUE INDEX "spells_key_version_key" ON "spells"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "users_githubId_idx" ON "users"("githubId");

-- CreateIndex
CREATE INDEX "users_stripeCustomerId_idx" ON "users"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "policy_violations" ADD CONSTRAINT "policy_violations_spellId_fkey" FOREIGN KEY ("spellId") REFERENCES "spells"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_transfer_consents" ADD CONSTRAINT "data_transfer_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
