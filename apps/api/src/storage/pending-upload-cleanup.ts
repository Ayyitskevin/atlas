import type { PrismaClient } from "@atlas/db";

import { deleteAttachmentObject } from "./object-storage.js";

export const defaultPendingUploadTtlMs = 24 * 60 * 60 * 1000;

type CleanupOptions = {
  deleteObject?: (objectKey: string) => Promise<void>;
  now?: Date;
  prisma: PrismaClient;
  ttlMs?: number;
};

type PendingUploadObject = {
  id: string;
  objectKey: string;
};

export type PendingUploadCleanupPreview = {
  cutoff: Date;
  expiredInitialAttachments: number;
  expiredReplacementVersions: number;
  ttlMs: number;
};

export type PendingUploadCleanupResult = PendingUploadCleanupPreview & {
  objectDeletes: {
    attempted: number;
    failed: number;
    failures: Array<{ message: string; objectKey: string }>;
    succeeded: number;
  };
};

export async function previewExpiredPendingAttachmentUploads(input: CleanupOptions): Promise<PendingUploadCleanupPreview> {
  const { cutoff, ttlMs } = cleanupWindow(input);
  const [expiredInitialAttachments, expiredReplacementVersions] = await Promise.all([
    input.prisma.attachment.count({
      where: { activatedAt: null, createdAt: { lt: cutoff }, deletedAt: null },
    }),
    input.prisma.attachmentVersion.count({
      where: {
        activatedAt: null,
        attachment: { activatedAt: { not: null }, deletedAt: null },
        createdAt: { lt: cutoff },
      },
    }),
  ]);

  return { cutoff, expiredInitialAttachments, expiredReplacementVersions, ttlMs };
}

export async function cleanupExpiredPendingAttachmentUploads(input: CleanupOptions): Promise<PendingUploadCleanupResult> {
  const { cutoff, ttlMs } = cleanupWindow(input);
  const now = input.now ?? new Date();
  const deleteObject = input.deleteObject ?? deleteAttachmentObject;

  const { expiredInitialAttachments, expiredReplacementVersions } = await input.prisma.$transaction(async (tx) => {
    const initialAttachments = await tx.attachment.updateManyAndReturn({
      data: { deletedAt: now },
      select: { id: true, objectKey: true },
      where: { activatedAt: null, createdAt: { lt: cutoff }, deletedAt: null },
    });
    if (initialAttachments.length) {
      await tx.attachmentVersion.deleteMany({
        where: { activatedAt: null, attachmentId: { in: initialAttachments.map((attachment) => attachment.id) } },
      });
    }

    const replacementVersions = await tx.$queryRaw<PendingUploadObject[]>`
      DELETE FROM "attachment_versions" AS av
      USING "attachments" AS a
      WHERE av."attachment_id" = a."id"
        AND av."activated_at" IS NULL
        AND av."created_at" < ${cutoff}
        AND a."activated_at" IS NOT NULL
        AND a."deleted_at" IS NULL
      RETURNING av."id", av."object_key" AS "objectKey"
    `;

    return {
      expiredInitialAttachments: initialAttachments,
      expiredReplacementVersions: replacementVersions,
    };
  });

  const objectKeys = uniqueObjectKeys([...expiredInitialAttachments, ...expiredReplacementVersions]);
  const failures: PendingUploadCleanupResult["objectDeletes"]["failures"] = [];

  for (const objectKey of objectKeys) {
    try {
      await deleteObject(objectKey);
    } catch (error) {
      failures.push({ message: error instanceof Error ? error.message : String(error), objectKey });
    }
  }

  return {
    cutoff,
    expiredInitialAttachments: expiredInitialAttachments.length,
    expiredReplacementVersions: expiredReplacementVersions.length,
    objectDeletes: {
      attempted: objectKeys.length,
      failed: failures.length,
      failures,
      succeeded: objectKeys.length - failures.length,
    },
    ttlMs,
  };
}

function cleanupWindow(input: CleanupOptions) {
  const ttlMs = input.ttlMs ?? defaultPendingUploadTtlMs;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("Pending upload cleanup TTL must be a positive number of milliseconds.");
  const now = input.now ?? new Date();
  return { cutoff: new Date(now.getTime() - ttlMs), ttlMs };
}

function uniqueObjectKeys(rows: PendingUploadObject[]) {
  return [...new Set(rows.map((row) => row.objectKey))];
}
