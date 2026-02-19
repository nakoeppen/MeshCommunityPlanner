"""Topology graph computation — adjacency, hop counts, articulation points.

Builds a mesh network topology graph from node positions and link viability,
computes shortest paths (BFS), detects single points of failure (Tarjan's
algorithm for articulation points), and calculates resilience metrics.

Phase 12 tasks: 12.7 (topology graph), 12.8 (topology API).
"""

from __future__ import annotations

import heapq
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Optional

# Safety limits
MAX_NODES_FOR_ALL_PAIRS = 5000  # O(V^2) guard for compute_all_hop_counts


@dataclass
class TopologyEdge:
    """An edge in the mesh topology graph."""

    node_a_id: str
    node_b_id: str
    distance_m: float = 0.0
    link_quality: str = "weak"  # strong/marginal/weak
    is_viable: bool = True


@dataclass
class TopologyNode:
    """A node in the mesh topology graph."""

    node_id: str
    latitude: float = 0.0
    longitude: float = 0.0
    is_articulation_point: bool = False


@dataclass
class ResilienceMetrics:
    """Network resilience summary statistics."""

    total_nodes: int = 0
    total_links: int = 0
    avg_connectivity: float = 0.0
    articulation_points: list[str] = field(default_factory=list)
    spof_count: int = 0
    network_diameter: int = 0
    is_fully_connected: bool = False


@dataclass
class RemovalResult:
    """Result of simulating a node removal."""

    removed_node_id: str
    clusters: list[list[str]] = field(default_factory=list)
    disconnected_nodes: list[str] = field(default_factory=list)
    was_articulation_point: bool = False


