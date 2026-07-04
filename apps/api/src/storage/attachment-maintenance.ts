import type { PrismaClient } from "@atlas/db";

import {
  cleanupDeletedAttachmentObjects,
  type DeletedAttachmentObjectCleanupPreview,
  type DeletedAttachmentObjectCleanupResult,
  previewDeletedAttachmentObjectCleanup,
} from "./deleted-attachment-object-cleanup.js";
import {
  cleanupExpiredPendingAttachmentUploads,
  type PendingUploadCleanupPreview,
  type PendingUploadCleanupResult,
  previewExpiredPendingAttachmentUploads,
} from "./pending-upload-cleanup.js";

type DeleteObject = (objectKey: string) => Promise<void>;

type AttachmentMaintenanceOptions = {
  deleteObject?: DeleteObject;
  deletedAttachmentObjectRetentionMs?: number;
  now?: Date;
  pendingUploadTtlMs?: number;
  prisma: PrismaClient;
};

export type AttachmentMaintenanceDryRunResult = {
  deletedAttachmentObjects: DeletedAttachmentObjectCleanupPreview;
  dryRun: true;
  pendingUploads: PendingUploadCleanupPreview;
};

export type AttachmentMaintenanceConfirmedResult = {
  deletedAttachmentObjects: DeletedAttachmentObjectCleanupResult;
  dryRun: false;
  pendingUploads: PendingUploadCleanupResult;
};

export type AttachmentMaintenanceResult = AttachmentMaintenanceConfirmedResult | AttachmentMaintenanceDryRunResult;

export function attachmentMaintenanceHasFailures(result: AttachmentMaintenanceResult): boolean {
  if (result.dryRun) return false;
  return result.pendingUploads.objectDeletes.failed > 0 || result.deletedAttachmentObjects.objectDeletes.failed > 0;
}

export async function runAttachmentMaintenance(
  input: AttachmentMaintenanceOptions & { confirm: true },
): Promise<AttachmentMaintenanceConfirmedResult>;
export async function runAttachmentMaintenance(
  input: AttachmentMaintenanceOptions & { confirm?: false },
): Promise<AttachmentMaintenanceDryRunResult>;
export async function runAttachmentMaintenance(input: AttachmentMaintenanceOptions & { confirm?: boolean }): Promise<AttachmentMaintenanceResult>;
export async function runAttachmentMaintenance(input: AttachmentMaintenanceOptions & { confirm?: boolean }): Promise<AttachmentMaintenanceResult> {
  const deletedAttachmentObjectInput = {
    deleteObject: input.deleteObject,
    now: input.now,
    prisma: input.prisma,
    retentionMs: input.deletedAttachmentObjectRetentionMs,
  };
  const pendingUploadInput = {
    deleteObject: input.deleteObject,
    now: input.now,
    prisma: input.prisma,
    ttlMs: input.pendingUploadTtlMs,
  };

  if (input.confirm) {
    return {
      deletedAttachmentObjects: await cleanupDeletedAttachmentObjects(deletedAttachmentObjectInput),
      dryRun: false,
      pendingUploads: await cleanupExpiredPendingAttachmentUploads(pendingUploadInput),
    };
  }

  return {
    deletedAttachmentObjects: await previewDeletedAttachmentObjectCleanup(deletedAttachmentObjectInput),
    dryRun: true,
    pendingUploads: await previewExpiredPendingAttachmentUploads(pendingUploadInput),
  };
}
