import { prisma } from "@atlas/db";

import {
  cleanupExpiredPendingAttachmentUploads,
  defaultPendingUploadTtlMs,
  previewExpiredPendingAttachmentUploads,
} from "../src/storage/pending-upload-cleanup.js";

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help")) {
    console.info("Usage: pnpm cleanup:pending-uploads [-- --confirm]");
    console.info("Defaults to dry-run. Set ATLAS_PENDING_UPLOAD_TTL_HOURS to override the 24-hour expiry window.");
    return;
  }

  const ttlMs = pendingUploadTtlMs();
  const confirmed = args.has("--confirm");
  const result = confirmed
    ? await cleanupExpiredPendingAttachmentUploads({ prisma, ttlMs })
    : await previewExpiredPendingAttachmentUploads({ prisma, ttlMs });

  console.info(JSON.stringify({ ...serializeResult(result), dryRun: !confirmed }, null, 2));
  if (!confirmed) console.info("Dry-run only. Re-run with --confirm to expire these pending uploads.");
  if ("objectDeletes" in result && result.objectDeletes.failed > 0) process.exitCode = 1;
}

function pendingUploadTtlMs() {
  const configuredHours = process.env.ATLAS_PENDING_UPLOAD_TTL_HOURS;
  if (!configuredHours) return defaultPendingUploadTtlMs;
  const ttlHours = Number(configuredHours);
  if (!Number.isFinite(ttlHours) || ttlHours <= 0) throw new Error("ATLAS_PENDING_UPLOAD_TTL_HOURS must be a positive number.");
  return ttlHours * 60 * 60 * 1000;
}

function serializeResult<T extends { cutoff: Date; ttlMs: number }>(result: T) {
  return { ...result, cutoff: result.cutoff.toISOString() };
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Atlas pending upload cleanup failed: " + message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
