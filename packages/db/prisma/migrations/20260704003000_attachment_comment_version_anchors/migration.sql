ALTER TABLE "attachment_comments" ADD COLUMN "version_id" UUID;

CREATE INDEX "attachment_comments_workspace_id_version_id_created_at_idx"
  ON "attachment_comments"("workspace_id", "version_id", "created_at");

ALTER TABLE "attachment_comments"
  ADD CONSTRAINT "attachment_comments_version_id_fkey"
  FOREIGN KEY ("version_id") REFERENCES "attachment_versions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
