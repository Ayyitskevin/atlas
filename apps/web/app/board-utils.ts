import type { Section, Task } from "./atlas-types";

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

function numericPosition(value: number | string | undefined) {
  const position = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(position) ? position : null;
}
