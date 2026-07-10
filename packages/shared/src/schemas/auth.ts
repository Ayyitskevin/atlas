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
  refreshToken: z.string().min(32).optional(),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(12).max(256),
  token: z.string().min(32),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(32),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type RequestPasswordResetRequest = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>;
