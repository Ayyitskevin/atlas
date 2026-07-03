import { describe, expect, it } from "vitest";

import { type DependencyEdge, wouldCreateDependencyCycle } from "../../src/modules/work/task-dependencies.js";

function edge(blockingTaskId: string, blockedTaskId: string): DependencyEdge {
  return { blockedTaskId, blockingTaskId };
}

describe("wouldCreateDependencyCycle", () => {
  it("allows the first edge in an empty graph", () => {
    expect(wouldCreateDependencyCycle([], "a", "b")).toBe(false);
  });

  it("rejects a self dependency", () => {
    expect(wouldCreateDependencyCycle([], "a", "a")).toBe(true);
  });

  it("rejects a direct two-node cycle", () => {
    // b already blocks a; adding a -> b closes b -> a -> b.
    expect(wouldCreateDependencyCycle([edge("b", "a")], "a", "b")).toBe(true);
  });

  it("rejects a transitive cycle across a chain", () => {
    // a -> b -> c already exists; adding c -> a closes the loop.
    expect(wouldCreateDependencyCycle([edge("a", "b"), edge("b", "c")], "c", "a")).toBe(true);
  });

  it("allows extending a chain forward", () => {
    // a -> b -> c already exists; adding c -> d stays acyclic.
    expect(wouldCreateDependencyCycle([edge("a", "b"), edge("b", "c")], "c", "d")).toBe(false);
  });

  it("allows a shortcut edge inside a diamond", () => {
    // a -> b, a -> c, b -> d, c -> d; adding b -> c keeps it a DAG.
    const edges = [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")];
    expect(wouldCreateDependencyCycle(edges, "b", "c")).toBe(false);
  });

  it("rejects a back edge that closes a diamond", () => {
    const edges = [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")];
    expect(wouldCreateDependencyCycle(edges, "d", "a")).toBe(true);
  });

  it("ignores unrelated components", () => {
    const edges = [edge("x", "y"), edge("y", "z")];
    expect(wouldCreateDependencyCycle(edges, "a", "b")).toBe(false);
  });
});
