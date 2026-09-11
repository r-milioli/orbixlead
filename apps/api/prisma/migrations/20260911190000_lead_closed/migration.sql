-- CreateEnum
CREATE TYPE "LeadClosedReason" AS ENUM ('CONVERTED', 'LOST');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "closed_at" TIMESTAMP(3),
ADD COLUMN "closed_reason" "LeadClosedReason";

-- CreateIndex
CREATE INDEX "leads_tenant_id_closed_at_idx" ON "leads"("tenant_id", "closed_at");
