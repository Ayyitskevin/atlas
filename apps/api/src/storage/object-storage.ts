import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AttachmentStorageInstructions } from "@atlas/shared";

import { env } from "../config/env.js";

const instructionTtlSeconds = 15 * 60;
const s3 = new S3Client({
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  endpoint: env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT,
  forcePathStyle: true,
  region: env.S3_REGION,
});

export type AttachmentObjectMetadata = {
  contentLength: number | null;
  contentType: string | null;
  eTag: string | null;
  lastModified: Date | null;
};

export function createAttachmentObjectKey(input: { fileName: string; taskId: string; workspaceId: string }): string {
  return [
    "workspaces",
    input.workspaceId,
    "tasks",
    input.taskId,
    `${randomUUID()}-${safeFileName(input.fileName)}`,
  ].join("/");
}

export async function createUploadInstructions(input: { mimeType: string; objectKey: string }): Promise<AttachmentStorageInstructions> {
  const command = new PutObjectCommand({ Bucket: env.S3_BUCKET, ContentType: input.mimeType, Key: input.objectKey });
  return {
    expiresInSeconds: instructionTtlSeconds,
    headers: { "content-type": input.mimeType },
    method: "PUT",
    objectKey: input.objectKey,
    url: await getSignedUrl(s3, command, { expiresIn: instructionTtlSeconds }),
  };
}

export async function createDownloadInstructions(objectKey: string): Promise<AttachmentStorageInstructions> {
  const command = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey });
  return {
    expiresInSeconds: instructionTtlSeconds,
    headers: {},
    method: "GET",
    objectKey,
    url: await getSignedUrl(s3, command, { expiresIn: instructionTtlSeconds }),
  };
}

export async function getAttachmentObjectMetadata(objectKey: string): Promise<AttachmentObjectMetadata | null> {
  try {
    const result = await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }));
    return {
      contentLength: result.ContentLength ?? null,
      contentType: result.ContentType ?? null,
      eTag: result.ETag ?? null,
      lastModified: result.LastModified ?? null,
    };
  } catch (error) {
    if (isMissingObjectError(error)) return null;
    throw error;
  }
}

export async function deleteAttachmentObject(objectKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }));
}

export async function getAttachmentObjectStream(objectKey: string): Promise<Readable> {
  const result = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }));
  if (!result.Body) throw new Error("Attachment object body was empty.");
  return readableBody(result.Body);
}

function safeFileName(fileName: string): string {
  const cleaned = fileName.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "attachment";
}

function isMissingObjectError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { $metadata?: { httpStatusCode?: number }; Code?: string; code?: string; name?: string };
  return (
    candidate.$metadata?.httpStatusCode === 404 ||
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.Code === "NoSuchKey" ||
    candidate.code === "NoSuchKey"
  );
}

function readableBody(body: unknown): Readable {
  if (body instanceof Readable) return body;
  if (isAsyncIterableBody(body)) return Readable.from(body);
  if (hasTransformToWebStream(body)) return Readable.fromWeb(body.transformToWebStream());
  throw new Error("Attachment object body is not readable.");
}

function isAsyncIterableBody(body: unknown): body is AsyncIterable<Uint8Array> {
  return typeof body === "object" && body !== null && Symbol.asyncIterator in body;
}

function hasTransformToWebStream(body: unknown): body is { transformToWebStream: () => ReadableStream<Uint8Array> } {
  return typeof body === "object" && body !== null && "transformToWebStream" in body && typeof (body as { transformToWebStream?: unknown }).transformToWebStream === "function";
}
