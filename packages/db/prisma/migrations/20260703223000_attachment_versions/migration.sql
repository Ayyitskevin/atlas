ALTER TABLE "attachments" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "attachment_versions" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workspace_id" UUID NOT NULL,
  "attachment_id" UUID NOT NULL,
  "uploaded_by_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "object_key" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "activated_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attachment_versions_pkey" PRIMARY KEY ("id")
);

INSERT INTO "attachment_versions" (
  "workspace_id",
  "attachment_id",
  "uploaded_by_id",
  "version",
  "object_key",
  "file_name",
  "mime_type",
  "size_bytes",
  "activated_at",
  "created_at"
)
SELECT
  "workspace_id",
  "id",
  "uploaded_by_id",
  1,
  "object_key",
  "file_name",
  "mime_type",
  "size_bytes",
  "created_at",
  "created_at"
FROM "attachments";

CREATE UNIQUE INDEX "attachment_versions_workspace_id_attachment_id_version_key" ON "attachment_versions"("workspace_id", "attachment_id", "version");
CREATE UNIQUE INDEX "attachment_versions_workspace_id_object_key_key" ON "attachment_versions"("workspace_id", "object_key");
CREATE INDEX "attachment_versions_workspace_id_attachment_id_activated_at_idx" ON "attachment_versions"("workspace_id", "attachment_id", "activated_at");
CREATE INDEX "attachment_versions_workspace_id_uploaded_by_id_idx" ON "attachment_versions"("workspace_id", "uploaded_by_id");

ALTER TABLE "attachment_versions" ADD CONSTRAINT "attachment_versions_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachment_versions" ADD CONSTRAINT "attachment_versions_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
