import type { TaskDependencies, TaskDependencyEdge } from "../shared/atlas-types";

export function openDependencyBlockers(dependencies: TaskDependencies) {
  return dependencies.blockedBy.filter((edge) => edge.task.status !== "DONE");
}

export function readyDependencyBlockers(dependencies: TaskDependencies) {
  return openDependencyBlockers(dependencies).filter((edge) => (edge.task.dependencySummary?.blockedByOpenCount ?? 0) === 0);
}

export function dependencyTaskIds(edges: TaskDependencyEdge[]) {
  return edges.map((edge) => edge.task.id);
}
