export type DependencyEdge = {
  blockedTaskId: string;
  blockingTaskId: string;
};

/**
 * A dependency edge `{ blockingTaskId, blockedTaskId }` means the blocking task must be
 * completed before the blocked task: a directed edge `blockingTaskId -> blockedTaskId` in the
 * "must finish before" graph.
 *
 * Adding a new edge `blockingTaskId -> blockedTaskId` closes a cycle if and only if the graph
 * already contains a path from `blockedTaskId` back to `blockingTaskId`. We therefore walk the
 * existing edges forward from `blockedTaskId` and report a cycle when `blockingTaskId` is
 * reachable. A self-dependency (`blockingTaskId === blockedTaskId`) is treated as a cycle.
 */
export function wouldCreateDependencyCycle(
  edges: DependencyEdge[],
  blockingTaskId: string,
  blockedTaskId: string,
): boolean {
  if (blockingTaskId === blockedTaskId) return true;

  const successors = new Map<string, string[]>();
  for (const edge of edges) {
    const existing = successors.get(edge.blockingTaskId);
    if (existing) existing.push(edge.blockedTaskId);
    else successors.set(edge.blockingTaskId, [edge.blockedTaskId]);
  }

  const stack = [blockedTaskId];
  const visited = new Set<string>();
  while (stack.length) {
    const current = stack.pop() as string;
    if (current === blockingTaskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const next = successors.get(current);
    if (next) stack.push(...next);
  }

  return false;
}
