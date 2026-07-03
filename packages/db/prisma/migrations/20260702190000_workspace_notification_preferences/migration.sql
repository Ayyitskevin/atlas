CREATE TABLE "workspace_notification_preferences" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workspace_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "email_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "workspace_notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_notification_preferences_workspace_id_user_id_key"
  ON "workspace_notification_preferences"("workspace_id", "user_id");

CREATE INDEX "workspace_notification_preferences_user_id_idx"
  ON "workspace_notification_preferences"("user_id");

ALTER TABLE "workspace_notification_preferences"
  ADD CONSTRAINT "workspace_notification_preferences_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_notification_preferences"
  ADD CONSTRAINT "workspace_notification_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
