import type { Prisma } from "@atlas/db";
import type { SearchResultType } from "@atlas/shared";

import {
  compactWhere,
  searchAfterWhere,
  type SearchWorkspaceCursor,
} from "../work/work-repository-helpers.js";
import { WorkRepositoryBase } from "../work/work-repository-base.js";

type FtsIdRow = {
  id: string;
};

/**
 * Workspace search prefers PostgreSQL full-text (`search_vector` generated columns)
 * with ILIKE fallback when the query is too short for useful FTS or FTS returns nothing.
 * Pagination stays cursor-based on (updatedAt, id) so OpenAPI contracts remain stable.
 */
export class SearchRepository extends WorkRepositoryBase {
  async searchWorkspace(input: {
    after?: SearchWorkspaceCursor;
    limit: number;
    q: string;
    type?: SearchResultType;
    userId: string;
    workspaceId: string;
  }) {
    const accessibleProject = this.accessibleProjectWhere(input.userId, input.workspaceId);
    const q = input.q.trim();
    const useFts = q.length >= 2;

    const [tasks, projects] = await Promise.all([
      input.type && input.type !== "task"
        ? Promise.resolve([])
        : this.searchTasks({ ...input, accessibleProject, q, useFts }),
      input.type && input.type !== "project"
        ? Promise.resolve([])
        : this.searchProjects({ ...input, accessibleProject, q, useFts }),
    ]);

    return [tasks, projects] as const;
  }

