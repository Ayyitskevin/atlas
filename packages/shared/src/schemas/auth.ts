import { z } from "zod";

export const registerRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(12).max(256),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(32),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
