CREATE TABLE "project_templates" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workspace_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_template_sections" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workspace_id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "position" DECIMAL(20,10) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_template_sections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_template_tasks" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workspace_id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "position" DECIMAL(20,10) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_template_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_templates_workspace_id_deleted_at_created_at_idx"
  ON "project_templates"("workspace_id", "deleted_at", "created_at");

CREATE INDEX "project_templates_created_by_id_idx"
  ON "project_templates"("created_by_id");

CREATE UNIQUE INDEX "project_template_sections_template_id_position_key"
  ON "project_template_sections"("template_id", "position");

CREATE INDEX "project_template_sections_workspace_id_template_id_idx"
  ON "project_template_sections"("workspace_id", "template_id");

CREATE INDEX "project_template_tasks_workspace_id_template_id_idx"
  ON "project_template_tasks"("workspace_id", "template_id");

CREATE INDEX "project_template_tasks_workspace_id_section_id_position_idx"
  ON "project_template_tasks"("workspace_id", "section_id", "position");

ALTER TABLE "project_templates"
  ADD CONSTRAINT "project_templates_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_templates"
  ADD CONSTRAINT "project_templates_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_template_sections"
  ADD CONSTRAINT "project_template_sections_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_template_tasks"
  ADD CONSTRAINT "project_template_tasks_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_template_tasks"
  ADD CONSTRAINT "project_template_tasks_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "project_template_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
