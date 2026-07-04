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

    console.info(
      JSON.stringify(
        {
          checks: body.checks,
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
