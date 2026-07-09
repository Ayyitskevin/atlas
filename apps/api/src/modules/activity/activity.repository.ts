import { paginationArgs } from "../../shared/pagination.js";
import { WorkRepositoryBase } from "../work/work-repository-base.js";

export class ActivityRepository extends WorkRepositoryBase {
  listActivity(input: { cursor?: string; limit: number; projectId?: string; taskId?: string; workspaceId: string }) {
    return this.prisma.activityEvent.findMany({
      ...paginationArgs(input),
      orderBy: { createdAt: "desc" },
      where: {
        projectId: input.projectId,
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      },
    });
  }
}
