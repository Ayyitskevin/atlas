import type { Section, Task, TaskPriority, TaskStatus } from "../shared/atlas-types";

export type BoardTaskFilters = {
  assigneeId: string;
  priority: TaskPriority | "any";
  status: TaskStatus | "any";
};

export const emptyBoardTaskFilters: BoardTaskFilters = {
  assigneeId: "any",
  priority: "any",
  status: "any",
};

export function moveItemById<T extends { id: string }>(items: T[], itemId: string, direction: -1 | 1) {
  const index = items.findIndex((item) => item.id === itemId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;
  const nextItems = [...items];
  const [item] = nextItems.splice(index, 1);
  if (!item) return items;
  nextItems.splice(nextIndex, 0, item);
  return nextItems;
}

export function sectionPositionPayload(sections: Section[]) {
  return sections.map((section, index) => ({ id: section.id, position: (index + 1) * 1000 }));
}

export function nextTaskPosition(tasks: Task[], sectionId: string) {
  const positions = tasks
    .filter((task) => task.sectionId === sectionId)
    .map((task) => numericPosition(task.position))
    .filter((position): position is number => position !== null);
  return (positions.length ? Math.max(...positions) : 0) + 1000;
}

export function filterBoardTasks(tasks: Task[], filters: BoardTaskFilters) {
  return tasks.filter((task) => {
    if (filters.status !== "any" && task.status !== filters.status) return false;
    if (filters.priority !== "any" && task.priority !== filters.priority) return false;
    if (filters.assigneeId !== "any") {
      const assigneeIds = (task.assignees ?? []).map((assignee) => assignee.userId);
      if (!assigneeIds.includes(filters.assigneeId)) return false;
    }
    return true;
  });
}

export function toggleSelection(selectedIds: string[], taskId: string) {
  return selectedIds.includes(taskId) ? selectedIds.filter((id) => id !== taskId) : [...selectedIds, taskId];
}

export function isConflictErrorMessage(message: string) {
  return /conflict|version|stale/i.test(message);
}

function numericPosition(value: number | string | undefined) {
  const position = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(position) ? position : null;
}
