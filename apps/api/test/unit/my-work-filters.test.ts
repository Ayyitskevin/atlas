import { describe, expect, it } from "vitest";

import { myWorkDependencyWhere, myWorkDueDateWhere, myWorkScopeWhere, myWorkStatusWhere } from "../../src/modules/work/my-work-filters.js";

const now = new Date("2026-06-30T15:45:00.000Z");

describe("my work filters", () => {
  it("builds status filters for assigned-task views", () => {
    expect(myWorkStatusWhere("open")).toEqual({ status: { not: "DONE" } });
    expect(myWorkStatusWhere("done")).toEqual({ status: "DONE" });
    expect(myWorkStatusWhere("all")).toEqual({});
  });

  it("builds UTC due-date windows", () => {
    expect(myWorkDueDateWhere("overdue", now)).toEqual({ dueDate: { lt: new Date("2026-06-30T00:00:00.000Z") } });
    expect(myWorkDueDateWhere("today", now)).toEqual({
      dueDate: { gte: new Date("2026-06-30T00:00:00.000Z"), lt: new Date("2026-07-01T00:00:00.000Z") },
    });
    expect(myWorkDueDateWhere("next7", now)).toEqual({
      dueDate: { gte: new Date("2026-06-30T00:00:00.000Z"), lt: new Date("2026-07-08T00:00:00.000Z") },
    });
    expect(myWorkDueDateWhere("unscheduled", now)).toEqual({ dueDate: null });
    expect(myWorkDueDateWhere("any", now)).toEqual({});
  });

  it("builds dependency triage filters", () => {
    expect(myWorkDependencyWhere("blocked", "workspace-1")).toEqual({
      dependenciesAsBlocked: {
        some: {
          blockingTask: { deletedAt: null, status: { not: "DONE" }, workspaceId: "workspace-1" },
          workspaceId: "workspace-1",
        },
      },
      status: { not: "DONE" },
    });
    expect(myWorkDependencyWhere("blocking", "workspace-1")).toEqual({
      dependenciesAsBlocker: {
        some: {
          blockedTask: { deletedAt: null, status: { not: "DONE" }, workspaceId: "workspace-1" },
          workspaceId: "workspace-1",
        },
      },
      status: { not: "DONE" },
    });
    expect(myWorkDependencyWhere("any", "workspace-1")).toEqual({});
  });

  it("builds ownership scope filters", () => {
    expect(myWorkScopeWhere("assigned", "user-1", "workspace-1")).toEqual({
      assignees: { some: { userId: "user-1", workspaceId: "workspace-1" } },
    });
    expect(myWorkScopeWhere("watching", "user-1", "workspace-1")).toEqual({
      watchers: { some: { userId: "user-1", workspaceId: "workspace-1" } },
    });
    expect(myWorkScopeWhere("all", "user-1", "workspace-1")).toEqual({
      OR: [
        { assignees: { some: { userId: "user-1", workspaceId: "workspace-1" } } },
        { watchers: { some: { userId: "user-1", workspaceId: "workspace-1" } } },
      ],
    });
  });
});
