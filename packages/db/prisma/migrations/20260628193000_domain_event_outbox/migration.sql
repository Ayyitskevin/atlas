CREATE TABLE "domain_event_outbox" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "event_id" UUID NOT NULL UNIQUE,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ,
  "locked_at" TIMESTAMPTZ,
  "processed_at" TIMESTAMPTZ,
  "failed_at" TIMESTAMPTZ,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "domain_event_outbox_processed_failed_next_idx" ON "domain_event_outbox"("processed_at", "failed_at", "next_attempt_at");
CREATE INDEX "domain_event_outbox_event_type_idx" ON "domain_event_outbox"("event_type");
