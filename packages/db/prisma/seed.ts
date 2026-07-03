import { PrismaClient, ProjectRole, ProjectVisibility, TaskPriority, TaskRecurrenceFrequency, TaskStatus, WorkspaceRole } from "@prisma/client";

const prisma = new PrismaClient();
const demoPasswordHash = "$argon2id$v=19$m=65536,t=3,p=4$3kV8t+4ue+gpSKg/g1XxuQ$WSdYol7nG/kwQwhihUaqa5pkbbLDfDXbt004bRsnm5A";
const seedNow = new Date("2026-07-03T12:00:00.000Z");

async function main() {
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "kevin@example.com" },
      update: { name: "Kevin Lee", passwordHash: demoPasswordHash },
      create: {
        email: "kevin@example.com",
        name: "Kevin Lee",
        passwordHash: demoPasswordHash,
      },
    }),
    prisma.user.upsert({
      where: { email: "maya@example.com" },
      update: { name: "Maya Chen", passwordHash: demoPasswordHash },
      create: {
        email: "maya@example.com",
        name: "Maya Chen",
        passwordHash: demoPasswordHash,
      },
    }),
    prisma.user.upsert({
      where: { email: "jon@example.com" },
      update: { name: "Jon Bell", passwordHash: demoPasswordHash },
      create: {
        email: "jon@example.com",
        name: "Jon Bell",
        passwordHash: demoPasswordHash,
      },
    }),
  ]);

  const [kevin, maya, jon] = users;

  const workspace = await prisma.workspace.upsert({
    where: { slug: "atlas-demo" },
    update: { name: "Atlas Demo Workspace", ownerId: kevin.id },
    create: {
      name: "Atlas Demo Workspace",
      slug: "atlas-demo",
      ownerId: kevin.id,
    },
  });

  await Promise.all([
    upsertWorkspaceMember(workspace.id, kevin.id, WorkspaceRole.OWNER),
    upsertWorkspaceMember(workspace.id, maya.id, WorkspaceRole.ADMIN, kevin.id),
    upsertWorkspaceMember(workspace.id, jon.id, WorkspaceRole.MEMBER, kevin.id),
  ]);

  const launch = await prisma.project.upsert({
    where: { id: "00000000-0000-0000-0000-000000000101" },
    update: {
      description: "Coordinate launch readiness across product, content, and operations.",
      name: "Product Launch",
      visibility: ProjectVisibility.WORKSPACE,
    },
    create: {
      id: "00000000-0000-0000-0000-000000000101",
      workspaceId: workspace.id,
      name: "Product Launch",
      description: "Coordinate launch readiness across product, content, and operations.",
      visibility: ProjectVisibility.WORKSPACE,
      createdById: kevin.id,
    },
  });

  const onboarding = await prisma.project.upsert({
    where: { id: "00000000-0000-0000-0000-000000000102" },
    update: {
      description: "Move new clients from signed agreement to kickoff.",
      name: "Client Onboarding",
      visibility: ProjectVisibility.PRIVATE,
    },
    create: {
      id: "00000000-0000-0000-0000-000000000102",
      workspaceId: workspace.id,
      name: "Client Onboarding",
      description: "Move new clients from signed agreement to kickoff.",
      visibility: ProjectVisibility.PRIVATE,
      createdById: maya.id,
    },
  });

  await Promise.all([
    upsertProjectMember(launch.id, kevin.id, ProjectRole.PROJECT_ADMIN),
    upsertProjectMember(launch.id, maya.id, ProjectRole.EDITOR),
    upsertProjectMember(onboarding.id, maya.id, ProjectRole.PROJECT_ADMIN),
    upsertProjectMember(onboarding.id, kevin.id, ProjectRole.EDITOR),
  ]);

  const todo = await upsertSection(workspace.id, launch.id, "To Do", "1000");
  const doing = await upsertSection(workspace.id, launch.id, "Doing", "2000");
  const done = await upsertSection(workspace.id, launch.id, "Done", "3000");
  const intake = await upsertSection(workspace.id, onboarding.id, "Intake", "1000");
  const setup = await upsertSection(workspace.id, onboarding.id, "Setup", "2000");
  const launchLabel = await upsertTaskLabel(workspace.id, "00000000-0000-0000-0000-000000000501", "Launch", "#2563eb");
  const riskLabel = await upsertTaskLabel(workspace.id, "00000000-0000-0000-0000-000000000502", "Risk", "#dc2626");
  const clientLabel = await upsertTaskLabel(workspace.id, "00000000-0000-0000-0000-000000000503", "Client", "#16a34a");

  const launchTask = await prisma.task.upsert({
    where: { id: "00000000-0000-0000-0000-000000000201" },
    update: {
      description: "Confirm owners, fallback plan, and launch-day communication sequence.",
      dueDate: new Date("2026-07-03"),
      priority: TaskPriority.HIGH,
      sectionId: doing.id,
      status: TaskStatus.IN_PROGRESS,
      title: "Finalize launch checklist",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000201",
      workspaceId: workspace.id,
      projectId: launch.id,
      sectionId: doing.id,
      title: "Finalize launch checklist",
      description: "Confirm owners, fallback plan, and launch-day communication sequence.",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      dueDate: new Date("2026-07-03"),
      position: "1000",
      assignees: {
        create: [
          { workspaceId: workspace.id, userId: kevin.id, assignedById: maya.id },
          { workspaceId: workspace.id, userId: maya.id, assignedById: kevin.id },
        ],
      },
      subtasks: {
        create: [
          { workspaceId: workspace.id, title: "Confirm rollback owner", status: TaskStatus.DONE, position: "1000" },
          { workspaceId: workspace.id, title: "Publish command-center notes", position: "2000" },
        ],
      },
      comments: {
        create: {
          workspaceId: workspace.id,
          authorId: maya.id,
          body: "Need final confirmation on the support escalation owner.",
        },
      },
    },
  });

  const announcementTask = await prisma.task.upsert({
    where: { id: "00000000-0000-0000-0000-000000000202" },
    update: {
      description: "Prepare email and in-app copy for launch communications.",
      dueDate: new Date("2026-07-06"),
      priority: TaskPriority.MEDIUM,
      sectionId: todo.id,
      title: "Draft customer announcement",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000202",
      workspaceId: workspace.id,
      projectId: launch.id,
      sectionId: todo.id,
      title: "Draft customer announcement",
      description: "Prepare email and in-app copy for launch communications.",
      priority: TaskPriority.MEDIUM,
      dueDate: new Date("2026-07-06"),
      position: "1000",
      assignees: {
        create: { workspaceId: workspace.id, userId: jon.id, assignedById: kevin.id },
      },
    },
  });

  await prisma.task.upsert({
    where: { id: "00000000-0000-0000-0000-000000000203" },
    update: {
      completedAt: seedNow,
      dueDate: new Date("2026-06-27"),
      priority: TaskPriority.LOW,
      sectionId: done.id,
      status: TaskStatus.DONE,
      title: "Book launch review meeting",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000203",
      workspaceId: workspace.id,
      projectId: launch.id,
      sectionId: done.id,
      title: "Book launch review meeting",
      status: TaskStatus.DONE,
      completedAt: seedNow,
      priority: TaskPriority.LOW,
      dueDate: new Date("2026-06-27"),
      position: "1000",
    },
  });

  const stakeholderTask = await prisma.task.upsert({
    where: { id: "00000000-0000-0000-0000-000000000204" },
    update: {
      dueDate: new Date("2026-07-05"),
      priority: TaskPriority.MEDIUM,
      sectionId: intake.id,
      title: "Collect stakeholder contacts",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000204",
      workspaceId: workspace.id,
      projectId: onboarding.id,
      sectionId: intake.id,
      title: "Collect stakeholder contacts",
      priority: TaskPriority.MEDIUM,
      dueDate: new Date("2026-07-05"),
      position: "1000",
      assignees: {
        create: { workspaceId: workspace.id, userId: maya.id, assignedById: kevin.id },
      },
    },
  });

  const kickoffTask = await prisma.task.upsert({
    where: { id: "00000000-0000-0000-0000-000000000205" },
    update: {
      dueDate: new Date("2026-07-07"),
      priority: TaskPriority.HIGH,
      sectionId: setup.id,
      title: "Prepare kickoff workspace",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000205",
      workspaceId: workspace.id,
      projectId: onboarding.id,
      sectionId: setup.id,
      title: "Prepare kickoff workspace",
      priority: TaskPriority.HIGH,
      dueDate: new Date("2026-07-07"),
      position: "1000",
      assignees: {
        create: { workspaceId: workspace.id, userId: kevin.id, assignedById: maya.id },
      },
    },
  });

  const qaTask = await prisma.task.upsert({
    where: { id: "00000000-0000-0000-0000-000000000206" },
    update: {
      description: "Run signup, invite, dependency, and notification flows before launch.",
      dueDate: new Date("2026-07-02"),
      priority: TaskPriority.URGENT,
      sectionId: todo.id,
      title: "QA signup and invite flow",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000206",
      workspaceId: workspace.id,
      projectId: launch.id,
      sectionId: todo.id,
      title: "QA signup and invite flow",
      description: "Run signup, invite, dependency, and notification flows before launch.",
      priority: TaskPriority.URGENT,
      dueDate: new Date("2026-07-02"),
      position: "0500",
      assignees: {
        create: { workspaceId: workspace.id, userId: maya.id, assignedById: kevin.id },
      },
    },
  });

  const weeklyPulseTask = await prisma.task.upsert({
    where: { id: "00000000-0000-0000-0000-000000000207" },
    update: {
      description: "Recurring client-facing checkpoint while onboarding is active.",
      dueDate: new Date("2026-07-10"),
      priority: TaskPriority.MEDIUM,
      recurrenceFrequency: TaskRecurrenceFrequency.WEEKLY,
      recurrenceInterval: 1,
      sectionId: setup.id,
      title: "Send weekly onboarding pulse",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000207",
      workspaceId: workspace.id,
      projectId: onboarding.id,
      sectionId: setup.id,
      title: "Send weekly onboarding pulse",
      description: "Recurring client-facing checkpoint while onboarding is active.",
      priority: TaskPriority.MEDIUM,
      dueDate: new Date("2026-07-10"),
      recurrenceFrequency: TaskRecurrenceFrequency.WEEKLY,
      recurrenceInterval: 1,
      position: "2000",
      assignees: {
        create: { workspaceId: workspace.id, userId: maya.id, assignedById: kevin.id },
      },
    },
  });

  await Promise.all([
    upsertTaskLabelAssignment(workspace.id, launchTask.id, launchLabel.id, maya.id),
    upsertTaskLabelAssignment(workspace.id, launchTask.id, riskLabel.id, maya.id),
    upsertTaskLabelAssignment(workspace.id, announcementTask.id, launchLabel.id, kevin.id),
    upsertTaskLabelAssignment(workspace.id, qaTask.id, riskLabel.id, kevin.id),
    upsertTaskLabelAssignment(workspace.id, stakeholderTask.id, clientLabel.id, maya.id),
    upsertTaskLabelAssignment(workspace.id, kickoffTask.id, clientLabel.id, maya.id),
    upsertTaskLabelAssignment(workspace.id, weeklyPulseTask.id, clientLabel.id, maya.id),
    upsertTaskWatcher(workspace.id, launchTask.id, jon.id, kevin.id),
    upsertTaskWatcher(workspace.id, qaTask.id, kevin.id, maya.id),
    upsertTaskDependency(workspace.id, "00000000-0000-0000-0000-000000000801", qaTask.id, launchTask.id, kevin.id),
    upsertTaskDependency(workspace.id, "00000000-0000-0000-0000-000000000802", launchTask.id, announcementTask.id, kevin.id),
    upsertWorkspaceNotificationPreference(workspace.id, kevin.id, true),
    upsertWorkspaceNotificationPreference(workspace.id, maya.id, true),
  ]);

  await prisma.projectMessage.upsert({
    where: { id: "00000000-0000-0000-0000-000000000601" },
    update: {
      body: "Dependency map shows QA -> launch checklist -> announcement as the current launch chain.",
      pinnedAt: seedNow,
      pinnedById: kevin.id,
      title: "Launch room operating note",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000601",
      workspaceId: workspace.id,
      projectId: launch.id,
      authorId: kevin.id,
      title: "Launch room operating note",
      body: "Dependency map shows QA -> launch checklist -> announcement as the current launch chain.",
      pinnedAt: seedNow,
      pinnedById: kevin.id,
    },
  });

  await seedOnboardingTemplate(workspace.id, maya.id, clientLabel.id);

  await prisma.activityEvent.upsert({
    where: { id: "00000000-0000-0000-0000-000000000301" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000301",
      workspaceId: workspace.id,
      projectId: launch.id,
      taskId: launchTask.id,
      actorUserId: kevin.id,
      eventType: "TaskCreated",
      entityType: "task",
      entityId: launchTask.id,
      payload: { title: launchTask.title },
    },
  });

  await prisma.activityEvent.upsert({
    where: { id: "00000000-0000-0000-0000-000000000302" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000302",
      workspaceId: workspace.id,
      projectId: launch.id,
      taskId: launchTask.id,
      actorUserId: maya.id,
      eventType: "CommentCreated",
      entityType: "comment",
      entityId: launchTask.id,
      payload: { preview: "Need final confirmation on the support escalation owner." },
    },
  });

  await prisma.notification.upsert({
    where: { id: "00000000-0000-0000-0000-000000000401" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000401",
      workspaceId: workspace.id,
      recipientId: kevin.id,
      taskId: launchTask.id,
      type: "task.comment.created",
      title: "New comment on Finalize launch checklist",
      body: "Maya Chen commented on a task assigned to you.",
    },
  });
}

