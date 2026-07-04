import { prisma } from "@atlas/db";

import {
  cleanupDeletedAttachmentObjects,
  defaultDeletedAttachmentObjectRetentionMs,
  previewDeletedAttachmentObjectCleanup,
} from "../src/storage/deleted-attachment-object-cleanup.js";

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help")) {
    console.info("Usage: pnpm cleanup:deleted-attachment-objects [-- --confirm]");
    console.info("Defaults to dry-run. Set ATLAS_DELETED_ATTACHMENT_OBJECT_RETENTION_DAYS to override the 30-day retention window.");
    return;
  }

  const retentionMs = deletedAttachmentObjectRetentionMs();
  const confirmed = args.has("--confirm");
  const result = confirmed
    ? await cleanupDeletedAttachmentObjects({ prisma, retentionMs })
    : await previewDeletedAttachmentObjectCleanup({ prisma, retentionMs });

  console.info(JSON.stringify({ ...serializeResult(result), dryRun: !confirmed }, null, 2));
  if (!confirmed) console.info("Dry-run only. Re-run with --confirm to delete these retained attachment objects.");
  if ("objectDeletes" in result && result.objectDeletes.failed > 0) process.exitCode = 1;
}

function deletedAttachmentObjectRetentionMs() {
  const configuredDays = process.env.ATLAS_DELETED_ATTACHMENT_OBJECT_RETENTION_DAYS;
  if (!configuredDays) return defaultDeletedAttachmentObjectRetentionMs;
  const retentionDays = Number(configuredDays);
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) throw new Error("ATLAS_DELETED_ATTACHMENT_OBJECT_RETENTION_DAYS must be a positive number.");
  return retentionDays * 24 * 60 * 60 * 1000;
}

function serializeResult<T extends { cutoff: Date; retentionMs: number }>(result: T) {
  return { ...result, cutoff: result.cutoff.toISOString() };
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Atlas deleted attachment object cleanup failed: " + message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
