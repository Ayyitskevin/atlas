"use client";

import type { FormEvent } from "react";

import { formatEventType } from "./atlas-format";
import type { OutboxEvent, OutboxEventDetail, OutboxStatus } from "./atlas-types";

const outboxStatuses: OutboxStatus[] = ["failed", "pending", "locked", "processed", "all"];

type OutboxPanelProps = {
  detail: OutboxEventDetail | null;
  eventType: string;
  events: OutboxEvent[];
  onEventTypeChange: (value: string) => void;
  onInspect: (eventId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onReplay: (eventId: string) => Promise<void>;
  onStatusChange: (value: OutboxStatus) => void;
  status: OutboxStatus;
  statusMessage: string;
  workspaceSelected: boolean;
};

export function OutboxPanel({
  detail,
  eventType,
  events,
  onEventTypeChange,
  onInspect,
  onRefresh,
  onReplay,
  onStatusChange,
  status,
  statusMessage,
  workspaceSelected,
}: OutboxPanelProps) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">Outbox</h2>
          <p className="text-sm text-slate-600">Failed-event replay and dispatch attempts</p>
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

      <form className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)_auto]" onSubmit={(event) => handleRefresh(event, onRefresh)}>
        <select
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={!workspaceSelected}
          onChange={(event) => onStatusChange(event.target.value as OutboxStatus)}
          value={status}
        >
          {outboxStatuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={!workspaceSelected}
          onChange={(event) => onEventTypeChange(event.target.value)}
          placeholder="Filter by event type"
          value={eventType}
        />
        <button
          className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!workspaceSelected}
          type="submit"
        >
          Apply
        </button>
      </form>

      {statusMessage ? <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{statusMessage}</p> : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-2">
          {events.map((event) => (
            <article className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={event.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-medium text-slate-900">{formatEventType(event.eventType)}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{event.eventId}</p>
                </div>
                <span className={"shrink-0 rounded-md px-2 py-1 text-xs font-medium " + statusClass(event.status)}>{event.status}</span>
              </div>
              <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                <div>
                  <dt className="font-medium text-slate-500">Attempts</dt>
                  <dd>{event.attempts}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Created</dt>
                  <dd>{formatDateTime(event.createdAt)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Next attempt</dt>
                  <dd>{event.nextAttemptAt ? formatDateTime(event.nextAttemptAt) : "none"}</dd>
                </div>
              </dl>
              {event.lastError ? <p className="mt-3 break-words rounded-md bg-white px-3 py-2 text-xs text-red-700">{event.lastError}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                  onClick={() => void onInspect(event.id)}
                  type="button"
                >
                  Inspect
                </button>
                <button
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!event.canReplay}
                  onClick={() => void onReplay(event.id)}
                  type="button"
                >
                  Replay
                </button>
              </div>
            </article>
          ))}
        </div>

        <aside className="grid content-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold uppercase text-slate-500">Event detail</h3>
          {detail ? (
            <>
              <div className="grid gap-1 text-sm">
                <p className="break-words font-medium text-slate-900">{formatEventType(detail.eventType)}</p>
                <p className="break-all text-xs text-slate-500">{detail.id}</p>
              </div>
              <dl className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-1">
                <div>
                  <dt className="font-medium text-slate-500">Status</dt>
                  <dd>{detail.status}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Failed</dt>
                  <dd>{detail.failedAt ? formatDateTime(detail.failedAt) : "no"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Processed</dt>
                  <dd>{detail.processedAt ? formatDateTime(detail.processedAt) : "no"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Locked</dt>
                  <dd>{detail.lockedAt ? formatDateTime(detail.lockedAt) : "no"}</dd>
                </div>
              </dl>
              <section className="grid gap-2">
                <h4 className="text-xs font-semibold uppercase text-slate-500">Attempts</h4>
                {detail.attemptHistory.length ? (
                  detail.attemptHistory.map((attempt) => (
                    <article className="rounded-md border border-slate-200 bg-white p-2 text-xs" key={attempt.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-slate-700">Attempt {attempt.attemptNumber}</p>
                        <span className={attempt.status === "failed" ? "text-red-700" : "text-emerald-700"}>{attempt.status}</span>
                      </div>
                      <p className="mt-1 text-slate-500">{formatDateTime(attempt.finishedAt)}</p>
                      {attempt.error ? <p className="mt-2 break-words text-red-700">{attempt.error}</p> : null}
                    </article>
                  ))
                ) : (
                  <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">No attempts recorded.</p>
                )}
              </section>
              <section className="grid gap-2">
                <h4 className="text-xs font-semibold uppercase text-slate-500">Payload</h4>
                <pre className="max-h-80 overflow-auto rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                  {JSON.stringify(detail.payload, null, 2)}
                </pre>
              </section>
            </>
          ) : (
            <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">Select an outbox event.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

function handleRefresh(event: FormEvent<HTMLFormElement>, onRefresh: () => Promise<void>) {
  event.preventDefault();
  void onRefresh();
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function statusClass(status: OutboxEvent["status"]) {
  if (status === "failed") return "bg-red-100 text-red-700";
  if (status === "processed") return "bg-emerald-100 text-emerald-700";
  if (status === "locked") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-700";
}
