import { paginationArgs } from "../../shared/pagination.js";
import { WorkRepositoryBase } from "../work/work-repository-base.js";

export class SectionsRepository extends WorkRepositoryBase {
  createSection(input: { name: string; position: number; projectId: string; workspaceId: string }) {
    return this.prisma.section.create({ data: input });
  }

  findSection(input: { projectId: string; sectionId: string; workspaceId: string }) {
    return this.prisma.section.findFirst({
      where: { deletedAt: null, id: input.sectionId, projectId: input.projectId, workspaceId: input.workspaceId },
    });
  }

  countSections(input: { projectId: string; sectionIds: string[]; workspaceId: string }) {
    const ids = [...new Set(input.sectionIds)];
    if (!ids.length) return Promise.resolve(0);
    return this.prisma.section.count({
      where: { deletedAt: null, id: { in: ids }, projectId: input.projectId, workspaceId: input.workspaceId },
    });
  }

  listSections(input: { cursor?: string; limit: number; projectId: string; workspaceId: string }) {
    return this.prisma.section.findMany({
      ...paginationArgs(input),
      orderBy: { position: "asc" },
      where: { deletedAt: null, projectId: input.projectId, workspaceId: input.workspaceId },
    });
  }

  async updateSection(input: { data: { name?: string; position?: number }; projectId: string; sectionId: string; workspaceId: string }) {
    const result = await this.prisma.section.updateMany({
      data: input.data,
      where: { deletedAt: null, id: input.sectionId, projectId: input.projectId, workspaceId: input.workspaceId },
    });
    if (!result.count) return null;
    return this.findSection(input);
  }

  async softDeleteSection(input: { projectId: string; sectionId: string; workspaceId: string }) {
    const result = await this.prisma.section.updateMany({
      data: { deletedAt: new Date() },
      where: { deletedAt: null, id: input.sectionId, projectId: input.projectId, workspaceId: input.workspaceId },
    });
    return result.count;
  }

  async reorderSections(input: { projectId: string; sections: Array<{ id: string; position: number }>; workspaceId: string }) {
    return this.prisma.$transaction(
      input.sections.map((section) =>
        this.prisma.section.updateMany({
          data: { position: section.position },
          where: { deletedAt: null, id: section.id, projectId: input.projectId, workspaceId: input.workspaceId },
        }),
      ),
    );
  }
}
