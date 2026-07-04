import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export function localIntegrationConfig(env = process.env) {
  const projectName = env.ATLAS_INTEGRATION_PROJECT || "atlas-integration";
  const postgresPort = env.ATLAS_INTEGRATION_POSTGRES_PORT || "55432";
  const redisPort = env.ATLAS_INTEGRATION_REDIS_PORT || "6380";
  const minioApiPort = env.ATLAS_INTEGRATION_MINIO_API_PORT || "59000";
  const minioConsolePort = env.ATLAS_INTEGRATION_MINIO_CONSOLE_PORT || "59001";
  const databaseUrl = env.DATABASE_URL || `postgresql://atlas:atlas@localhost:${postgresPort}/atlas`;
  const redisUrl = env.REDIS_URL || `redis://localhost:${redisPort}`;
  const s3Endpoint = env.S3_ENDPOINT || `http://localhost:${minioApiPort}`;
  const s3PublicEndpoint = env.S3_PUBLIC_ENDPOINT || s3Endpoint;
  const keepServices = env.ATLAS_KEEP_TEST_SERVICES === "1";
  const requestedDriver = env.ATLAS_INTEGRATION_DRIVER || "auto";

  return {
    databaseUrl,
    keepServices,
    minioApiPort,
    minioConsolePort,
    postgresPort,
    projectName,
    redisPort,
    redisUrl,
    requestedDriver,
    s3Endpoint,
    s3PublicEndpoint,
  };
}

export function localIntegrationEnvironmentHelp(config = localIntegrationConfig()) {
  return `Environment:
  ATLAS_INTEGRATION_PROJECT        Compose project name. Default: ${config.projectName}
  ATLAS_INTEGRATION_POSTGRES_PORT  Host Postgres port. Default: ${config.postgresPort}
  ATLAS_INTEGRATION_REDIS_PORT     Host Redis port. Default: ${config.redisPort}
  ATLAS_INTEGRATION_MINIO_API_PORT Host MinIO API port. Default: ${config.minioApiPort}
  ATLAS_INTEGRATION_MINIO_CONSOLE_PORT Host MinIO console port. Default: ${config.minioConsolePort}
  ATLAS_INTEGRATION_DRIVER         auto, compose, or podman. Default: ${config.requestedDriver}
  DATABASE_URL                     Test database URL. Default: ${config.databaseUrl}
  REDIS_URL                        Test Redis URL. Default: ${config.redisUrl}
  S3_ENDPOINT                      S3 API endpoint. Default: ${config.s3Endpoint}
  S3_PUBLIC_ENDPOINT               Signed URL endpoint. Default: ${config.s3PublicEndpoint}
  ATLAS_KEEP_TEST_SERVICES=1       Leave services running after the command.
`;
}

