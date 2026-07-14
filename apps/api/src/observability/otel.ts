/**
 * Optional OpenTelemetry bootstrap.
 * Enable with OTEL_EXPORTER_OTLP_ENDPOINT (e.g. http://localhost:4318).
 * When unset, instrumentation is a no-op so local dev stays zero-config.
 *
 * Packages are optional: install OTEL SDK packages when enabling in a deployment.
 * Dynamic import keeps typecheck/runtime free of hard deps when OTEL is off.
 */

import { env } from "../config/env.js";

type SpanLike = {
  end(): void;
  recordException?(error: unknown): void;
  setAttribute?(key: string, value: string | number | boolean): void;
  setStatus?(status: { code: number; message?: string }): void;
};

type TracerLike = {
  startSpan(name: string, options?: { attributes?: Record<string, string | number | boolean> }): SpanLike;
};

const noopSpan: SpanLike = {
  end() {},
  recordException() {},
  setAttribute() {},
  setStatus() {},
};

const noopTracer: TracerLike = {
  startSpan() {
    return noopSpan;
  },
};

let tracer: TracerLike = noopTracer;
let started = false;

export async function startOpenTelemetry(): Promise<void> {
  if (started) return;
  started = true;
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!endpoint) return;

  try {
    // Use Function constructor so TypeScript does not resolve optional package names at compile time.
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<Record<string, unknown>>;

    const api = await dynamicImport("@opentelemetry/api");
    const { NodeSDK } = (await dynamicImport("@opentelemetry/sdk-node")) as {
      NodeSDK: new (config: Record<string, unknown>) => { start(): Promise<void> | void; shutdown(): Promise<void> };
    };
    const { OTLPTraceExporter } = (await dynamicImport("@opentelemetry/exporter-trace-otlp-http")) as {
      OTLPTraceExporter: new (config: { url: string }) => unknown;
    };
    const { resourceFromAttributes } = (await dynamicImport("@opentelemetry/resources")) as {
      resourceFromAttributes: (attrs: Record<string, string>) => unknown;
    };
    const semantic = await dynamicImport("@opentelemetry/semantic-conventions");
    const serviceNameKey = String(semantic.ATTR_SERVICE_NAME ?? "service.name");

    let instrumentations: unknown[] = [];
    try {
      const auto = (await dynamicImport("@opentelemetry/auto-instrumentations-node")) as {
        getNodeAutoInstrumentations: (config: Record<string, unknown>) => unknown;
      };
      instrumentations = [
        auto.getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false },
        }),
      ];
    } catch {
      // auto-instrumentations optional
    }

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [serviceNameKey]: env.OTEL_SERVICE_NAME,
      }),
      traceExporter: new OTLPTraceExporter({ url: endpoint.replace(/\/$/, "") + "/v1/traces" }),
      instrumentations,
    });
    await sdk.start();

    const traceApi = api.trace as { getTracer: (name: string) => TracerLike };
    tracer = traceApi.getTracer("atlas-api");

    const shutdown = async () => {
      await sdk.shutdown().catch(() => undefined);
    };
    process.once("SIGTERM", () => void shutdown());
    process.once("SIGINT", () => void shutdown());
  } catch (error) {
    console.error("[otel] failed to start OpenTelemetry — install OTEL packages or unset OTEL_EXPORTER_OTLP_ENDPOINT", error);
  }
}

export function getTracer(): TracerLike {
  return tracer;
}

export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean> | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const span = getTracer().startSpan(name, { attributes });
  try {
    return await fn();
  } catch (error) {
    span.recordException?.(error);
    span.setStatus?.({ code: 2, message: error instanceof Error ? error.message : "error" });
    throw error;
  } finally {
    span.end();
  }
}
