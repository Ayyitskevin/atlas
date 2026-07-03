import { describe, expect, it } from "vitest";

import type { ActivityEvent, MyWorkTask, Notification, Project, Task, WorkspaceMember } from "./atlas-types";
import { myWorkPlanningCounts, recentActiveProjects, workspaceDashboardStats } from "./dashboard-utils";

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
      { dueDate: "2026-06-29", id: "task-1", status: "TODO" },
      { id: "task-2", status: "DONE" },
      { dueDate: "2026-06-30", id: "task-3", status: "TODO" },
      { dueDate: "2026-07-04", id: "task-4", status: "IN_PROGRESS" },
      { dueDate: null, id: "task-5", status: "TODO" },
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
      }, new Date("2026-06-30T15:45:00.000Z")),
    ).toEqual({
      activeProjects: 1,
      archivedProjects: 1,
      doneTasks: 1,
      openMyWork: 4,
      overdueMyWork: 1,
      privateProjects: 1,
      recentActivity: 1,
      selectedProjectTasks: 2,
      todayMyWork: 1,
      unreadNotifications: 1,
      upcomingMyWork: 1,
      unscheduledMyWork: 1,
      workspaceMembers: 2,
    });
  });

  it("summarizes open planning buckets without counting completed work", () => {
    const tasks = [
      { dueDate: "2026-06-29", id: "overdue", status: "TODO" },
      { dueDate: "2026-06-30", id: "today", status: "TODO" },
      { dueDate: "2026-07-03", id: "upcoming", status: "IN_PROGRESS" },
      { dueDate: "2026-07-20", id: "later", status: "TODO" },
      { dueDate: null, id: "unscheduled", status: "TODO" },
      { dueDate: "2026-06-29", id: "done", status: "DONE" },
    ] as MyWorkTask[];

    expect(myWorkPlanningCounts(tasks, new Date("2026-06-30T15:45:00.000Z"))).toEqual({
      overdue: 1,
      today: 1,
      upcoming: 1,
      unscheduled: 1,
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
