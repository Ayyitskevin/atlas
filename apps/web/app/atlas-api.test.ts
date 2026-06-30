import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./atlas-api";

describe("api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns JSON responses and sends auth headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    await expect(api<{ ok: boolean }>("/health", {}, "access-token")).resolves.toEqual({ ok: true });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers((init as RequestInit | undefined)?.headers);
    expect(headers.get("authorization")).toBe("Bearer access-token");
  });

  it("returns undefined for empty success responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await expect(api<void>("/empty")).resolves.toBeUndefined();
  });

  it("throws structured API error messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Bad input" } }), {
        headers: { "content-type": "application/json" },
        status: 400,
      }),
    );

    await expect(api("/bad-request")).rejects.toThrow("Bad input");
  });

  it("throws text responses when the server does not return JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("upstream down", {
        headers: { "content-type": "text/plain" },
        status: 502,
      }),
    );

    await expect(api("/gateway")).rejects.toThrow("upstream down");
  });

  it("falls back to the HTTP status for empty errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));

    await expect(api("/unavailable")).rejects.toThrow("HTTP 503");
  });
});