  private async searchTasks(input: {
    accessibleProject: Prisma.ProjectWhereInput;
    after?: SearchWorkspaceCursor;
    limit: number;
    q: string;
    useFts: boolean;
    userId: string;
    workspaceId: string;
  }) {
    if (input.useFts) {
      const after = input.after?.type === "task" ? input.after : undefined;
      const rows = after
        ? await this.prisma.$queryRaw<FtsIdRow[]>`
            SELECT t.id
            FROM tasks t
            INNER JOIN projects p ON p.id = t.project_id
            LEFT JOIN project_members pm
              ON pm.project_id = p.id AND pm.user_id = ${input.userId}::uuid AND pm.deleted_at IS NULL
            WHERE t.workspace_id = ${input.workspaceId}::uuid
              AND t.deleted_at IS NULL
              AND p.deleted_at IS NULL
              AND (
                p.visibility = 'WORKSPACE'
                OR pm.id IS NOT NULL
                OR EXISTS (
                  SELECT 1 FROM workspace_members wm
                  WHERE wm.workspace_id = t.workspace_id
                    AND wm.user_id = ${input.userId}::uuid
                    AND wm.deleted_at IS NULL
                    AND wm.role IN ('OWNER', 'ADMIN')
                )
              )
              AND t.search_vector @@ plainto_tsquery('english', ${input.q})
              AND (
                t.updated_at < ${after.updatedAt}
                OR (t.updated_at = ${after.updatedAt} AND t.id > ${after.id}::uuid)
              )
            ORDER BY t.updated_at DESC, t.id ASC
            LIMIT ${input.limit + 1}
          `
        : await this.prisma.$queryRaw<FtsIdRow[]>`
            SELECT t.id
            FROM tasks t
            INNER JOIN projects p ON p.id = t.project_id
            LEFT JOIN project_members pm
              ON pm.project_id = p.id AND pm.user_id = ${input.userId}::uuid AND pm.deleted_at IS NULL
            WHERE t.workspace_id = ${input.workspaceId}::uuid
              AND t.deleted_at IS NULL
              AND p.deleted_at IS NULL
              AND (
                p.visibility = 'WORKSPACE'
                OR pm.id IS NOT NULL
                OR EXISTS (
                  SELECT 1 FROM workspace_members wm
                  WHERE wm.workspace_id = t.workspace_id
                    AND wm.user_id = ${input.userId}::uuid
                    AND wm.deleted_at IS NULL
                    AND wm.role IN ('OWNER', 'ADMIN')
                )
              )
              AND t.search_vector @@ plainto_tsquery('english', ${input.q})
            ORDER BY t.updated_at DESC, t.id ASC
            LIMIT ${input.limit + 1}
          `;

      if (rows.length) {
        const order = new Map(rows.map((row, index) => [row.id, index]));
        const tasks = await this.prisma.task.findMany({
          where: { id: { in: rows.map((row) => row.id) }, deletedAt: null },
        });
        return tasks.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
      }
    }

    return this.prisma.task.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: input.limit + 1,
      where: {
        deletedAt: null,
        AND: compactWhere<Prisma.TaskWhereInput>([
          searchAfterWhere<Prisma.TaskWhereInput>("task", input.after),
          {
            OR: [
              { title: { contains: input.q, mode: "insensitive" } },
              { description: { contains: input.q, mode: "insensitive" } },
            ],
          },
        ]),
        project: input.accessibleProject,
        workspaceId: input.workspaceId,
      },
    });
  }

  private async searchProjects(input: {
    accessibleProject: Prisma.ProjectWhereInput;
    after?: SearchWorkspaceCursor;
    limit: number;
    q: string;
    useFts: boolean;
    userId: string;
    workspaceId: string;
  }) {
    if (input.useFts) {
      const after = input.after?.type === "project" ? input.after : undefined;
      const rows = after
        ? await this.prisma.$queryRaw<FtsIdRow[]>`
            SELECT p.id
            FROM projects p
            LEFT JOIN project_members pm
              ON pm.project_id = p.id AND pm.user_id = ${input.userId}::uuid AND pm.deleted_at IS NULL
            WHERE p.workspace_id = ${input.workspaceId}::uuid
              AND p.deleted_at IS NULL
              AND (
                p.visibility = 'WORKSPACE'
                OR pm.id IS NOT NULL
                OR EXISTS (
                  SELECT 1 FROM workspace_members wm
                  WHERE wm.workspace_id = p.workspace_id
                    AND wm.user_id = ${input.userId}::uuid
                    AND wm.deleted_at IS NULL
                    AND wm.role IN ('OWNER', 'ADMIN')
                )
              )
              AND p.search_vector @@ plainto_tsquery('english', ${input.q})
              AND (
                p.updated_at < ${after.updatedAt}
                OR (p.updated_at = ${after.updatedAt} AND p.id > ${after.id}::uuid)
              )
            ORDER BY p.updated_at DESC, p.id ASC
            LIMIT ${input.limit + 1}
          `
        : await this.prisma.$queryRaw<FtsIdRow[]>`
            SELECT p.id
            FROM projects p
            LEFT JOIN project_members pm
              ON pm.project_id = p.id AND pm.user_id = ${input.userId}::uuid AND pm.deleted_at IS NULL
            WHERE p.workspace_id = ${input.workspaceId}::uuid
              AND p.deleted_at IS NULL
              AND (
                p.visibility = 'WORKSPACE'
                OR pm.id IS NOT NULL
                OR EXISTS (
                  SELECT 1 FROM workspace_members wm
                  WHERE wm.workspace_id = p.workspace_id
                    AND wm.user_id = ${input.userId}::uuid
                    AND wm.deleted_at IS NULL
                    AND wm.role IN ('OWNER', 'ADMIN')
                )
              )
              AND p.search_vector @@ plainto_tsquery('english', ${input.q})
            ORDER BY p.updated_at DESC, p.id ASC
            LIMIT ${input.limit + 1}
          `;

      if (rows.length) {
        const order = new Map(rows.map((row, index) => [row.id, index]));
        const projects = await this.prisma.project.findMany({
          where: { id: { in: rows.map((row) => row.id) }, deletedAt: null },
        });
        return projects.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
      }
    }

    return this.prisma.project.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: input.limit + 1,
      where: {
        ...input.accessibleProject,
        AND: compactWhere<Prisma.ProjectWhereInput>([
          searchAfterWhere<Prisma.ProjectWhereInput>("project", input.after),
          {
            OR: [
              { name: { contains: input.q, mode: "insensitive" } },
              { description: { contains: input.q, mode: "insensitive" } },
            ],
          },
        ]),
      },
    });
  }
}
