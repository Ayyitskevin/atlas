import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export function localIntegrationConfig(env = process.env) {
  const projectName = env.ATLAS_INTEGRATION_PROJECT || "atlas-integration";
  const postgresPort = env.ATLAS_INTEGRATION_POSTGRES_PORT || "55432";
  const redisPort = env.ATLAS_INTEGRATION_REDIS_PORT || "6380";
  const databaseUrl = env.DATABASE_URL || `postgresql://atlas:atlas@localhost:${postgresPort}/atlas`;
  const redisUrl = env.REDIS_URL || `redis://localhost:${redisPort}`;
  const keepServices = env.ATLAS_KEEP_TEST_SERVICES === "1";
  const requestedDriver = env.ATLAS_INTEGRATION_DRIVER || "auto";

  return {
    databaseUrl,
    keepServices,
    postgresPort,
    projectName,
    redisPort,
    redisUrl,
    requestedDriver,
  };
}

export function localIntegrationEnvironmentHelp(config = localIntegrationConfig()) {
  return `Environment:
  ATLAS_INTEGRATION_PROJECT        Compose project name. Default: ${config.projectName}
  ATLAS_INTEGRATION_POSTGRES_PORT  Host Postgres port. Default: ${config.postgresPort}
  ATLAS_INTEGRATION_REDIS_PORT     Host Redis port. Default: ${config.redisPort}
  ATLAS_INTEGRATION_DRIVER         auto, compose, or podman. Default: ${config.requestedDriver}
  DATABASE_URL                     Test database URL. Default: ${config.databaseUrl}
  REDIS_URL                        Test Redis URL. Default: ${config.redisUrl}
  ATLAS_KEEP_TEST_SERVICES=1       Leave services running after the command.
`;
}

export async function withLocalIntegrationServices(task, options = {}) {
  const baseEnv = options.env || process.env;
  const config = localIntegrationConfig(baseEnv);
  validateDriver(config.requestedDriver);

  const composeEnv = {
    ...baseEnv,
    POSTGRES_HOST_PORT: config.postgresPort,
    REDIS_HOST_PORT: config.redisPort,
  };

  const serviceEnv = {
    ...baseEnv,
    DATABASE_URL: config.databaseUrl,
    REDIS_URL: config.redisUrl,
  };

  let cleaningUp = false;
  let serviceDriver;

  const cleanup = () => {
    if (cleaningUp || config.keepServices || !serviceDriver) return;
    cleaningUp = true;
    serviceDriver.cleanup();
  };
  const handleSigint = () => {
    cleanup();
    process.exit(130);
  };
  const handleSigterm = () => {
    cleanup();
    process.exit(143);
  };

  process.once("SIGINT", handleSigint);
  process.once("SIGTERM", handleSigterm);

  try {
    serviceDriver = selectServiceDriver(config, composeEnv);
    console.info("Starting integration services with " + serviceDriver.name + ".");
    serviceDriver.cleanup();
    serviceDriver.start();
    waitForService("Postgres", () => serviceDriver.checkPostgres());
    waitForService("Redis", () => serviceDriver.checkRedis());
    await task({ config, env: serviceEnv, run });
  } finally {
    process.off("SIGINT", handleSigint);
    process.off("SIGTERM", handleSigterm);
    cleanup();
  }
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: options.env || process.env,
    stdio: options.stdio || "inherit",
  });

  if (result.error) {
    if (options.throwOnError === false) return result;
    throw result.error;
  }
  if (result.status !== 0 && options.throwOnError !== false) {
    throw new Error(command + " " + args.join(" ") + " exited with " + result.status + ".");
  }
  return result;
}

function validateDriver(requestedDriver) {
  if (!["auto", "compose", "podman"].includes(requestedDriver)) {
    throw new Error("ATLAS_INTEGRATION_DRIVER must be auto, compose, or podman.");
  }
}

