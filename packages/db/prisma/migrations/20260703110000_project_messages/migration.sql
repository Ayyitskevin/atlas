CREATE TABLE "project_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workspace_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "project_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_messages_workspace_id_project_id_created_at_idx" ON "project_messages"("workspace_id", "project_id", "created_at");
CREATE INDEX "project_messages_workspace_id_author_id_idx" ON "project_messages"("workspace_id", "author_id");

ALTER TABLE "project_messages" ADD CONSTRAINT "project_messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_messages" ADD CONSTRAINT "project_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_messages" ADD CONSTRAINT "project_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
