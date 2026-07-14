"use client";

import type { FormEvent } from "react";

import { dateInputValue, taskStatusLabel } from "../shared/atlas-format";
import type { Task, TaskDependencies, TaskDependencyEdge } from "../shared/atlas-types";
import { readyDependencyBlockers } from "./task-dependency-utils";

type TaskDependenciesPanelProps = {
  dependencies: TaskDependencies;
  dependencyStatus: string;
  onAddDependency: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCompleteReadyBlockers: () => Promise<void>;
  onRemoveDependency: (dependencyId: string) => Promise<void>;
  task: Task;
  tasks: Task[];
};

export function TaskDependenciesPanel({
  dependencies,
  dependencyStatus,
  onAddDependency,
  onCompleteReadyBlockers,
  onRemoveDependency,
  task,
  tasks,
}: TaskDependenciesPanelProps) {
  const relatedTaskIds = new Set<string>([
    task.id,
    ...dependencies.blockedBy.map((edge) => edge.task.id),
    ...dependencies.blocks.map((edge) => edge.task.id),
  ]);
  const availableTasks = tasks.filter((candidate) => !relatedTaskIds.has(candidate.id));
  const readyBlockerCount = readyDependencyBlockers(dependencies).length;

  return (
    <section className="grid gap-2 border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase text-slate-500">Dependencies</h3>
        {dependencies.isBlocked ? (
          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">Blocked</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase text-slate-400">Blocked by</p>
        {readyBlockerCount ? (
          <button
            className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800"
            onClick={() => void onCompleteReadyBlockers()}
            type="button"
          >
            Complete {readyBlockerCount === 1 ? "blocker" : readyBlockerCount + " blockers"}
          </button>
        ) : null}
      </div>
      <DependencyList edges={dependencies.blockedBy} emptyLabel="Not blocked by any task" onRemove={onRemoveDependency} />

      <p className="text-xs font-medium uppercase text-slate-400">Blocks</p>
      <DependencyList edges={dependencies.blocks} emptyLabel="Not blocking any task" impact="downstream" onRemove={onRemoveDependency} />

      <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => void onAddDependency(event)}>
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={!availableTasks.length} name="blockingTaskId" required>
          <option value="">Add blocking task</option>
          {availableTasks.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.title}
            </option>
          ))}
        </select>
        <button
          className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!availableTasks.length}
          type="submit"
        >
          Add
        </button>
      </form>
      {dependencyStatus ? <p className="text-sm text-slate-600">{dependencyStatus}</p> : null}
    </section>
  );
}

function DependencyList({
  edges,
  emptyLabel,
  impact,
  onRemove,
}: {
  edges: TaskDependencyEdge[];
  emptyLabel: string;
  impact?: "downstream";
  onRemove: (dependencyId: string) => Promise<void>;
}) {
  if (!edges.length) {
    return <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{emptyLabel}</p>;
  }

  return (
    <div className="grid gap-2">
      {edges.map((edge) => {
        const metadata = dependencyMetadata(edge);
        const downstreamImpact = impact === "downstream" ? downstreamImpactLabel(edge) : null;
        return (
          <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={edge.id}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 break-words text-slate-700">{edge.task.title}</span>
                <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                  {taskStatusLabel(edge.task.status)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                {metadata.map((item) => (
                  <span key={item}>{item}</span>
                ))}
                {downstreamImpact ? <span className={downstreamImpact.className}>{downstreamImpact.label}</span> : null}
              </div>
            </div>
            <button
              className="w-fit shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
              onClick={() => void onRemove(edge.id)}
              type="button"
            >
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}

function dependencyMetadata(edge: TaskDependencyEdge) {
  const items: string[] = [];
  if (edge.task.priority) items.push(taskStatusLabel(edge.task.priority) + " priority");
  if (edge.task.dueDate) items.push("due " + dateInputValue(edge.task.dueDate));
  if (typeof edge.task.assigneeCount === "number") {
    items.push(edge.task.assigneeCount === 0 ? "unassigned" : edge.task.assigneeCount + " assigned");
  }
  return items;
}

function downstreamImpactLabel(edge: TaskDependencyEdge) {
  if (edge.task.status === "DONE") {
    return { className: "font-medium text-slate-500", label: "completed" };
  }
  const openBlockerCount = edge.task.dependencySummary?.blockedByOpenCount;
  if (typeof openBlockerCount !== "number") return null;
  if (openBlockerCount <= 1) {
    return { className: "font-medium text-amber-700", label: "last open blocker" };
  }
  const otherBlockers = openBlockerCount - 1;
  return {
    className: "font-medium text-slate-600",
    label: otherBlockers + " other blocker" + (otherBlockers === 1 ? "" : "s") + " remain",
  };
}
