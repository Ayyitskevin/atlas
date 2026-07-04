ALTER TABLE "attachments" ADD COLUMN "activated_at" TIMESTAMPTZ(6);

UPDATE "attachments"
SET "activated_at" = "created_at";

CREATE INDEX "attachments_workspace_id_task_id_activated_at_idx" ON "attachments"("workspace_id", "task_id", "activated_at");
