"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import type { Project, ProjectMessage } from "../shared/atlas-types";

type ProjectMessagesPanelProps = {
  messages: ProjectMessage[];
  onCreateMessage: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onPinMessage: (messageId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onUnpinMessage: (messageId: string) => Promise<void>;
  onUpdateMessage: (messageId: string, event: FormEvent<HTMLFormElement>) => Promise<void>;
  project?: Project;
  statusMessage: string;
};

export function ProjectMessagesPanel({
  messages,
  onCreateMessage,
  onDeleteMessage,
  onPinMessage,
  onRefresh,
  onUnpinMessage,
  onUpdateMessage,
  project,
  statusMessage,
}: ProjectMessagesPanelProps) {
  const [editingMessageId, setEditingMessageId] = useState("");

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">Message board</h2>
          <p className="text-sm text-slate-600">{project ? project.name + " - " + messages.length + " posts" : "Select a project"}</p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!project}
          onClick={() => void onRefresh()}
          type="button"
        >
          Refresh
        </button>
      </div>

      {statusMessage ? <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{statusMessage}</p> : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-3">
          {messages.length ? (
            messages.map((message) => (
              <article className="rounded-md border border-slate-200 bg-slate-50 p-3" key={message.id}>
                {editingMessageId === message.id ? (
                  <form className="grid gap-2" onSubmit={(event) => void onUpdateMessage(message.id, event)}>
                    <input className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" defaultValue={message.title} maxLength={160} name="title" required />
                    <textarea className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" defaultValue={message.body} name="body" required />
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit">
                        Save
                      </button>
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                        onClick={() => setEditingMessageId("")}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-base font-semibold text-slate-950">{message.title}</h3>
                          {message.pinnedAt ? (
                            <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Pinned</span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500">
                          {message.author.name} - {formatTimestamp(message.createdAt)}
                          {message.pinnedAt ? " - pinned " + formatTimestamp(message.pinnedAt) : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {message.pinnedAt ? (
                          <button
                            className="rounded-md border border-amber-200 px-2 py-1 text-xs font-medium text-amber-800"
                            onClick={() => void onUnpinMessage(message.id)}
                            type="button"
                          >
                            Unpin
                          </button>
                        ) : (
                          <button
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                            onClick={() => void onPinMessage(message.id)}
                            type="button"
                          >
                            Pin
                          </button>
                        )}
                        <button
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                          onClick={() => setEditingMessageId(message.id)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700"
                          onClick={() => confirmMessageDelete(message.title) && void onDeleteMessage(message.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{message.body}</p>
                  </div>
                )}
              </article>
            ))
          ) : (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">No messages yet.</p>
          )}
        </div>

        <aside className="grid content-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold uppercase text-slate-500">New message</h3>
          <form className="grid gap-2" onSubmit={(event) => void onCreateMessage(event)}>
            <input
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!project}
              maxLength={160}
              name="title"
              placeholder="Subject"
              required
            />
            <textarea
              className="min-h-32 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!project}
              name="body"
              placeholder="Write a project update"
              required
            />
            <button
              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!project}
              type="submit"
            >
              Post
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}

function confirmMessageDelete(title: string) {
  return window.confirm("Delete message " + title + "?");
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