export async function withLocalIntegrationServices(task, options = {}) {
  const baseEnv = options.env || process.env;
  const config = localIntegrationConfig(baseEnv);
  validateDriver(config.requestedDriver);

  const composeEnv = {
    ...baseEnv,
    MINIO_API_HOST_PORT: config.minioApiPort,
    MINIO_CONSOLE_HOST_PORT: config.minioConsolePort,
    POSTGRES_HOST_PORT: config.postgresPort,
    REDIS_HOST_PORT: config.redisPort,
  };

  const serviceEnv = {
    ...baseEnv,
    DATABASE_URL: config.databaseUrl,
    REDIS_URL: config.redisUrl,
    S3_ACCESS_KEY_ID: baseEnv.S3_ACCESS_KEY_ID || "atlas",
    S3_BUCKET: baseEnv.S3_BUCKET || "atlas-local",
    S3_ENDPOINT: config.s3Endpoint,
    S3_PUBLIC_ENDPOINT: config.s3PublicEndpoint,
    S3_REGION: baseEnv.S3_REGION || "us-east-1",
    S3_SECRET_ACCESS_KEY: baseEnv.S3_SECRET_ACCESS_KEY || "atlas-password",
  };

  let cleaningUp = false;
  let releaseLock = () => {};
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
    releaseLock = acquireProjectLock(config.projectName);
    serviceDriver = selectServiceDriver(config, composeEnv);
    console.info("Starting integration services with " + serviceDriver.name + ".");
    serviceDriver.cleanup();
    serviceDriver.start();
    waitForService("Postgres", () => serviceDriver.checkPostgres());
    waitForService("Redis", () => serviceDriver.checkRedis());
    waitForService("MinIO", () => serviceDriver.checkObjectStorage());
    serviceDriver.initObjectStorage();
    await task({ config, env: serviceEnv, run });
  } finally {
    process.off("SIGINT", handleSigint);
    process.off("SIGTERM", handleSigterm);
    cleanup();
    releaseLock();
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

function acquireProjectLock(projectName) {
  const lockDir = join(tmpdir(), sanitizeResourceName(projectName) + ".lock");
  createLockDir(lockDir, projectName);
  writeFileSync(
    join(lockDir, "owner.json"),
    JSON.stringify({
      pid: process.pid,
      projectName,
      startedAt: new Date().toISOString(),
    }) + "\n",
  );
  return () => rmSync(lockDir, { force: true, recursive: true });
}

function createLockDir(lockDir, projectName) {
  try {
    mkdirSync(lockDir);
    return;
  } catch (error) {
    if (!isNodeError(error) || error.code !== "EEXIST") throw error;
  }

  if (hasStaleLock(lockDir)) {
    rmSync(lockDir, { force: true, recursive: true });
    mkdirSync(lockDir);
    return;
  }

  throw new Error(
    "Local integration services are already running for project " +
      projectName +
      ". Wait for the current command to finish, or set ATLAS_INTEGRATION_PROJECT and alternate ports for a parallel run.",
  );
}

function hasStaleLock(lockDir) {
  const ownerPath = join(lockDir, "owner.json");
  if (!existsSync(ownerPath)) return true;

  try {
    const owner = JSON.parse(readFileSync(ownerPath, "utf8"));
    return typeof owner.pid !== "number" || !isProcessRunning(owner.pid);
  } catch {
    return true;
  }
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ESRCH") return false;
    return true;
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
    checkObjectStorage: () =>
      runCompose(["exec", "-T", "minio", "sh", "-c", "mc alias set local http://127.0.0.1:9000 atlas atlas-password >/dev/null && mc ready local"], {
        stdio: "ignore",
        throwOnError: false,
      }),
    cleanup: () => runCompose(["down", "--volumes", "--remove-orphans"], { throwOnError: false }),
    initObjectStorage: () =>
      runCompose([
        "exec",
        "-T",
        "minio",
        "sh",
        "-c",
        "mc alias set local http://127.0.0.1:9000 atlas atlas-password && mc mb --ignore-existing local/atlas-local && mc anonymous set none local/atlas-local",
      ]),
    name: "Docker Compose",
    start: () => runCompose(["up", "-d", "postgres", "redis", "minio"]),
  };
}

function podmanDriver(config) {
  const resourcePrefix = sanitizeResourceName(config.projectName) || "atlas-integration";
  const postgresContainer = resourcePrefix + "-postgres";
  const redisContainer = resourcePrefix + "-redis";
  const minioContainer = resourcePrefix + "-minio";
  const postgresVolume = resourcePrefix + "-postgres-data";
  const redisVolume = resourcePrefix + "-redis-data";
  const minioVolume = resourcePrefix + "-minio-data";

  return {
    checkPostgres: () => run("podman", ["exec", postgresContainer, "pg_isready", "-U", "atlas", "-d", "atlas"], { stdio: "ignore", throwOnError: false }),
    checkRedis: () => run("podman", ["exec", redisContainer, "redis-cli", "ping"], { stdio: "ignore", throwOnError: false }),
    checkObjectStorage: () =>
      run("podman", ["exec", minioContainer, "sh", "-c", "mc alias set local http://127.0.0.1:9000 atlas atlas-password >/dev/null && mc ready local"], {
        stdio: "ignore",
        throwOnError: false,
      }),
    cleanup: () => {
      run("podman", ["rm", "--force", "--volumes", postgresContainer, redisContainer, minioContainer], { throwOnError: false });
      run("podman", ["volume", "rm", "--force", postgresVolume, redisVolume, minioVolume], { throwOnError: false });
    },
    initObjectStorage: () =>
      run("podman", [
        "exec",
        minioContainer,
        "sh",
        "-c",
        "mc alias set local http://127.0.0.1:9000 atlas atlas-password && mc mb --ignore-existing local/atlas-local && mc anonymous set none local/atlas-local",
      ]),
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
      run("podman", [
        "run",
        "--detach",
        "--name",
        minioContainer,
        "--env",
        "MINIO_ROOT_PASSWORD=atlas-password",
        "--env",
        "MINIO_ROOT_USER=atlas",
        "--publish",
        config.minioApiPort + ":9000",
        "--publish",
        config.minioConsolePort + ":9001",
        "--volume",
        minioVolume + ":/data",
        "docker.io/minio/minio:latest",
        "server",
        "/data",
        "--console-address",
        ":9001",
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

function sanitizeResourceName(name) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "-");
}

function isNodeError(error) {
  return error instanceof Error && "code" in error;
}
