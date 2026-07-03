"use client";

import type { FormEvent } from "react";

import type { Project, ProjectTemplate, ProjectTemplateDetail, ProjectTemplateTask } from "./atlas-types";

type ProjectTemplatesPanelProps = {
  onCreateProjectFromTemplate: (templateId: string, event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onPreviewTemplate: (templateId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onSaveTemplate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUpdateTemplate: (templateId: string, event: FormEvent<HTMLFormElement>) => Promise<void>;
  project?: Project;
  selectedTemplate: ProjectTemplateDetail | null;
  statusMessage: string;
  templates: ProjectTemplate[];
  workspaceSelected: boolean;
};

export function ProjectTemplatesPanel({
  onCreateProjectFromTemplate,
  onDeleteTemplate,
  onPreviewTemplate,
  onRefresh,
  onSaveTemplate,
  onUpdateTemplate,
  project,
  selectedTemplate,
  statusMessage,
  templates,
  workspaceSelected,
}: ProjectTemplatesPanelProps) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">Project templates</h2>
          <p className="text-sm text-slate-600">{workspaceSelected ? templates.length + " templates" : "Select a workspace"}</p>
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

      {statusMessage ? <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{statusMessage}</p> : null}

      <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="grid content-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold uppercase text-slate-500">Save selected project</h3>
          <form className="grid gap-2" onSubmit={(event) => void onSaveTemplate(event)}>
            <input
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!project}
              maxLength={160}
              name="name"
              placeholder={project ? project.name + " template" : "Template name"}
            />
            <textarea
              className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!project}
              maxLength={4000}
              name="description"
              placeholder="Description"
            />
            <button
              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!project}
              type="submit"
            >
              Save template
            </button>
          </form>
        </aside>

        <div className="grid content-start gap-3">
          {templates.length ? (
            templates.map((template) => {
              const isSelected = selectedTemplate?.id === template.id;
              return (
                <article className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3" key={template.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-semibold text-slate-950">{template.name}</h3>
                      <p className="text-xs text-slate-500">
                        {(template._count?.sections ?? 0) + " sections"} - {(template._count?.tasks ?? 0) + " tasks"}
                        {template.createdBy ? " - " + template.createdBy.name : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                        onClick={() => void onPreviewTemplate(template.id)}
                        type="button"
                      >
                        {isSelected ? "Refresh preview" : "Preview/Edit"}
                      </button>
                      <button
                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700"
                        onClick={() => confirmTemplateDelete(template.name) && void onDeleteTemplate(template.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {template.description ? <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{template.description}</p> : null}
                  <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]" onSubmit={(event) => void onCreateProjectFromTemplate(template.id, event)}>
                    <input className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" defaultValue={template.name} maxLength={160} name="name" required />
                    <select className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" defaultValue="WORKSPACE" name="visibility">
                      <option value="WORKSPACE">Workspace</option>
                      <option value="PRIVATE">Private</option>
                    </select>
                    <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit">
                      Create project
                    </button>
                  </form>
                  {isSelected ? <TemplateDetail onUpdateTemplate={onUpdateTemplate} template={selectedTemplate} /> : null}
                </article>
              );
            })
          ) : (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">No templates yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function confirmTemplateDelete(name: string) {
  return window.confirm("Delete template " + name + "?");
}

function TemplateDetail({
  onUpdateTemplate,
  template,
}: {
  onUpdateTemplate: (templateId: string, event: FormEvent<HTMLFormElement>) => Promise<void>;
  template: ProjectTemplateDetail;
}) {
  return (
    <div className="grid gap-3 border-t border-slate-200 pt-3">
      <form className="grid gap-2" key={template.id + template.updatedAt} onSubmit={(event) => void onUpdateTemplate(template.id, event)}>
        <input
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          defaultValue={template.name}
          maxLength={160}
          name="name"
          required
        />
        <textarea
          className="min-h-20 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          defaultValue={template.description ?? ""}
          maxLength={4000}
          name="description"
        />
        <button className="justify-self-start rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700" type="submit">
          Save changes
        </button>
      </form>

      <div className="grid gap-2">
        {template.sections.length ? (
          template.sections.map((section) => (
            <section className="grid gap-2 rounded-md border border-slate-200 bg-white p-3" key={section.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="break-words text-sm font-semibold text-slate-950">{section.name}</h4>
                <span className="text-xs text-slate-500">{section.tasks.length + " tasks"}</span>
              </div>
              {section.tasks.length ? (
                <ol className="grid gap-2">
                  {section.tasks.map((task) => (
                    <li className="grid gap-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2" key={task.id}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="break-words text-sm font-medium text-slate-900">{task.title}</p>
                        <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">{task.priority.toLowerCase()}</span>
                      </div>
                      {task.description ? <p className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{task.description}</p> : null}
                      <TemplateTaskMeta task={task} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">No tasks.</p>
              )}
            </section>
          ))
        ) : (
          <p className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">No sections.</p>
        )}
      </div>
    </div>
  );
}

function TemplateTaskMeta({ task }: { task: ProjectTemplateTask }) {
  const assignees = task.assignees ?? [];
  const labels = task.labelAssignments ?? [];
  if (!assignees.length && !labels.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((assignment) => (
        <span
          className="rounded-md border bg-white px-2 py-0.5 text-xs font-medium"
          key={assignment.id}
          style={{ borderColor: assignment.label.color, color: assignment.label.color }}
        >
          {assignment.label.name}
        </span>
      ))}
      {assignees.length ? (
        <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
          {assignees.map((assignee) => assignee.user?.name ?? assignee.userId).join(", ")}
        </span>
      ) : null}
    </div>
  );
}