function selectServiceDriver(config, composeEnv) {
  if (config.requestedDriver === "auto" || config.requestedDriver === "compose") {
    const composeCheck = run("docker", ["compose", "version"], { env: composeEnv, stdio: "ignore", throwOnError: false });
    if (composeCheck.status === 0) return dockerComposeDriver(config, composeEnv);
    if (config.requestedDriver === "compose") throw driverError("Docker Compose", composeCheck);
  }

  if (config.requestedDriver === "auto" || config.requestedDriver === "podman") {
    const podmanCheck = run("podman", ["info"], { stdio: "ignore", throwOnError: false });
    if (podmanCheck.status === 0) return podmanDriver(config);
    if (config.requestedDriver === "podman") throw driverError("Podman", podmanCheck);
  }

  throw new Error(
    "No supported local integration service driver found. Install Docker with Compose, or install Podman. " +
      "Set ATLAS_INTEGRATION_DRIVER=compose or ATLAS_INTEGRATION_DRIVER=podman to force a driver.",
  );
}

function dockerComposeDriver(config, composeEnv) {
  const runCompose = (args, options = {}) =>
    run("docker", ["compose", "--project-name", config.projectName, ...args], { env: composeEnv, ...options });

  return {
    checkPostgres: () => runCompose(["exec", "-T", "postgres", "pg_isready", "-U", "atlas", "-d", "atlas"], { stdio: "ignore", throwOnError: false }),
    checkRedis: () => runCompose(["exec", "-T", "redis", "redis-cli", "ping"], { stdio: "ignore", throwOnError: false }),
    cleanup: () => runCompose(["down", "--volumes", "--remove-orphans"], { throwOnError: false }),
    name: "Docker Compose",
    start: () => runCompose(["up", "-d", "postgres", "redis"]),
  };
}

function podmanDriver(config) {
  const resourcePrefix = config.projectName.replace(/[^a-zA-Z0-9_.-]/g, "-") || "atlas-integration";
  const postgresContainer = resourcePrefix + "-postgres";
  const redisContainer = resourcePrefix + "-redis";
  const postgresVolume = resourcePrefix + "-postgres-data";
  const redisVolume = resourcePrefix + "-redis-data";

  return {
    checkPostgres: () => run("podman", ["exec", postgresContainer, "pg_isready", "-U", "atlas", "-d", "atlas"], { stdio: "ignore", throwOnError: false }),
    checkRedis: () => run("podman", ["exec", redisContainer, "redis-cli", "ping"], { stdio: "ignore", throwOnError: false }),
    cleanup: () => {
      run("podman", ["rm", "--force", "--volumes", postgresContainer, redisContainer], { throwOnError: false });
      run("podman", ["volume", "rm", "--force", postgresVolume, redisVolume], { throwOnError: false });
    },
    name: "Podman",
    start: () => {
      run("podman", [
        "run",
        "--detach",
        "--name",
        postgresContainer,
        "--env",
        "POSTGRES_DB=atlas",
        "--env",
        "POSTGRES_PASSWORD=atlas",
        "--env",
        "POSTGRES_USER=atlas",
        "--publish",
        config.postgresPort + ":5432",
        "--volume",
        postgresVolume + ":/var/lib/postgresql/data",
        "docker.io/library/postgres:17-alpine",
      ]);
      run("podman", [
        "run",
        "--detach",
        "--name",
        redisContainer,
        "--publish",
        config.redisPort + ":6379",
        "--volume",
        redisVolume + ":/data",
        "docker.io/library/redis:7-alpine",
        "redis-server",
        "--appendonly",
        "yes",
      ]);
    },
  };
}

function waitForService(name, checkService) {
  const startedAt = Date.now();
  const timeoutMs = 60_000;

  while (Date.now() - startedAt < timeoutMs) {
    const result = checkService();
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }

  throw new Error(name + " did not become ready within " + timeoutMs / 1000 + " seconds.");
}

function driverError(name, result) {
  const detail = result.error ? result.error.message : "exit code " + result.status;
  return new Error(name + " is not usable by this session: " + detail);
}
