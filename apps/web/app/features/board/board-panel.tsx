"use client";

import type { DragEvent, FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { taskPriorityLabel, taskStatusLabel } from "../shared/atlas-format";
import type { Section, Task, TaskDependencyFilter, TaskPriority, TaskStatus, WorkspaceMember } from "../shared/atlas-types";
import { TaskDependencyBadges } from "../task/task-dependency-badges";
import { emptyBoardTaskFilters, filterBoardTasks, type BoardTaskFilters, toggleSelection } from "./board-utils";

const dependencyFilters: Array<{ label: string; value: TaskDependencyFilter }> = [
  { label: "All dependency states", value: "any" },
  { label: "Blocked", value: "blocked" },
  { label: "Blocking open work", value: "blocking" },
];

const statusFilters: Array<{ label: string; value: TaskStatus | "any" }> = [
  { label: "Any status", value: "any" },
  { label: "To do", value: "TODO" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Done", value: "DONE" },
  { label: "Archived", value: "ARCHIVED" },
];

const priorityFilters: Array<{ label: string; value: TaskPriority | "any" }> = [
  { label: "Any priority", value: "any" },
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Urgent", value: "URGENT" },
];

type BoardPanelProps = {
  onBulkComplete: (taskIds: string[]) => Promise<void>;
  onBulkMove: (taskIds: string[], sectionId: string) => Promise<void>;
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
  workspaceMembers: WorkspaceMember[];
};

export function BoardPanel({
  onBulkComplete,
  onBulkMove,
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
  workspaceMembers,
}: BoardPanelProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropSectionId, setDropSectionId] = useState<string | null>(null);
  const [filters, setFilters] = useState<BoardTaskFilters>(emptyBoardTaskFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSectionId, setBulkSectionId] = useState(sections[0]?.id ?? "");

  const visibleTasks = useMemo(() => filterBoardTasks(tasks, filters), [filters, tasks]);
  const orderedVisibleIds = useMemo(() => visibleTasks.map((task) => task.id), [visibleTasks]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => tasks.some((task) => task.id === id)));
  }, [tasks]);

  useEffect(() => {
    if (!bulkSectionId && sections[0]) setBulkSectionId(sections[0].id);
  }, [bulkSectionId, sections]);

  function handleDragStart(taskId: string) {
    setDraggingTaskId(taskId);
  }

  function handleDragEnd() {
    setDraggingTaskId(null);
    setDropSectionId(null);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, sectionId: string) {
    event.preventDefault();
    if (dropSectionId !== sectionId) setDropSectionId(sectionId);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, sectionId: string) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/atlas-task-id") || draggingTaskId;
    const task = tasks.find((item) => item.id === taskId);
    setDraggingTaskId(null);
    setDropSectionId(null);
    if (!task || task.sectionId === sectionId) return;
    void onMoveTask(task, sectionId);
  }

  function handleBoardKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
      return;
    }

    if (event.key === "j" || event.key === "k") {
      event.preventDefault();
      if (!orderedVisibleIds.length) return;
      const currentIndex = Math.max(0, orderedVisibleIds.indexOf(selectedTaskId));
      const nextIndex = event.key === "j" ? Math.min(orderedVisibleIds.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
      const nextId = orderedVisibleIds[nextIndex];
      if (nextId) void onChooseTask(nextId);
      return;
    }

    if (event.key === "c" && selectedTaskId) {
      event.preventDefault();
      void onBulkComplete([selectedTaskId]);
      return;
    }

    if (event.key === "n") {
      event.preventDefault();
      const titleInput = document.querySelector<HTMLInputElement>('input[name="title"][data-board-new-task="1"]');
      titleInput?.focus();
    }
  }

  return (
    <section className="grid content-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm" onKeyDown={handleBoardKeyDown} tabIndex={0}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{projectName ?? "Tasks"}</h2>
          <p className="mt-1 text-[11px] text-slate-500">Keys: j/k select · c complete · n new task · drag cards to move</p>
        </div>
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
          <select
            aria-label="Status filter"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as BoardTaskFilters["status"] }))}
            value={filters.status}
          >
            {statusFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Priority filter"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as BoardTaskFilters["priority"] }))}
            value={filters.priority}
          >
            {priorityFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Assignee filter"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setFilters((current) => ({ ...current, assigneeId: event.target.value }))}
            value={filters.assigneeId}
          >
            <option value="any">Any assignee</option>
            {workspaceMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.user?.name || member.user?.email || member.userId}
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
        <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" data-board-new-task="1" name="title" placeholder="Task title" required />
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

      {selectedIds.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="font-medium text-slate-700">{selectedIds.length} selected</span>
          <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium" onClick={() => void onBulkComplete(selectedIds)} type="button">
            Complete
          </button>
          <select className="rounded-md border border-slate-300 px-2 py-1 text-xs" onChange={(event) => setBulkSectionId(event.target.value)} value={bulkSectionId}>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                Move to {section.name}
              </option>
            ))}
          </select>
          <button
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium"
            disabled={!bulkSectionId}
            onClick={() => bulkSectionId && void onBulkMove(selectedIds, bulkSectionId)}
            type="button"
          >
            Move selected
          </button>
          <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium" onClick={() => setSelectedIds([])} type="button">
            Clear
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 auto-cols-[minmax(240px,1fr)] grid-flow-col overflow-x-auto pb-1 md:grid-flow-row md:grid-cols-3">
        {sections.map((section, sectionIndex) => {
          const sectionTasks = visibleTasks.filter((task) => task.sectionId === section.id);
          const isDropTarget = dropSectionId === section.id;
          return (
            <div
              className={
                "min-h-52 rounded-md border p-2 transition-colors " +
                (isDropTarget ? "border-slate-950 bg-slate-100" : "border-slate-200 bg-[var(--board-column)]")
              }
              key={section.id}
              onDragLeave={() => {
                if (dropSectionId === section.id) setDropSectionId(null);
              }}
              onDragOver={(event) => handleDragOver(event, section.id)}
              onDrop={(event) => handleDrop(event, section.id)}
            >
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
                    className={
                      "rounded-md border bg-white px-3 py-2 text-sm " +
                      (task.id === selectedTaskId ? "border-slate-950" : "border-slate-200") +
                      (draggingTaskId === task.id ? " opacity-60" : "") +
                      (selectedIds.includes(task.id) ? " ring-1 ring-slate-400" : "")
                    }
                    draggable
                    key={task.id}
                    onDragEnd={handleDragEnd}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/atlas-task-id", task.id);
                      event.dataTransfer.effectAllowed = "move";
                      handleDragStart(task.id);
                    }}
                  >
                    <div className="mb-1 flex items-start gap-2">
                      <input
                        aria-label={"Select " + task.title}
                        checked={selectedIds.includes(task.id)}
                        className="mt-1"
                        onChange={() => setSelectedIds((current) => toggleSelection(current, task.id))}
                        type="checkbox"
                      />
                      <button className="min-w-0 flex-1 text-left" onClick={() => void onChooseTask(task.id)} type="button">
                        <span className="block font-medium text-slate-900">{task.title}</span>
                        <span className="text-xs text-slate-500">
                          {taskStatusLabel(task.status)} · {taskPriorityLabel(task.priority)}
                        </span>
                        <TaskDependencyBadges summary={task.dependencySummary} />
                      </button>
                    </div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Drag to move</p>
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
                    {taskDependencyFilter === "any" && filters.status === "any" && filters.priority === "any" && filters.assigneeId === "any"
                      ? "Drop tasks here."
                      : "No matching tasks."}
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
