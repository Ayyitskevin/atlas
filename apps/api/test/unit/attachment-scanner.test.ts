import { createServer, type Server } from "node:net";
import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  attachmentScanBlockReason,
  attachmentScannerErrorResult,
  checkClamAvScannerReadiness,
  createClamAvAttachmentScanner,
  noopAttachmentScanner,
} from "../../src/storage/attachment-scanner.js";

describe("attachment scanner", () => {
  it("uses an explicit skipped verdict for the noop scanner", async () => {
    await expect(
      noopAttachmentScanner.scan({
        fileName: "brief.pdf",
        metadata: { contentLength: 2048, contentType: "application/pdf", eTag: null, lastModified: null },
        mimeType: "application/pdf",
        objectKey: "workspaces/workspace/tasks/task/brief.pdf",
        sizeBytes: 2048,
        workspaceId: "workspace",
      }),
    ).resolves.toMatchObject({
      message: "No attachment scanner configured.",
      provider: "noop",
      status: "SKIPPED",
    });
  });

  it("blocks infected and scanner-error verdicts", () => {
    expect(attachmentScanBlockReason({ checkedAt: new Date(), message: null, provider: "scanner", status: "INFECTED" })).toBe("infected");
    expect(attachmentScanBlockReason({ checkedAt: new Date(), message: null, provider: "scanner", status: "ERROR" })).toBe("scanner_error");
    expect(attachmentScanBlockReason({ checkedAt: new Date(), message: null, provider: "scanner", status: "CLEAN" })).toBeNull();
    expect(attachmentScanBlockReason({ checkedAt: new Date(), message: null, provider: "noop", status: "SKIPPED" })).toBeNull();
  });

  it("normalizes thrown scanner failures into error verdicts", () => {
    expect(attachmentScannerErrorResult(new Error("scanner unavailable"))).toMatchObject({
      message: "scanner unavailable",
      provider: "attachment-scanner",
      status: "ERROR",
    });
  });

  it("streams objects to ClamAV and records clean verdicts", async () => {
    const fixture = await startFakeClamAv("stream: OK\0");
    try {
      const scanner = createClamAvAttachmentScanner({
        host: "127.0.0.1",
        port: fixture.port,
        readObject: async () => Readable.from([Buffer.from("safe-"), Buffer.from("payload")]),
        timeoutMs: 1000,
      });

      await expect(scanner.scan(scanInput())).resolves.toMatchObject({
        message: "stream: OK",
        provider: "clamav",
        status: "CLEAN",
      });
      await expect(fixture.receivedPayload).resolves.toEqual(Buffer.from("safe-payload"));
    } finally {
      await fixture.close();
    }
  });

  it("maps ClamAV malware responses to infected verdicts", async () => {
    const fixture = await startFakeClamAv("stream: Eicar-Test-Signature FOUND\0");
    try {
      const scanner = createClamAvAttachmentScanner({
        host: "127.0.0.1",
        port: fixture.port,
        readObject: async () => Readable.from([Buffer.from("malware-payload")]),
        timeoutMs: 1000,
      });

      await expect(scanner.scan(scanInput())).resolves.toMatchObject({
        message: "stream: Eicar-Test-Signature FOUND",
        provider: "clamav",
        status: "INFECTED",
      });
    } finally {
      await fixture.close();
    }
  });

  it("maps unverifiable ClamAV responses to scanner-error verdicts", async () => {
    const fixture = await startFakeClamAv("stream: INSTREAM size limit exceeded. ERROR\0");
    try {
      const scanner = createClamAvAttachmentScanner({
        host: "127.0.0.1",
        port: fixture.port,
        readObject: async () => Readable.from([Buffer.from("large-payload")]),
        timeoutMs: 1000,
      });

      await expect(scanner.scan(scanInput())).resolves.toMatchObject({
        message: "stream: INSTREAM size limit exceeded. ERROR",
        provider: "clamav",
        status: "ERROR",
      });
    } finally {
      await fixture.close();
    }
  });

  it("checks ClamAV readiness with a ping command", async () => {
    const fixture = await startFakeClamAv("PONG\0");
    try {
      await expect(checkClamAvScannerReadiness({ host: "127.0.0.1", port: fixture.port, timeoutMs: 1000 })).resolves.toBeUndefined();
      await expect(fixture.receivedCommand).resolves.toBe("zPING\0");
    } finally {
      await fixture.close();
    }
  });

  it("rejects unexpected ClamAV readiness responses", async () => {
    const fixture = await startFakeClamAv("UNKNOWN\0");
    try {
      await expect(checkClamAvScannerReadiness({ host: "127.0.0.1", port: fixture.port, timeoutMs: 1000 })).rejects.toThrow("ClamAV ping failed: UNKNOWN.");
    } finally {
      await fixture.close();
    }
  });
});

