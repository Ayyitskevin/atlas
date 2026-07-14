import { describe, expect, it } from "vitest";

import { moveItemById, nextTaskPosition, sectionPositionPayload } from "./board-utils";
import type { Section, Task } from "../shared/atlas-types";

const sections: Section[] = [
  { id: "todo", name: "To do" },
  { id: "doing", name: "Doing" },
  { id: "done", name: "Done" },
];

const task = (input: Partial<Task> & Pick<Task, "id" | "sectionId">): Task => ({
  id: input.id,
  priority: "MEDIUM",
  projectId: "project-1",
  sectionId: input.sectionId,
  status: "TODO",
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
});
