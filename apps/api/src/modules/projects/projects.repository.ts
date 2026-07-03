import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient, ProjectRole } from "@atlas/db";
import type {
  AddProjectMemberRequest,
  CreateProjectFromTemplateRequest,
  CreateProjectRequest,
  CreateProjectTemplateFromProjectRequest,
  UpdateProjectTemplateRequest,
  UpdateProjectRequest,
} from "@atlas/shared";

import { paginationArgs } from "../../shared/pagination.js";

const dayInMs = 24 * 60 * 60 * 1000;

const projectTemplateInclude = {
  _count: { select: { sections: true, tasks: true } },
  createdBy: { select: { email: true, id: true, name: true } },
} satisfies Prisma.ProjectTemplateInclude;

const projectTemplateDetailInclude = {
  ...projectTemplateInclude,
  sections: {
    include: {
      tasks: {
        include: {
          assignees: {
            include: { user: { select: { email: true, id: true, name: true } } },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
          labelAssignments: {
            include: { label: true },
            orderBy: [{ label: { name: "asc" } }, { id: "asc" }],
          },
        },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { position: "asc" },
  },
} satisfies Prisma.ProjectTemplateInclude;

function utcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function daysBetweenDates(from: Date, to: Date) {
  return Math.round((utcDay(to) - utcDay(from)) / dayInMs);
}

function earliestDueDate(
  sections: Array<{
    tasks: Array<{
      dueDate: Date | null;
    }>;
  }>,
) {
  const dueDates = sections.flatMap((section) => section.tasks.flatMap((task) => (task.dueDate ? [task.dueDate] : [])));
  if (!dueDates.length) return null;
  return dueDates.reduce((earliest, dueDate) => (utcDay(dueDate) < utcDay(earliest) ? dueDate : earliest));
}

function dueDateFromAnchor(anchor: string | undefined, offsetDays: number | null) {
  if (!anchor || offsetDays === null) return null;
  const date = new Date(anchor + "T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date;
}

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

  findTemplateDetail(workspaceId: string, templateId: string) {
    return this.prisma.projectTemplate.findFirst({
      include: projectTemplateDetailInclude,
      where: { deletedAt: null, id: templateId, workspaceId },
    });
  }

  async updateTemplate(input: UpdateProjectTemplateRequest & { templateId: string; workspaceId: string }) {
    const result = await this.prisma.projectTemplate.updateMany({
      data: {
        description: input.description,
        name: input.name,
      },
      where: { deletedAt: null, id: input.templateId, workspaceId: input.workspaceId },
    });
    if (!result.count) return null;
    return this.findTemplate(input.workspaceId, input.templateId);
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
                select: {
                  assignees: {
                    select: { userId: true },
                    where: {
                      user: {
                        deletedAt: null,
                        disabledAt: null,
                        workspaceLinks: { some: { deletedAt: null, workspaceId: input.workspaceId } },
                      },
                    },
                  },
                  description: true,
                  dueDate: true,
                  labelAssignments: {
                    select: { labelId: true },
                    where: { label: { deletedAt: null, workspaceId: input.workspaceId } },
                  },
                  position: true,
                  priority: true,
                  title: true,
                },
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
      const dueDateAnchor = earliestDueDate(project.sections);

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
        const templateTasks = section.tasks.map((task) => ({ id: randomUUID(), task }));
        await tx.projectTemplateTask.createMany({
          data: templateTasks.map(({ id, task }) => ({
            description: task.description,
            dueDateOffsetDays: dueDateAnchor && task.dueDate ? daysBetweenDates(dueDateAnchor, task.dueDate) : null,
            id,
            position: task.position,
            priority: task.priority,
            sectionId: templateSection.id,
            templateId: template.id,
            title: task.title,
            workspaceId: input.workspaceId,
          })),
        });

        const templateTaskAssignees = templateTasks.flatMap(({ id, task }) =>
          task.assignees.map((assignee) => ({
            templateTaskId: id,
            userId: assignee.userId,
            workspaceId: input.workspaceId,
          })),
        );
        if (templateTaskAssignees.length) {
          await tx.projectTemplateTaskAssignee.createMany({ data: templateTaskAssignees, skipDuplicates: true });
        }

        const templateTaskLabelAssignments = templateTasks.flatMap(({ id, task }) =>
          task.labelAssignments.map((assignment) => ({
            labelId: assignment.labelId,
            templateTaskId: id,
            workspaceId: input.workspaceId,
          })),
        );
        if (templateTaskLabelAssignments.length) {
          await tx.projectTemplateTaskLabelAssignment.createMany({ data: templateTaskLabelAssignments, skipDuplicates: true });
        }
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
                include: {
                  assignees: { select: { userId: true } },
                  labelAssignments: { select: { labelId: true } },
                },
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

      const [activeMembers, activeLabels] = await Promise.all([
        tx.workspaceMember.findMany({
          select: { userId: true },
          where: {
            deletedAt: null,
            user: { deletedAt: null, disabledAt: null },
            workspaceId: input.workspaceId,
          },
        }),
        tx.taskLabel.findMany({
          select: { id: true },
          where: { deletedAt: null, workspaceId: input.workspaceId },
        }),
      ]);
      const activeMemberIds = new Set(activeMembers.map((member) => member.userId));
      const activeLabelIds = new Set(activeLabels.map((label) => label.id));

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
        const tasks = templateSection.tasks.map((task) => ({ id: randomUUID(), task }));
        await tx.task.createMany({
          data: tasks.map(({ id, task }) => ({
            description: task.description,
            dueDate: dueDateFromAnchor(input.dueDateAnchor, task.dueDateOffsetDays),
            id,
            position: task.position,
            priority: task.priority,
            projectId: project.id,
            sectionId: section.id,
            title: task.title,
            workspaceId: input.workspaceId,
          })),
        });

        const assignees = tasks.flatMap(({ id, task }) =>
          task.assignees
            .filter((assignee) => activeMemberIds.has(assignee.userId))
            .map((assignee) => ({
              assignedById: input.createdById,
              taskId: id,
              userId: assignee.userId,
              workspaceId: input.workspaceId,
            })),
        );
        if (assignees.length) await tx.taskAssignee.createMany({ data: assignees, skipDuplicates: true });

        const labelAssignments = tasks.flatMap(({ id, task }) =>
          task.labelAssignments
            .filter((assignment) => activeLabelIds.has(assignment.labelId))
            .map((assignment) => ({
              assignedById: input.createdById,
              labelId: assignment.labelId,
              taskId: id,
              workspaceId: input.workspaceId,
            })),
        );
        if (labelAssignments.length) await tx.taskLabelAssignment.createMany({ data: labelAssignments, skipDuplicates: true });
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