async function upsertSection(workspaceId: string, projectId: string, name: string, position: string) {
  const existing = await prisma.section.findFirst({
    where: { workspaceId, projectId, name, deletedAt: null },
  });

  if (existing) return existing;

  return prisma.section.create({
    data: {
      workspaceId,
      projectId,
      name,
      position,
    },
  });
}

async function upsertWorkspaceMember(workspaceId: string, userId: string, role: WorkspaceRole, invitedById?: string) {
  return prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { userId, workspaceId } },
    update: { deletedAt: null, invitedById, joinedAt: seedNow, role },
    create: { invitedById, joinedAt: seedNow, role, userId, workspaceId },
  });
}

async function upsertProjectMember(projectId: string, userId: string, role: ProjectRole) {
  return prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: { deletedAt: null, role },
    create: { projectId, role, userId },
  });
}

async function upsertTaskLabel(workspaceId: string, id: string, name: string, color: string) {
  return prisma.taskLabel.upsert({
    where: { workspaceId_name: { name, workspaceId } },
    update: { color, deletedAt: null },
    create: { color, id, name, workspaceId },
  });
}

async function upsertTaskLabelAssignment(workspaceId: string, taskId: string, labelId: string, assignedById: string) {
  return prisma.taskLabelAssignment.upsert({
    where: { taskId_labelId: { labelId, taskId } },
    update: { assignedById },
    create: { assignedById, labelId, taskId, workspaceId },
  });
}

