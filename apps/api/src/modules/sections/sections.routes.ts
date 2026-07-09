import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createSectionRequestSchema,
  cursorPaginationQuerySchema,
  reorderSectionsRequestSchema,
  updateSectionRequestSchema
} from "@atlas/shared";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { createSectionsService } from "../work/create-work-service.js";
import { SectionsController } from "./sections.controller.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const projectParamsSchema = workspaceParamsSchema.extend({ projectId: z.string().uuid() });
const sectionParamsSchema = projectParamsSchema.extend({ sectionId: z.string().uuid() });

export async function registerSectionsRoutes(app: FastifyInstance): Promise<void> {
  const controller = new SectionsController(createSectionsService());

    app.post("/workspaces/:workspaceId/projects/:projectId/sections", { schema: openApiSchema({ body: createSectionRequestSchema, params: projectParamsSchema, tags: ["Sections"] }) }, controller.createSection);
    app.get("/workspaces/:workspaceId/projects/:projectId/sections", { schema: openApiSchema({ params: projectParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Sections"] }) }, controller.listSections);
    app.patch("/workspaces/:workspaceId/projects/:projectId/sections/:sectionId", { schema: openApiSchema({ body: updateSectionRequestSchema, params: sectionParamsSchema, tags: ["Sections"] }) }, controller.updateSection);
    app.delete("/workspaces/:workspaceId/projects/:projectId/sections/:sectionId", { schema: openApiSchema({ params: sectionParamsSchema, tags: ["Sections"] }) }, controller.deleteSection);
    app.post("/workspaces/:workspaceId/projects/:projectId/sections/reorder", { schema: openApiSchema({ body: reorderSectionsRequestSchema, params: projectParamsSchema, tags: ["Sections"] }) }, controller.reorderSections);
}
