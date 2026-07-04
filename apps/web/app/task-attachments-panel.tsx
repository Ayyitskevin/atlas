"use client";

import type { FormEvent } from "react";

import { ATTACHMENT_ACCEPT_ATTRIBUTE, ATTACHMENT_UPLOAD_HELP_TEXT } from "@atlas/shared";

import { formatBytes } from "./atlas-format";
import type { Attachment } from "./atlas-types";

type TaskAttachmentsPanelProps = {
  attachmentStatus: string;
  attachments: Attachment[];
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  onDownloadAttachment: (attachmentId: string) => Promise<void>;
  onReplaceAttachment: (event: FormEvent<HTMLFormElement>, attachmentId: string) => Promise<void>;
  onUpdateAttachmentDescription: (event: FormEvent<HTMLFormElement>, attachmentId: string) => Promise<void>;
  onUploadAttachment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function TaskAttachmentsPanel({
  attachmentStatus,
  attachments,
  onDeleteAttachment,
  onDownloadAttachment,
  onReplaceAttachment,
  onUpdateAttachmentDescription,
  onUploadAttachment,
}: TaskAttachmentsPanelProps) {
  return (
    <section className="grid gap-2 border-t border-slate-200 pt-4">
      <div>
        <h3 className="text-sm font-semibold uppercase text-slate-500">Attachments</h3>
        {attachmentStatus ? <p className="mt-1 text-xs text-slate-500">{attachmentStatus}</p> : null}
      </div>
      <form className="grid gap-2" onSubmit={(event) => void onUploadAttachment(event)}>
        <input
          accept={ATTACHMENT_ACCEPT_ATTRIBUTE}
          aria-describedby="attachment-upload-help"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          name="file"
          required
          type="file"
        />
        <p className="text-xs text-slate-500" id="attachment-upload-help">
          {ATTACHMENT_UPLOAD_HELP_TEXT}
        </p>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Note
          <textarea className="min-h-16 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900" maxLength={1000} name="description" />
        </label>
        <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit">
          Upload
        </button>
      </form>
      <div className="grid gap-2">
        {attachments.map((attachment) => (
          <article className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={attachment.id}>
            <p className="break-words font-medium text-slate-900">{attachment.fileName}</p>
            <p className="mt-1 text-xs text-slate-500">
              v{attachment.version} · {attachment.mimeType} · {formatBytes(attachment.sizeBytes)}
            </p>
            <time className="mt-1 block text-xs text-slate-500">{new Date(attachment.createdAt).toLocaleString()}</time>
            {attachment.versions?.length ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Version history</p>
                <ul className="mt-2 grid gap-1 text-xs text-slate-600">
                  {attachment.versions.map((version) => (
                    <li className="break-words" key={version.id}>
                      v{version.version} · {version.fileName} · {formatBytes(version.sizeBytes)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <form className="mt-3 grid gap-2" onSubmit={(event) => void onUpdateAttachmentDescription(event, attachment.id)}>
              <label className="grid gap-1 text-xs font-medium text-slate-600">
                Note
                <textarea
                  className="min-h-16 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
                  defaultValue={attachment.description ?? ""}
                  maxLength={1000}
                  name="description"
                />
              </label>
              <button className="w-fit rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" type="submit">
                Save note
              </button>
            </form>
            <form className="mt-3 grid gap-2" onSubmit={(event) => void onReplaceAttachment(event, attachment.id)}>
              <label className="grid gap-1 text-xs font-medium text-slate-600">
                Replace file
                <input
                  accept={ATTACHMENT_ACCEPT_ATTRIBUTE}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
                  name="file"
                  required
                  type="file"
                />
              </label>
              <button className="w-fit rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" type="submit">
                Upload new version
              </button>
            </form>
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
