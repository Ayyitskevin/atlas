import type { TaskStatus } from "@atlas/db";

import { paginationArgs } from "../../shared/pagination.js";
import { completedAtForStatusTransition } from "../work/task-state.js";
import { WorkRepositoryBase } from "../work/work-repository-base.js";

export class SubtasksRepository extends WorkRepositoryBase {
  createSubtask(input: { assigneeId?: string | null; position: number; taskId: string; title: string; workspaceId: string }) {
    return this.prisma.subtask.create({ data: input });
  }

  listSubtasks(input: { cursor?: string; limit: number; taskId: string; workspaceId: string }) {
    return this.prisma.subtask.findMany({
      ...paginationArgs(input),
      orderBy: { position: "asc" },
      where: { deletedAt: null, taskId: input.taskId, workspaceId: input.workspaceId },
    });
  }

  async updateSubtask(input: {
    data: { assigneeId?: string | null; status?: TaskStatus; title?: string };
    subtaskId: string;
    version: number;
    workspaceId: string;
  }) {
    const result = await this.prisma.subtask.updateMany({
      data: {
        ...input.data,
        completedAt: completedAtForStatusTransition(input.data.status, new Date()),
        version: { increment: 1 },
      },
      where: { deletedAt: null, id: input.subtaskId, version: input.version, workspaceId: input.workspaceId },
    });
    return result.count;
  }

  softDeleteSubtask(workspaceId: string, subtaskId: string) {
    return this.prisma.subtask.updateMany({ data: { deletedAt: new Date() }, where: { id: subtaskId, workspaceId } });
  }

  findSubtask(workspaceId: string, subtaskId: string) {
    return this.prisma.subtask.findFirst({ where: { deletedAt: null, id: subtaskId, workspaceId } });
  }
}
