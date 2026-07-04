import type { PrismaClient } from "@atlas/db";

import { deleteAttachmentObject } from "./object-storage.js";

export const defaultDeletedAttachmentObjectRetentionMs = 30 * 24 * 60 * 60 * 1000;

type CleanupOptions = {
  deleteObject?: (objectKey: string) => Promise<void>;
  now?: Date;
  prisma: PrismaClient;
  retentionMs?: number;
};

type DeletedAttachmentObjectRow = {
  attachmentId: string | null;
  objectKey: string;
  versionId: string | null;
};

type DeletedAttachmentObjectCandidate = {
  attachmentIds: string[];
  objectKey: string;
  versionIds: string[];
};

export type DeletedAttachmentObjectCleanupPreview = {
  cutoff: Date;
  expiredObjectCount: number;
  retentionMs: number;
};

export type DeletedAttachmentObjectCleanupResult = DeletedAttachmentObjectCleanupPreview & {
  objectDeletes: {
    attempted: number;
    failed: number;
    failures: Array<{ message: string; objectKey: string }>;
    succeeded: number;
  };
};

export async function previewDeletedAttachmentObjectCleanup(input: CleanupOptions): Promise<DeletedAttachmentObjectCleanupPreview> {
  const { cutoff, retentionMs } = cleanupWindow(input);
  const candidates = await deletedAttachmentObjectCandidates(input.prisma, cutoff);
  return { cutoff, expiredObjectCount: candidates.length, retentionMs };
}

export async function cleanupDeletedAttachmentObjects(input: CleanupOptions): Promise<DeletedAttachmentObjectCleanupResult> {
  const { cutoff, retentionMs } = cleanupWindow(input);
  const deleteObject = input.deleteObject ?? deleteAttachmentObject;
  const deletedAt = input.now ?? new Date();
  const candidates = await deletedAttachmentObjectCandidates(input.prisma, cutoff);
  const failures: DeletedAttachmentObjectCleanupResult["objectDeletes"]["failures"] = [];
  const deletedAttachmentIds: string[] = [];
  const deletedVersionIds: string[] = [];

  for (const candidate of candidates) {
    try {
      await deleteObject(candidate.objectKey);
      deletedAttachmentIds.push(...candidate.attachmentIds);
      deletedVersionIds.push(...candidate.versionIds);
    } catch (error) {
      failures.push({ message: error instanceof Error ? error.message : String(error), objectKey: candidate.objectKey });
    }
  }

  await markDeletedAttachmentObjects(input.prisma, {
    attachmentIds: deletedAttachmentIds,
    cutoff,
    deletedAt,
    versionIds: deletedVersionIds,
  });

  return {
    cutoff,
    expiredObjectCount: candidates.length,
    objectDeletes: {
      attempted: candidates.length,
      failed: failures.length,
      failures,
      succeeded: candidates.length - failures.length,
    },
    retentionMs,
  };
}

async function deletedAttachmentObjectCandidates(prisma: PrismaClient, cutoff: Date): Promise<DeletedAttachmentObjectCandidate[]> {
  const rows = await prisma.$queryRaw<DeletedAttachmentObjectRow[]>`
    SELECT
      a."id" AS "attachmentId",
      a."object_key" AS "objectKey",
      NULL::uuid AS "versionId"
    FROM "attachments" AS a
    WHERE a."deleted_at" IS NOT NULL
      AND a."deleted_at" < ${cutoff}
      AND a."object_deleted_at" IS NULL

    UNION ALL

    SELECT
      NULL::uuid AS "attachmentId",
      av."object_key" AS "objectKey",
      av."id" AS "versionId"
    FROM "attachment_versions" AS av
    JOIN "attachments" AS a ON a."id" = av."attachment_id"
    WHERE a."deleted_at" IS NOT NULL
      AND a."deleted_at" < ${cutoff}
      AND av."object_deleted_at" IS NULL
  `;

  const candidates = new Map<string, DeletedAttachmentObjectCandidate>();
  for (const row of rows) {
    const candidate = candidates.get(row.objectKey) ?? { attachmentIds: [], objectKey: row.objectKey, versionIds: [] };
    if (row.attachmentId) candidate.attachmentIds.push(row.attachmentId);
    if (row.versionId) candidate.versionIds.push(row.versionId);
    candidates.set(row.objectKey, candidate);
  }
  return [...candidates.values()];
}

async function markDeletedAttachmentObjects(
  prisma: PrismaClient,
  input: {
    attachmentIds: string[];
    cutoff: Date;
    deletedAt: Date;
    versionIds: string[];
  },
) {
  const attachmentIds = uniqueIds(input.attachmentIds);
  const versionIds = uniqueIds(input.versionIds);
  await prisma.$transaction([
    ...(attachmentIds.length
      ? [
          prisma.attachment.updateMany({
            data: { objectDeletedAt: input.deletedAt },
            where: {
              deletedAt: { lt: input.cutoff },
              id: { in: attachmentIds },
              objectDeletedAt: null,
            },
          }),
        ]
      : []),
    ...(versionIds.length
      ? [
          prisma.attachmentVersion.updateMany({
            data: { objectDeletedAt: input.deletedAt },
            where: {
              attachment: { deletedAt: { lt: input.cutoff } },
              id: { in: versionIds },
              objectDeletedAt: null,
            },
          }),
        ]
      : []),
  ]);
}

function cleanupWindow(input: CleanupOptions) {
  const retentionMs = input.retentionMs ?? defaultDeletedAttachmentObjectRetentionMs;
  if (!Number.isFinite(retentionMs) || retentionMs <= 0) throw new Error("Deleted attachment object retention must be a positive number of milliseconds.");
  const now = input.now ?? new Date();
  return { cutoff: new Date(now.getTime() - retentionMs), retentionMs };
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids)];
}
