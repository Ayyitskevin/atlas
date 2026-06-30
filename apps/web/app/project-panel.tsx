"use client";

import type { FormEvent } from "react";

import type { Project, Workspace } from "./atlas-types";

type ProjectPanelProps = {
  onArchiveProject: (projectId: string) => Promise<void>;
  onChooseProject: (projectId: string) => Promise<void>;
  onCreateProject: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onUpdateProject: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  projects: Project[];
  selectedProject: Project | undefined;
  selectedProjectId: string;
  workspace: Workspace | undefined;
};

export function ProjectPanel({
  onArchiveProject,
  onChooseProject,
  onCreateProject,
  onDeleteProject,
  onUpdateProject,
  projects,
  selectedProject,
  selectedProjectId,
  workspace,
}: ProjectPanelProps) {
  return (
    <aside className="grid content-start gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase text-slate-500">{workspace?.name ?? "Projects"}</h2>
      <form className="grid gap-2" onSubmit={onCreateProject}>
        <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="name" placeholder="Project name" required />
        <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit">
          Create
        </button>
      </form>

      <div className="grid gap-2">
        {projects.map((project) => (
          <button
            className={"rounded-md px-3 py-2 text-left text-sm " + (project.id === selectedProjectId ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700")}
            key={project.id}
            onClick={() => void onChooseProject(project.id)}
            type="button"
          >
            <span className="block font-medium">{project.name}</span>
            <span className="text-xs opacity-75">
              {project.visibility.toLowerCase()}
              {project.archivedAt ? " archived" : ""}
            </span>
          </button>
        ))}
      </div>

      {selectedProject ? (
        <form className="grid gap-2 border-t border-slate-200 pt-3" key={selectedProject.id} onSubmit={onUpdateProject}>
          <input name="projectId" type="hidden" value={selectedProject.id} />
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Name
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={selectedProject.name} name="name" required />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Visibility
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={selectedProject.visibility} name="visibility">
              <option value="WORKSPACE">Workspace</option>
              <option value="PRIVATE">Private</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Description
            <textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={selectedProject.description ?? ""} name="description" />
          </label>
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" type="submit">
            Save project
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={Boolean(selectedProject.archivedAt)}
              onClick={() => void onArchiveProject(selectedProject.id)}
              type="button"
            >
              Archive
            </button>
            <button
              className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-700"
              onClick={() => confirmProjectDelete(selectedProject.name) && void onDeleteProject(selectedProject.id)}
              type="button"
            >
              Delete
            </button>
          </div>
        </form>
      ) : null}
    </aside>
  );
}

function confirmProjectDelete(name: string) {
  return window.confirm("Delete project " + name + "?");
}
