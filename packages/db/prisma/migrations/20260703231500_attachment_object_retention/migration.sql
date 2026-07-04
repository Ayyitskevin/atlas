ALTER TABLE "attachments" ADD COLUMN "object_deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "attachment_versions" ADD COLUMN "object_deleted_at" TIMESTAMPTZ(6);

CREATE INDEX "attachments_workspace_id_deleted_at_object_deleted_at_idx"
  ON "attachments"("workspace_id", "deleted_at", "object_deleted_at");

CREATE INDEX "attachment_versions_workspace_id_attachment_id_object_deleted_at_idx"
  ON "attachment_versions"("workspace_id", "attachment_id", "object_deleted_at");
