import type { AuthContext } from "../../shared/auth-context.js";
import {
  pageFromLimit } from "../../shared/pagination.js";
import {
  type ActivityQuery,
} from "@atlas/shared";
import { WorkDomainBase } from "../work/work-domain-base.js";

export class ActivityService extends WorkDomainBase {
  async listActivity(ctx: AuthContext, workspaceId: string, query: ActivityQuery) {
    if (query.taskId) {
      await this.permissions.requireTaskRole(ctx, workspaceId, query.taskId, "VIEWER");
    } else if (query.projectId) {
      await this.permissions.requireProjectRole(ctx, workspaceId, query.projectId, "VIEWER");
    } else {
      await this.permissions.requireWorkspaceRole(ctx, workspaceId, "ADMIN");
    }
    return pageFromLimit(await this.activityRepo.listActivity({ ...query, workspaceId }), query.limit);
  }

}
