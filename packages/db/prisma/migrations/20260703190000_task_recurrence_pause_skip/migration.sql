-- Track recurrence pause state and skipped occurrences without widening task status.
ALTER TABLE "tasks"
  ADD COLUMN "recurrence_paused_at" TIMESTAMPTZ(6),
  ADD COLUMN "recurrence_skipped_at" TIMESTAMPTZ(6);

CREATE INDEX "tasks_workspace_id_recurrence_paused_at_idx" ON "tasks"("workspace_id", "recurrence_paused_at");
