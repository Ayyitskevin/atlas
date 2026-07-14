import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "@atlas/db";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");

export type AtlasApp = Awaited<ReturnType<typeof import("../../../src/app.js").buildApp>>;
export type CloseDomainSideEffectQueues = typeof import("../../../src/jobs/queues.js").closeDomainSideEffectQueues;

export type IntegrationHarness = {
  app: AtlasApp;
  closeDomainSideEffectQueues: CloseDomainSideEffectQueues;
};

/** Build API app after applying migrations. Shared by domain integration suites. */
export async function startIntegrationApp(): Promise<IntegrationHarness> {
  execFileSync(
    "pnpm",
    ["--filter", "@atlas/db", "exec", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"],
    { cwd: rootDir, env: process.env, stdio: "ignore" },
  );

  const [{ buildApp }, queuesModule] = await Promise.all([
    import("../../../src/app.js"),
    import("../../../src/jobs/queues.js"),
  ]);

  return {
    app: await buildApp(),
    closeDomainSideEffectQueues: queuesModule.closeDomainSideEffectQueues,
  };
}

export async function stopIntegrationApp(harness: IntegrationHarness | undefined): Promise<void> {
  if (!harness) return;
  await harness.app.close();
  await harness.closeDomainSideEffectQueues();
  await prisma.$disconnect();
}

export function authHeader(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` };
}
