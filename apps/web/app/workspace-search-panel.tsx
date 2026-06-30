"use client";

import type { FormEvent } from "react";

import type { SearchResult, Workspace } from "./atlas-types";

type WorkspaceSearchPanelProps = {
  onOpenResult: (result: SearchResult) => Promise<void>;
  onQueryChange: (query: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  query: string;
  results: SearchResult[];
  statusMessage: string;
  workspace?: Workspace;
  workspaceSelected: boolean;
};

export function WorkspaceSearchPanel({
  onOpenResult,
  onQueryChange,
  onSearch,
  query,
  results,
  statusMessage,
  workspace,
  workspaceSelected,
}: WorkspaceSearchPanelProps) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">Search</h2>
          <p className="text-sm text-slate-600">{workspace?.name ?? "Workspace"}</p>
        </div>
        {statusMessage ? <p className="text-sm font-medium text-slate-600">{statusMessage}</p> : null}
      </div>
      <form className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={onSearch}>
        <input
          aria-label="Search workspace"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={!workspaceSelected}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search projects and tasks"
          value={query}
        />
        <button
          className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!workspaceSelected || !query.trim()}
          type="submit"
        >
          Search
        </button>
      </form>

      {results.length ? (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {results.map((result) =>
            result.type === "project" ? (
              <button
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm"
                key={`project-${result.project.id}`}
                onClick={() => void onOpenResult(result)}
                type="button"
              >
                <span className="block font-medium text-slate-900">{result.project.name}</span>
                <span className="text-xs text-slate-500">{result.project.visibility.toLowerCase()} project</span>
              </button>
            ) : (
              <button
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm"
                key={`task-${result.task.id}`}
                onClick={() => void onOpenResult(result)}
                type="button"
              >
                <span className="block font-medium text-slate-900">{result.task.title}</span>
                <span className="text-xs text-slate-500">Task {result.task.status.toLowerCase()}</span>
              </button>
            ),
          )}
        </div>
      ) : null}
    </section>
  );
}
