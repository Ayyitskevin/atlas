CREATE TYPE "AttachmentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'ERROR', 'SKIPPED');

ALTER TABLE "attachments"
  ADD COLUMN "scan_status" "AttachmentScanStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "scan_checked_at" TIMESTAMPTZ(6),
  ADD COLUMN "scan_provider" TEXT,
  ADD COLUMN "scan_message" TEXT;

ALTER TABLE "attachment_versions"
  ADD COLUMN "scan_status" "AttachmentScanStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "scan_checked_at" TIMESTAMPTZ(6),
  ADD COLUMN "scan_provider" TEXT,
  ADD COLUMN "scan_message" TEXT;

CREATE INDEX "attachments_workspace_id_scan_status_idx" ON "attachments"("workspace_id", "scan_status");
CREATE INDEX "attachment_versions_workspace_id_scan_status_idx" ON "attachment_versions"("workspace_id", "scan_status");
