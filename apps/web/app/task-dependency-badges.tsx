"use client";

import type { TaskDependencySummary } from "./atlas-types";

export function TaskDependencyBadges({ summary }: { summary?: TaskDependencySummary }) {
  if (!summary || (!summary.isBlocked && summary.blocksCount === 0)) return null;

  return (
    <span className="mt-2 flex flex-wrap gap-1">
      {summary.isBlocked ? (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
          Blocked by {summary.blockedByOpenCount}
        </span>
      ) : null}
      {summary.blocksCount ? (
        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
          Blocks {summary.blocksCount}
        </span>
      ) : null}
    </span>
  );
}
