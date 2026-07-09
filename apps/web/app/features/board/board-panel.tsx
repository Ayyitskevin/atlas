"use client";

import type { FormEvent } from "react";

import { taskStatusLabel } from "../shared/atlas-format";
import type { Section, Task, TaskDependencyFilter } from "../shared/atlas-types";
import { TaskDependencyBadges } from "../task/task-dependency-badges";

const dependencyFilters: Array<{ label: string; value: TaskDependencyFilter }> = [
  { label: "All dependency states", value: "any" },
  { label: "Blocked", value: "blocked" },
  { label: "Blocking open work", value: "blocking" },
];

type BoardPanelProps = {
  onChooseTask: (taskId: string) => Promise<void>;
  onCreateSection: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateTask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDeleteSection: (sectionId: string) => Promise<void>;
  onDependencyFilterChange: (dependency: TaskDependencyFilter) => void;
  onMoveSection: (sectionId: string, direction: -1 | 1) => Promise<void>;
  onMoveTask: (task: Task, sectionId: string) => Promise<void>;
  onRenameSection: (sectionId: string, name: string) => Promise<void>;
  projectName?: string;
  sections: Section[];
  selectedTaskId: string;
  taskDependencyFilter: TaskDependencyFilter;
  tasks: Task[];
};

export function BoardPanel({
  onChooseTask,
  onCreateSection,
  onCreateTask,
  onDeleteSection,
  onDependencyFilterChange,
  onMoveSection,
  onMoveTask,
  onRenameSection,
  projectName,
  sections,
  selectedTaskId,
  taskDependencyFilter,
  tasks,
}: BoardPanelProps) {
  return (
    <section className="grid content-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{projectName ?? "Tasks"}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Task dependency filter"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => onDependencyFilterChange(event.target.value as TaskDependencyFilter)}
            value={taskDependencyFilter}
          >
            {dependencyFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <form className="flex gap-2" onSubmit={onCreateSection}>
            <input className="w-36 rounded-md border border-slate-300 px-3 py-2 text-sm" name="name" placeholder="Section" required />
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium" type="submit">
              Add
            </button>
          </form>
        </div>
      </div>

      <form className="grid gap-2 md:grid-cols-[1fr_180px_auto]" onSubmit={onCreateTask}>
        <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="title" placeholder="Task title" required />
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="sectionId">
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!sections.length} type="submit">
          Add task
        </button>
      </form>

      <div className="grid gap-3 auto-cols-[minmax(240px,1fr)] grid-flow-col overflow-x-auto pb-1 md:grid-flow-row md:grid-cols-3">
        {sections.map((section, sectionIndex) => {
          const sectionTasks = tasks.filter((task) => task.sectionId === section.id);
          return (
            <div className="min-h-52 rounded-md border border-slate-200 bg-[var(--board-column)] p-2" key={section.id}>
              <div className="mb-2 grid gap-1.5">
                <form className="flex gap-2" onSubmit={(event) => handleRename(event, section.id, onRenameSection)}>
                  <input
                    aria-label={section.name + " section name"}
                    className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-700"
                    defaultValue={section.name}
                    name="name"
                    required
                  />
                  <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" type="submit">
                    Save
                  </button>
                </form>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={sectionIndex === 0}
                    onClick={() => void onMoveSection(section.id, -1)}
                    type="button"
                  >
                    Left
                  </button>
                  <button
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={sectionIndex === sections.length - 1}
                    onClick={() => void onMoveSection(section.id, 1)}
                    type="button"
                  >
                    Right
                  </button>
                  <button
                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={sectionTasks.length > 0}
                    onClick={() => confirmSectionDelete(section.name) && void onDeleteSection(section.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                {sectionTasks.map((task) => (
                  <article
                    className={"rounded-md border bg-white px-3 py-2 text-sm " + (task.id === selectedTaskId ? "border-slate-950" : "border-slate-200")}
                    key={task.id}
                  >
                    <button className="block w-full text-left" onClick={() => void onChooseTask(task.id)} type="button">
                      <span className="block font-medium text-slate-900">{task.title}</span>
                      <span className="text-xs text-slate-500">{taskStatusLabel(task.status)}</span>
                      <TaskDependencyBadges summary={task.dependencySummary} />
                    </button>
                    {sections.length > 1 ? (
                      <select
                        aria-label={"Move " + task.title}
                        className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                        onChange={(event) => void onMoveTask(task, event.target.value)}
                        value={task.sectionId}
                      >
                        {sections.map((targetSection) => (
                          <option key={targetSection.id} value={targetSection.id}>
                            {targetSection.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </article>
                ))}
                {!sectionTasks.length ? (
                  <p className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm text-xs text-slate-500">
                    {taskDependencyFilter === "any" ? "No tasks." : "No matching tasks."}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function handleRename(event: FormEvent<HTMLFormElement>, sectionId: string, onRenameSection: (sectionId: string, name: string) => Promise<void>) {
  event.preventDefault();
  const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
  if (name) void onRenameSection(sectionId, name);
}

function confirmSectionDelete(name: string) {
  return window.confirm("Delete empty section " + name + "?");
}
