import type { TaskStatus } from "@atlas/db";

export function completedAtForStatusTransition(status: TaskStatus | undefined, now: Date): Date | null | undefined {
  if (status === undefined) return undefined;
  return status === "DONE" ? now : null;
}

export function isAlreadyCompleted(status: TaskStatus): boolean {
  return status === "DONE";
}
