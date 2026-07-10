"use client";

import type { FormEvent } from "react";

export type AuthPanelMode = "login" | "register" | "forgot" | "reset";

type AuthPanelProps = {
  invitationMessage?: string;
  message?: string;
  mode: AuthPanelMode;
  onModeChange: (mode: AuthPanelMode) => void;
  onRequestPasswordReset: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onResetPassword: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSubmitAuth: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onVerifyEmail: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  resetToken: string;
  statusMessage?: string;
  verifyToken: string;
};

export function AuthPanel({
  invitationMessage,
  message,
  mode,
  onModeChange,
  onRequestPasswordReset,
  onResetPassword,
  onSubmitAuth,
  onVerifyEmail,
  resetToken,
  statusMessage,
  verifyToken,
}: AuthPanelProps) {
  const title =
    mode === "register"
      ? "Create your account"
      : mode === "forgot"
        ? "Reset your password"
        : mode === "reset"
          ? "Choose a new password"
          : "Log in";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Atlas</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {mode === "forgot"
              ? "We will email a one-time reset link if the account exists."
              : mode === "reset"
                ? "Use the token from your email, or paste a new password for the open reset link."
                : "Team workspaces, boards, and realtime collaboration."}
          </p>
        </div>

        {verifyToken && mode === "login" ? (
          <form className="grid gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3" onSubmit={(event) => void onVerifyEmail(event)}>
            <p className="text-sm font-medium text-emerald-900">Email verification link loaded.</p>
            <input name="token" type="hidden" value={verifyToken} />
            <button className="rounded-md bg-emerald-800 px-3 py-2 text-sm font-semibold text-white" type="submit">
              Verify email
            </button>
          </form>
        ) : null}

        {mode === "login" || mode === "register" ? (
          <form className="grid gap-4" onSubmit={(event) => void onSubmitAuth(event)}>
            {mode === "register" ? (
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Name
                <input className="rounded-md border border-slate-300 px-3 py-2" name="name" required />
              </label>
            ) : null}
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Email
              <input className="rounded-md border border-slate-300 px-3 py-2" name="email" required type="email" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Password
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                minLength={mode === "register" ? 12 : 1}
                name="password"
                required
                type="password"
              />
            </label>
            {mode === "register" ? (
              <p className="text-xs text-slate-500">Password must be at least 12 characters. We will send a verification email.</p>
            ) : null}
            {message ? <p className="text-sm text-red-700">{message}</p> : null}
            {statusMessage ? <p className="text-sm text-slate-600">{statusMessage}</p> : null}
            {invitationMessage ? <p className="text-sm text-slate-600">{invitationMessage}</p> : null}
            <button className="rounded-md bg-slate-950 px-4 py-2 font-semibold text-white" type="submit">
              {mode === "register" ? "Register" : "Log in"}
            </button>
          </form>
        ) : null}

        {mode === "forgot" ? (
          <form className="grid gap-4" onSubmit={(event) => void onRequestPasswordReset(event)}>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Email
              <input className="rounded-md border border-slate-300 px-3 py-2" name="email" required type="email" />
            </label>
            {message ? <p className="text-sm text-red-700">{message}</p> : null}
            {statusMessage ? <p className="text-sm text-slate-600">{statusMessage}</p> : null}
            <button className="rounded-md bg-slate-950 px-4 py-2 font-semibold text-white" type="submit">
              Send reset link
            </button>
          </form>
        ) : null}

        {mode === "reset" ? (
          <form className="grid gap-4" onSubmit={(event) => void onResetPassword(event)}>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Reset token
              <input className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs" defaultValue={resetToken} name="token" required />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              New password
              <input className="rounded-md border border-slate-300 px-3 py-2" minLength={12} name="password" required type="password" />
            </label>
            {message ? <p className="text-sm text-red-700">{message}</p> : null}
            {statusMessage ? <p className="text-sm text-slate-600">{statusMessage}</p> : null}
            <button className="rounded-md bg-slate-950 px-4 py-2 font-semibold text-white" type="submit">
              Update password
            </button>
          </form>
        ) : null}

        <div className="grid gap-2 border-t border-slate-100 pt-3 text-sm">
          {mode === "login" ? (
            <>
              <button className="text-left font-medium text-slate-600" onClick={() => onModeChange("forgot")} type="button">
                Forgot password?
              </button>
              <button className="text-left font-medium text-slate-600" onClick={() => onModeChange("register")} type="button">
                Create an account
              </button>
            </>
          ) : null}
          {mode === "register" ? (
            <button className="text-left font-medium text-slate-600" onClick={() => onModeChange("login")} type="button">
              Use an existing account
            </button>
          ) : null}
          {mode === "forgot" || mode === "reset" ? (
            <button className="text-left font-medium text-slate-600" onClick={() => onModeChange("login")} type="button">
              Back to log in
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
