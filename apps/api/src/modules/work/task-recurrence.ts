import type { TaskRecurrenceFrequency } from "@atlas/db";

export function nextRecurringDueDate(
  input: { dueDate?: Date | string | null; frequency: TaskRecurrenceFrequency; interval: number },
  now = new Date(),
) {
  const base = input.dueDate ? dateOnly(input.dueDate) : utcDateOnly(now);
  if (input.frequency === "DAILY") base.setUTCDate(base.getUTCDate() + input.interval);
  if (input.frequency === "WEEKLY") base.setUTCDate(base.getUTCDate() + input.interval * 7);
  if (input.frequency === "MONTHLY") return addMonths(base, input.interval).toISOString().slice(0, 10);
  return base.toISOString().slice(0, 10);
}

function dateOnly(value: Date | string) {
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
  return new Date(text + "T00:00:00.000Z");
}

function utcDateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addMonths(value: Date, months: number) {
  const day = value.getUTCDate();
  const target = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
  const lastDayOfTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return target;
}
