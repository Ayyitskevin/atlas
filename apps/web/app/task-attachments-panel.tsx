"use client";

import type { FormEvent } from "react";

import { ATTACHMENT_ACCEPT_ATTRIBUTE, ATTACHMENT_UPLOAD_HELP_TEXT } from "@atlas/shared";

import { formatBytes } from "./atlas-format";
import type { Attachment, AttachmentScanStatus } from "./atlas-types";

type TaskAttachmentsPanelProps = {
  attachmentStatus: string;
  attachments: Attachment[];
  onCreateAttachmentComment: (event: FormEvent<HTMLFormElement>, attachmentId: string) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  onDeleteAttachmentComment: (attachmentCommentId: string) => Promise<void>;
  onDownloadAttachment: (attachmentId: string) => Promise<void>;
  onReplaceAttachment: (event: FormEvent<HTMLFormElement>, attachmentId: string) => Promise<void>;
  onUpdateAttachmentComment: (attachmentCommentId: string, body: string) => Promise<void>;
  onUpdateAttachmentDescription: (event: FormEvent<HTMLFormElement>, attachmentId: string) => Promise<void>;
  onUploadAttachment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function TaskAttachmentsPanel({
  attachmentStatus,
  attachments,
  onCreateAttachmentComment,
  onDeleteAttachment,
  onDeleteAttachmentComment,
  onDownloadAttachment,
  onReplaceAttachment,
  onUpdateAttachmentComment,
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
            <AttachmentScanBadge
              checkedAt={attachment.scanCheckedAt}
              message={attachment.scanMessage}
              provider={attachment.scanProvider}
              status={attachment.scanStatus}
            />
            <time className="mt-1 block text-xs text-slate-500">{new Date(attachment.createdAt).toLocaleString()}</time>
            {attachment.versions?.length ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Version history</p>
                <ul className="mt-2 grid gap-1 text-xs text-slate-600">
                  {attachment.versions.map((version) => (
                    <li className="grid gap-1 break-words" key={version.id}>
                      <span>
                        v{version.version} · {version.fileName} · {formatBytes(version.sizeBytes)}
                      </span>
                      <AttachmentScanBadge
                        checkedAt={version.scanCheckedAt}
                        message={version.scanMessage}
                        provider={version.scanProvider}
                        status={version.scanStatus}
                      />
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
            <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs font-semibold uppercase text-slate-500">File thread</p>
              <form className="mt-2 grid gap-2" onSubmit={(event) => void onCreateAttachmentComment(event, attachment.id)}>
                <textarea className="min-h-16 rounded-md border border-slate-300 px-3 py-2 text-sm" name="body" required />
                <button className="w-fit rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" type="submit">
                  Add file comment
                </button>
              </form>
              <div className="mt-3 grid gap-2">
                {attachment.comments?.length ? (
                  attachment.comments.map((comment) => (
                    <form className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2" key={comment.id} onSubmit={(event) => handleAttachmentCommentSubmit(event, comment.id, onUpdateAttachmentComment)}>
                      <textarea className="min-h-16 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" defaultValue={comment.body} name="body" required />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <time className="text-xs text-slate-500">{new Date(comment.createdAt).toLocaleString()}{comment.editedAt ? " · edited" : ""}</time>
                        <div className="flex gap-2">
                          <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" type="submit">
                            Save
                          </button>
                          <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" onClick={() => void onDeleteAttachmentComment(comment.id)} type="button">
                            Delete
                          </button>
                        </div>
                      </div>
                    </form>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No file comments yet.</p>
                )}
              </div>
            </div>
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

function AttachmentScanBadge({
  checkedAt,
  message,
  provider,
  status,
}: {
  checkedAt?: string | null;
  message?: string | null;
  provider?: string | null;
  status: AttachmentScanStatus;
}) {
  const copy = attachmentScanCopy(status);
  const detail = [provider ? "via " + provider : null, checkedAt ? new Date(checkedAt).toLocaleString() : null].filter(Boolean).join(" · ");
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
      <span className={"rounded px-1.5 py-0.5 font-medium " + copy.className}>{copy.label}</span>
      {detail ? <span>{detail}</span> : null}
      {message ? <span>{message}</span> : null}
    </p>
  );
}

function attachmentScanCopy(status: AttachmentScanStatus) {
  switch (status) {
    case "CLEAN":
      return { className: "bg-emerald-100 text-emerald-800", label: "Scan clean" };
    case "ERROR":
      return { className: "bg-amber-100 text-amber-800", label: "Scan error" };
    case "INFECTED":
      return { className: "bg-rose-100 text-rose-800", label: "Scan blocked" };
    case "PENDING":
      return { className: "bg-slate-200 text-slate-700", label: "Scan pending" };
    case "SKIPPED":
      return { className: "bg-sky-100 text-sky-800", label: "Scan skipped" };
  }
}

function handleAttachmentCommentSubmit(
  event: FormEvent<HTMLFormElement>,
  attachmentCommentId: string,
  onUpdateAttachmentComment: (attachmentCommentId: string, body: string) => Promise<void>,
) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  void onUpdateAttachmentComment(attachmentCommentId, String(form.get("body") ?? ""));
}
