import type { AuthContext } from "../../shared/auth-context.js";
import {
  AtlasHttpError } from "../../shared/errors.js";
import { pageFromLimit } from "../../shared/pagination.js";
import {
  ATLAS_ERROR_CODES,
  type CreateAttachmentCommentRequest,
  type CreateAttachmentRequest,
  type CursorPaginationQuery,
  type ReplaceAttachmentRequest,
  type UpdateAttachmentCommentRequest,
  type UpdateAttachmentRequest,
} from "@atlas/shared";
import { createAttachmentObjectKey, createDownloadInstructions, createUploadInstructions } from "../../storage/object-storage.js";
import {
  attachmentActivityPayload,
  isPrismaUniqueConstraintError,
  normalizeAttachmentDescription,
} from "../work/work-helpers.js";
import { WorkDomainBase } from "../work/work-domain-base.js";

export class AttachmentsService extends WorkDomainBase {
  async createAttachment(ctx: AuthContext, workspaceId: string, taskId: string, input: CreateAttachmentRequest) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "COMMENTER");
    const objectKey = createAttachmentObjectKey({ fileName: input.fileName, taskId, workspaceId });
    const attachment = await this.workRepository.createAttachment({
      description: normalizeAttachmentDescription(input.description),
      fileName: input.fileName,
      mimeType: input.mimeType,
      objectKey,
      sizeBytes: input.sizeBytes,
      taskId,
      uploadedById: ctx.userId,
      workspaceId,
    });
    return { attachment, upload: await createUploadInstructions({ mimeType: attachment.mimeType, objectKey: attachment.objectKey }) };
  }


  async completeAttachment(ctx: AuthContext, workspaceId: string, attachmentId: string) {
    const attachment = await this.workRepository.findAttachmentIncludingPending(workspaceId, attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    const task = await this.getTask(ctx, workspaceId, attachment.taskId);
    const requiredRole = attachment.uploadedById === ctx.userId ? "COMMENTER" : "EDITOR";
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, requiredRole);
    const scan = attachment.activatedAt
      ? undefined
      : await this.scanInitialAttachment({
          attachmentId,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          objectKey: attachment.objectKey,
          sizeBytes: attachment.sizeBytes,
          workspaceId,
        });
    const result = await this.workRepository.completeAttachment({ attachmentId, scan, workspaceId });
    if (result.conflict || !result.attachment) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Attachment changed before upload completion.");
    }
    if (result.activated) {
      await this.events.recordActivity({
        actorUserId: ctx.userId,
        entityId: attachment.id,
        entityType: "attachment",
        eventType: "AttachmentAdded",
        payload: { attachmentId: attachment.id, description: attachment.description, fileName: attachment.fileName, sizeBytes: attachment.sizeBytes },
        projectId: task.projectId,
        taskId: attachment.taskId,
        workspaceId,
      });
    }
    return result.attachment;
  }


  async listAttachments(ctx: AuthContext, workspaceId: string, taskId: string, query: CursorPaginationQuery) {
    await this.permissions.requireTaskRole(ctx, workspaceId, taskId, "VIEWER");
    return pageFromLimit(await this.workRepository.listAttachments({ ...query, taskId, workspaceId }), query.limit);
  }


  async createAttachmentComment(ctx: AuthContext, workspaceId: string, attachmentId: string, input: CreateAttachmentCommentRequest) {
    const attachment = await this.workRepository.findAttachment(workspaceId, attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    const task = await this.getTask(ctx, workspaceId, attachment.taskId);
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, "COMMENTER");
    const versionAnchor = input.versionId ? await this.workRepository.findActiveAttachmentVersion({ attachmentId, versionId: input.versionId, workspaceId }) : null;
    if (input.versionId && !versionAnchor) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment version not found.");
    const comment = await this.workRepository.createAttachmentComment({ attachmentId, authorId: ctx.userId, body: input.body, versionId: versionAnchor?.id ?? null, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: comment.id,
      entityType: "attachment_comment",
      eventType: "AttachmentCommentCreated",
      payload: attachmentActivityPayload(attachment, versionAnchor),
      projectId: task.projectId,
      taskId: attachment.taskId,
      workspaceId,
    });
    return comment;
  }


  async listAttachmentComments(ctx: AuthContext, workspaceId: string, attachmentId: string, query: CursorPaginationQuery) {
    const attachment = await this.workRepository.findAttachment(workspaceId, attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, "VIEWER");
    return pageFromLimit(await this.workRepository.listAttachmentComments({ ...query, attachmentId, workspaceId }), query.limit);
  }


  async updateAttachmentComment(ctx: AuthContext, workspaceId: string, attachmentCommentId: string, input: UpdateAttachmentCommentRequest) {
    const comment = await this.workRepository.findAttachmentComment({ attachmentCommentId, workspaceId });
    if (!comment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment comment not found.");
    const attachment = await this.workRepository.findAttachment(workspaceId, comment.attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment comment not found.");
    const task = await this.getTask(ctx, workspaceId, attachment.taskId);
    if (comment.authorId !== ctx.userId) await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, "EDITOR");
    const updated = await this.workRepository.updateAttachmentComment({ attachmentCommentId, body: input.body, workspaceId });
    if (!updated) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment comment not found.");
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: attachmentCommentId,
      entityType: "attachment_comment",
      eventType: "AttachmentCommentUpdated",
      payload: attachmentActivityPayload(attachment, comment.version),
      projectId: task.projectId,
      taskId: attachment.taskId,
      workspaceId,
    });
    return updated;
  }


  async deleteAttachmentComment(ctx: AuthContext, workspaceId: string, attachmentCommentId: string) {
    const comment = await this.workRepository.findAttachmentComment({ attachmentCommentId, workspaceId });
    if (!comment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment comment not found.");
    const attachment = await this.workRepository.findAttachment(workspaceId, comment.attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment comment not found.");
    const task = await this.getTask(ctx, workspaceId, attachment.taskId);
    if (comment.authorId !== ctx.userId) await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, "EDITOR");
    await this.workRepository.softDeleteAttachmentComment({ attachmentCommentId, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: attachmentCommentId,
      entityType: "attachment_comment",
      eventType: "AttachmentCommentDeleted",
      payload: attachmentActivityPayload(attachment, comment.version),
      projectId: task.projectId,
      taskId: attachment.taskId,
      workspaceId,
    });
    return { ok: true };
  }


  async getAttachmentDownload(ctx: AuthContext, workspaceId: string, attachmentId: string) {
    const attachment = await this.workRepository.findAttachment(workspaceId, attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, "VIEWER");
    return { attachment, download: await createDownloadInstructions(attachment.objectKey) };
  }


  async createAttachmentVersion(ctx: AuthContext, workspaceId: string, attachmentId: string, input: ReplaceAttachmentRequest) {
    const attachment = await this.workRepository.findAttachment(workspaceId, attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    const requiredRole = attachment.uploadedById === ctx.userId ? "COMMENTER" : "EDITOR";
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, requiredRole);
    const objectKey = createAttachmentObjectKey({ fileName: input.fileName, taskId: attachment.taskId, workspaceId });
    try {
      const version = await this.workRepository.prepareAttachmentVersion({
        attachmentId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        objectKey,
        sizeBytes: input.sizeBytes,
        uploadedById: ctx.userId,
        version: attachment.version + 1,
        workspaceId,
      });
      return {
        attachment,
        upload: await createUploadInstructions({ mimeType: version.mimeType, objectKey: version.objectKey }),
        version,
      };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Attachment replacement is already pending.");
      }
      throw error;
    }
  }


  async completeAttachmentVersion(ctx: AuthContext, workspaceId: string, attachmentId: string, versionId: string) {
    const version = await this.workRepository.findAttachmentVersion({ attachmentId, versionId, workspaceId });
    if (!version || version.attachment.deletedAt) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment version not found.");
    const attachment = await this.workRepository.findAttachment(workspaceId, attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    const task = await this.getTask(ctx, workspaceId, attachment.taskId);
    const requiredRole = version.uploadedById === ctx.userId ? "COMMENTER" : "EDITOR";
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, requiredRole);
    const scan = version.activatedAt
      ? undefined
      : await this.scanAttachmentVersion({
          fileName: version.fileName,
          mimeType: version.mimeType,
          objectKey: version.objectKey,
          sizeBytes: version.sizeBytes,
          versionId,
          workspaceId,
        });
    const result = await this.workRepository.completeAttachmentVersion({ attachmentId, scan, versionId, workspaceId });
    if (result.conflict || !result.attachment || !result.version) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Attachment changed before this version was completed.");
    }
    if (result.activated) {
      await this.events.recordActivity({
        actorUserId: ctx.userId,
        entityId: attachmentId,
        entityType: "attachment",
        eventType: "AttachmentReplaced",
        payload: {
          attachmentId,
          fileName: result.attachment.fileName,
          previousFileName: attachment.fileName,
          previousSizeBytes: attachment.sizeBytes,
          sizeBytes: result.attachment.sizeBytes,
          version: result.attachment.version,
          versionId,
        },
        projectId: task.projectId,
        taskId: attachment.taskId,
        workspaceId,
      });
    }
    return result.attachment;
  }


  async updateAttachment(ctx: AuthContext, workspaceId: string, attachmentId: string, input: UpdateAttachmentRequest) {
    const attachment = await this.workRepository.findAttachment(workspaceId, attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    const task = await this.getTask(ctx, workspaceId, attachment.taskId);
    const requiredRole = attachment.uploadedById === ctx.userId ? "COMMENTER" : "EDITOR";
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, requiredRole);
    const description = normalizeAttachmentDescription(input.description);
    const updated = await this.workRepository.updateAttachment({ attachmentId, description, workspaceId });
    if (!updated) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: attachmentId,
      entityType: "attachment",
      eventType: "AttachmentUpdated",
      payload: { attachmentId, description, fileName: attachment.fileName, sizeBytes: attachment.sizeBytes },
      projectId: task.projectId,
      taskId: attachment.taskId,
      workspaceId,
    });
    return updated;
  }


  async deleteAttachment(ctx: AuthContext, workspaceId: string, attachmentId: string) {
    const attachment = await this.workRepository.findAttachment(workspaceId, attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    const task = await this.getTask(ctx, workspaceId, attachment.taskId);
    const requiredRole = attachment.uploadedById === ctx.userId ? "COMMENTER" : "EDITOR";
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, requiredRole);
    await this.workRepository.softDeleteAttachment({ attachmentId, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: attachmentId,
      entityType: "attachment",
      eventType: "AttachmentDeleted",
      payload: { attachmentId, fileName: attachment.fileName, sizeBytes: attachment.sizeBytes },
      projectId: task.projectId,
      taskId: attachment.taskId,
      workspaceId,
    });
    return { ok: true };
  }

}
