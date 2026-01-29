/**
 * Detects circular dependencies in a dependency graph using depth-first search (DFS).
 * 
 * @param depGraph - A map where keys are node names and values are sets of their dependencies
 * @returns The cycle path as a string if a cycle is detected, null otherwise
 */
export function detectCycle(depGraph: Map<string, Set<string>>): string | null {
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];
  
  const detectCycleHelper = (node: string): string | null => {
    if (recStack.has(node)) {
      // Found a cycle, return the cycle path
      const cycleStart = path.indexOf(node);
      return [...path.slice(cycleStart), node].join(" -> ");
    }
    if (visited.has(node)) return null;
    
    visited.add(node);
    recStack.add(node);
    path.push(node);
    
    const deps = depGraph.get(node);
    if (deps) {
      for (const dep of deps) {
        const cycle = detectCycleHelper(dep);
        if (cycle) return cycle;
      }
    }
    
    recStack.delete(node);
    path.pop();
    return null;
  };
  
  for (const node of depGraph.keys()) {
    const cycle = detectCycleHelper(node);
    if (cycle) {
      return cycle;
    }
  }
  
  return null;
}
