import type { Prisma } from "@atlas/db";
import type { SearchResultType } from "@atlas/shared";

import {
  compactWhere,
  searchAfterWhere,
  type SearchWorkspaceCursor,
} from "../work/work-repository-helpers.js";
import { WorkRepositoryBase } from "../work/work-repository-base.js";

export class SearchRepository extends WorkRepositoryBase {
  searchWorkspace(input: { after?: SearchWorkspaceCursor; limit: number; q: string; type?: SearchResultType; userId: string; workspaceId: string }) {
    const accessibleProject = this.accessibleProjectWhere(input.userId, input.workspaceId);
    const tasks = input.type && input.type !== "task" ? [] : this.prisma.task.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: input.limit + 1,
      where: {
        deletedAt: null,
        AND: compactWhere<Prisma.TaskWhereInput>([
          searchAfterWhere<Prisma.TaskWhereInput>("task", input.after),
          { OR: [{ title: { contains: input.q, mode: "insensitive" } }, { description: { contains: input.q, mode: "insensitive" } }] },
        ]),
        project: accessibleProject,
        workspaceId: input.workspaceId,
      },
    });
    const projects = input.type && input.type !== "project" ? [] : this.prisma.project.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: input.limit + 1,
      where: {
        ...accessibleProject,
        AND: compactWhere<Prisma.ProjectWhereInput>([
          searchAfterWhere<Prisma.ProjectWhereInput>("project", input.after),
          { OR: [{ name: { contains: input.q, mode: "insensitive" } }, { description: { contains: input.q, mode: "insensitive" } }] },
        ]),
      },
    });
    return Promise.all([tasks, projects]);
  }
}
