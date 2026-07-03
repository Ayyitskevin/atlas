"use client";

import type { FormEvent } from "react";

import type { Task, TaskDependencies, TaskDependencyEdge } from "./atlas-types";

type TaskDependenciesPanelProps = {
  dependencies: TaskDependencies;
  dependencyStatus: string;
  onAddDependency: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRemoveDependency: (dependencyId: string) => Promise<void>;
  task: Task;
  tasks: Task[];
};

export function TaskDependenciesPanel({
  dependencies,
  dependencyStatus,
  onAddDependency,
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

  return (
    <section className="grid gap-2 border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase text-slate-500">Dependencies</h3>
        {dependencies.isBlocked ? (
          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">Blocked</span>
        ) : null}
      </div>

      <p className="text-xs font-medium uppercase text-slate-400">Blocked by</p>
      <DependencyList edges={dependencies.blockedBy} emptyLabel="Not blocked by any task" onRemove={onRemoveDependency} />

      <p className="text-xs font-medium uppercase text-slate-400">Blocks</p>
      <DependencyList edges={dependencies.blocks} emptyLabel="Not blocking any task" onRemove={onRemoveDependency} />

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
  onRemove,
}: {
  edges: TaskDependencyEdge[];
  emptyLabel: string;
  onRemove: (dependencyId: string) => Promise<void>;
}) {
  if (!edges.length) {
    return <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{emptyLabel}</p>;
  }

  return (
    <div className="grid gap-2">
      {edges.map((edge) => (
        <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" key={edge.id}>
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 break-words text-slate-700">{edge.task.title}</span>
            <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600">{edge.task.status}</span>
          </span>
          <button
            className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
            onClick={() => void onRemove(edge.id)}
            type="button"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
