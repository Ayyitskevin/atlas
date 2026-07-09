import { paginationArgs } from "../../shared/pagination.js";
import { WorkRepositoryBase } from "../work/work-repository-base.js";

export class CommentsRepository extends WorkRepositoryBase {
  createComment(input: { authorId: string; body: string; taskId: string; workspaceId: string }) {
    return this.prisma.comment.create({ data: input });
  }

  listComments(input: { cursor?: string; limit: number; taskId: string; workspaceId: string }) {
    return this.prisma.comment.findMany({
      ...paginationArgs(input),
      orderBy: { createdAt: "asc" },
      where: { deletedAt: null, taskId: input.taskId, workspaceId: input.workspaceId },
    });
  }

  findComment(workspaceId: string, commentId: string) {
    return this.prisma.comment.findFirst({ where: { deletedAt: null, id: commentId, workspaceId } });
  }

  async updateComment(input: { body: string; commentId: string; workspaceId: string }) {
    const result = await this.prisma.comment.updateMany({
      data: { body: input.body, editedAt: new Date() },
      where: { deletedAt: null, id: input.commentId, workspaceId: input.workspaceId },
    });
    if (!result.count) return null;
    return this.findComment(input.workspaceId, input.commentId);
  }

  softDeleteComment(input: { commentId: string; workspaceId: string }) {
    return this.prisma.comment.updateMany({
      data: { deletedAt: new Date() },
      where: { deletedAt: null, id: input.commentId, workspaceId: input.workspaceId },
    });
  }
}
