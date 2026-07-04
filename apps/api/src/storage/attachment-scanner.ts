import { once } from "node:events";
import { createConnection, type Socket } from "node:net";

import type { AttachmentScanStatus } from "@atlas/db";

import { env } from "../config/env.js";
import { getAttachmentObjectStream, type AttachmentObjectMetadata } from "./object-storage.js";

export type AttachmentScanVerdict = Exclude<AttachmentScanStatus, "PENDING">;

export type AttachmentScanInput = {
  fileName: string;
  metadata: AttachmentObjectMetadata;
  mimeType: string;
  objectKey: string;
  sizeBytes: number;
  workspaceId: string;
};

export type AttachmentScanResult = {
  checkedAt: Date;
  message: string | null;
  provider: string;
  status: AttachmentScanVerdict;
};

export type AttachmentScanner = {
  scan(input: AttachmentScanInput): Promise<AttachmentScanResult>;
};

type AttachmentObjectStream = AsyncIterable<Uint8Array> & { destroy?: (error?: Error) => void };

type ClamAvScannerOptions = {
  host: string;
  port: number;
  readObject?: (objectKey: string) => Promise<AttachmentObjectStream>;
  timeoutMs: number;
};

export const noopAttachmentScanner: AttachmentScanner = {
  async scan() {
    return {
      checkedAt: new Date(),
      message: "No attachment scanner configured.",
      provider: "noop",
      status: "SKIPPED",
    };
  },
};

export const attachmentScanner: AttachmentScanner = attachmentScannerFromEnv();

export function attachmentScannerFromEnv(): AttachmentScanner {
  switch (env.ATTACHMENT_SCAN_PROVIDER) {
    case "clamav":
      return createClamAvAttachmentScanner({
        host: env.CLAMAV_HOST,
        port: env.CLAMAV_PORT,
        timeoutMs: env.CLAMAV_TIMEOUT_MS,
      });
    case "noop":
      return noopAttachmentScanner;
  }
}

export function createClamAvAttachmentScanner(input: ClamAvScannerOptions): AttachmentScanner {
  const readObject = input.readObject ?? getAttachmentObjectStream;
  return {
    async scan(scanInput) {
      try {
        const response = await scanObjectWithClamAv(await readObject(scanInput.objectKey), input);
        return {
          ...clamAvScanResult(response),
          checkedAt: new Date(),
          provider: "clamav",
        };
      } catch (error) {
        return {
          checkedAt: new Date(),
          message: scannerErrorMessage(error),
          provider: "clamav",
          status: "ERROR",
        };
      }
    },
  };
}

export function attachmentScanBlockReason(result: AttachmentScanResult): "infected" | "scanner_error" | null {
  if (result.status === "INFECTED") return "infected";
  if (result.status === "ERROR") return "scanner_error";
  return null;
}

export function attachmentScannerErrorResult(error: unknown): AttachmentScanResult {
  return {
    checkedAt: new Date(),
    message: scannerErrorMessage(error),
    provider: "attachment-scanner",
    status: "ERROR",
  };
}

async function scanObjectWithClamAv(stream: AttachmentObjectStream, input: ClamAvScannerOptions): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const socket = createConnection({ host: input.host, port: input.port });
    let response = "";
    let settled = false;

    const finish = (error?: unknown, result?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      if (error) {
        stream.destroy?.(error instanceof Error ? error : new Error(String(error)));
        reject(error);
        return;
      }
      resolve(result ?? response);
    };

    const timeout = setTimeout(() => finish(new Error("ClamAV scan timed out after " + input.timeoutMs + "ms.")), input.timeoutMs);

    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
    });
    socket.once("error", finish);
    socket.once("end", () => finish(undefined, response));
    socket.once("close", (hadError) => {
      if (!settled && !hadError) finish(undefined, response);
    });
    socket.once("connect", () => {
      void writeClamAvInstream(socket, stream).catch(finish);
    });
  });
}

async function writeClamAvInstream(socket: Socket, stream: AsyncIterable<Uint8Array>) {
  await writeSocket(socket, Buffer.from("zINSTREAM\0"));
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (!buffer.length) continue;
    const size = Buffer.allocUnsafe(4);
    size.writeUInt32BE(buffer.length, 0);
    await writeSocket(socket, size);
    await writeSocket(socket, buffer);
  }
  await writeSocket(socket, Buffer.alloc(4));
}

async function writeSocket(socket: Socket, chunk: Buffer) {
  if (socket.write(chunk)) return;
  await once(socket, "drain");
}

function clamAvScanResult(response: string): Omit<AttachmentScanResult, "checkedAt" | "provider"> {
  const message = response.replace(/\0/g, "").trim() || null;
  if (message?.endsWith(" OK")) return { message, status: "CLEAN" };
  if (message?.includes(" FOUND")) return { message, status: "INFECTED" };
  return { message: message ?? "ClamAV returned an empty scan response.", status: "ERROR" };
}

function scannerErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
