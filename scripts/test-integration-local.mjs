import { localIntegrationConfig, localIntegrationEnvironmentHelp, withLocalIntegrationServices } from "./local-services.mjs";

const config = localIntegrationConfig();

if (process.argv.includes("--help")) {
  console.log(`Usage: pnpm test:integration:local

Starts isolated Postgres/Redis/MinIO services, runs DB-backed API integration
tests, and removes the test services afterward.

${localIntegrationEnvironmentHelp(config)}
`);
  process.exit(0);
}

await withLocalIntegrationServices(({ env, run }) => {
  run("pnpm", ["test:integration"], { env });
});
