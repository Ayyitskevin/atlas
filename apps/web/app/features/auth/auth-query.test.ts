import { describe, expect, it } from "vitest";

import { authModeFromQuery, readAuthQueryTokens } from "./auth-query";

describe("auth query helpers", () => {
  it("reads verify and reset tokens from the query string", () => {
    expect(readAuthQueryTokens("?verifyToken=abc&resetToken=def")).toEqual({
      resetToken: "def",
      verifyToken: "abc",
    });
  });

  it("defaults to login unless a reset token is present", () => {
    expect(authModeFromQuery({ resetToken: "", verifyToken: "x" })).toBe("login");
    expect(authModeFromQuery({ resetToken: "token-value-here", verifyToken: "" })).toBe("reset");
  });
});
