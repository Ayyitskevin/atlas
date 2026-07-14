import { WorkRepositoryBase } from "../work/work-repository-base.js";

export class LabelsRepository extends WorkRepositoryBase {
  listLabels(input: { workspaceId: string }) {
    return this.prisma.taskLabel.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      where: { deletedAt: null, workspaceId: input.workspaceId },
    });
  }

  createLabel(input: { color: string; name: string; workspaceId: string }) {
    return this.prisma.taskLabel.create({ data: input });
  }

  findLabel(input: { labelId: string; workspaceId: string }) {
    return this.prisma.taskLabel.findFirst({
      where: { deletedAt: null, id: input.labelId, workspaceId: input.workspaceId },
    });
  }

  async updateLabel(input: { data: { color?: string; name?: string }; labelId: string; workspaceId: string }) {
    const result = await this.prisma.taskLabel.updateMany({
      data: input.data,
      where: { deletedAt: null, id: input.labelId, workspaceId: input.workspaceId },
    });
    if (!result.count) return null;
    return this.findLabel(input);
  }

  deleteLabel(input: { labelId: string; workspaceId: string }) {
    return this.prisma.taskLabel.deleteMany({
      where: { id: input.labelId, workspaceId: input.workspaceId },
    });
  }

  listTaskLabels(input: { taskId: string; workspaceId: string }) {
    return this.prisma.taskLabelAssignment.findMany({
      include: { label: true },
      orderBy: [{ label: { name: "asc" } }, { id: "asc" }],
      where: {
        label: { deletedAt: null },
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      },
    });
  }

  assignTaskLabel(input: { assignedById: string; labelId: string; taskId: string; workspaceId: string }) {
    return this.prisma.taskLabelAssignment.upsert({
      create: input,
      include: { label: true },
      update: { assignedById: input.assignedById },
      where: { taskId_labelId: { labelId: input.labelId, taskId: input.taskId } },
    });
  }

  unassignTaskLabel(input: { labelId: string; taskId: string; workspaceId: string }) {
    return this.prisma.taskLabelAssignment.deleteMany({
      where: { labelId: input.labelId, taskId: input.taskId, workspaceId: input.workspaceId },
    });
  }
}
