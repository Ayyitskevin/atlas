CREATE TABLE "task_dependencies" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workspace_id" UUID NOT NULL,
    "blocking_task_id" UUID NOT NULL,
    "blocked_task_id" UUID NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_dependencies_blocking_task_id_blocked_task_id_key" ON "task_dependencies"("blocking_task_id", "blocked_task_id");
CREATE INDEX "task_dependencies_workspace_id_blocked_task_id_idx" ON "task_dependencies"("workspace_id", "blocked_task_id");
CREATE INDEX "task_dependencies_workspace_id_blocking_task_id_idx" ON "task_dependencies"("workspace_id", "blocking_task_id");

ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_blocking_task_id_fkey" FOREIGN KEY ("blocking_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_blocked_task_id_fkey" FOREIGN KEY ("blocked_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
