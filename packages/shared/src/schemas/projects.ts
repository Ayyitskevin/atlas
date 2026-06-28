import { z } from "zod";

import { projectVisibilitySchema } from "../domain.js";

export const createProjectRequestSchema = z.object({
  description: z.string().max(4000).optional(),
  name: z.string().min(1).max(160),
  visibility: projectVisibilitySchema.default("WORKSPACE"),
});

export const updateProjectRequestSchema = createProjectRequestSchema.partial();

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
