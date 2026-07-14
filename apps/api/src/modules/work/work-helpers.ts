import { Prisma, type TaskPriority, type TaskStatus } from "@atlas/db";
import { ATLAS_ERROR_CODES, searchCursorSchema, type SearchResultType } from "@atlas/shared";

import { AtlasHttpError } from "../../shared/errors.js";


export type TaskDependencySummary = {
  blockedByOpenCount: number;
  blocksCount: number;
  isBlocked: boolean;
};

export function taskAuditPayload(
  task: {
    dueDate?: Date | string | null;
    priority: string;
    recurrenceEndDate?: Date | string | null;
    recurrenceFrequency?: string | null;
    recurrenceInterval?: number | null;
    recurrencePausedAt?: Date | string | null;
    recurrenceSkippedAt?: Date | string | null;
    sectionId: string;
    status: string;
    title: string;
  },
  previous?: {
    dueDate?: Date | string | null;
    priority: string;
    recurrenceEndDate?: Date | string | null;
    recurrenceFrequency?: string | null;
    recurrenceInterval?: number | null;
    recurrencePausedAt?: Date | string | null;
    recurrenceSkippedAt?: Date | string | null;
    status: string;
    title: string;
  },
) {
  const payload: Record<string, number | string | null> = {
    dueDate: datePayloadValue(task.dueDate),
    priority: task.priority,
    recurrenceEndDate: datePayloadValue(task.recurrenceEndDate),
    recurrenceFrequency: task.recurrenceFrequency ?? null,
    recurrenceInterval: task.recurrenceInterval ?? null,
    recurrencePausedAt: dateTimePayloadValue(task.recurrencePausedAt),
    recurrenceSkippedAt: dateTimePayloadValue(task.recurrenceSkippedAt),
    sectionId: task.sectionId,
    status: task.status,
    title: task.title,
  };
  if (!previous) return payload;
  if (previous.title !== task.title) payload.previousTitle = previous.title;
  if (previous.status !== task.status) payload.previousStatus = previous.status;
  if (previous.priority !== task.priority) payload.previousPriority = previous.priority;
  if ((previous.recurrenceFrequency ?? null) !== (task.recurrenceFrequency ?? null)) {
    payload.previousRecurrenceFrequency = previous.recurrenceFrequency ?? null;
  }
  if ((previous.recurrenceInterval ?? null) !== (task.recurrenceInterval ?? null)) {
    payload.previousRecurrenceInterval = previous.recurrenceInterval ?? null;
  }
  const previousRecurrenceEndDate = datePayloadValue(previous.recurrenceEndDate);
  if (previousRecurrenceEndDate !== payload.recurrenceEndDate) {
    payload.previousRecurrenceEndDate = previousRecurrenceEndDate;
  }
  const previousRecurrencePausedAt = dateTimePayloadValue(previous.recurrencePausedAt);
  if (previousRecurrencePausedAt !== payload.recurrencePausedAt) {
    payload.previousRecurrencePausedAt = previousRecurrencePausedAt;
  }
  const previousRecurrenceSkippedAt = dateTimePayloadValue(previous.recurrenceSkippedAt);
  if (previousRecurrenceSkippedAt !== payload.recurrenceSkippedAt) {
    payload.previousRecurrenceSkippedAt = previousRecurrenceSkippedAt;
  }
  const previousDueDate = datePayloadValue(previous.dueDate);
  if (previousDueDate !== payload.dueDate) payload.previousDueDate = previousDueDate;
  return payload;
}

export function recurrencePauseEventType(
  previous: { recurrencePausedAt?: Date | string | null },
  task: { recurrencePausedAt?: Date | string | null },
): "TaskRecurrencePaused" | "TaskRecurrenceResumed" | null {
  const wasPaused = Boolean(previous.recurrencePausedAt);
  const isPaused = Boolean(task.recurrencePausedAt);
  if (!wasPaused && isPaused) return "TaskRecurrencePaused";
  if (wasPaused && !isPaused) return "TaskRecurrenceResumed";
  return null;
}

