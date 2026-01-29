import { describe, expect, it } from "vitest";
import { detectCycle } from "./cycle-detection.mts";

describe("detectCycle", () => {
  it("should return null for an empty graph", () => {
    // Given
    const depGraph = new Map<string, Set<string>>();

    // When
    const result = detectCycle(depGraph);

    // Then
    expect(result).toBe(null);
  });

  it("should return null for a graph with no dependencies", () => {
    // Given
    const depGraph = new Map<string, Set<string>>();
    depGraph.set("A", new Set());
    depGraph.set("B", new Set());
    depGraph.set("C", new Set());

    // When
    const result = detectCycle(depGraph);

    // Then
    expect(result).toBe(null);
  });

  it("should return null for a valid dependency chain (A -> B -> C)", () => {
    // Given
    const depGraph = new Map<string, Set<string>>();
    depGraph.set("A", new Set(["B"]));
    depGraph.set("B", new Set(["C"]));
    depGraph.set("C", new Set());

    // When
    const result = detectCycle(depGraph);

    // Then
    expect(result).toBe(null);
  });

  it("should detect direct self-referencing cycle (A -> A)", () => {
    // Given
    const depGraph = new Map<string, Set<string>>();
    depGraph.set("A", new Set(["A"]));

    // When
    const result = detectCycle(depGraph);

    // Then
    expect(result).toBe("A -> A");
  });

  it("should detect two-node cycle (A -> B -> A)", () => {
    // Given
    const depGraph = new Map<string, Set<string>>();
    depGraph.set("A", new Set(["B"]));
    depGraph.set("B", new Set(["A"]));

    // When
    const result = detectCycle(depGraph);

    // Then
    expect(result).toMatch(/^(A -> B -> A|B -> A -> B)$/);
  });

  it("should detect three-node cycle (A -> B -> C -> A)", () => {
    // Given
    const depGraph = new Map<string, Set<string>>();
    depGraph.set("A", new Set(["B"]));
    depGraph.set("B", new Set(["C"]));
    depGraph.set("C", new Set(["A"]));

    // When
    const result = detectCycle(depGraph);

    // Then
    expect(result).toMatch(/^(A -> B -> C -> A|B -> C -> A -> B|C -> A -> B -> C)$/);
  });

  it("should detect cycle in complex graph with multiple paths", () => {
    // Given: A graph with multiple paths, one of which contains a cycle
    // A -> B -> C
    // D -> E -> F -> D (cycle)
    const depGraph = new Map<string, Set<string>>();
    depGraph.set("A", new Set(["B"]));
    depGraph.set("B", new Set(["C"]));
    depGraph.set("C", new Set());
    depGraph.set("D", new Set(["E"]));
    depGraph.set("E", new Set(["F"]));
    depGraph.set("F", new Set(["D"]));

    // When
    const result = detectCycle(depGraph);

    // Then
    expect(result).not.toBe(null);
    expect(result).toMatch(/D|E|F/);
  });

  it("should return null for a diamond graph with no cycles", () => {
    // Given: A diamond-shaped graph
    //     A
    //    / \
    //   B   C
    //    \ /
    //     D
    const depGraph = new Map<string, Set<string>>();
    depGraph.set("A", new Set(["B", "C"]));
    depGraph.set("B", new Set(["D"]));
    depGraph.set("C", new Set(["D"]));
    depGraph.set("D", new Set());

    // When
    const result = detectCycle(depGraph);

    // Then
    expect(result).toBe(null);
  });

  it("should detect cycle with multiple dependencies per node", () => {
    // Given: A node with multiple dependencies where one path leads to a cycle
    // A -> [B, C]
    // B -> D
    // C -> D
    // D -> A (creates cycle)
    const depGraph = new Map<string, Set<string>>();
    depGraph.set("A", new Set(["B", "C"]));
    depGraph.set("B", new Set(["D"]));
    depGraph.set("C", new Set(["D"]));
    depGraph.set("D", new Set(["A"]));

    // When
    const result = detectCycle(depGraph);

    // Then
    expect(result).not.toBe(null);
    expect(result).toContain("A");
    expect(result).toContain("D");
  });

  it("should handle nodes that are referenced but not defined in the graph", () => {
    // Given: A depends on B, but B is not in the graph
    const depGraph = new Map<string, Set<string>>();
    depGraph.set("A", new Set(["B"]));

    // When
    const result = detectCycle(depGraph);

    // Then: Should not detect a cycle since B has no dependencies
    expect(result).toBe(null);
  });

  it("should detect cycle even with long path", () => {
    // Given: A long chain that loops back
    // A -> B -> C -> D -> E -> A
    const depGraph = new Map<string, Set<string>>();
    depGraph.set("A", new Set(["B"]));
    depGraph.set("B", new Set(["C"]));
    depGraph.set("C", new Set(["D"]));
    depGraph.set("D", new Set(["E"]));
    depGraph.set("E", new Set(["A"]));

    // When
    const result = detectCycle(depGraph);

    // Then
    expect(result).not.toBe(null);
    // The cycle should include all nodes
    expect(result).toContain("A");
    expect(result).toContain("B");
    expect(result).toContain("C");
    expect(result).toContain("D");
    expect(result).toContain("E");
  });
});