async function upsertTaskWatcher(workspaceId: string, taskId: string, userId: string, watchedById: string) {
  return prisma.taskWatcher.upsert({
    where: { taskId_userId: { taskId, userId } },
    update: { watchedById },
    create: { taskId, userId, watchedById, workspaceId },
  });
}

async function upsertTaskDependency(workspaceId: string, id: string, blockingTaskId: string, blockedTaskId: string, createdById: string) {
  return prisma.taskDependency.upsert({
    where: { blockingTaskId_blockedTaskId: { blockedTaskId, blockingTaskId } },
    update: { createdById },
    create: { blockedTaskId, blockingTaskId, createdById, id, workspaceId },
  });
}

async function upsertWorkspaceNotificationPreference(workspaceId: string, userId: string, emailEnabled: boolean) {
  return prisma.workspaceNotificationPreference.upsert({
    where: { workspaceId_userId: { userId, workspaceId } },
    update: { emailEnabled },
    create: { emailEnabled, userId, workspaceId },
  });
}

async function seedOnboardingTemplate(workspaceId: string, createdById: string, clientLabelId: string) {
  const template = await prisma.projectTemplate.upsert({
    where: { id: "00000000-0000-0000-0000-000000000701" },
    update: {
      description: "Reusable kickoff plan with contact capture, workspace setup, and weekly pulse tasks.",
      name: "Client Onboarding Playbook",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000701",
      workspaceId,
      createdById,
      name: "Client Onboarding Playbook",
      description: "Reusable kickoff plan with contact capture, workspace setup, and weekly pulse tasks.",
    },
  });
  const intakeSection = await prisma.projectTemplateSection.upsert({
    where: { id: "00000000-0000-0000-0000-000000000702" },
    update: { name: "Intake", position: "1000" },
    create: {
      id: "00000000-0000-0000-0000-000000000702",
      workspaceId,
      templateId: template.id,
      name: "Intake",
      position: "1000",
    },
  });
  const setupSection = await prisma.projectTemplateSection.upsert({
    where: { id: "00000000-0000-0000-0000-000000000703" },
    update: { name: "Setup", position: "2000" },
    create: {
      id: "00000000-0000-0000-0000-000000000703",
      workspaceId,
      templateId: template.id,
      name: "Setup",
      position: "2000",
    },
  });
  const intakeTask = await prisma.projectTemplateTask.upsert({
    where: { id: "00000000-0000-0000-0000-000000000704" },
    update: {
      description: "Confirm decision makers, billing contacts, and launch stakeholders.",
      dueDateOffsetDays: 0,
      priority: TaskPriority.HIGH,
      sectionId: intakeSection.id,
      title: "Collect stakeholder contacts",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000704",
      workspaceId,
      templateId: template.id,
      sectionId: intakeSection.id,
      title: "Collect stakeholder contacts",
      description: "Confirm decision makers, billing contacts, and launch stakeholders.",
      priority: TaskPriority.HIGH,
      dueDateOffsetDays: 0,
      position: "1000",
    },
  });
  const setupTask = await prisma.projectTemplateTask.upsert({
    where: { id: "00000000-0000-0000-0000-000000000705" },
    update: {
      description: "Create kickoff project, recurring pulse task, and shared launch notes.",
      dueDateOffsetDays: 2,
      priority: TaskPriority.MEDIUM,
      sectionId: setupSection.id,
      title: "Prepare kickoff workspace",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000705",
      workspaceId,
      templateId: template.id,
      sectionId: setupSection.id,
      title: "Prepare kickoff workspace",
      description: "Create kickoff project, recurring pulse task, and shared launch notes.",
      priority: TaskPriority.MEDIUM,
      dueDateOffsetDays: 2,
      position: "1000",
    },
  });

  await Promise.all([
    upsertProjectTemplateTaskAssignee(workspaceId, intakeTask.id, createdById),
    upsertProjectTemplateTaskAssignee(workspaceId, setupTask.id, createdById),
    upsertProjectTemplateTaskLabelAssignment(workspaceId, intakeTask.id, clientLabelId),
    upsertProjectTemplateTaskLabelAssignment(workspaceId, setupTask.id, clientLabelId),
  ]);
}

async function upsertProjectTemplateTaskAssignee(workspaceId: string, templateTaskId: string, userId: string) {
  return prisma.projectTemplateTaskAssignee.upsert({
    where: { templateTaskId_userId: { templateTaskId, userId } },
    update: {},
    create: { templateTaskId, userId, workspaceId },
  });
}

async function upsertProjectTemplateTaskLabelAssignment(workspaceId: string, templateTaskId: string, labelId: string) {
  return prisma.projectTemplateTaskLabelAssignment.upsert({
    where: { templateTaskId_labelId: { labelId, templateTaskId } },
    update: {},
    create: { labelId, templateTaskId, workspaceId },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