export function datePayloadValue(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

export function dateTimePayloadValue(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function dateTimeOrNull(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function dependencyEdgeView(
  row: { blockedTaskId: string; blockingTaskId: string; createdAt: Date; id: string },
  task: {
    _count?: { assignees: number };
    dueDate?: Date | string | null;
    id: string;
    priority?: string;
    status: string;
    title: string;
  },
  dependencySummary?: TaskDependencySummary,
) {
  return {
    blockedTaskId: row.blockedTaskId,
    blockingTaskId: row.blockingTaskId,
    createdAt: row.createdAt,
    id: row.id,
    task: {
      assigneeCount: task._count?.assignees ?? 0,
      dependencySummary: dependencySummary ?? emptyDependencySummary(),
      dueDate: datePayloadValue(task.dueDate),
      id: task.id,
      priority: task.priority,
      status: task.status,
      title: task.title,
    },
  };
}

export type ProjectDependencyMapTask = {
  dueDate?: Date | string | null;
  id: string;
  priority: TaskPriority;
  sectionId: string;
  status: TaskStatus;
  title: string;
};

export type ProjectDependencyMapNode = ReturnType<typeof projectDependencyMapNodeView>;

export type ProjectDependencyMapEdge = {
  blockedTaskId: string;
  blockingTaskId: string;
};

export function uniqueDependencyMapNodes(
  rows: Array<{ blockedTask: ProjectDependencyMapTask; blockedTaskId: string; blockingTask: ProjectDependencyMapTask; blockingTaskId: string }>,
  summaries: Map<string, TaskDependencySummary>,
) {
  const nodes = new Map<string, ProjectDependencyMapNode>();
  for (const row of rows) {
    nodes.set(row.blockingTaskId, projectDependencyMapNodeView(row.blockingTask, summaries.get(row.blockingTaskId)));
    nodes.set(row.blockedTaskId, projectDependencyMapNodeView(row.blockedTask, summaries.get(row.blockedTaskId)));
  }
  return [...nodes.values()].sort(compareDependencyMapNodes);
}

export function projectDependencyMapNodeView(task: ProjectDependencyMapTask, dependencySummary?: TaskDependencySummary) {
  return {
    dependencySummary: dependencySummary ?? emptyDependencySummary(),
    dueDate: datePayloadValue(task.dueDate),
    id: task.id,
    priority: task.priority,
    sectionId: task.sectionId,
    status: task.status,
    title: task.title,
  };
}

export function dependencyMapStats(nodes: ProjectDependencyMapNode[], edges: ProjectDependencyMapEdge[]) {
  return {
    blockedTaskCount: nodes.filter((node) => node.dependencySummary.isBlocked).length,
    blockingTaskCount: nodes.filter((node) => node.dependencySummary.blocksCount > 0).length,
    edgeCount: edges.length,
    openEdgeCount: openDependencyEdges(nodes, edges).length,
    readyBlockerCount: nodes.filter((node) => node.status !== "DONE" && node.dependencySummary.blocksCount > 0 && node.dependencySummary.blockedByOpenCount === 0).length,
  };
}

export function longestOpenDependencyChain(nodes: ProjectDependencyMapNode[], edges: ProjectDependencyMapEdge[]) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  for (const edge of openDependencyEdges(nodes, edges)) {
    const blocked = outgoing.get(edge.blockingTaskId) ?? [];
    blocked.push(edge.blockedTaskId);
    outgoing.set(edge.blockingTaskId, blocked);
  }
  for (const blocked of outgoing.values()) blocked.sort((left, right) => compareDependencyMapNodes(nodesById.get(left), nodesById.get(right)));

  const memo = new Map<string, string[]>();
  const visiting = new Set<string>();
  const bestFrom = (taskId: string): string[] => {
    if (memo.has(taskId)) return memo.get(taskId) ?? [taskId];
    if (visiting.has(taskId)) return [taskId];
    visiting.add(taskId);
    let best = [taskId];
    for (const blockedTaskId of outgoing.get(taskId) ?? []) {
      const candidate = [taskId, ...bestFrom(blockedTaskId)];
      if (candidate.length > best.length) best = candidate;
    }
    visiting.delete(taskId);
    memo.set(taskId, best);
    return best;
  };

  let best: string[] = [];
  for (const node of nodes.filter((candidate) => candidate.status !== "DONE")) {
    const candidate = bestFrom(node.id);
    if (candidate.length > best.length) best = candidate;
  }
  return best.length > 1 ? best : [];
}

export function openDependencyEdges(nodes: ProjectDependencyMapNode[], edges: ProjectDependencyMapEdge[]) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  return edges.filter((edge) => nodesById.get(edge.blockingTaskId)?.status !== "DONE" && nodesById.get(edge.blockedTaskId)?.status !== "DONE");
}

export function compareDependencyMapNodes(left?: ProjectDependencyMapNode, right?: ProjectDependencyMapNode) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const due = (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31");
  if (due !== 0) return due;
  const title = left.title.localeCompare(right.title);
  if (title !== 0) return title;
  return left.id.localeCompare(right.id);
}

export function emptyDependencySummary(): TaskDependencySummary {
  return { blockedByOpenCount: 0, blocksCount: 0, isBlocked: false };
}

export function isPrismaUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function normalizeAttachmentDescription(value: string | null | undefined) {
  const description = value?.trim();
  return description ? description : null;
}

export function attachmentActivityPayload(
  attachment: { fileName: string; id: string; sizeBytes: number; version: number },
  versionAnchor?: { fileName: string; id: string; sizeBytes: number; version: number } | null,
) {
  const payload = {
    attachmentId: attachment.id,
    fileName: versionAnchor?.fileName ?? attachment.fileName,
    sizeBytes: versionAnchor?.sizeBytes ?? attachment.sizeBytes,
    version: versionAnchor?.version ?? attachment.version,
  };
  return versionAnchor ? { ...payload, versionFileName: versionAnchor.fileName, versionId: versionAnchor.id } : payload;
}

export function normalizeMimeType(value: string | null | undefined) {
  return value?.split(";")[0]?.trim().toLowerCase() ?? null;
}

export type SearchCursor = {
  id: string;
  type: SearchResultType;
  updatedAt: Date;
};

export type SearchResultItem =
  | { project: { id: string; updatedAt: Date }; type: "project" }
  | { task: { id: string; updatedAt: Date }; type: "task" };

export const searchResultTypeRank: Record<SearchResultType, number> = {
  project: 0,
  task: 1,
};

export function compareSearchResults(left: SearchResultItem, right: SearchResultItem) {
  const updatedAtDelta = searchResultUpdatedAt(right).getTime() - searchResultUpdatedAt(left).getTime();
  if (updatedAtDelta) return updatedAtDelta;
  const typeDelta = searchResultRank(left.type) - searchResultRank(right.type);
  if (typeDelta) return typeDelta;
  return searchResultId(left).localeCompare(searchResultId(right));
}

export function decodeSearchCursor(cursor?: string, requestedType?: SearchResultType): SearchCursor | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = searchCursorSchema.safeParse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    if (!parsed.success) throw new Error("Invalid cursor payload.");
    if (requestedType && parsed.data.type !== requestedType) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Search cursor does not match the requested result type.");
    }
    return {
      id: parsed.data.id,
      type: parsed.data.type,
      updatedAt: new Date(parsed.data.updatedAt),
    };
  } catch (error) {
    if (error instanceof AtlasHttpError) throw error;
    throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Invalid search cursor.");
  }
}

export function encodeSearchCursor(item: SearchResultItem) {
  return Buffer.from(
    JSON.stringify({
      id: searchResultId(item),
      type: item.type,
      updatedAt: searchResultUpdatedAt(item).toISOString(),
    }),
  ).toString("base64url");
}

export function searchResultId(item: SearchResultItem) {
  return item.type === "project" ? item.project.id : item.task.id;
}

export function searchResultUpdatedAt(item: SearchResultItem) {
  return item.type === "project" ? item.project.updatedAt : item.task.updatedAt;
}

export function searchResultRank(type: SearchResultType) {
  return searchResultTypeRank[type] ?? 0;
}

export function notificationPreferenceResponse(input: {
  emailEnabled: boolean;
  updatedAt: Date | null;
  userId: string;
  workspaceId: string;
}) {
  return {
    emailEnabled: input.emailEnabled,
    inAppEnabled: true as const,
    updatedAt: input.updatedAt?.toISOString() ?? null,
    userId: input.userId,
    workspaceId: input.workspaceId,
  };
}
