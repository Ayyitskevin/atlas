"use client";

import type { FormEvent } from "react";

import { dateInputValue, formatActivityDetail, formatActivityTitle, taskStatusLabel } from "../shared/atlas-format";
import type { ActivityEvent, MyWorkTask, Notification, Project, Section, Task, Workspace, WorkspaceMember } from "../shared/atlas-types";
import { recentActiveProjects, workspaceDashboardStats } from "./dashboard-utils";
import { TaskDependencyBadges } from "../task/task-dependency-badges";

type WorkspaceDashboardPanelProps = {
  activities: ActivityEvent[];
  dashboardWorkStatus: string;
  myWorkTasks: MyWorkTask[];
  notifications: Notification[];
  onChooseProject: (projectId: string) => Promise<void>;
  onCreateProject: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateTask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onOpenTask: (task: MyWorkTask) => Promise<void>;
  projects: Project[];
  sections: Section[];
  selectedProject?: Project;
  tasks: Task[];
  workspace?: Workspace;
  workspaceMembers: WorkspaceMember[];
};

export function WorkspaceDashboardPanel({
  activities,
  dashboardWorkStatus,
  myWorkTasks,
  notifications,
  onChooseProject,
  onCreateProject,
  onCreateTask,
  onOpenTask,
  projects,
  sections,
  selectedProject,
  tasks,
  workspace,
  workspaceMembers,
}: WorkspaceDashboardPanelProps) {
  const stats = workspaceDashboardStats({ activities, myWorkTasks, notifications, projects, tasks, workspaceMembers });
  const quickProjects = recentActiveProjects(projects);
  const quickTasks = myWorkTasks.slice(0, 4);
  const recentNotifications = notifications.slice(0, 3);
  const recentActivities = activities.slice(0, 4);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">Workspace dashboard</h2>
          <p className="text-2xl font-semibold text-slate-950">{workspace?.name ?? "No workspace selected"}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Metric label="Projects" value={stats.activeProjects} />
          <Metric label="My work" value={stats.openMyWork} />
          <Metric label="Unread" value={stats.unreadNotifications} />
          <Metric label="Members" value={stats.workspaceMembers} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Metric label="Overdue" value={stats.overdueMyWork} />
            <Metric label="Due today" value={stats.todayMyWork} />
            <Metric label="Next 7" value={stats.upcomingMyWork} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <form className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3" onSubmit={onCreateProject}>
              <h3 className="text-xs font-semibold uppercase text-slate-500">Quick project</h3>
              <input className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" name="name" placeholder="Project name" required />
              <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" disabled={!workspace} type="submit">
                Create project
              </button>
            </form>

            <form className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3" onSubmit={onCreateTask}>
              <h3 className="text-xs font-semibold uppercase text-slate-500">Quick task</h3>
              <input className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" name="title" placeholder="Task title" required />
              <select className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" name="sectionId">
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {selectedProject ? selectedProject.name + " - " : ""}
                    {section.name}
                  </option>
                ))}
              </select>
              <button
                className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedProject || !sections.length}
                type="submit"
              >
                Create task
              </button>
            </form>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {quickProjects.length ? (
              quickProjects.map((project) => (
                <button
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm"
                  key={project.id}
                  onClick={() => void onChooseProject(project.id)}
                  type="button"
                >
                  <span className="block font-medium text-slate-900">{project.name}</span>
                  <span className="text-xs text-slate-500">{project.visibility.toLowerCase()}</span>
                </button>
              ))
            ) : (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">No active projects.</p>
            )}
          </div>
        </section>

        <aside className="grid content-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <h3 className="text-sm font-semibold uppercase text-slate-500">Next up</h3>
            <p className="text-sm text-slate-600">
              {stats.unscheduledMyWork} unscheduled - {stats.archivedProjects} archived projects
            </p>
          </div>

          {dashboardWorkStatus ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{dashboardWorkStatus}</p>
          ) : null}

          <div className="grid gap-2">
            {quickTasks.length ? (
              quickTasks.map((task) => (
                <button
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm"
                  key={task.id}
                  onClick={() => void onOpenTask(task)}
                  type="button"
                >
                  <span className="block break-words font-medium text-slate-900">{task.title}</span>
                  <span className="text-xs text-slate-500">
                    {task.project.name} - {taskStatusLabel(task.status)}
                    {task.dueDate ? " - due " + dateInputValue(task.dueDate) : ""}
                  </span>
                  <TaskDependencyBadges summary={task.dependencySummary} />
                </button>
              ))
            ) : (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                No assigned or watched tasks.
              </p>
            )}
          </div>
        </aside>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid content-start gap-2 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold uppercase text-slate-500">Recent notifications</h3>
          {recentNotifications.length ? (
            recentNotifications.map((notification) => <NotificationRow key={notification.id} notification={notification} />)
          ) : (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">No notifications.</p>
          )}
        </section>

        <section className="grid content-start gap-2 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold uppercase text-slate-500">Recent activity</h3>
          {recentActivities.length ? (
            recentActivities.map((activity) => <ActivityRow activity={activity} key={activity.id} />)
          ) : (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">No activity loaded.</p>
          )}
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function NotificationRow({ notification }: { notification: Notification }) {
  return (
    <article className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-medium text-slate-900">{notification.title}</p>
          <p className="mt-1 text-slate-600">{notification.body}</p>
        </div>
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {notification.status.toLowerCase()}
        </span>
      </div>
    </article>
  );
}

function ActivityRow({ activity }: { activity: ActivityEvent }) {
  return (
    <article className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{formatActivityTitle(activity.eventType)}</p>
          <p className="mt-1 text-xs text-slate-500">{formatActivityDetail(activity)}</p>
        </div>
        <time className="shrink-0 text-xs text-slate-500">{new Date(activity.createdAt).toLocaleString()}</time>
      </div>
    </article>
  );
}
