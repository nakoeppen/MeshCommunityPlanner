/**
 * Client-side multi-hop path routing utility.
 * Builds an adjacency graph from LOS overlays (viable links only)
 * and computes shortest paths using BFS / Yen's k-shortest paths.
 */

import type { LOSOverlay } from '../stores/mapStore';

// ============================================================================
// Types
// ============================================================================

export interface RouteResult {
  path: string[];           // ordered node UUIDs
  hopCount: number;
  totalDistanceM: number;
  pathLinks: {
    nodeAUuid: string;
    nodeBUuid: string;
    distanceM: number;
    linkQuality: string;
  }[];
  isReachable: boolean;
}

interface AdjEntry {
  neighbor: string;
  distanceM: number;
  linkQuality: string;
}

// ============================================================================
// Graph Construction
// ============================================================================

function buildAdjacencyGraph(losOverlays: LOSOverlay[]): Map<string, AdjEntry[]> {
  const graph = new Map<string, AdjEntry[]>();

  for (const los of losOverlays) {
    if (!los.isViable) continue;

    const a = los.nodeAUuid;
    const b = los.nodeBUuid;

    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);

    graph.get(a)!.push({ neighbor: b, distanceM: los.distanceM, linkQuality: los.linkQuality });
    graph.get(b)!.push({ neighbor: a, distanceM: los.distanceM, linkQuality: los.linkQuality });
  }

  return graph;
}

// ============================================================================
// BFS Shortest Path (hop count)
// ============================================================================

function bfsShortestPath(
  graph: Map<string, AdjEntry[]>,
  sourceId: string,
  targetId: string,
  excludedEdges?: Set<string>,
): string[] | null {
  if (sourceId === targetId) return [sourceId];
  if (!graph.has(sourceId) || !graph.has(targetId)) return null;

  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue: string[] = [sourceId];
  visited.add(sourceId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const adj of graph.get(current) || []) {
      if (excludedEdges) {
        const edgeKey = [current, adj.neighbor].sort().join('|');
        if (excludedEdges.has(edgeKey)) continue;
      }
      if (visited.has(adj.neighbor)) continue;
      visited.add(adj.neighbor);
      parent.set(adj.neighbor, current);

      if (adj.neighbor === targetId) {
        // Reconstruct path
        const path: string[] = [];
        let node: string | undefined = targetId;
        while (node !== undefined) {
          path.unshift(node);
          node = parent.get(node);
        }
        return path;
      }

      queue.push(adj.neighbor);
    }
  }

  return null;
}

// ============================================================================
// Build RouteResult from path
// ============================================================================

function buildRouteResult(
  path: string[] | null,
  graph: Map<string, AdjEntry[]>,
): RouteResult {
  if (!path || path.length < 2) {
    return {
      path: path || [],
      hopCount: 0,
      totalDistanceM: 0,
      pathLinks: [],
      isReachable: false,
    };
  }

  const pathLinks: RouteResult['pathLinks'] = [];
  let totalDistanceM = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const adj = (graph.get(a) || []).find((e) => e.neighbor === b);
    const distanceM = adj?.distanceM || 0;
    const linkQuality = adj?.linkQuality || 'unknown';
    pathLinks.push({ nodeAUuid: a, nodeBUuid: b, distanceM, linkQuality });
    totalDistanceM += distanceM;
  }

  return {
    path,
    hopCount: path.length - 1,
    totalDistanceM,
    pathLinks,
    isReachable: true,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Find the shortest path (by hop count) between two nodes using BFS.
 */
export function findShortestPath(
  sourceId: string,
  targetId: string,
  losOverlays: LOSOverlay[],
): RouteResult {
  const graph = buildAdjacencyGraph(losOverlays);
  const path = bfsShortestPath(graph, sourceId, targetId);
  return buildRouteResult(path, graph);
}

/**
 * Find up to k shortest paths using Yen's algorithm (hop-count based).
 */
export function findKShortestPaths(
  sourceId: string,
  targetId: string,
  losOverlays: LOSOverlay[],
  k: number = 3,
): RouteResult[] {
  const graph = buildAdjacencyGraph(losOverlays);

  // First shortest path via BFS
  const firstPath = bfsShortestPath(graph, sourceId, targetId);
  if (!firstPath) {
    return [buildRouteResult(null, graph)];
  }

  const A: string[][] = [firstPath]; // k shortest paths found
  const B: string[][] = [];          // candidate paths

  for (let kIdx = 1; kIdx < k; kIdx++) {
    const prevPath = A[kIdx - 1];

    for (let i = 0; i < prevPath.length - 1; i++) {
      const spurNode = prevPath[i];
      const rootPath = prevPath.slice(0, i + 1);

      // Exclude edges that share the same root path prefix
      const excludedEdges = new Set<string>();
      for (const p of A) {
        if (p.length > i && arraysEqualUpTo(p, rootPath, i + 1)) {
          const edgeKey = [p[i], p[i + 1]].sort().join('|');
          excludedEdges.add(edgeKey);
        }
      }

      // Also exclude nodes in rootPath (except spurNode) by temporarily removing edges
      const rootNodes = new Set(rootPath.slice(0, -1));
      for (const [node, adjs] of graph) {
        if (rootNodes.has(node)) {
          for (const adj of adjs) {
            const edgeKey = [node, adj.neighbor].sort().join('|');
            excludedEdges.add(edgeKey);
          }
        }
      }

      const spurPath = bfsShortestPath(graph, spurNode, targetId, excludedEdges);
      if (spurPath) {
        const totalPath = [...rootPath.slice(0, -1), ...spurPath];
        // Check for duplicates
        if (!B.some((p) => arraysEqual(p, totalPath)) && !A.some((p) => arraysEqual(p, totalPath))) {
          B.push(totalPath);
        }
      }
    }

    if (B.length === 0) break;

    // Sort candidates by hop count, then total distance
    B.sort((a, b) => {
      if (a.length !== b.length) return a.length - b.length;
      return pathDistance(a, graph) - pathDistance(b, graph);
    });

    A.push(B.shift()!);
  }

  return A.map((path) => buildRouteResult(path, graph));
}

// ============================================================================
// Helpers
// ============================================================================

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function arraysEqualUpTo(a: string[], b: string[], len: number): boolean {
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function pathDistance(path: string[], graph: Map<string, AdjEntry[]>): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const adj = (graph.get(path[i]) || []).find((e) => e.neighbor === path[i + 1]);
    total += adj?.distanceM || 0;
  }
  return total;
}
