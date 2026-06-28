import { z } from "zod";

export const domainEventTypeSchema = z.enum([
  "WorkspaceCreated",
  "MemberInvited",
  "ProjectCreated",
  "ProjectArchived",
  "SectionCreated",
  "SectionsReordered",
  "TaskCreated",
  "TaskUpdated",
  "TaskMoved",
  "TaskAssigned",
  "TaskUnassigned",
  "TaskCompleted",
  "SubtaskCreated",
  "CommentCreated",
  "AttachmentAdded",
]);

export const domainEventSchema = z.object({
  actorUserId: z.string().uuid(),
  entityId: z.string().uuid(),
  eventId: z.string().uuid(),
  eventType: domainEventTypeSchema,
  occurredAt: z.string().datetime(),
  payload: z.record(z.unknown()),
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  version: z.number().int().nonnegative(),
  workspaceId: z.string().uuid(),
});

export type DomainEventType = z.infer<typeof domainEventTypeSchema>;
export type DomainEvent = z.infer<typeof domainEventSchema>;
