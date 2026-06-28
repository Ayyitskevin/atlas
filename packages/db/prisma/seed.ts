import { PrismaClient, ProjectRole, ProjectVisibility, TaskPriority, TaskStatus, WorkspaceRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "kevin@example.com" },
      update: {},
      create: {
        email: "kevin@example.com",
        name: "Kevin Lee",
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$seed$replace-in-auth-phase",
      },
    }),
    prisma.user.upsert({
      where: { email: "maya@example.com" },
      update: {},
      create: {
        email: "maya@example.com",
        name: "Maya Chen",
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$seed$replace-in-auth-phase",
      },
    }),
    prisma.user.upsert({
      where: { email: "jon@example.com" },
      update: {},
      create: {
        email: "jon@example.com",
        name: "Jon Bell",
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$seed$replace-in-auth-phase",
      },
    }),
  ]);

  const [kevin, maya, jon] = users;

  const workspace = await prisma.workspace.upsert({
    where: { slug: "atlas-demo" },
    update: {},
    create: {
      name: "Atlas Demo Workspace",
      slug: "atlas-demo",
      ownerId: kevin.id,
      members: {
        create: [
          { userId: kevin.id, role: WorkspaceRole.OWNER, joinedAt: new Date() },
          { userId: maya.id, role: WorkspaceRole.ADMIN, joinedAt: new Date() },
          { userId: jon.id, role: WorkspaceRole.MEMBER, joinedAt: new Date() },
        ],
      },
    },
  });

  const launch = await prisma.project.upsert({
    where: { id: "00000000-0000-0000-0000-000000000101" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000101",
      workspaceId: workspace.id,
      name: "Product Launch",
      description: "Coordinate launch readiness across product, content, and operations.",
      visibility: ProjectVisibility.WORKSPACE,
      createdById: kevin.id,
      members: {
        create: [
          { userId: kevin.id, role: ProjectRole.PROJECT_ADMIN },
          { userId: maya.id, role: ProjectRole.EDITOR },
        ],
      },
    },
  });

  const onboarding = await prisma.project.upsert({
    where: { id: "00000000-0000-0000-0000-000000000102" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000102",
      workspaceId: workspace.id,
      name: "Client Onboarding",
      description: "Move new clients from signed agreement to kickoff.",
      visibility: ProjectVisibility.PRIVATE,
      createdById: maya.id,
      members: {
        create: [
          { userId: maya.id, role: ProjectRole.PROJECT_ADMIN },
          { userId: kevin.id, role: ProjectRole.EDITOR },
        ],
      },
    },
  });

  const todo = await upsertSection(workspace.id, launch.id, "To Do", "1000");
  const doing = await upsertSection(workspace.id, launch.id, "Doing", "2000");
  const done = await upsertSection(workspace.id, launch.id, "Done", "3000");
  const intake = await upsertSection(workspace.id, onboarding.id, "Intake", "1000");
  const setup = await upsertSection(workspace.id, onboarding.id, "Setup", "2000");

  const launchTask = await prisma.task.upsert({
    where: { id: "00000000-0000-0000-0000-000000000201" },
    update: {},
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

  await prisma.task.upsert({
    where: { id: "00000000-0000-0000-0000-000000000202" },
    update: {},
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
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000203",
      workspaceId: workspace.id,
      projectId: launch.id,
      sectionId: done.id,
      title: "Book launch review meeting",
      status: TaskStatus.DONE,
      completedAt: new Date(),
      priority: TaskPriority.LOW,
      dueDate: new Date("2026-06-27"),
      position: "1000",
    },
  });

  await prisma.task.upsert({
    where: { id: "00000000-0000-0000-0000-000000000204" },
    update: {},
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

  await prisma.task.upsert({
    where: { id: "00000000-0000-0000-0000-000000000205" },
    update: {},
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

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
