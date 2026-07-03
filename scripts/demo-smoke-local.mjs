import { localIntegrationConfig, localIntegrationEnvironmentHelp, withLocalIntegrationServices } from "./local-services.mjs";

const config = localIntegrationConfig();

if (process.argv.includes("--help")) {
  console.log(`Usage: pnpm smoke:demo:local

Starts isolated Postgres/Redis services, applies migrations, seeds the demo
workspace, verifies documented demo login and launch-critical API surfaces,
and removes the local services afterward.

${localIntegrationEnvironmentHelp(config)}
`);
  process.exit(0);
}

await withLocalIntegrationServices(({ env, run }) => {
  run("pnpm", ["--filter", "@atlas/db", "exec", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], { env });
  run("pnpm", ["seed"], { env });
  run("pnpm", ["--filter", "@atlas/api", "exec", "tsx", "scripts/demo-smoke.ts"], { env });
});
