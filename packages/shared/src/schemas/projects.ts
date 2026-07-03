import { z } from "zod";

import { projectRoleSchema, projectVisibilitySchema } from "../domain.js";

export const createProjectRequestSchema = z.object({
  description: z.string().max(4000).optional(),
  name: z.string().min(1).max(160),
  visibility: projectVisibilitySchema.default("WORKSPACE"),
});

export const updateProjectRequestSchema = createProjectRequestSchema.partial();

export const createProjectTemplateFromProjectRequestSchema = z.object({
  description: z.string().trim().max(4000).optional(),
  name: z.string().trim().min(1).max(160).optional(),
});

export const createProjectFromTemplateRequestSchema = z.object({
  description: z.string().trim().max(4000).optional(),
  name: z.string().trim().min(1).max(160),
  visibility: projectVisibilitySchema.default("WORKSPACE"),
});

export const addProjectMemberRequestSchema = z.object({
  role: projectRoleSchema.default("EDITOR"),
  userId: z.string().uuid(),
});

export const updateProjectMemberRequestSchema = z.object({
  role: projectRoleSchema,
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type CreateProjectTemplateFromProjectRequest = z.infer<typeof createProjectTemplateFromProjectRequestSchema>;
export type CreateProjectFromTemplateRequest = z.infer<typeof createProjectFromTemplateRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
export type AddProjectMemberRequest = z.infer<typeof addProjectMemberRequestSchema>;
export type UpdateProjectMemberRequest = z.infer<typeof updateProjectMemberRequestSchema>;
