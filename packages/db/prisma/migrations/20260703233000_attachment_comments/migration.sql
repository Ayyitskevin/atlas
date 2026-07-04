CREATE TABLE "attachment_comments" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workspace_id" UUID NOT NULL,
  "attachment_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "edited_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "attachment_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attachment_comments_workspace_id_attachment_id_created_at_idx" ON "attachment_comments"("workspace_id", "attachment_id", "created_at");
CREATE INDEX "attachment_comments_workspace_id_author_id_idx" ON "attachment_comments"("workspace_id", "author_id");

ALTER TABLE "attachment_comments" ADD CONSTRAINT "attachment_comments_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachment_comments" ADD CONSTRAINT "attachment_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
