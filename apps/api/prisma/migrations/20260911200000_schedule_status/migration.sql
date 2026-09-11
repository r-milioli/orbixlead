-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN "status" "ScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN "cancelled_at" TIMESTAMP(3),
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "schedules_tenant_id_status_idx" ON "schedules"("tenant_id", "status");