function scanInput() {
  return {
    fileName: "brief.pdf",
    metadata: { contentLength: 2048, contentType: "application/pdf", eTag: null, lastModified: null },
    mimeType: "application/pdf",
    objectKey: "workspaces/workspace/tasks/task/brief.pdf",
    sizeBytes: 2048,
    workspaceId: "workspace",
  };
}

async function startFakeClamAv(response: string): Promise<{
  close: () => Promise<void>;
  port: number;
  receivedCommand: Promise<string>;
  receivedPayload: Promise<Buffer>;
}> {
  let resolvePayload!: (payload: Buffer) => void;
  let rejectPayload!: (error: Error) => void;
  let resolveCommand!: (command: string) => void;
  let rejectCommand!: (error: Error) => void;
  const receivedPayload = new Promise<Buffer>((resolve, reject) => {
    resolvePayload = resolve;
    rejectPayload = reject;
  });
  const receivedCommand = new Promise<string>((resolve, reject) => {
    resolveCommand = resolve;
    rejectCommand = reject;
  });
  const server = createServer((socket) => {
    let buffer = Buffer.alloc(0);
    let commandRead = false;
    const payloadChunks: Buffer[] = [];

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        if (buffer.equals(Buffer.from("zPING\0"))) {
          resolveCommand("zPING\0");
          resolvePayload(Buffer.alloc(0));
          socket.end(response);
          return;
        }
        const result = readClamAvInstreamPayload(buffer, commandRead, payloadChunks);
        buffer = result.buffer;
        commandRead = result.commandRead;
        if (result.done) {
          resolveCommand("zINSTREAM\0");
          resolvePayload(Buffer.concat(payloadChunks));
          socket.end(response);
        }
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        rejectCommand(normalized);
        rejectPayload(normalized);
        socket.destroy(normalized);
      }
    });
    socket.once("error", (error) => {
      rejectCommand(error);
      rejectPayload(error);
    });
  });
  await listen(server);

  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("Fake ClamAV server did not expose a TCP port.");
  }

  return {
    close: () => closeServer(server),
    port: address.port,
    receivedCommand,
    receivedPayload,
  };
}

function readClamAvInstreamPayload(
  input: Buffer,
  commandRead: boolean,
  payloadChunks: Buffer[],
): {
  buffer: Buffer;
  commandRead: boolean;
  done: boolean;
} {
  let buffer = input;
  if (!commandRead) {
    const command = Buffer.from("zINSTREAM\0");
    if (buffer.length < command.length) return { buffer, commandRead, done: false };
    if (!buffer.subarray(0, command.length).equals(command)) throw new Error("Expected ClamAV INSTREAM command.");
    buffer = buffer.subarray(command.length);
    commandRead = true;
  }

  while (buffer.length >= 4) {
    const size = buffer.readUInt32BE(0);
    if (buffer.length < 4 + size) return { buffer, commandRead, done: false };
    buffer = buffer.subarray(4);
    if (size === 0) return { buffer, commandRead, done: true };
    payloadChunks.push(Buffer.from(buffer.subarray(0, size)));
    buffer = buffer.subarray(size);
  }

  return { buffer, commandRead, done: false };
}

async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

async function closeServer(server: Server) {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
