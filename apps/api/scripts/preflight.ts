import type { FastifyInstance } from "fastify";

type ReadinessResponse = {
  checks?: Record<string, string>;
  status?: string;
};

async function main() {
  let app: FastifyInstance | undefined;
  let closeDomainSideEffectQueues: (() => Promise<void>) | undefined;
  let prisma: (typeof import("@atlas/db"))["prisma"] | undefined;
  let preflightObjectKey: string | undefined;
  let storageModule: typeof import("../src/storage/object-storage.js") | undefined;

  try {
    const dbModule = await import("@atlas/db");
    const appModule = await import("../src/app.js");
    const queueModule = await import("../src/jobs/queues.js");
    storageModule = await import("../src/storage/object-storage.js");

    prisma = dbModule.prisma;
    closeDomainSideEffectQueues = queueModule.closeDomainSideEffectQueues;

    const { buildApp } = appModule;
    app = await buildApp();
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/readyz" });
    const body = response.json<ReadinessResponse>();
    if (response.statusCode !== 200 || body.status !== "ok") {
      throw new Error("Readiness failed with " + response.statusCode + ": " + response.body);
    }
    const objectKey = storageModule.createAttachmentObjectKey({
      fileName: "preflight.txt",
      taskId: "00000000-0000-0000-0000-000000000002",
      workspaceId: "00000000-0000-0000-0000-000000000001",
    });
    preflightObjectKey = objectKey;
    const upload = await storageModule.createUploadInstructions({ mimeType: "text/plain", objectKey });
    const download = await storageModule.createDownloadInstructions(objectKey);
    if (upload.method !== "PUT" || upload.objectKey !== objectKey || !upload.url) throw new Error("Upload signing failed.");
    if (download.method !== "GET" || download.objectKey !== objectKey || !download.url) throw new Error("Download signing failed.");
    const preflightBody = Buffer.from("atlas object storage preflight\n");
    const uploadResponse = await fetch(upload.url, { body: preflightBody, headers: upload.headers, method: "PUT" });
    if (!uploadResponse.ok) throw new Error("Object storage write failed with " + uploadResponse.status + ".");
    const metadata = await storageModule.getAttachmentObjectMetadata(objectKey);
    if (!metadata) throw new Error("Object storage metadata check failed.");
    if (metadata.contentLength !== preflightBody.byteLength) throw new Error("Object storage metadata size mismatch.");
    if (metadata.contentType?.split(";")[0]?.trim().toLowerCase() !== "text/plain") throw new Error("Object storage metadata content type mismatch.");

    console.info(
      JSON.stringify(
        {
          checks: { ...body.checks, objectStorageSigning: "ok", objectStorageWrite: "ok" },
          status: "ok",
        },
        null,
        2,
      ),
    );
    console.info("Atlas preflight passed.");
  } finally {
    if (storageModule && preflightObjectKey) await storageModule.deleteAttachmentObject(preflightObjectKey).catch(() => undefined);
    if (app) await app.close();
    if (closeDomainSideEffectQueues) await closeDomainSideEffectQueues();
    if (prisma) await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Atlas preflight failed: " + message);
  process.exit(1);
});
