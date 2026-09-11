-- CreateEnum
CREATE TYPE "LeadCardMarker" AS ENUM ('NONE', 'URGENT', 'CLOSING', 'WAITING', 'MISSING', 'FOLLOW_UP');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "card_marker" "LeadCardMarker" NOT NULL DEFAULT 'NONE';
