-- AlterTable
ALTER TABLE "authenticators" ADD COLUMN "name" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "lastUsedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "authenticators_userId_idx" ON "authenticators"("userId");
