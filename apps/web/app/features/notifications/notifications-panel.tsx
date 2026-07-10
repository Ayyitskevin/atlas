"use client";

import type { Notification } from "../shared/atlas-types";

type NotificationFilter = "all" | "unread";

type NotificationsPanelProps = {
  emailNotificationsEnabled: boolean;
  filter: NotificationFilter;
  notifications: Notification[];
  onEmailNotificationsChange: (enabled: boolean) => Promise<void>;
  onFilterChange: (filter: NotificationFilter) => void;
  onMarkAllRead: () => Promise<void>;
  onMarkRead: (notificationId: string) => Promise<void>;
  onOpenTask: (taskId: string, notificationId: string) => Promise<void>;
  preferenceStatus: string;
  unreadCount: number;
  workspaceSelected: boolean;
};

export function NotificationsPanel({
  emailNotificationsEnabled,
  filter,
  notifications,
  onEmailNotificationsChange,
  onFilterChange,
  onMarkAllRead,
  onMarkRead,
  onOpenTask,
  preferenceStatus,
  unreadCount,
  workspaceSelected,
}: NotificationsPanelProps) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">Notifications</h2>
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-950">{unreadCount}</span> unread
            {unreadCount > 0 ? " · open a card to jump to the task" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
            <button
              className={`px-3 py-2 font-medium ${filter === "unread" ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}
              onClick={() => onFilterChange("unread")}
              type="button"
            >
              Unread
            </button>
            <button
              className={`border-l border-slate-300 px-3 py-2 font-medium ${filter === "all" ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}
              onClick={() => onFilterChange("all")}
              type="button"
            >
              All
            </button>
          </div>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!workspaceSelected || unreadCount === 0}
            onClick={() => void onMarkAllRead()}
            type="button"
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <div>
          <p className="font-medium text-slate-900">Task email updates</p>
          <p className="text-xs text-slate-500">Mentions and assignments email when enabled (Resend or noop stub).</p>
          {preferenceStatus ? <p className="text-xs text-slate-500">{preferenceStatus}</p> : null}
        </div>
        <label className="inline-flex items-center gap-2 font-medium text-slate-700">
          <input
            checked={emailNotificationsEnabled}
            className="h-4 w-4 rounded border-slate-300"
            disabled={!workspaceSelected}
            onChange={(event) => void onEmailNotificationsChange(event.target.checked)}
            type="checkbox"
          />
          Email
        </label>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {notifications.length ? (
          notifications.map((notification) => {
            const canOpenTask = Boolean(notification.taskId);
            return (
              <article
                className={`rounded-md border px-3 py-2 text-sm ${notification.status === "UNREAD" ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"}`}
                key={notification.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{notification.title}</p>
                    <p className="mt-1 text-slate-600">{notification.body}</p>
                    <time className="mt-2 block text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString()}</time>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${
                      notification.status === "UNREAD" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {notification.status.toLowerCase()}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canOpenTask ? (
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                      onClick={() => notification.taskId && void onOpenTask(notification.taskId, notification.id)}
                      type="button"
                    >
                      Open task
                    </button>
                  ) : null}
                  {notification.status === "UNREAD" ? (
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                      onClick={() => void onMarkRead(notification.id)}
                      type="button"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            {filter === "unread" ? "No unread notifications." : "No notifications yet."}
          </p>
        )}
      </div>
    </section>
  );
}
