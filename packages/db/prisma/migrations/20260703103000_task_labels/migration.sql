CREATE TABLE "task_labels" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "task_labels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_label_assignments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workspace_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "label_id" UUID NOT NULL,
    "assigned_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_label_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_labels_workspace_id_name_key" ON "task_labels"("workspace_id", "name");
CREATE INDEX "task_labels_workspace_id_deleted_at_idx" ON "task_labels"("workspace_id", "deleted_at");
CREATE UNIQUE INDEX "task_label_assignments_task_id_label_id_key" ON "task_label_assignments"("task_id", "label_id");
CREATE INDEX "task_label_assignments_workspace_id_label_id_idx" ON "task_label_assignments"("workspace_id", "label_id");
CREATE INDEX "task_label_assignments_workspace_id_task_id_idx" ON "task_label_assignments"("workspace_id", "task_id");

ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_label_assignments" ADD CONSTRAINT "task_label_assignments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_label_assignments" ADD CONSTRAINT "task_label_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_label_assignments" ADD CONSTRAINT "task_label_assignments_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "task_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_label_assignments" ADD CONSTRAINT "task_label_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
