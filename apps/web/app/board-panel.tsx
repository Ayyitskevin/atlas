"use client";

import type { FormEvent } from "react";

import { taskStatusLabel } from "./atlas-format";
import type { Section, Task } from "./atlas-types";
import { TaskDependencyBadges } from "./task-dependency-badges";

type BoardPanelProps = {
  onChooseTask: (taskId: string) => Promise<void>;
  onCreateSection: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateTask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDeleteSection: (sectionId: string) => Promise<void>;
  onMoveSection: (sectionId: string, direction: -1 | 1) => Promise<void>;
  onMoveTask: (task: Task, sectionId: string) => Promise<void>;
  onRenameSection: (sectionId: string, name: string) => Promise<void>;
  projectName?: string;
  sections: Section[];
  selectedTaskId: string;
  tasks: Task[];
};

export function BoardPanel({
  onChooseTask,
  onCreateSection,
  onCreateTask,
  onDeleteSection,
  onMoveSection,
  onMoveTask,
  onRenameSection,
  projectName,
  sections,
  selectedTaskId,
  tasks,
}: BoardPanelProps) {
  return (
    <section className="grid content-start gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase text-slate-500">{projectName ?? "Tasks"}</h2>
        <form className="flex gap-2" onSubmit={onCreateSection}>
          <input className="w-36 rounded-md border border-slate-300 px-3 py-2 text-sm" name="name" placeholder="Section" required />
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium" type="submit">
            Add
          </button>
        </form>
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

      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section, sectionIndex) => {
          const sectionTasks = tasks.filter((task) => task.sectionId === section.id);
          return (
            <div className="min-h-48 rounded-lg border border-slate-200 bg-slate-50 p-3" key={section.id}>
              <div className="mb-3 grid gap-2">
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
                {!sectionTasks.length ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">No tasks.</p> : null}
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
