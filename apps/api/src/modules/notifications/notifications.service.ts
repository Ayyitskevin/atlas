import type { AuthContext } from "../../shared/auth-context.js";
import {
  pageFromLimit } from "../../shared/pagination.js";
import {
  type NotificationQuery,
  type UpdateNotificationPreferenceRequest,
} from "@atlas/shared";
import {
  notificationPreferenceResponse,
} from "../work/work-helpers.js";
import { WorkDomainBase } from "../work/work-domain-base.js";

export class NotificationsService extends WorkDomainBase {
  async listNotifications(ctx: AuthContext, workspaceId: string, query: NotificationQuery) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    return pageFromLimit(
      await this.notificationsRepo.listNotifications({ ...query, recipientId: ctx.userId, workspaceId }),
      query.limit,
    );
  }


  async getNotificationPreferences(ctx: AuthContext, workspaceId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    const preference = await this.notificationsRepo.findNotificationPreference({ userId: ctx.userId, workspaceId });
    return notificationPreferenceResponse({
      emailEnabled: preference?.emailEnabled ?? false,
      updatedAt: preference?.updatedAt ?? null,
      userId: ctx.userId,
      workspaceId,
    });
  }


  async updateNotificationPreferences(ctx: AuthContext, workspaceId: string, input: UpdateNotificationPreferenceRequest) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    const preference = await this.notificationsRepo.upsertNotificationPreference({
      emailEnabled: input.emailEnabled,
      userId: ctx.userId,
      workspaceId,
    });
    return notificationPreferenceResponse({
      emailEnabled: preference.emailEnabled,
      updatedAt: preference.updatedAt,
      userId: ctx.userId,
      workspaceId,
    });
  }


  async markNotificationRead(ctx: AuthContext, workspaceId: string, notificationId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    await this.notificationsRepo.markNotificationRead({ notificationId, recipientId: ctx.userId, workspaceId });
    return { ok: true };
  }


  async markAllNotificationsRead(ctx: AuthContext, workspaceId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    await this.notificationsRepo.markAllNotificationsRead({ recipientId: ctx.userId, workspaceId });
    return { ok: true };
  }

}
