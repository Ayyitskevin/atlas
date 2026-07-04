import type { FastifyInstance } from "fastify";

type ReadinessResponse = {
  checks?: Record<string, string>;
  status?: string;
};

async function main() {
  let app: FastifyInstance | undefined;
  let closeDomainSideEffectQueues: (() => Promise<void>) | undefined;
  let prisma: (typeof import("@atlas/db"))["prisma"] | undefined;

  try {
    const dbModule = await import("@atlas/db");
    const appModule = await import("../src/app.js");
    const queueModule = await import("../src/jobs/queues.js");
    const storageModule = await import("../src/storage/object-storage.js");

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
    const upload = await storageModule.createUploadInstructions({ mimeType: "text/plain", objectKey });
    const download = await storageModule.createDownloadInstructions(objectKey);
    if (upload.method !== "PUT" || upload.objectKey !== objectKey || !upload.url) throw new Error("Upload signing failed.");
    if (download.method !== "GET" || download.objectKey !== objectKey || !download.url) throw new Error("Download signing failed.");

    console.info(
      JSON.stringify(
        {
          checks: { ...body.checks, objectStorageSigning: "ok" },
          status: "ok",
        },
        null,
        2,
      ),
    );
    console.info("Atlas preflight passed.");
  } finally {
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
