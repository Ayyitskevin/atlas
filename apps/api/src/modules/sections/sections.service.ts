import type { AuthContext } from "../../shared/auth-context.js";
import {
  AtlasHttpError } from "../../shared/errors.js";
import { pageFromLimit } from "../../shared/pagination.js";
import {
  ATLAS_ERROR_CODES,
  type CreateSectionRequest,
  type CursorPaginationQuery,
  type ReorderSectionsRequest,
  type UpdateSectionRequest,
} from "@atlas/shared";
import { defaultListPosition } from "../work/position.js";
import { WorkDomainBase } from "../work/work-domain-base.js";

export class SectionsService extends WorkDomainBase {
  async createSection(ctx: AuthContext, workspaceId: string, projectId: string, input: CreateSectionRequest) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    const section = await this.sectionsRepo.createSection({
      name: input.name,
      position: input.position ?? defaultListPosition(),
      projectId,
      workspaceId,
    });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: section.id,
      entityType: "section",
      eventType: "SectionCreated",
      projectId,
      workspaceId,
    });
    return section;
  }


  async listSections(ctx: AuthContext, workspaceId: string, projectId: string, query: CursorPaginationQuery) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "VIEWER");
    return pageFromLimit(await this.sectionsRepo.listSections({ ...query, projectId, workspaceId }), query.limit);
  }


  async updateSection(ctx: AuthContext, workspaceId: string, projectId: string, sectionId: string, input: UpdateSectionRequest) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    const section = await this.sectionsRepo.updateSection({ data: input, projectId, sectionId, workspaceId });
    if (!section) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Section not found in this Project.");
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: section.id,
      entityType: "section",
      eventType: "SectionUpdated",
      payload: { name: section.name, position: String(section.position) },
      projectId,
      workspaceId,
    });
    return section;
  }


  async deleteSection(ctx: AuthContext, workspaceId: string, projectId: string, sectionId: string) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    const section = await this.sectionsRepo.findSection({ projectId, sectionId, workspaceId });
    if (!section) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Section not found in this Project.");
    await this.sectionsRepo.softDeleteSection({ projectId, sectionId, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: section.id,
      entityType: "section",
      eventType: "SectionDeleted",
      payload: { name: section.name },
      projectId,
      workspaceId,
    });
    return { ok: true };
  }


  async reorderSections(ctx: AuthContext, workspaceId: string, projectId: string, input: ReorderSectionsRequest) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    await this.requireSectionsInProject(workspaceId, projectId, input.sections.map((section) => section.id));
    await this.sectionsRepo.reorderSections({ projectId, sections: input.sections, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: projectId,
      entityType: "project",
      eventType: "SectionsReordered",
      projectId,
      workspaceId,
    });
    return { ok: true };
  }

}
