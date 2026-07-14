import { paginationArgs } from "../../shared/pagination.js";
import {
  attachmentCommentInclude,
  attachmentScanData,
  attachmentWithActiveVersions,
  type AttachmentScanWrite,
} from "../work/work-repository-helpers.js";
import { WorkRepositoryBase } from "../work/work-repository-base.js";

export class AttachmentsRepository extends WorkRepositoryBase {
  createAttachment(input: {
    description?: string | null;
    fileName: string;
    mimeType: string;
    objectKey: string;
    sizeBytes: number;
    taskId: string;
    uploadedById: string;
    workspaceId: string;
  }) {
    return this.prisma.attachment.create({
      data: {
        ...input,
        version: 1,
        versions: {
          create: {
            fileName: input.fileName,
            mimeType: input.mimeType,
            objectKey: input.objectKey,
            sizeBytes: input.sizeBytes,
            uploadedById: input.uploadedById,
            version: 1,
            workspaceId: input.workspaceId,
          },
        },
      },
      include: attachmentWithActiveVersions,
    });
  }

  listAttachments(input: { cursor?: string; limit: number; taskId: string; workspaceId: string }) {
    return this.prisma.attachment.findMany({
      ...paginationArgs(input),
      include: attachmentWithActiveVersions,
      orderBy: { createdAt: "desc" },
      where: { activatedAt: { not: null }, deletedAt: null, taskId: input.taskId, workspaceId: input.workspaceId },
    });
  }

  createAttachmentComment(input: { attachmentId: string; authorId: string; body: string; versionId?: string | null; workspaceId: string }) {
    return this.prisma.attachmentComment.create({ data: input, include: attachmentCommentInclude });
  }

  listAttachmentComments(input: { attachmentId: string; cursor?: string; limit: number; workspaceId: string }) {
    return this.prisma.attachmentComment.findMany({
      ...paginationArgs(input),
      include: attachmentCommentInclude,
      orderBy: { createdAt: "asc" },
      where: { attachmentId: input.attachmentId, deletedAt: null, workspaceId: input.workspaceId },
    });
  }

  findAttachmentComment(input: { attachmentCommentId: string; workspaceId: string }) {
    return this.prisma.attachmentComment.findFirst({
      include: attachmentCommentInclude,
      where: { deletedAt: null, id: input.attachmentCommentId, workspaceId: input.workspaceId },
    });
  }

  async updateAttachmentComment(input: { attachmentCommentId: string; body: string; workspaceId: string }) {
    const result = await this.prisma.attachmentComment.updateMany({
      data: { body: input.body, editedAt: new Date() },
      where: { deletedAt: null, id: input.attachmentCommentId, workspaceId: input.workspaceId },
    });
    if (!result.count) return null;
    return this.findAttachmentComment(input);
  }

  softDeleteAttachmentComment(input: { attachmentCommentId: string; workspaceId: string }) {
    return this.prisma.attachmentComment.updateMany({
      data: { deletedAt: new Date() },
      where: { deletedAt: null, id: input.attachmentCommentId, workspaceId: input.workspaceId },
    });
  }

  findAttachment(workspaceId: string, attachmentId: string) {
    return this.prisma.attachment.findFirst({
      include: attachmentWithActiveVersions,
      where: { activatedAt: { not: null }, deletedAt: null, id: attachmentId, workspaceId },
    });
  }

  findAttachmentIncludingPending(workspaceId: string, attachmentId: string) {
    return this.prisma.attachment.findFirst({ include: attachmentWithActiveVersions, where: { deletedAt: null, id: attachmentId, workspaceId } });
  }

