"use client";

import type { FormEvent } from "react";

import { formatBytes } from "./atlas-format";
import type { Attachment } from "./atlas-types";

type TaskAttachmentsPanelProps = {
  attachmentStatus: string;
  attachments: Attachment[];
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  onDownloadAttachment: (attachmentId: string) => Promise<void>;
  onUploadAttachment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function TaskAttachmentsPanel({ attachmentStatus, attachments, onDeleteAttachment, onDownloadAttachment, onUploadAttachment }: TaskAttachmentsPanelProps) {
  return (
    <section className="grid gap-2 border-t border-slate-200 pt-4">
      <div>
        <h3 className="text-sm font-semibold uppercase text-slate-500">Attachments</h3>
        {attachmentStatus ? <p className="mt-1 text-xs text-slate-500">{attachmentStatus}</p> : null}
      </div>
      <form className="grid gap-2" onSubmit={(event) => void onUploadAttachment(event)}>
        <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="file" required type="file" />
        <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit">
          Upload
        </button>
      </form>
      <div className="grid gap-2">
        {attachments.map((attachment) => (
          <article className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={attachment.id}>
            <p className="break-words font-medium text-slate-900">{attachment.fileName}</p>
            <p className="mt-1 text-xs text-slate-500">
              {attachment.mimeType} · {formatBytes(attachment.sizeBytes)}
            </p>
            <time className="mt-1 block text-xs text-slate-500">{new Date(attachment.createdAt).toLocaleString()}</time>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" onClick={() => void onDownloadAttachment(attachment.id)} type="button">
                Download
              </button>
              <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" onClick={() => void onDeleteAttachment(attachment.id)} type="button">
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
