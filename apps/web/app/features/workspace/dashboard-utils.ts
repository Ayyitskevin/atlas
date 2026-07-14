import type { ActivityEvent, MyWorkTask, Notification, Project, Task, WorkspaceMember } from "../shared/atlas-types";

export type WorkspaceDashboardStats = {
  activeProjects: number;
  archivedProjects: number;
  doneTasks: number;
  openMyWork: number;
  overdueMyWork: number;
  privateProjects: number;
  recentActivity: number;
  selectedProjectTasks: number;
  todayMyWork: number;
  unreadNotifications: number;
  upcomingMyWork: number;
  unscheduledMyWork: number;
  workspaceMembers: number;
};

export function workspaceDashboardStats(input: {
  activities: ActivityEvent[];
  myWorkTasks: MyWorkTask[];
  notifications: Notification[];
  projects: Project[];
  tasks: Task[];
  workspaceMembers: WorkspaceMember[];
}, now = new Date()): WorkspaceDashboardStats {
  const planning = myWorkPlanningCounts(input.myWorkTasks, now);
  return {
    activeProjects: input.projects.filter((project) => !project.archivedAt).length,
    archivedProjects: input.projects.filter((project) => Boolean(project.archivedAt)).length,
    doneTasks: input.tasks.filter((task) => task.status === "DONE").length,
    openMyWork: input.myWorkTasks.filter((task) => task.status !== "DONE" && task.status !== "ARCHIVED").length,
    overdueMyWork: planning.overdue,
    privateProjects: input.projects.filter((project) => project.visibility === "PRIVATE").length,
    recentActivity: input.activities.length,
    selectedProjectTasks: input.tasks.length,
    todayMyWork: planning.today,
    unreadNotifications: input.notifications.filter((notification) => notification.status === "UNREAD").length,
    upcomingMyWork: planning.upcoming,
    unscheduledMyWork: planning.unscheduled,
    workspaceMembers: input.workspaceMembers.length,
  };
}

export function recentActiveProjects(projects: Project[], limit = 4) {
  return projects.filter((project) => !project.archivedAt).slice(0, limit);
}

export function myWorkPlanningCounts(tasks: MyWorkTask[], now = new Date()) {
  const today = startOfUtcDay(now);
  const tomorrow = addUtcDays(today, 1);
  const nextWindowEnd = addUtcDays(today, 8);
  return tasks.reduce(
    (counts, task) => {
      if (task.status === "DONE" || task.status === "ARCHIVED") return counts;
      if (!task.dueDate) {
        counts.unscheduled += 1;
        return counts;
      }

      const dueDate = startOfUtcDay(new Date(task.dueDate));
      if (dueDate < today) counts.overdue += 1;
      else if (dueDate < tomorrow) counts.today += 1;
      else if (dueDate < nextWindowEnd) counts.upcoming += 1;
      return counts;
    },
    { overdue: 0, today: 0, upcoming: 0, unscheduled: 0 },
  );
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