class TopologyGraph:
    """Mesh network topology graph with analysis capabilities.

    Supports:
    - Building adjacency graph from edges
    - BFS shortest paths / hop counts
    - Tarjan's algorithm for articulation points
    - Network resilience metrics
    - Node removal simulation
    """

    def __init__(self) -> None:
        self._nodes: dict[str, TopologyNode] = {}
        self._edges: list[TopologyEdge] = []
        self._adjacency: dict[str, set[str]] = defaultdict(set)

    @property
    def node_count(self) -> int:
        return len(self._nodes)

    @property
    def edge_count(self) -> int:
        return len(self._edges)

    @property
    def nodes(self) -> dict[str, TopologyNode]:
        return dict(self._nodes)

    @property
    def edges(self) -> list[TopologyEdge]:
        return list(self._edges)

    def add_node(
        self,
        node_id: str,
        latitude: float = 0.0,
        longitude: float = 0.0,
    ) -> None:
        """Add a node to the graph."""
        self._nodes[node_id] = TopologyNode(
            node_id=node_id,
            latitude=latitude,
            longitude=longitude,
        )

    def add_edge(self, edge: TopologyEdge) -> None:
        """Add a viable edge to the graph.

        Only viable edges (is_viable=True) are added to the adjacency graph.
        Non-viable edges are stored but don't affect connectivity.
        """
        self._edges.append(edge)
        # Ensure both nodes exist
        if edge.node_a_id not in self._nodes:
            self._nodes[edge.node_a_id] = TopologyNode(node_id=edge.node_a_id)
        if edge.node_b_id not in self._nodes:
            self._nodes[edge.node_b_id] = TopologyNode(node_id=edge.node_b_id)
        if edge.is_viable:
            self._adjacency[edge.node_a_id].add(edge.node_b_id)
            self._adjacency[edge.node_b_id].add(edge.node_a_id)

    def get_neighbors(self, node_id: str) -> set[str]:
        """Get the set of nodes connected to the given node."""
        return set(self._adjacency.get(node_id, set()))

    def compute_hop_counts(self, source_id: str) -> dict[str, int]:
        """Compute shortest hop counts from source to all reachable nodes using BFS.

        Args:
            source_id: Starting node ID.

        Returns:
            Dict mapping node_id → hop count. Unreachable nodes are not included.

        Raises:
            KeyError: If source_id is not in the graph.
        """
        if source_id not in self._nodes:
            raise KeyError(f"Node '{source_id}' not in graph")

        distances: dict[str, int] = {source_id: 0}
        queue = deque([source_id])

        while queue:
            current = queue.popleft()
            for neighbor in self._adjacency.get(current, set()):
                if neighbor not in distances:
                    distances[neighbor] = distances[current] + 1
                    queue.append(neighbor)

        return distances

    def compute_all_hop_counts(self) -> dict[str, dict[str, int]]:
        """Compute hop counts between all pairs of nodes.

        Returns:
            Nested dict: hop_counts[source][dest] = count.

        Raises:
            ValueError: If node count exceeds MAX_NODES_FOR_ALL_PAIRS.
        """
        if len(self._nodes) > MAX_NODES_FOR_ALL_PAIRS:
            raise ValueError(
                f"Graph has {len(self._nodes)} nodes, exceeds safety limit of "
                f"{MAX_NODES_FOR_ALL_PAIRS} for all-pairs BFS (O(V^2)). "
                f"Use compute_hop_counts() for individual source nodes instead."
            )
        return {
            node_id: self.compute_hop_counts(node_id)
            for node_id in self._nodes
        }

    def find_articulation_points(self) -> list[str]:
        """Find all articulation points using iterative Tarjan's algorithm.

        An articulation point (cut vertex) is a node whose removal disconnects
        the graph. These are single points of failure in the mesh network.

        Uses an explicit stack instead of recursion to avoid Python's
        1,000-frame stack limit on long node chains.

        Returns:
            List of node IDs that are articulation points.
        """
        if not self._nodes:
            return []

        visited: set[str] = set()
        disc: dict[str, int] = {}
        low: dict[str, int] = {}
        parent: dict[str, Optional[str]] = {}
        children_count: dict[str, int] = {}
        ap_set: set[str] = set()
        timer = 0

        for start_node in self._nodes:
            if start_node in visited:
                continue

            parent[start_node] = None
            children_count[start_node] = 0

            # Stack holds [node, neighbors_list, index] — mutable lists
            # avoid tuple repacking on every neighbor advance
            stack: list[list] = []
            # Initialize start node
            visited.add(start_node)
            disc[start_node] = low[start_node] = timer
            timer += 1
            neighbors = list(self._adjacency.get(start_node, set()))
            stack.append([start_node, neighbors, 0])

            while stack:
                frame = stack[-1]
                u = frame[0]
                nbrs = frame[1]
                idx = frame[2]

                if idx < len(nbrs):
                    v = nbrs[idx]
                    frame[2] = idx + 1  # Mutate in place — no repacking

                    if v not in visited:
                        children_count[u] = children_count.get(u, 0) + 1
                        parent[v] = u
                        children_count[v] = 0
                        visited.add(v)
                        disc[v] = low[v] = timer
                        timer += 1
                        v_neighbors = list(self._adjacency.get(v, set()))
                        stack.append([v, v_neighbors, 0])
                    elif v != parent.get(u):
                        low[u] = min(low[u], disc[v])
                else:
                    # All neighbors of u processed — backtrack
                    stack.pop()
                    if stack:
                        p = stack[-1][0]  # parent of u
                        low[p] = min(low[p], low[u])

                        # Check AP conditions — cache parent lookup
                        parent_of_p = parent[p]
                        if parent_of_p is None and children_count.get(p, 0) > 1:
                            ap_set.add(p)
                        elif parent_of_p is not None and low[u] >= disc[p]:
                            ap_set.add(p)

        # Update node flags
        for node_id in self._nodes:
            self._nodes[node_id].is_articulation_point = node_id in ap_set

        return sorted(ap_set)

    def find_bridges(self) -> list[tuple[str, str]]:
        """Find all bridge edges using iterative DFS.

        A bridge is an edge whose removal disconnects the graph.
        These are link-level single points of failure in the mesh network.

        Uses the same DFS as Tarjan's AP but checks the edge condition:
        edge (u, v) is a bridge if low[v] > disc[u].

        Returns:
            List of (node_a_id, node_b_id) tuples for bridge edges.
        """
        if not self._nodes:
            return []

        visited: set[str] = set()
        disc: dict[str, int] = {}
        low: dict[str, int] = {}
        parent: dict[str, Optional[str]] = {}
        bridges: list[tuple[str, str]] = []
        timer = 0

        for start_node in self._nodes:
            if start_node in visited:
                continue

            parent[start_node] = None
            visited.add(start_node)
            disc[start_node] = low[start_node] = timer
            timer += 1
            neighbors = list(self._adjacency.get(start_node, set()))
            stack: list[list] = [[start_node, neighbors, 0]]

            while stack:
                frame = stack[-1]
                u = frame[0]
                nbrs = frame[1]
                idx = frame[2]

                if idx < len(nbrs):
                    v = nbrs[idx]
                    frame[2] = idx + 1

                    if v not in visited:
                        parent[v] = u
                        visited.add(v)
                        disc[v] = low[v] = timer
                        timer += 1
                        v_neighbors = list(self._adjacency.get(v, set()))
                        stack.append([v, v_neighbors, 0])
                    elif v != parent.get(u):
                        low[u] = min(low[u], disc[v])
                else:
                    stack.pop()
                    if stack:
                        p = stack[-1][0]
                        low[p] = min(low[p], low[u])
                        # Bridge condition: strict inequality
                        if low[u] > disc[p]:
                            bridges.append((p, u))

        return sorted(bridges)

    def is_connected(self) -> bool:
        """Check if the graph is fully connected."""
        if not self._nodes:
            return True
        start = next(iter(self._nodes))
        reachable = self.compute_hop_counts(start)
        return len(reachable) == len(self._nodes)

    def compute_diameter(self) -> int:
        """Compute the network diameter (maximum shortest path between any pair).

        Returns 0 for empty or single-node graphs.
        Returns -1 if the graph is disconnected.
        """
        if len(self._nodes) <= 1:
            return 0

        all_hops = self.compute_all_hop_counts()
        max_hops = 0

        for source_hops in all_hops.values():
            if len(source_hops) < len(self._nodes):
                return -1  # Disconnected
            for hops in source_hops.values():
                if hops > max_hops:
                    max_hops = hops

        return max_hops

    def compute_resilience_metrics(self) -> ResilienceMetrics:
        """Compute network resilience summary statistics."""
        total_nodes = len(self._nodes)
        viable_edges = [e for e in self._edges if e.is_viable]
        total_links = len(viable_edges)

        if total_nodes == 0:
            return ResilienceMetrics()

        avg_connectivity = (2 * total_links) / total_nodes if total_nodes > 0 else 0.0
        articulation_points = self.find_articulation_points()
        diameter = self.compute_diameter()
        is_connected = diameter >= 0

        return ResilienceMetrics(
            total_nodes=total_nodes,
            total_links=total_links,
            avg_connectivity=avg_connectivity,
            articulation_points=articulation_points,
            spof_count=len(articulation_points),
            network_diameter=max(diameter, 0),
            is_fully_connected=is_connected,
        )

    def simulate_removal(self, node_id: str) -> RemovalResult:
        """Simulate removing a node and return the resulting clusters.

        Args:
            node_id: ID of the node to remove.

        Returns:
            RemovalResult with clusters and disconnected nodes.

        Raises:
            KeyError: If node_id is not in the graph.
        """
        if node_id not in self._nodes:
            raise KeyError(f"Node '{node_id}' not in graph")

        was_ap = self._nodes[node_id].is_articulation_point

        # Build adjacency without the removed node
        remaining_nodes = set(self._nodes.keys()) - {node_id}
        temp_adj: dict[str, set[str]] = defaultdict(set)

        for a_id, neighbors in self._adjacency.items():
            if a_id == node_id:
                continue
            for b_id in neighbors:
                if b_id != node_id:
                    temp_adj[a_id].add(b_id)

        # Find connected components via BFS
        visited: set[str] = set()
        clusters: list[list[str]] = []

        for start in remaining_nodes:
            if start in visited:
                continue
            cluster: list[str] = []
            queue = deque([start])
            visited.add(start)
            while queue:
                current = queue.popleft()
                cluster.append(current)
                for neighbor in temp_adj.get(current, set()):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append(neighbor)
            clusters.append(sorted(cluster))

        # Sort clusters by size descending
        clusters.sort(key=len, reverse=True)

        # Nodes that are isolated (single-node clusters)
        disconnected = [c[0] for c in clusters if len(c) == 1]

        return RemovalResult(
            removed_node_id=node_id,
            clusters=clusters,
            disconnected_nodes=disconnected,
            was_articulation_point=was_ap,
        )

    def shortest_path(self, source_id: str, target_id: str) -> Optional[list[str]]:
        """Find shortest path (fewest hops) between two nodes using BFS.

        Uses predecessor dict instead of storing full paths in queue,
        reducing memory from O(V * path_length) to O(V).

        Returns list of node IDs from source to target, or None if unreachable.
        """
        if source_id not in self._nodes:
            raise KeyError(f"Node '{source_id}' not in graph")
        if target_id not in self._nodes:
            raise KeyError(f"Node '{target_id}' not in graph")

        if source_id == target_id:
            return [source_id]

        prev: dict[str, str] = {}
        visited: set[str] = {source_id}
        queue: deque[str] = deque([source_id])

        while queue:
            current = queue.popleft()
            for neighbor in self._adjacency.get(current, set()):
                if neighbor not in visited:
                    visited.add(neighbor)
                    prev[neighbor] = current
                    if neighbor == target_id:
                        # Reconstruct path from predecessor chain
                        path = [target_id]
                        node = target_id
                        while node != source_id:
                            node = prev[node]
                            path.append(node)
                        path.reverse()
                        return path
                    queue.append(neighbor)

        return None  # Unreachable

    def _get_weights(self) -> dict[tuple[str, str], float]:
        """Build or return cached edge weight lookup for Dijkstra.

        Invalidated when edges change (cache rebuilt on next call).
        """
        if not hasattr(self, "_weight_cache") or self._weight_cache_len != len(self._edges):
            weights: dict[tuple[str, str], float] = {}
            for edge in self._edges:
                if edge.is_viable:
                    weights[(edge.node_a_id, edge.node_b_id)] = edge.distance_m
                    weights[(edge.node_b_id, edge.node_a_id)] = edge.distance_m
            self._weight_cache = weights
            self._weight_cache_len = len(self._edges)
        return self._weight_cache

    def shortest_weighted_path(
        self, source_id: str, target_id: str
    ) -> Optional[tuple[list[str], float]]:
        """Find shortest weighted path using Dijkstra (distance_m as weight).

        Returns (path, total_distance_m) or None if unreachable.
        """
        if source_id not in self._nodes:
            raise KeyError(f"Node '{source_id}' not in graph")
        if target_id not in self._nodes:
            raise KeyError(f"Node '{target_id}' not in graph")

        if source_id == target_id:
            return [source_id], 0.0

        weights = self._get_weights()

        dist: dict[str, float] = {source_id: 0.0}
        prev: dict[str, Optional[str]] = {source_id: None}
        heap: list[tuple[float, str]] = [(0.0, source_id)]

        while heap:
            d, u = heapq.heappop(heap)
            if u == target_id:
                # Reconstruct path
                path = []
                node = target_id
                while node is not None:
                    path.append(node)
                    node = prev[node]
                return list(reversed(path)), d
            if d > dist.get(u, float("inf")):
                continue
            for neighbor in self._adjacency.get(u, set()):
                w = weights.get((u, neighbor), float("inf"))
                new_dist = d + w
                if new_dist < dist.get(neighbor, float("inf")):
                    dist[neighbor] = new_dist
                    prev[neighbor] = u
                    heapq.heappush(heap, (new_dist, neighbor))

        return None

    def minimum_spanning_tree(self) -> list[TopologyEdge]:
        """Compute minimum spanning tree using Kruskal's algorithm.

        Uses distance_m as edge weight. Only considers viable edges.
        Returns list of edges forming the MST.
        Returns empty list if graph has no edges or is disconnected.
        """
        viable = [e for e in self._edges if e.is_viable]
        viable.sort(key=lambda e: e.distance_m)

        # Union-Find
        parent: dict[str, str] = {n: n for n in self._nodes}
        rank: dict[str, int] = {n: 0 for n in self._nodes}

        def find(x: str) -> str:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(a: str, b: str) -> bool:
            ra, rb = find(a), find(b)
            if ra == rb:
                return False
            if rank[ra] < rank[rb]:
                ra, rb = rb, ra
            parent[rb] = ra
            if rank[ra] == rank[rb]:
                rank[ra] += 1
            return True

        mst: list[TopologyEdge] = []
        for edge in viable:
            if union(edge.node_a_id, edge.node_b_id):
                mst.append(edge)
                if len(mst) == len(self._nodes) - 1:
                    break

        return mst

    def edge_connectivity(self) -> int:
        """Compute edge connectivity — minimum edges to remove to disconnect graph.

        Uses iterative BFS to find min-cut. For mesh planning, this indicates
        how many links must fail before the network splits.
        Returns 0 if already disconnected or empty.
        """
        if len(self._nodes) <= 1:
            return 0 if len(self._nodes) == 0 else 0

        if not self.is_connected():
            return 0

        # Build base capacity once, copy for each flow computation
        base_capacity: dict[tuple[str, str], int] = {}
        for edge in self._edges:
            if edge.is_viable:
                base_capacity[(edge.node_a_id, edge.node_b_id)] = 1
                base_capacity[(edge.node_b_id, edge.node_a_id)] = 1

        node_list = list(self._nodes.keys())
        source = node_list[0]
        min_cut = float("inf")

        for target in node_list[1:]:
            flow = self._max_flow_bfs(source, target, base_capacity)
            min_cut = min(min_cut, flow)
            if min_cut == 0:
                break  # Can't get lower than 0

        return int(min_cut) if min_cut != float("inf") else 0

    def _max_flow_bfs(
        self,
        source: str,
        target: str,
        base_capacity: dict[tuple[str, str], int] | None = None,
    ) -> int:
        """Edmonds-Karp max-flow (unit capacity) between source and target.

        Accepts pre-built base_capacity to avoid rebuilding per call.
        """
        if base_capacity is not None:
            capacity = dict(base_capacity)
        else:
            capacity = {}
            for edge in self._edges:
                if edge.is_viable:
                    capacity[(edge.node_a_id, edge.node_b_id)] = 1
                    capacity[(edge.node_b_id, edge.node_a_id)] = 1

        flow_total = 0

        while True:
            # BFS to find augmenting path
            visited = {source}
            parent: dict[str, str] = {}
            queue = deque([source])
            found = False

            while queue and not found:
                u = queue.popleft()
                for v in self._adjacency.get(u, set()):
                    if v not in visited and capacity.get((u, v), 0) > 0:
                        visited.add(v)
                        parent[v] = u
                        if v == target:
                            found = True
                            break
                        queue.append(v)

            if not found:
                break

            # Augment along path
            flow_total += 1
            v = target
            while v != source:
                u = parent[v]
                capacity[(u, v)] -= 1
                capacity[(v, u)] = capacity.get((v, u), 0) + 1
                v = u

        return flow_total

    def simulate_all_removals(self) -> dict[str, RemovalResult]:
        """Simulate removing each node and return all results.

        Optimized: pre-computes articulation points once, builds adjacency
        lookup once instead of per-removal. ~2x faster than calling
        simulate_removal() in a loop.

        Returns:
            Dict mapping node_id → RemovalResult.
        """
        # Pre-compute AP flags
        self.find_articulation_points()

        # Pre-build viable adjacency once
        viable_adj: dict[str, set[str]] = defaultdict(set)
        for a_id, neighbors in self._adjacency.items():
            viable_adj[a_id] = set(neighbors)

        results: dict[str, RemovalResult] = {}

        for node_id in self._nodes:
            was_ap = self._nodes[node_id].is_articulation_point

            # Build adjacency without the removed node
            remaining = set(self._nodes.keys()) - {node_id}
            visited: set[str] = set()
            clusters: list[list[str]] = []

            for start in remaining:
                if start in visited:
                    continue
                cluster: list[str] = []
                queue = deque([start])
                visited.add(start)
                while queue:
                    current = queue.popleft()
                    cluster.append(current)
                    for neighbor in viable_adj.get(current, set()):
                        if neighbor != node_id and neighbor not in visited:
                            visited.add(neighbor)
                            queue.append(neighbor)
                clusters.append(sorted(cluster))

            clusters.sort(key=len, reverse=True)
            disconnected = [c[0] for c in clusters if len(c) == 1]

            results[node_id] = RemovalResult(
                removed_node_id=node_id,
                clusters=clusters,
                disconnected_nodes=disconnected,
                was_articulation_point=was_ap,
            )

        return results

    def network_health_score(self) -> dict:
        """Compute a 0–100 network health score with component breakdown.

        Components (each 0–25 points):
        - connectivity: 25 if fully connected, 0 if disconnected
        - redundancy: based on average node degree (2+ = good)
        - spof_nodes: penalizes articulation points (fewer = better)
        - spof_links: penalizes bridge edges (fewer = better)

        Returns dict with 'score', 'grade' (A-F), and 'components'.
        """
        n = len(self._nodes)
        if n == 0:
            return {"score": 0, "grade": "F", "components": {}}

        # Connectivity: 25 if connected, 0 otherwise
        connected = self.is_connected()
        connectivity = 25.0 if connected else 0.0

        # Redundancy: average node degree / target degree (2.0 = max score)
        viable_edges = sum(1 for e in self._edges if e.is_viable)
        avg_degree = (2 * viable_edges) / n if n > 0 else 0
        redundancy = min(25.0, (avg_degree / 2.0) * 25.0)

        # SPOF nodes: fewer articulation points = better
        aps = self.find_articulation_points()
        ap_ratio = len(aps) / n if n > 0 else 0
        spof_nodes = 25.0 * (1.0 - ap_ratio)

        # SPOF links: fewer bridges = better
        bridges = self.find_bridges()
        bridge_ratio = len(bridges) / viable_edges if viable_edges > 0 else 0
        spof_links = 25.0 * (1.0 - bridge_ratio)

        score = round(connectivity + redundancy + spof_nodes + spof_links, 1)

        if score >= 90:
            grade = "A"
        elif score >= 75:
            grade = "B"
        elif score >= 60:
            grade = "C"
        elif score >= 40:
            grade = "D"
        else:
            grade = "F"

        return {
            "score": score,
            "grade": grade,
            "components": {
                "connectivity": round(connectivity, 1),
                "redundancy": round(redundancy, 1),
                "spof_nodes": round(spof_nodes, 1),
                "spof_links": round(spof_links, 1),
            },
            "details": {
                "total_nodes": n,
                "viable_edges": viable_edges,
                "avg_degree": round(avg_degree, 2),
                "articulation_points": len(aps),
                "bridges": len(bridges),
                "is_connected": connected,
            },
        }

    def to_dict(self) -> dict:
        """Serialize the graph to a dictionary for API responses."""
        return {
            "nodes": [
                {
                    "node_id": n.node_id,
                    "latitude": n.latitude,
                    "longitude": n.longitude,
                    "is_articulation_point": n.is_articulation_point,
                }
                for n in self._nodes.values()
            ],
            "edges": [
                {
                    "node_a_id": e.node_a_id,
                    "node_b_id": e.node_b_id,
                    "distance_m": e.distance_m,
                    "link_quality": e.link_quality,
                    "is_viable": e.is_viable,
                }
                for e in self._edges
            ],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "TopologyGraph":
        """Reconstruct a graph from a to_dict() output.

        Enables caching/persistence of topology analysis results.

        Args:
            data: Dict with "nodes" and "edges" lists.

        Returns:
            Reconstructed TopologyGraph with AP flags preserved.
        """
        graph = cls()

        for node_data in data.get("nodes", []):
            graph.add_node(
                node_id=node_data["node_id"],
                latitude=node_data.get("latitude", 0.0),
                longitude=node_data.get("longitude", 0.0),
            )
            if node_data.get("is_articulation_point", False):
                graph._nodes[node_data["node_id"]].is_articulation_point = True

        for edge_data in data.get("edges", []):
            graph.add_edge(TopologyEdge(
                node_a_id=edge_data["node_a_id"],
                node_b_id=edge_data["node_b_id"],
                distance_m=edge_data.get("distance_m", 0.0),
                link_quality=edge_data.get("link_quality", "weak"),
                is_viable=edge_data.get("is_viable", True),
            ))

        return graph
