CREATE UNIQUE INDEX "attachments_workspace_object_key_key" ON "attachments"("workspace_id", "object_key");
CREATE INDEX "attachments_workspace_uploaded_by_idx" ON "attachments"("workspace_id", "uploaded_by_id");
