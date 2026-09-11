-- AlterTable
ALTER TABLE "pipeline_stages" ADD COLUMN "archived_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "pipeline_stages_tenant_id_archived_at_idx" ON "pipeline_stages"("tenant_id", "archived_at");
