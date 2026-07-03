ALTER TABLE "project_messages"
  ADD COLUMN "pinned_at" TIMESTAMPTZ(6),
  ADD COLUMN "pinned_by_id" UUID;

ALTER TABLE "project_messages"
  ADD CONSTRAINT "project_messages_pinned_by_id_fkey"
  FOREIGN KEY ("pinned_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "project_messages_workspace_id_project_id_pinned_at_idx"
  ON "project_messages"("workspace_id", "project_id", "pinned_at");
