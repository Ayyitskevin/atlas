import type { PrismaClient, ProjectRole } from "@atlas/db";
import type {
  AddProjectMemberRequest,
  CreateProjectFromTemplateRequest,
  CreateProjectRequest,
  CreateProjectTemplateFromProjectRequest,
  UpdateProjectRequest,
} from "@atlas/shared";

import { paginationArgs } from "../../shared/pagination.js";

const projectTemplateInclude = {
  _count: { select: { sections: true, tasks: true } },
  createdBy: { select: { email: true, id: true, name: true } },
};

export class ProjectsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateProjectRequest & { createdById: string; workspaceId: string }) {
    return this.prisma.project.create({
      data: {
        createdById: input.createdById,
        description: input.description,
        name: input.name,
        visibility: input.visibility,
        workspaceId: input.workspaceId,
        members: { create: { role: "PROJECT_ADMIN", userId: input.createdById } },
      },
    });
  }

  list(input: { cursor?: string; limit: number; userId: string; workspaceId: string }) {
    return this.prisma.project.findMany({
      ...paginationArgs(input),
      orderBy: { createdAt: "desc" },
      where: {
        deletedAt: null,
        workspaceId: input.workspaceId,
        OR: [
          { visibility: "WORKSPACE" },
          { members: { some: { deletedAt: null, userId: input.userId } } },
          { workspace: { members: { some: { deletedAt: null, role: { in: ["OWNER", "ADMIN"] }, userId: input.userId } } } },
        ],
      },
    });
  }

  find(workspaceId: string, projectId: string) {
    return this.prisma.project.findFirst({ where: { deletedAt: null, id: projectId, workspaceId } });
  }

  update(workspaceId: string, projectId: string, input: UpdateProjectRequest) {
    return this.prisma.project.update({ data: input, where: { id: projectId, workspaceId } });
  }

  archive(workspaceId: string, projectId: string) {
    return this.prisma.project.update({ data: { archivedAt: new Date() }, where: { id: projectId, workspaceId } });
  }

  softDelete(workspaceId: string, projectId: string) {
    return this.prisma.project.update({ data: { deletedAt: new Date() }, where: { id: projectId, workspaceId } });
  }

  listTemplates(workspaceId: string) {
    return this.prisma.projectTemplate.findMany({
      include: projectTemplateInclude,
      orderBy: { createdAt: "desc" },
      where: { deletedAt: null, workspaceId },
    });
  }

  findTemplate(workspaceId: string, templateId: string) {
    return this.prisma.projectTemplate.findFirst({
      include: projectTemplateInclude,
      where: { deletedAt: null, id: templateId, workspaceId },
    });
  }

  async createTemplateFromProject(
    input: CreateProjectTemplateFromProjectRequest & { createdById: string; projectId: string; workspaceId: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        include: {
          sections: {
            include: {
              tasks: {
                orderBy: { position: "asc" },
                select: { description: true, position: true, priority: true, title: true },
                where: { deletedAt: null },
              },
            },
            orderBy: { position: "asc" },
            where: { deletedAt: null },
          },
        },
        where: { deletedAt: null, id: input.projectId, workspaceId: input.workspaceId },
      });
      if (!project) return null;

      const template = await tx.projectTemplate.create({
        data: {
          createdById: input.createdById,
          description: input.description ?? project.description,
          name: input.name ?? project.name + " template",
          workspaceId: input.workspaceId,
        },
      });

      for (const section of project.sections) {
        const templateSection = await tx.projectTemplateSection.create({
          data: {
            name: section.name,
            position: section.position,
            templateId: template.id,
            workspaceId: input.workspaceId,
          },
        });
        if (!section.tasks.length) continue;
        await tx.projectTemplateTask.createMany({
          data: section.tasks.map((task) => ({
            description: task.description,
            position: task.position,
            priority: task.priority,
            sectionId: templateSection.id,
            templateId: template.id,
            title: task.title,
            workspaceId: input.workspaceId,
          })),
        });
      }

      return tx.projectTemplate.findUniqueOrThrow({ include: projectTemplateInclude, where: { id: template.id } });
    });
  }

  async createProjectFromTemplate(
    input: CreateProjectFromTemplateRequest & { createdById: string; templateId: string; workspaceId: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.projectTemplate.findFirst({
        include: {
          sections: {
            include: {
              tasks: {
                orderBy: { position: "asc" },
                where: { workspaceId: input.workspaceId },
              },
            },
            orderBy: { position: "asc" },
            where: { workspaceId: input.workspaceId },
          },
        },
        where: { deletedAt: null, id: input.templateId, workspaceId: input.workspaceId },
      });
      if (!template) return null;

      const project = await tx.project.create({
        data: {
          createdById: input.createdById,
          description: input.description ?? template.description,
          members: { create: { role: "PROJECT_ADMIN", userId: input.createdById } },
          name: input.name,
          visibility: input.visibility,
          workspaceId: input.workspaceId,
        },
      });

      for (const templateSection of template.sections) {
        const section = await tx.section.create({
          data: {
            name: templateSection.name,
            position: templateSection.position,
            projectId: project.id,
            workspaceId: input.workspaceId,
          },
        });
        if (!templateSection.tasks.length) continue;
        await tx.task.createMany({
          data: templateSection.tasks.map((task) => ({
            description: task.description,
            position: task.position,
            priority: task.priority,
            projectId: project.id,
            sectionId: section.id,
            title: task.title,
            workspaceId: input.workspaceId,
          })),
        });
      }

      return tx.project.findUniqueOrThrow({ where: { id: project.id } });
    });
  }

  softDeleteTemplate(workspaceId: string, templateId: string) {
    return this.prisma.projectTemplate.updateMany({
      data: { deletedAt: new Date() },
      where: { deletedAt: null, id: templateId, workspaceId },
    });
  }

  listMembers(workspaceId: string, projectId: string) {
    return this.prisma.projectMember.findMany({
      include: { user: { select: { email: true, id: true, name: true } } },
      orderBy: { createdAt: "asc" },
      where: { deletedAt: null, project: { deletedAt: null, id: projectId, workspaceId } },
    });
  }

  findActiveWorkspaceMember(input: { userId: string; workspaceId: string }) {
    return this.prisma.workspaceMember.findFirst({
      where: {
        deletedAt: null,
        user: { deletedAt: null, disabledAt: null },
        userId: input.userId,
        workspaceId: input.workspaceId,
        workspace: { deletedAt: null },
      },
    });
  }

  findActiveMember(input: { projectId: string; userId: string }) {
    return this.prisma.projectMember.findFirst({
      include: { user: { select: { email: true, id: true, name: true } } },
      where: { deletedAt: null, projectId: input.projectId, userId: input.userId },
    });
  }

  countProjectAdmins(projectId: string) {
    return this.prisma.projectMember.count({
      where: { deletedAt: null, projectId, role: "PROJECT_ADMIN" },
    });
  }

  addMember(input: AddProjectMemberRequest & { projectId: string }) {
    return this.prisma.projectMember.upsert({
      create: {
        projectId: input.projectId,
        role: input.role as ProjectRole,
        userId: input.userId,
      },
      include: { user: { select: { email: true, id: true, name: true } } },
      update: {
        deletedAt: null,
        role: input.role as ProjectRole,
      },
      where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
    });
  }

  updateMemberRole(input: { projectId: string; role: ProjectRole; userId: string }) {
    return this.prisma.projectMember.update({
      data: { role: input.role },
      include: { user: { select: { email: true, id: true, name: true } } },
      where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
    });
  }

  removeMember(input: { projectId: string; userId: string }) {
    return this.prisma.projectMember.update({
      data: { deletedAt: new Date() },
      include: { user: { select: { email: true, id: true, name: true } } },
      where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
    });
  }

  createMessage(input: { authorId: string; body: string; projectId: string; title: string; workspaceId: string }) {
    return this.prisma.projectMessage.create({
      data: input,
      include: { author: { select: { email: true, id: true, name: true } } },
    });
  }

  listMessages(input: { cursor?: string; limit: number; projectId: string; workspaceId: string }) {
    return this.prisma.projectMessage.findMany({
      ...paginationArgs(input),
      include: { author: { select: { email: true, id: true, name: true } } },
      orderBy: [{ pinnedAt: { nulls: "last", sort: "desc" } }, { createdAt: "desc" }, { id: "asc" }],
      where: { deletedAt: null, projectId: input.projectId, workspaceId: input.workspaceId },
    });
  }

  findMessage(input: { messageId: string; projectId: string; workspaceId: string }) {
    return this.prisma.projectMessage.findFirst({
      include: { author: { select: { email: true, id: true, name: true } } },
      where: { deletedAt: null, id: input.messageId, projectId: input.projectId, workspaceId: input.workspaceId },
    });
  }

  async updateMessage(input: { body?: string; messageId: string; projectId: string; title?: string; workspaceId: string }) {
    const result = await this.prisma.projectMessage.updateMany({
      data: { body: input.body, title: input.title },
      where: { deletedAt: null, id: input.messageId, projectId: input.projectId, workspaceId: input.workspaceId },
    });
    if (!result.count) return null;
    return this.findMessage(input);
  }

  softDeleteMessage(input: { messageId: string; projectId: string; workspaceId: string }) {
    return this.prisma.projectMessage.updateMany({
      data: { deletedAt: new Date() },
      where: { deletedAt: null, id: input.messageId, projectId: input.projectId, workspaceId: input.workspaceId },
    });
  }

  async pinMessage(input: { messageId: string; pinnedById: string; projectId: string; workspaceId: string }) {
    const result = await this.prisma.projectMessage.updateMany({
      data: { pinnedAt: new Date(), pinnedById: input.pinnedById },
      where: { deletedAt: null, id: input.messageId, projectId: input.projectId, workspaceId: input.workspaceId },
    });
    if (!result.count) return null;
    return this.findMessage(input);
  }

  async unpinMessage(input: { messageId: string; projectId: string; workspaceId: string }) {
    const result = await this.prisma.projectMessage.updateMany({
      data: { pinnedAt: null, pinnedById: null },
      where: { deletedAt: null, id: input.messageId, projectId: input.projectId, workspaceId: input.workspaceId },
    });
    if (!result.count) return null;
    return this.findMessage(input);
  }
}
