import { randomUUID } from "node:crypto";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

function safeFileName(fileName: string): string {
  const cleaned = fileName.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "attachment";
}
