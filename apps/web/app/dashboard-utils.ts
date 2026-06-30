import type { ActivityEvent, MyWorkTask, Notification, Project, Task, WorkspaceMember } from "./atlas-types";

export type WorkspaceDashboardStats = {
  activeProjects: number;
  archivedProjects: number;
  doneTasks: number;
  openMyWork: number;
  privateProjects: number;
  recentActivity: number;
  selectedProjectTasks: number;
  unreadNotifications: number;
  workspaceMembers: number;
};

export function workspaceDashboardStats(input: {
  activities: ActivityEvent[];
  myWorkTasks: MyWorkTask[];
  notifications: Notification[];
  projects: Project[];
  tasks: Task[];
  workspaceMembers: WorkspaceMember[];
}): WorkspaceDashboardStats {
  return {
    activeProjects: input.projects.filter((project) => !project.archivedAt).length,
    archivedProjects: input.projects.filter((project) => Boolean(project.archivedAt)).length,
    doneTasks: input.tasks.filter((task) => task.status === "DONE").length,
    openMyWork: input.myWorkTasks.filter((task) => task.status !== "DONE" && task.status !== "ARCHIVED").length,
    privateProjects: input.projects.filter((project) => project.visibility === "PRIVATE").length,
    recentActivity: input.activities.length,
    selectedProjectTasks: input.tasks.length,
    unreadNotifications: input.notifications.filter((notification) => notification.status === "UNREAD").length,
    workspaceMembers: input.workspaceMembers.length,
  };
}

export function recentActiveProjects(projects: Project[], limit = 4) {
  return projects.filter((project) => !project.archivedAt).slice(0, limit);
}
