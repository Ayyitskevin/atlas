import { describe, expect, it } from "vitest";

import type { ActivityEvent, MyWorkTask, Notification, Project, Task, WorkspaceMember } from "./atlas-types";
import { recentActiveProjects, workspaceDashboardStats } from "./dashboard-utils";

describe("dashboard utilities", () => {
  it("summarizes workspace dashboard counts", () => {
    const projects = [
      { id: "project-1", name: "Active", visibility: "WORKSPACE" },
      { archivedAt: "2026-06-30T00:00:00.000Z", id: "project-2", name: "Archived", visibility: "PRIVATE" },
    ] as Project[];
    const tasks = [
      { id: "task-1", status: "TODO" },
      { id: "task-2", status: "DONE" },
    ] as Task[];
    const myWorkTasks = [
      { id: "task-1", status: "TODO" },
      { id: "task-2", status: "DONE" },
    ] as MyWorkTask[];
    const notifications = [
      { id: "notification-1", status: "UNREAD" },
      { id: "notification-2", status: "READ" },
    ] as Notification[];

    expect(
      workspaceDashboardStats({
        activities: [{ id: "activity-1" }] as ActivityEvent[],
        myWorkTasks,
        notifications,
        projects,
        tasks,
        workspaceMembers: [{ id: "member-1" }, { id: "member-2" }] as WorkspaceMember[],
      }),
    ).toEqual({
      activeProjects: 1,
      archivedProjects: 1,
      doneTasks: 1,
      openMyWork: 1,
      privateProjects: 1,
      recentActivity: 1,
      selectedProjectTasks: 2,
      unreadNotifications: 1,
      workspaceMembers: 2,
    });
  });

  it("returns only active projects for quick access", () => {
    const projects = [
      { id: "project-1", name: "Active 1", visibility: "WORKSPACE" },
      { archivedAt: "2026-06-30T00:00:00.000Z", id: "project-2", name: "Archived", visibility: "WORKSPACE" },
      { id: "project-3", name: "Active 2", visibility: "PRIVATE" },
    ] as Project[];

    expect(recentActiveProjects(projects).map((project) => project.id)).toEqual(["project-1", "project-3"]);
  });
});
