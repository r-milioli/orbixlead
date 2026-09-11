-- AlterTable
ALTER TABLE "leads" ADD COLUMN "assignee_id" TEXT;

-- CreateIndex
CREATE INDEX "leads_assignee_id_idx" ON "leads"("assignee_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
