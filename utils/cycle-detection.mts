/**
 * Builds a dependency graph from variable declarations.
 *
 * @param declarations An array of variable declarations, each with optional `name` and `deps` properties.
 * @returns A map where keys are variable names and values are sets of their dependencies.
 */
export function buildDependencyGraphFromDeclarations(declarations: any[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const config of declarations) {
    if (config.deps === undefined) {
      continue;
    }

    const depsForConfig = graph.get(config.name) ?? new Set<string>();

    for (const dep of config.deps) {
      depsForConfig.add(dep);
    }

    graph.set(config.name, depsForConfig);
  }

  return graph;
}

/**
 * Detects circular dependencies in a dependency graph using depth-first search (DFS).
 *
 * @param depGraph A map where keys are node names and values are sets of their dependencies.
 * @returns The cycle path as a string if a cycle is detected, null otherwise.
 */
export function detectCycle(depGraph: Map<string, Set<string>>): string | null {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  for (const node of depGraph.keys()) {
    const cycle = detectCycleHelper(node, depGraph, visited, recursionStack, path);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}

/**
 * Traverses the graph from a starting node to detect cycles.
 *
 * @param node The current node to visit.
 * @param depGraph The dependency graph to traverse.
 * @param visited The set of nodes already fully explored.
 * @param recursionStack The set of nodes in the current DFS path.
 * @param path The ordered path of nodes in the current DFS stack.
 * @returns The cycle path as a string if a cycle is detected, null otherwise.
 */
function detectCycleHelper(
  node: string,
  depGraph: Map<string, Set<string>>,
  visited: Set<string>,
  recursionStack: Set<string>,
  path: string[],
): string | null {
  if (recursionStack.has(node)) {
    // Found a cycle, return the cycle path.
    const cycleStart = path.indexOf(node);
    return [...path.slice(cycleStart), node].join(" -> ");
  }

  if (visited.has(node)) {
    return null;
  }

  visited.add(node);
  recursionStack.add(node);
  path.push(node);

  const deps = depGraph.get(node);
  if (deps) {
    for (const dep of deps) {
      const cycle = detectCycleHelper(dep, depGraph, visited, recursionStack, path);

      if (cycle) {
        return cycle;
      }
    }
  }

  recursionStack.delete(node);
  path.pop();
  return null;
}
