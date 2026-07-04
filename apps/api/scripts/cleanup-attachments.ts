import { prisma } from "@atlas/db";

import {
  attachmentMaintenanceHasFailures,
  runAttachmentMaintenance,
} from "../src/storage/attachment-maintenance.js";
import { defaultDeletedAttachmentObjectRetentionMs } from "../src/storage/deleted-attachment-object-cleanup.js";
import { defaultPendingUploadTtlMs } from "../src/storage/pending-upload-cleanup.js";

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help")) {
    console.info("Usage: pnpm cleanup:attachments [-- --confirm]");
    console.info("Defaults to dry-run and runs both attachment cleanup routines.");
    console.info("Set ATLAS_PENDING_UPLOAD_TTL_HOURS to override the 24-hour abandoned upload window.");
    console.info("Set ATLAS_DELETED_ATTACHMENT_OBJECT_RETENTION_DAYS to override the 30-day deleted object retention window.");
    return;
  }

  const result = await runAttachmentMaintenance({
    confirm: args.has("--confirm"),
    deletedAttachmentObjectRetentionMs: deletedAttachmentObjectRetentionMs(),
    pendingUploadTtlMs: pendingUploadTtlMs(),
    prisma,
  });

  console.info(JSON.stringify(serializeResult(result), null, 2));
  if (result.dryRun) console.info("Dry-run only. Re-run with --confirm to expire stale rows and delete retained attachment objects.");
  if (attachmentMaintenanceHasFailures(result)) process.exitCode = 1;
}

function pendingUploadTtlMs() {
  const configuredHours = process.env.ATLAS_PENDING_UPLOAD_TTL_HOURS;
  if (!configuredHours) return defaultPendingUploadTtlMs;
  const ttlHours = Number(configuredHours);
  if (!Number.isFinite(ttlHours) || ttlHours <= 0) throw new Error("ATLAS_PENDING_UPLOAD_TTL_HOURS must be a positive number.");
  return ttlHours * 60 * 60 * 1000;
}

function deletedAttachmentObjectRetentionMs() {
  const configuredDays = process.env.ATLAS_DELETED_ATTACHMENT_OBJECT_RETENTION_DAYS;
  if (!configuredDays) return defaultDeletedAttachmentObjectRetentionMs;
  const retentionDays = Number(configuredDays);
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) throw new Error("ATLAS_DELETED_ATTACHMENT_OBJECT_RETENTION_DAYS must be a positive number.");
  return retentionDays * 24 * 60 * 60 * 1000;
}

function serializeResult(result: Awaited<ReturnType<typeof runAttachmentMaintenance>>) {
  return {
    ...result,
    deletedAttachmentObjects: {
      ...result.deletedAttachmentObjects,
      cutoff: result.deletedAttachmentObjects.cutoff.toISOString(),
    },
    pendingUploads: {
      ...result.pendingUploads,
      cutoff: result.pendingUploads.cutoff.toISOString(),
    },
  };
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Atlas attachment cleanup failed: " + message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
