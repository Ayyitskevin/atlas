import { describe, expect, it } from "vitest";

import { parseEnv } from "../../src/config/env.js";

const productionBase = {
  JWT_ACCESS_SECRET: "access-secret-with-at-least-32-chars",
  JWT_REFRESH_SECRET: "refresh-secret-with-at-least-32-chars",
  NODE_ENV: "production",
};

describe("API environment parsing", () => {
  it("allows local development defaults outside production", () => {
    expect(parseEnv({})).toMatchObject({
      JWT_ACCESS_SECRET: "local-dev-access-secret-change-me",
      JWT_REFRESH_SECRET: "local-dev-refresh-secret-change-me",
      NODE_ENV: "development",
    });
  });

  it("rejects local JWT placeholders in production", () => {
    expect(() =>
      parseEnv({
        ...productionBase,
        JWT_ACCESS_SECRET: "local-dev-access-secret-change-me",
        JWT_REFRESH_SECRET: "replace-with-a-long-local-refresh-secret",
      }),
    ).toThrow(/JWT_ACCESS_SECRET.*local development placeholder|JWT_REFRESH_SECRET.*local development placeholder/s);
  });

  it("rejects short JWT secrets in production", () => {
    expect(() =>
      parseEnv({
        ...productionBase,
        JWT_ACCESS_SECRET: "short-access",
      }),
    ).toThrow("JWT_ACCESS_SECRET must be at least 32 characters in production.");
  });

  it("rejects matching JWT secrets in production", () => {
    const sharedSecret = "shared-secret-with-at-least-32-characters";

    expect(() =>
      parseEnv({
        ...productionBase,
        JWT_ACCESS_SECRET: sharedSecret,
        JWT_REFRESH_SECRET: sharedSecret,
      }),
    ).toThrow("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production.");
  });

  it("accepts unique production JWT secrets", () => {
    expect(parseEnv(productionBase)).toMatchObject(productionBase);
  });
});
