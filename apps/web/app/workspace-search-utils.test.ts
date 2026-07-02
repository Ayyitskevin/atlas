import { describe, expect, it } from "vitest";

import { searchStatusMessage } from "./workspace-search-utils";

describe("workspace search helpers", () => {
  it("formats result counts with pagination state", () => {
    expect(searchStatusMessage(0, false)).toBe("No results");
    expect(searchStatusMessage(1, false)).toBe("1 result");
    expect(searchStatusMessage(2, false)).toBe("2 results");
    expect(searchStatusMessage(8, true)).toBe("Showing 8+ results");
  });
});
