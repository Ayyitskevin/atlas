import { z } from "zod";

const localDevAccessSecret = "local-dev-access-secret-change-me";
const localDevRefreshSecret = "local-dev-refresh-secret-change-me";
const minimumProductionSecretLength = 32;

const envSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().default("postgresql://atlas:atlas@localhost:5432/atlas"),
  EMAIL_FROM: z.string().default("no-reply@atlas.local"),
  EMAIL_PROVIDER: z.enum(["noop", "resend"]).default("noop"),
  JWT_ACCESS_SECRET: z.string().default(localDevAccessSecret),
  JWT_REFRESH_SECRET: z.string().default(localDevRefreshSecret),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  NODE_ENV: z.string().default("development"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_API_URL: z.string().url().default("https://api.resend.com"),
  S3_ACCESS_KEY_ID: z.string().default("atlas"),
  S3_BUCKET: z.string().default("atlas-local"),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_PUBLIC_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_SECRET_ACCESS_KEY: z.string().default("atlas-password"),
  ATTACHMENT_SCAN_PROVIDER: z.enum(["noop"]).default("noop"),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
}).superRefine((value, ctx) => {
  if (value.EMAIL_PROVIDER === "resend" && !value.RESEND_API_KEY?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "RESEND_API_KEY is required when EMAIL_PROVIDER=resend.",
      path: ["RESEND_API_KEY"],
    });
  }
  if (value.NODE_ENV === "production") {
    requireProductionJwtSecret(ctx, "JWT_ACCESS_SECRET", value.JWT_ACCESS_SECRET, localDevAccessSecret);
    requireProductionJwtSecret(ctx, "JWT_REFRESH_SECRET", value.JWT_REFRESH_SECRET, localDevRefreshSecret);
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production.",
        path: ["JWT_REFRESH_SECRET"],
      });
    }
  }
});

export function parseEnv(input: NodeJS.ProcessEnv) {
  return envSchema.parse(input);
}

export const env = parseEnv(process.env);

function requireProductionJwtSecret(ctx: z.RefinementCtx, name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET", value: string, localDefault: string) {
  if (value === localDefault || value.startsWith("replace-with-")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: name + " must be changed from the local development placeholder in production.",
      path: [name],
    });
    return;
  }

  if (value.length < minimumProductionSecretLength) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: name + " must be at least " + minimumProductionSecretLength + " characters in production.",
      path: [name],
    });
  }
}
