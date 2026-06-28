import { describe, expect, it } from "vitest";

import { defaultListPosition } from "../../src/modules/work/position.js";

describe("defaultListPosition", () => {
  it("uses epoch seconds so generated positions fit NUMERIC(20,10)", () => {
    expect(defaultListPosition(1_782_671_279_889)).toBe(1_782_671_279);
  });

  it("clamps values to the numeric column integer limit", () => {
    expect(defaultListPosition(20_000_000_000_000)).toBe(9_999_999_999);
  });
});
