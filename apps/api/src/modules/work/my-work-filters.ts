import type { Prisma } from "@atlas/db";
import type { MyWorkDueFilter, MyWorkStatusFilter } from "@atlas/shared";

export function myWorkStatusWhere(status: MyWorkStatusFilter): Prisma.TaskWhereInput {
  if (status === "done") return { status: "DONE" };
  if (status === "all") return {};
  return { status: { not: "DONE" } };
}

export function myWorkDueDateWhere(due: MyWorkDueFilter, now = new Date()): Prisma.TaskWhereInput {
  const today = startOfUtcDay(now);
  const tomorrow = addUtcDays(today, 1);

  if (due === "overdue") return { dueDate: { lt: today } };
  if (due === "today") return { dueDate: { gte: today, lt: tomorrow } };
  if (due === "next7") return { dueDate: { gte: today, lt: addUtcDays(today, 8) } };
  if (due === "unscheduled") return { dueDate: null };
  return {};
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
