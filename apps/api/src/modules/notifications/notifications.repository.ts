import { paginationArgs } from "../../shared/pagination.js";
import { WorkRepositoryBase } from "../work/work-repository-base.js";

export class NotificationsRepository extends WorkRepositoryBase {
  listNotifications(input: { cursor?: string; limit: number; recipientId: string; unreadOnly?: boolean; workspaceId: string }) {
    return this.prisma.notification.findMany({
      ...paginationArgs(input),
      orderBy: { createdAt: "desc" },
      where: {
        recipientId: input.recipientId,
        status: input.unreadOnly ? "UNREAD" : undefined,
        workspaceId: input.workspaceId,
      },
    });
  }

  markNotificationRead(input: { notificationId: string; recipientId: string; workspaceId: string }) {
    return this.prisma.notification.updateMany({
      data: { readAt: new Date(), status: "READ" },
      where: { id: input.notificationId, recipientId: input.recipientId, workspaceId: input.workspaceId },
    });
  }

  markAllNotificationsRead(input: { recipientId: string; workspaceId: string }) {
    return this.prisma.notification.updateMany({
      data: { readAt: new Date(), status: "READ" },
      where: { recipientId: input.recipientId, status: "UNREAD", workspaceId: input.workspaceId },
    });
  }

  findNotificationPreference(input: { userId: string; workspaceId: string }) {
    return this.prisma.workspaceNotificationPreference.findUnique({
      where: { workspaceId_userId: { userId: input.userId, workspaceId: input.workspaceId } },
    });
  }

  upsertNotificationPreference(input: { emailEnabled: boolean; userId: string; workspaceId: string }) {
    return this.prisma.workspaceNotificationPreference.upsert({
      create: input,
      update: { emailEnabled: input.emailEnabled },
      where: { workspaceId_userId: { userId: input.userId, workspaceId: input.workspaceId } },
    });
  }
}
