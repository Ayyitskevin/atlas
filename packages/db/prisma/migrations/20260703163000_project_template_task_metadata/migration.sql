CREATE TABLE "project_template_task_assignees" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workspace_id" UUID NOT NULL,
  "template_task_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_template_task_assignees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_template_task_label_assignments" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workspace_id" UUID NOT NULL,
  "template_task_id" UUID NOT NULL,
  "label_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_template_task_label_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_template_task_assignees_template_task_id_user_id_key"
  ON "project_template_task_assignees"("template_task_id", "user_id");

CREATE INDEX "project_template_task_assignees_workspace_id_user_id_idx"
  ON "project_template_task_assignees"("workspace_id", "user_id");

CREATE INDEX "project_template_task_assignees_workspace_id_template_task_id_idx"
  ON "project_template_task_assignees"("workspace_id", "template_task_id");

CREATE UNIQUE INDEX "project_template_task_label_assignments_template_task_id_label_id_key"
  ON "project_template_task_label_assignments"("template_task_id", "label_id");

CREATE INDEX "project_template_task_label_assignments_workspace_id_label_id_idx"
  ON "project_template_task_label_assignments"("workspace_id", "label_id");

CREATE INDEX "project_template_task_label_assignments_workspace_id_template_task_id_idx"
  ON "project_template_task_label_assignments"("workspace_id", "template_task_id");

ALTER TABLE "project_template_task_assignees"
  ADD CONSTRAINT "project_template_task_assignees_template_task_id_fkey"
  FOREIGN KEY ("template_task_id") REFERENCES "project_template_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_template_task_assignees"
  ADD CONSTRAINT "project_template_task_assignees_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_template_task_label_assignments"
  ADD CONSTRAINT "project_template_task_label_assignments_template_task_id_fkey"
  FOREIGN KEY ("template_task_id") REFERENCES "project_template_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_template_task_label_assignments"
  ADD CONSTRAINT "project_template_task_label_assignments_label_id_fkey"
  FOREIGN KEY ("label_id") REFERENCES "task_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
