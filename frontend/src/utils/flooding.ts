/**
 * Message Flooding Simulation Engine
 * BFS wave expansion using LOS overlays as the link graph.
 * Computes hop-by-hop timing using LoRa time-on-air formula.
 */

import type { LOSOverlay } from '../stores/mapStore';
import { computeTimeOnAir, parseCodingRateNum } from './lora';

// ============================================================================
// Types
// ============================================================================

export interface FloodingConfig {
  sourceNodeId: string;
  messagePayloadBytes: number;  // default 32
  processingDelayMs: number;    // per-hop relay delay, default 50
}

export interface FloodWave {
  hopNumber: number;
  nodeIds: string[];
  cumulativeTimeMs: number;
  links: { from: string; to: string; distanceM: number }[];
}

export interface FloodingResult {
  waves: FloodWave[];
  reachedNodeIds: string[];
  unreachedNodeIds: string[];
  totalTimeMs: number;
  totalHops: number;
}

export interface CriticalNodeResult {
  articulationPoints: string[];
  bridges: { from: string; to: string }[];
}

export interface NetworkHealthResult {
  score: number;
  grade: string;
  connectivity: number;
  redundancy: number;
  spofNodes: number;
  spofLinks: number;
  criticalNodes: CriticalNodeResult;
}

// ============================================================================
// Adjacency Graph
// ============================================================================

interface AdjEntry {
  neighbor: string;
  distanceM: number;
}

function buildAdjacencyGraph(losOverlays: LOSOverlay[]): Map<string, AdjEntry[]> {
  const graph = new Map<string, AdjEntry[]>();

  for (const los of losOverlays) {
    if (!los.isViable) continue;

    const a = los.nodeAUuid;
    const b = los.nodeBUuid;

    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);

    graph.get(a)!.push({ neighbor: b, distanceM: los.distanceM });
    graph.get(b)!.push({ neighbor: a, distanceM: los.distanceM });
  }

  return graph;
}

// ============================================================================
// Simulation
// ============================================================================

/**
 * Simulate message flooding from a source node through the mesh network.
 *
 * BFS wave expansion: each "wave" is one hop level from the source.
 * Per-hop time = LoRa time-on-air + processing delay.
 *
 * @param losOverlays - Current LOS overlay results (viable links form the graph)
 * @param allNodeIds  - All node UUIDs in the plan
 * @param config      - Source node, payload size, processing delay
 * @param sf          - Spreading factor (from network radio settings)
 * @param bwKhz       - Bandwidth in kHz
 * @param crNum       - Coding rate numerator (1=4/5, 2=4/6, 3=4/7, 4=4/8)
 */
export function simulateFlooding(
  losOverlays: LOSOverlay[],
  allNodeIds: string[],
  config: FloodingConfig,
  sf: number,
  bwKhz: number,
  crNum: number,
): FloodingResult {
  const graph = buildAdjacencyGraph(losOverlays);

  // Compute per-hop airtime
  const toaResult = computeTimeOnAir(sf, bwKhz, crNum, config.messagePayloadBytes, 16, false, true);
  const perHopMs = toaResult.toaMs + config.processingDelayMs;

  // BFS from source
  const visited = new Set<string>();
  const waves: FloodWave[] = [];

  // Wave 0: source node
  visited.add(config.sourceNodeId);
  waves.push({
    hopNumber: 0,
    nodeIds: [config.sourceNodeId],
    cumulativeTimeMs: 0,
    links: [],
  });

  let currentFrontier = [config.sourceNodeId];

  while (currentFrontier.length > 0) {
    const nextFrontier: string[] = [];
    const waveLinks: { from: string; to: string; distanceM: number }[] = [];

    for (const nodeId of currentFrontier) {
      const neighbors = graph.get(nodeId) || [];
      for (const adj of neighbors) {
        if (visited.has(adj.neighbor)) continue;
        visited.add(adj.neighbor);
        nextFrontier.push(adj.neighbor);
        waveLinks.push({ from: nodeId, to: adj.neighbor, distanceM: adj.distanceM });
      }
    }

    if (nextFrontier.length === 0) break;

    const hopNumber = waves.length;
    waves.push({
      hopNumber,
      nodeIds: nextFrontier,
      cumulativeTimeMs: hopNumber * perHopMs,
      links: waveLinks,
    });

    currentFrontier = nextFrontier;
  }

  const reachedNodeIds = Array.from(visited);
  const unreachedNodeIds = allNodeIds.filter((id) => !visited.has(id));
  const totalHops = waves.length - 1; // exclude wave 0 (source)
  const totalTimeMs = totalHops > 0 ? totalHops * perHopMs : 0;

  return {
    waves,
    reachedNodeIds,
    unreachedNodeIds,
    totalTimeMs,
    totalHops,
  };
}

// ============================================================================
// Critical Node Analysis (Tarjan's bridge-finding, iterative)
// ============================================================================

/**
 * Find articulation points (single points of failure) and bridges in the
 * network graph. Uses an iterative version of Tarjan's algorithm.
 */
