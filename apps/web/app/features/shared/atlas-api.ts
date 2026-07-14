import type { AuthPair } from "./atlas-types";

export const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function api<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", "Bearer " + accessToken);
  const response = await fetch(apiBase + path, { ...init, credentials: "include", headers });
  const data = await responseBody(response);
  if (!response.ok) {
    throw new Error(apiErrorMessage(data) ?? responseErrorMessage(data, response));
  }
  return data as T;
}

async function responseBody(response: Response) {
  if (response.status === 204 || response.headers.get("content-length") === "0") return undefined;
  const text = await response.text();
  if (!text) return undefined;
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function responseErrorMessage(data: unknown, response: Response) {
  if (typeof data === "string" && data.trim()) return data.trim();
  return "HTTP " + response.status;
}

export function apiErrorMessage(data: unknown) {
  if (!data || typeof data !== "object" || !("error" in data)) return undefined;
  const error = (data as { error?: unknown }).error;
  if (!error || typeof error !== "object" || !("message" in error)) return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

export function storeSession(auth: AuthPair) {
  // Access token stays in localStorage for SPA API calls; refresh is also mirrored in httpOnly cookie by the API.
  window.localStorage.setItem("atlas.accessToken", auth.accessToken);
  window.localStorage.setItem("atlas.refreshToken", auth.refreshToken);
}

export function clearSession() {
  window.localStorage.removeItem("atlas.accessToken");
  window.localStorage.removeItem("atlas.refreshToken");
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

/** WebSocket URL without secrets in the query string. Auth is sent as the first message. */
export function websocketUrl() {
  const url = new URL(apiBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = url.pathname.replace(/\/$/, "") + "/ws";
  url.search = "";
  return url.toString();
}
