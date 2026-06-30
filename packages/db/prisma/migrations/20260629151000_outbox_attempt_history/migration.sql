CREATE TABLE "domain_event_outbox_attempts" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "outbox_event_id" UUID NOT NULL REFERENCES "domain_event_outbox"("id") ON DELETE CASCADE,
  "attempt_number" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "started_at" TIMESTAMPTZ NOT NULL,
  "finished_at" TIMESTAMPTZ NOT NULL,
  "error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "domain_event_outbox_attempts_event_number_key" ON "domain_event_outbox_attempts"("outbox_event_id", "attempt_number");
CREATE INDEX "domain_event_outbox_attempts_event_created_idx" ON "domain_event_outbox_attempts"("outbox_event_id", "created_at");
