import { describe, expect, it } from "vitest";

const baseUrl = process.env.ATLAS_E2E_BASE_URL ?? "http://localhost:4000";

describe("dockerized stack smoke", () => {
  it.skipIf(process.env.ATLAS_E2E_DOCKER !== "1")("responds from the API health endpoint", async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toMatchObject({ service: "atlas-api", status: "ok" });
  });
});
