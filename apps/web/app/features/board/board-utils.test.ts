import { describe, expect, it } from "vitest";

import {
  emptyBoardTaskFilters,
  filterBoardTasks,
  isConflictErrorMessage,
  moveItemById,
  nextTaskPosition,
  sectionPositionPayload,
  toggleSelection,
} from "./board-utils";
import type { Section, Task } from "../shared/atlas-types";

const sections: Section[] = [
  { id: "todo", name: "To do" },
  { id: "doing", name: "Doing" },
  { id: "done", name: "Done" },
];

const task = (input: Partial<Task> & Pick<Task, "id" | "sectionId">): Task => ({
  assignees: input.assignees,
  id: input.id,
  priority: input.priority ?? "MEDIUM",
  projectId: "project-1",
  sectionId: input.sectionId,
  status: input.status ?? "TODO",
  title: input.title ?? input.id,
  version: input.version ?? 0,
  position: input.position,
});

describe("board utils", () => {
  it("moves items by id within bounds", () => {
    expect(moveItemById(sections, "doing", -1).map((section) => section.id)).toEqual(["doing", "todo", "done"]);
    expect(moveItemById(sections, "doing", 1).map((section) => section.id)).toEqual(["todo", "done", "doing"]);
    expect(moveItemById(sections, "todo", -1)).toBe(sections);
    expect(moveItemById(sections, "missing", 1)).toBe(sections);
  });

  it("creates stable section position payloads", () => {
    expect(sectionPositionPayload(sections)).toEqual([
      { id: "todo", position: 1000 },
      { id: "doing", position: 2000 },
      { id: "done", position: 3000 },
    ]);
  });

  it("places moved tasks after the target section tail", () => {
    expect(nextTaskPosition([task({ id: "a", position: 1000, sectionId: "todo" })], "todo")).toBe(2000);
    expect(nextTaskPosition([task({ id: "a", position: "7000", sectionId: "todo" })], "todo")).toBe(8000);
    expect(nextTaskPosition([], "todo")).toBe(1000);
  });

  it("filters board tasks by status, priority, and assignee", () => {
    const tasks = [
      task({ id: "a", sectionId: "todo", status: "TODO", priority: "HIGH", assignees: [{ id: "1", taskId: "a", userId: "u1" }] as Task["assignees"] }),
      task({ id: "b", sectionId: "todo", status: "DONE", priority: "LOW", assignees: [{ id: "2", taskId: "b", userId: "u2" }] as Task["assignees"] }),
    ];
    expect(filterBoardTasks(tasks, { ...emptyBoardTaskFilters, status: "DONE" }).map((item) => item.id)).toEqual(["b"]);
    expect(filterBoardTasks(tasks, { ...emptyBoardTaskFilters, priority: "HIGH" }).map((item) => item.id)).toEqual(["a"]);
    expect(filterBoardTasks(tasks, { ...emptyBoardTaskFilters, assigneeId: "u2" }).map((item) => item.id)).toEqual(["b"]);
  });

  it("toggles selection and detects conflict messages", () => {
    expect(toggleSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSelection(["a", "b"], "a")).toEqual(["b"]);
    expect(isConflictErrorMessage("Version conflict on task")).toBe(true);
    expect(isConflictErrorMessage("Not found")).toBe(false);
  });
});
