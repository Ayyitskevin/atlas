import { z } from "zod";

const envSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().default("postgresql://atlas:atlas@localhost:5432/atlas"),
  EMAIL_FROM: z.string().default("no-reply@atlas.local"),
  EMAIL_PROVIDER: z.enum(["noop"]).default("noop"),
  JWT_ACCESS_SECRET: z.string().default("local-dev-access-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().default("local-dev-refresh-secret-change-me"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  S3_ACCESS_KEY_ID: z.string().default("atlas"),
  S3_BUCKET: z.string().default("atlas-local"),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_PUBLIC_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_SECRET_ACCESS_KEY: z.string().default("atlas-password"),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
