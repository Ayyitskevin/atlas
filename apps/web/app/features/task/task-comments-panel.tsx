"use client";

import type { FormEvent } from "react";

import type { Comment } from "../shared/atlas-types";

type TaskCommentsPanelProps = {
  comments: Comment[];
  onCreateComment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onUpdateComment: (commentId: string, body: string) => Promise<void>;
};

export function TaskCommentsPanel({ comments, onCreateComment, onDeleteComment, onUpdateComment }: TaskCommentsPanelProps) {
  return (
    <section className="grid gap-2 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold uppercase text-slate-500">Comments</h3>
      <form className="grid gap-2" onSubmit={(event) => void onCreateComment(event)}>
        <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm" name="body" required />
        <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit">
          Comment
        </button>
      </form>
      {comments.map((comment) => (
        <article className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={comment.id}>
          <form className="grid gap-2" onSubmit={(event) => handleCommentSubmit(event, comment.id, onUpdateComment)}>
            <textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={comment.body} name="body" required />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <time className="text-xs text-slate-500">{new Date(comment.createdAt).toLocaleString()}{comment.editedAt ? " · edited" : ""}</time>
              <div className="flex gap-2">
                <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" type="submit">
                  Save
                </button>
                <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" onClick={() => void onDeleteComment(comment.id)} type="button">
                  Delete
                </button>
              </div>
            </div>
          </form>
        </article>
      ))}
    </section>
  );
}

function handleCommentSubmit(
  event: FormEvent<HTMLFormElement>,
  commentId: string,
  onUpdateComment: (commentId: string, body: string) => Promise<void>,
) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  void onUpdateComment(commentId, String(form.get("body") ?? ""));
}
