import type { AuthContext } from "../../shared/auth-context.js";
import {
  AtlasHttpError } from "../../shared/errors.js";
import { pageFromLimit } from "../../shared/pagination.js";
import {
  ATLAS_ERROR_CODES,
  type CreateCommentRequest,
  type CursorPaginationQuery,
  type UpdateCommentRequest,
} from "@atlas/shared";
import { WorkDomainBase } from "../work/work-domain-base.js";

export class CommentsService extends WorkDomainBase {
  async createComment(ctx: AuthContext, workspaceId: string, taskId: string, input: CreateCommentRequest) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "COMMENTER");
    const comment = await this.workRepository.createComment({ authorId: ctx.userId, body: input.body, taskId, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: comment.id,
      entityType: "comment",
      eventType: "CommentCreated",
      projectId: task.projectId,
      taskId,
      workspaceId,
    });
    return comment;
  }


  async listComments(ctx: AuthContext, workspaceId: string, taskId: string, query: CursorPaginationQuery) {
    await this.permissions.requireTaskRole(ctx, workspaceId, taskId, "VIEWER");
    return pageFromLimit(await this.workRepository.listComments({ ...query, taskId, workspaceId }), query.limit);
  }


  async updateComment(ctx: AuthContext, workspaceId: string, commentId: string, input: UpdateCommentRequest) {
    const comment = await this.workRepository.findComment(workspaceId, commentId);
    if (!comment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Comment not found.");
    const task = await this.getTask(ctx, workspaceId, comment.taskId);
    if (comment.authorId !== ctx.userId) await this.permissions.requireTaskRole(ctx, workspaceId, comment.taskId, "EDITOR");
    const updated = await this.workRepository.updateComment({ body: input.body, commentId, workspaceId });
    if (!updated) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Comment not found.");
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: commentId,
      entityType: "comment",
      eventType: "CommentUpdated",
      projectId: task.projectId,
      taskId: comment.taskId,
      workspaceId,
    });
    return updated;
  }


  async deleteComment(ctx: AuthContext, workspaceId: string, commentId: string) {
    const comment = await this.workRepository.findComment(workspaceId, commentId);
    if (!comment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Comment not found.");
    const task = await this.getTask(ctx, workspaceId, comment.taskId);
    if (comment.authorId !== ctx.userId) await this.permissions.requireTaskRole(ctx, workspaceId, comment.taskId, "EDITOR");
    await this.workRepository.softDeleteComment({ commentId, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: commentId,
      entityType: "comment",
      eventType: "CommentDeleted",
      projectId: task.projectId,
      taskId: comment.taskId,
      workspaceId,
    });
    return { ok: true };
  }

}
