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
  const pathIndex = new Map<string, number>();

  for (const node of depGraph.keys()) {
    if (visited.has(node)) {
      continue;
    }

    const stack: Array<{
      node: string;
      entered: boolean;
      iterator?: Iterator<string>;
    }> = [{ node, entered: false }];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];

      if (!frame.entered) {
        frame.entered = true;

        if (visited.has(frame.node)) {
          stack.pop();
          continue;
        }

        visited.add(frame.node);
        recursionStack.add(frame.node);
        pathIndex.set(frame.node, path.length);
        path.push(frame.node);

        const deps = depGraph.get(frame.node) ?? new Set<string>();
        frame.iterator = deps.values();
      }

      const next = frame.iterator?.next();

      if (next && !next.done) {
        const dep = next.value;

        if (recursionStack.has(dep)) {
          const cycleStart = pathIndex.get(dep) ?? path.indexOf(dep);
          return [...path.slice(cycleStart), dep].join(" -> ");
        }

        if (!visited.has(dep)) {
          stack.push({ node: dep, entered: false });
        }

        continue;
      }

      recursionStack.delete(frame.node);
      pathIndex.delete(frame.node);
      path.pop();
      stack.pop();
    }
  }

  return null;
}