export function findCriticalNodes(
  adjacencyMap: Map<string, AdjEntry[]>,
): CriticalNodeResult {
  const nodeIds = Array.from(adjacencyMap.keys());
  if (nodeIds.length === 0) return { articulationPoints: [], bridges: [] };

  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const articulationSet = new Set<string>();
  const bridges: { from: string; to: string }[] = [];

  let timer = 0;

  // Iterative DFS for each connected component
  for (const startNode of nodeIds) {
    if (disc.has(startNode)) continue;

    // Stack entries: [node, neighborIndex]
    const stack: Array<[string, number]> = [[startNode, 0]];
    disc.set(startNode, timer);
    low.set(startNode, timer);
    parent.set(startNode, null);
    timer++;
    const childCount = new Map<string, number>();
    childCount.set(startNode, 0);

    while (stack.length > 0) {
      const [u, idx] = stack[stack.length - 1];
      const neighbors = adjacencyMap.get(u) || [];

      if (idx < neighbors.length) {
        // Advance neighbor index
        stack[stack.length - 1][1] = idx + 1;
        const v = neighbors[idx].neighbor;

        if (!disc.has(v)) {
          // Tree edge
          disc.set(v, timer);
          low.set(v, timer);
          parent.set(v, u);
          timer++;
          childCount.set(u, (childCount.get(u) || 0) + 1);
          childCount.set(v, 0);
          stack.push([v, 0]);
        } else if (v !== parent.get(u)) {
          // Back edge — update low
          low.set(u, Math.min(low.get(u)!, disc.get(v)!));
        }
      } else {
        // Done with u — pop and update parent's low
        stack.pop();
        if (stack.length > 0) {
          const p = stack[stack.length - 1][0];
          low.set(p, Math.min(low.get(p)!, low.get(u)!));

          // Bridge check: if low[u] > disc[p], edge p-u is a bridge
          if (low.get(u)! > disc.get(p)!) {
            bridges.push({ from: p, to: u });
          }

          // Articulation point check
          const pIsRoot = parent.get(p) === null;
          if (pIsRoot) {
            // Root is AP if it has 2+ children
            if ((childCount.get(p) || 0) >= 2) {
              articulationSet.add(p);
            }
          } else {
            // Non-root is AP if low[u] >= disc[p]
            if (low.get(u)! >= disc.get(p)!) {
              articulationSet.add(p);
            }
          }
        }
      }
    }
  }

  return {
    articulationPoints: Array.from(articulationSet),
    bridges,
  };
}

// ============================================================================
// Network Health Score
// ============================================================================

/**
 * Compute a 0-100 network health score with grade (A-F).
 * Four components, 25 points each: connectivity, redundancy, SPOF nodes, SPOF links.
 */
export function computeNetworkHealthScore(
  losOverlays: LOSOverlay[],
  allNodeIds: string[],
): NetworkHealthResult {
  const nodeCount = allNodeIds.length;
  if (nodeCount === 0) {
    return {
      score: 0, grade: 'F', connectivity: 0, redundancy: 0,
      spofNodes: 0, spofLinks: 0,
      criticalNodes: { articulationPoints: [], bridges: [] },
    };
  }

  const graph = buildAdjacencyGraph(losOverlays);

  // 1. Connectivity: BFS from first node, see how many are reachable
  const visited = new Set<string>();
  const startNode = allNodeIds[0];
  const queue = [startNode];
  visited.add(startNode);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const adj of (graph.get(current) || [])) {
      if (!visited.has(adj.neighbor)) {
        visited.add(adj.neighbor);
        queue.push(adj.neighbor);
      }
    }
  }
  const connectivityPct = visited.size / nodeCount;
  const connectivity = connectivityPct * 25;

  // 2. Redundancy: average node degree / 2, capped at 25
  let totalDegree = 0;
  // Count unique edges for edge count
  const edgeSet = new Set<string>();
  for (const [nodeId, neighbors] of graph) {
    // Deduplicate neighbors (graph may have parallel edges from multiple LOS checks)
    const uniqueNeighbors = new Set(neighbors.map((n) => n.neighbor));
    totalDegree += uniqueNeighbors.size;
    for (const nb of uniqueNeighbors) {
      const key = [nodeId, nb].sort().join('-');
      edgeSet.add(key);
    }
  }
  const avgDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
  const redundancy = Math.min(25, (avgDegree / 2) * 25);

  // 3 & 4: SPOF analysis
  const criticalNodes = findCriticalNodes(graph);
  const edgeCount = edgeSet.size;
  const apCount = criticalNodes.articulationPoints.length;
  const bridgeCount = criticalNodes.bridges.length;

  const spofNodes = nodeCount > 1
    ? 25 * (1 - apCount / nodeCount)
    : 25;
  const spofLinks = edgeCount > 0
    ? 25 * (1 - bridgeCount / edgeCount)
    : 0;

  const score = Math.round(connectivity + redundancy + spofNodes + spofLinks);
  const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F';

  return {
    score,
    grade,
    connectivity: Math.round(connectivity),
    redundancy: Math.round(redundancy),
    spofNodes: Math.round(spofNodes),
    spofLinks: Math.round(spofLinks),
    criticalNodes,
  };
}

// ============================================================================
// Node Failure Simulation
// ============================================================================

/**
 * Re-run flooding simulation with a node removed to see the impact.
 */
export function simulateNodeRemoval(
  losOverlays: LOSOverlay[],
  allNodeIds: string[],
  removedNodeId: string,
  config: FloodingConfig,
  sf: number,
  bwKhz: number,
  crNum: number,
): FloodingResult {
  // Filter out all links touching the removed node
  const filteredLos = losOverlays.filter(
    (los) => los.nodeAUuid !== removedNodeId && los.nodeBUuid !== removedNodeId,
  );
  const filteredNodes = allNodeIds.filter((id) => id !== removedNodeId);

  // If the source was removed, pick the first remaining node
  const adjustedConfig: FloodingConfig = {
    ...config,
    sourceNodeId: config.sourceNodeId === removedNodeId
      ? (filteredNodes[0] || '')
      : config.sourceNodeId,
  };

  if (filteredNodes.length === 0 || !adjustedConfig.sourceNodeId) {
    return { waves: [], reachedNodeIds: [], unreachedNodeIds: allNodeIds, totalTimeMs: 0, totalHops: 0 };
  }

  return simulateFlooding(filteredLos, filteredNodes, adjustedConfig, sf, bwKhz, crNum);
}
