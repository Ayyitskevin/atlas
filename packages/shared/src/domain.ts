import { z } from "zod";

export const workspaceRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "GUEST"]);
export const projectRoleSchema = z.enum(["PROJECT_ADMIN", "EDITOR", "COMMENTER", "VIEWER"]);
export const projectVisibilitySchema = z.enum(["WORKSPACE", "PRIVATE"]);
export const taskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const taskRecurrenceFrequencySchema = z.enum(["DAILY", "WEEKLY", "MONTHLY"]);

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type ProjectRole = z.infer<typeof projectRoleSchema>;
export type ProjectVisibility = z.infer<typeof projectVisibilitySchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskRecurrenceFrequency = z.infer<typeof taskRecurrenceFrequencySchema>;
