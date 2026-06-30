"use client";

import { dateInputValue, taskStatusLabel } from "./atlas-format";
import type { MyWorkDueFilter, MyWorkStatusFilter, MyWorkTask } from "./atlas-types";

const dueFilters: Array<{ label: string; value: MyWorkDueFilter }> = [
  { label: "Any due date", value: "any" },
  { label: "Overdue", value: "overdue" },
  { label: "Today", value: "today" },
  { label: "Next 7", value: "next7" },
  { label: "Unscheduled", value: "unscheduled" },
];

const statusFilters: Array<{ label: string; value: MyWorkStatusFilter }> = [
  { label: "Open", value: "open" },
  { label: "Done", value: "done" },
  { label: "All", value: "all" },
];

type MyWorkPanelProps = {
  dueFilter: MyWorkDueFilter;
  onDueFilterChange: (value: MyWorkDueFilter) => void;
  onOpenTask: (task: MyWorkTask) => Promise<void>;
  onRefresh: () => Promise<void>;
  onStatusFilterChange: (value: MyWorkStatusFilter) => void;
  statusFilter: MyWorkStatusFilter;
  statusMessage: string;
  tasks: MyWorkTask[];
  workspaceSelected: boolean;
};

export function MyWorkPanel({
  dueFilter,
  onDueFilterChange,
  onOpenTask,
  onRefresh,
  onStatusFilterChange,
  statusFilter,
  statusMessage,
  tasks,
  workspaceSelected,
}: MyWorkPanelProps) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">My work</h2>
          <p className="text-sm text-slate-600">Assigned tasks across accessible projects</p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!workspaceSelected}
          onClick={() => void onRefresh()}
          type="button"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium uppercase text-slate-500">
          Status
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm normal-case text-slate-700"
            disabled={!workspaceSelected}
            onChange={(event) => onStatusFilterChange(event.target.value as MyWorkStatusFilter)}
            value={statusFilter}
          >
            {statusFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium uppercase text-slate-500">
          Due
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm normal-case text-slate-700"
            disabled={!workspaceSelected}
            onChange={(event) => onDueFilterChange(event.target.value as MyWorkDueFilter)}
            value={dueFilter}
          >
            {dueFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {statusMessage ? <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{statusMessage}</p> : null}

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => (
          <button
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm"
            key={task.id}
            onClick={() => void onOpenTask(task)}
            type="button"
          >
            <span className="block break-words font-medium text-slate-900">{task.title}</span>
            <span className="mt-1 block text-xs text-slate-500">
              {task.project.name} - {taskStatusLabel(task.status)}
              {task.dueDate ? " - due " + dateInputValue(task.dueDate) : ""}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
