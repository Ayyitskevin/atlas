CREATE TABLE "worker_job_outcomes" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workspace_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID NOT NULL,
  "queue" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "provider" TEXT,
  "provider_message_id" TEXT,
  "recipient_count" INTEGER,
  "job_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "worker_job_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "worker_job_outcomes_workspace_id_event_id_created_at_idx"
  ON "worker_job_outcomes"("workspace_id", "event_id", "created_at");

CREATE INDEX "worker_job_outcomes_workspace_id_queue_created_at_idx"
  ON "worker_job_outcomes"("workspace_id", "queue", "created_at");

CREATE INDEX "worker_job_outcomes_workspace_id_status_created_at_idx"
  ON "worker_job_outcomes"("workspace_id", "status", "created_at");

ALTER TABLE "worker_job_outcomes"
  ADD CONSTRAINT "worker_job_outcomes_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