  async recordAttachmentScanResult(input: { attachmentId: string; scan: AttachmentScanWrite; workspaceId: string }) {
    const scanData = attachmentScanData(input.scan);
    await this.prisma.$transaction([
      this.prisma.attachment.updateMany({
        data: scanData,
        where: { activatedAt: null, deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
      }),
      this.prisma.attachmentVersion.updateMany({
        data: scanData,
        where: { activatedAt: null, attachmentId: input.attachmentId, version: 1, workspaceId: input.workspaceId },
      }),
    ]);
  }

  async recordAttachmentVersionScanResult(input: { scan: AttachmentScanWrite; versionId: string; workspaceId: string }) {
    await this.prisma.attachmentVersion.updateMany({
      data: attachmentScanData(input.scan),
      where: { activatedAt: null, id: input.versionId, workspaceId: input.workspaceId },
    });
  }

  completeAttachment(input: { attachmentId: string; scan?: AttachmentScanWrite; workspaceId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const attachment = await tx.attachment.findFirst({
        include: { versions: { where: { version: 1 } } },
        where: { deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
      });
      if (!attachment) return { activated: false, attachment: null, conflict: false };
      if (attachment.activatedAt) {
        return {
          activated: false,
          attachment: await tx.attachment.findFirst({
            include: attachmentWithActiveVersions,
            where: { activatedAt: { not: null }, deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
          }),
          conflict: false,
        };
      }

      const initialVersion = attachment.versions[0];
      if (!initialVersion || attachment.version !== 1) return { activated: false, attachment: null, conflict: true };

      const activatedAt = new Date();
      const scanData = input.scan ? attachmentScanData(input.scan) : {};
      const updated = await tx.attachment.updateMany({
        data: { activatedAt, ...scanData },
        where: { activatedAt: null, deletedAt: null, id: input.attachmentId, version: 1, workspaceId: input.workspaceId },
      });
      if (!updated.count) return { activated: false, attachment: null, conflict: true };

      await tx.attachmentVersion.updateMany({
        data: { activatedAt, ...scanData },
        where: { activatedAt: null, attachmentId: input.attachmentId, version: 1, workspaceId: input.workspaceId },
      });

      return {
        activated: true,
        attachment: await tx.attachment.findFirst({
          include: attachmentWithActiveVersions,
          where: { activatedAt: { not: null }, deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
        }),
        conflict: false,
      };
    });
  }

  async updateAttachment(input: { attachmentId: string; description: string | null; workspaceId: string }) {
    const result = await this.prisma.attachment.updateMany({
      data: { description: input.description },
      where: { deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
    });
    if (!result.count) return null;
    return this.findAttachment(input.workspaceId, input.attachmentId);
  }

  prepareAttachmentVersion(input: {
    attachmentId: string;
    fileName: string;
    mimeType: string;
    objectKey: string;
    sizeBytes: number;
    uploadedById: string;
    version: number;
    workspaceId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const pending = await tx.attachmentVersion.findFirst({
        where: { activatedAt: null, attachmentId: input.attachmentId, version: input.version, workspaceId: input.workspaceId },
      });
      if (pending) {
        return tx.attachmentVersion.update({
          data: {
            fileName: input.fileName,
            mimeType: input.mimeType,
            objectKey: input.objectKey,
            scanCheckedAt: null,
            scanMessage: null,
            scanProvider: null,
            scanStatus: "PENDING",
            sizeBytes: input.sizeBytes,
            uploadedById: input.uploadedById,
          },
          where: { id: pending.id },
        });
      }
      return tx.attachmentVersion.create({ data: input });
    });
  }

  findAttachmentVersion(input: { attachmentId: string; versionId: string; workspaceId: string }) {
    return this.prisma.attachmentVersion.findFirst({
      include: { attachment: true },
      where: { attachmentId: input.attachmentId, id: input.versionId, workspaceId: input.workspaceId },
    });
  }

  findActiveAttachmentVersion(input: { attachmentId: string; versionId: string; workspaceId: string }) {
    return this.prisma.attachmentVersion.findFirst({
      where: { activatedAt: { not: null }, attachmentId: input.attachmentId, id: input.versionId, workspaceId: input.workspaceId },
    });
  }

  completeAttachmentVersion(input: { attachmentId: string; scan?: AttachmentScanWrite; versionId: string; workspaceId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.attachmentVersion.findFirst({
        include: { attachment: true },
        where: { attachmentId: input.attachmentId, id: input.versionId, workspaceId: input.workspaceId },
      });
      if (!version || version.attachment.deletedAt) return { activated: false, attachment: null, conflict: false, version: null };
      if (version.activatedAt) {
        return {
          activated: false,
          attachment: await tx.attachment.findFirst({
            include: attachmentWithActiveVersions,
            where: { deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
          }),
          conflict: false,
          version,
        };
      }
      if (version.attachment.version !== version.version - 1) return { activated: false, attachment: null, conflict: true, version };

      const scanData = input.scan ? attachmentScanData(input.scan) : {};
      const updated = await tx.attachment.updateMany({
        data: {
          fileName: version.fileName,
          mimeType: version.mimeType,
          objectKey: version.objectKey,
          ...scanData,
          sizeBytes: version.sizeBytes,
          version: version.version,
        },
        where: { deletedAt: null, id: input.attachmentId, version: version.version - 1, workspaceId: input.workspaceId },
      });
      if (!updated.count) return { activated: false, attachment: null, conflict: true, version };

      const activatedVersion = await tx.attachmentVersion.update({ data: { activatedAt: new Date(), ...scanData }, where: { id: version.id } });
      return {
        activated: true,
        attachment: await tx.attachment.findFirst({
          include: attachmentWithActiveVersions,
          where: { deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
        }),
        conflict: false,
        version: activatedVersion,
      };
    });
  }

  softDeleteAttachment(input: { attachmentId: string; workspaceId: string }) {
    return this.prisma.attachment.updateMany({
      data: { deletedAt: new Date() },
      where: { deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
    });
  }
}
