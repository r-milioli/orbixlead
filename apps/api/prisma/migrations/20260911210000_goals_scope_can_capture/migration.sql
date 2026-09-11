-- CreateEnum
CREATE TYPE "GoalScope" AS ENUM ('COMPANY', 'OPERATOR');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "can_capture" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "goals" ADD COLUMN "scope" "GoalScope" NOT NULL DEFAULT 'COMPANY',
ADD COLUMN "assignee_id" TEXT;

-- CreateIndex
CREATE INDEX "goals_tenant_id_scope_idx" ON "goals"("tenant_id", "scope");

-- CreateIndex
CREATE INDEX "goals_assignee_id_idx" ON "goals"("assignee_id");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
