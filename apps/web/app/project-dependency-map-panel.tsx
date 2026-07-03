"use client";

import { dateInputValue, taskStatusLabel } from "./atlas-format";
import type { ProjectDependencyMap, ProjectDependencyMapEdge, ProjectDependencyMapNode } from "./atlas-types";

type ProjectDependencyMapPanelProps = {
  dependencyMap: ProjectDependencyMap;
  onOpenTask: (taskId: string) => Promise<void>;
};

export function ProjectDependencyMapPanel({ dependencyMap, onOpenTask }: ProjectDependencyMapPanelProps) {
  const nodesById = new Map(dependencyMap.nodes.map((node) => [node.id, node]));
  const criticalPath = dependencyMap.criticalPathTaskIds.map((taskId) => nodesById.get(taskId)).filter((node): node is ProjectDependencyMapNode => Boolean(node));

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Dependency map</h2>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {dependencyMap.stats.edgeCount} {dependencyMap.stats.edgeCount === 1 ? "edge" : "edges"}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <Metric label="Blocked" value={dependencyMap.stats.blockedTaskCount} />
        <Metric label="Blocking" value={dependencyMap.stats.blockingTaskCount} />
        <Metric label="Open edges" value={dependencyMap.stats.openEdgeCount} />
        <Metric label="Ready blockers" value={dependencyMap.stats.readyBlockerCount} />
      </div>

      {criticalPath.length ? (
        <div className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-medium uppercase text-amber-700">Longest open chain</p>
          <div className="flex flex-wrap items-center gap-2">
            {criticalPath.map((node, index) => (
              <div className="flex min-w-0 items-center gap-2" key={node.id}>
                {index > 0 ? <span className="text-xs text-amber-700">-&gt;</span> : null}
                <TaskChip node={node} onOpenTask={onOpenTask} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {dependencyMap.edges.length ? (
        <div className="grid gap-2">
          {dependencyMap.edges.slice(0, 8).map((edge) => (
            <DependencyEdgeRow edge={edge} key={edge.id} nodesById={nodesById} onOpenTask={onOpenTask} />
          ))}
          {dependencyMap.edges.length > 8 ? (
            <p className="text-xs text-slate-500">Showing 8 of {dependencyMap.edges.length} dependency edges.</p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">No project dependencies mapped yet.</p>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-lg font-semibold text-slate-950">{value}</p>
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
    </div>
  );
}

function DependencyEdgeRow({
  edge,
  nodesById,
  onOpenTask,
}: {
  edge: ProjectDependencyMapEdge;
  nodesById: Map<string, ProjectDependencyMapNode>;
  onOpenTask: (taskId: string) => Promise<void>;
}) {
  const blocking = nodesById.get(edge.blockingTaskId);
  const blocked = nodesById.get(edge.blockedTaskId);
  if (!blocking || !blocked) return null;
  return (
    <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
      <TaskLink node={blocking} onOpenTask={onOpenTask} />
      <span className="text-xs font-medium uppercase text-slate-400">blocks</span>
      <TaskLink node={blocked} onOpenTask={onOpenTask} />
    </div>
  );
}

function TaskChip({ node, onOpenTask }: { node: ProjectDependencyMapNode; onOpenTask: (taskId: string) => Promise<void> }) {
  return (
    <button
      className="max-w-48 rounded-md border border-amber-300 bg-white px-2 py-1 text-left text-xs font-medium text-amber-900"
      onClick={() => void onOpenTask(node.id)}
      type="button"
    >
      <span className="block truncate">{node.title}</span>
    </button>
  );
}

function TaskLink({ node, onOpenTask }: { node: ProjectDependencyMapNode; onOpenTask: (taskId: string) => Promise<void> }) {
  return (
    <button className="min-w-0 text-left" onClick={() => void onOpenTask(node.id)} type="button">
      <span className="block truncate font-medium text-slate-800">{node.title}</span>
      <span className="text-xs text-slate-500">
        {taskStatusLabel(node.status)}
        {node.dueDate ? " - due " + dateInputValue(node.dueDate) : ""}
      </span>
    </button>
  );
}
