"""Network optimization algorithms — channel assignment, power optimization, resilience.

Iteration 6 Priority 3: Automatic network optimization recommendations.
"""

from __future__ import annotations

import math
from typing import Optional


def optimize_channels(
    nodes: list[dict],
    edges: list[dict],
    region_id: str = "us_fcc",
) -> dict:
    """Recommend channel assignments to minimize co-channel interference.

    Uses a greedy graph coloring approach: nodes connected by edges should
    use different channels where possible to reduce interference.

    Args:
        nodes: List of node dicts with node_id.
        edges: List of edge dicts with node_a_id, node_b_id.
        region_id: Regulatory region for available channels.

    Returns:
        Dict with per-node channel assignments and interference analysis.
    """
    from backend.app.services.frequency_plan import get_channels_for_region

    try:
        channels = get_channels_for_region(region_id)
        if not channels:
            raise ValueError(f"No channels for region '{region_id}'")
        available = list(range(len(channels)))
    except (KeyError, ValueError):
        # Fallback to LoRa default 8 channels
        available = list(range(8))

    if not nodes:
        return {
            "assignments": {},
            "channels_used": 0,
            "interference_pairs": 0,
            "region_id": region_id,
        }

    # Build adjacency
    adj: dict[str, set[str]] = {n["node_id"]: set() for n in nodes}
    for e in edges:
        a = e.get("node_a_id", "")
        b = e.get("node_b_id", "")
        if a in adj and b in adj:
            adj[a].add(b)
            adj[b].add(a)

    # Greedy graph coloring (largest-degree-first)
    node_ids_sorted = sorted(adj.keys(), key=lambda nid: len(adj[nid]), reverse=True)
    assignment: dict[str, int] = {}

    for nid in node_ids_sorted:
        # Find channels used by neighbors
        neighbor_channels = {assignment[nb] for nb in adj[nid] if nb in assignment}
        # Pick first available channel not used by neighbors
        for ch in available:
            if ch not in neighbor_channels:
                assignment[nid] = ch
                break
        else:
            # All channels used by neighbors — pick least-used among neighbors
            assignment[nid] = available[0]

    # Count interference pairs (same-channel neighbors)
    interference_pairs = 0
    seen_pairs: set[tuple[str, str]] = set()
    for nid in adj:
        for nb in adj[nid]:
            pair = tuple(sorted([nid, nb]))
            if pair not in seen_pairs:
                seen_pairs.add(pair)
                if assignment.get(nid) == assignment.get(nb):
                    interference_pairs += 1

    channels_used = len(set(assignment.values()))

    return {
        "assignments": {nid: {"channel": ch} for nid, ch in assignment.items()},
        "channels_used": channels_used,
        "total_channels_available": len(available),
        "interference_pairs": interference_pairs,
        "region_id": region_id,
        "node_count": len(nodes),
    }


def optimize_power(
    nodes: list[dict],
    edges: list[dict],
    min_link_margin_db: float = 3.0,
    max_tx_power_dbm: float = 30.0,
) -> dict:
    """Recommend optimal TX power for each node.

    Strategy: reduce power where links have excessive margin to minimize
    interference and save energy, while maintaining minimum link margin.

    Args:
        nodes: List of node dicts with node_id, latitude, longitude.
        edges: List of edge dicts with node_a_id, node_b_id and optional link_margin_db.
        min_link_margin_db: Minimum acceptable link margin.
        max_tx_power_dbm: Maximum allowed TX power.

    Returns:
        Dict with per-node power recommendations.
    """
    if not nodes:
        return {
            "recommendations": {},
            "avg_power_reduction_db": 0.0,
            "total_energy_savings_pct": 0.0,
        }

    # Build edge info by node
    node_edges: dict[str, list[dict]] = {n["node_id"]: [] for n in nodes}
    for e in edges:
        a = e.get("node_a_id", "")
        b = e.get("node_b_id", "")
        margin = e.get("link_margin_db", 10.0)
        if a in node_edges:
            node_edges[a].append({"neighbor": b, "margin_db": margin})
        if b in node_edges:
            node_edges[b].append({"neighbor": a, "margin_db": margin})

    recommendations: dict[str, dict] = {}
    total_reduction = 0.0

    default_power = 20.0  # Assume 20 dBm as current default

    for node in nodes:
        nid = node["node_id"]
        node_links = node_edges.get(nid, [])

        if not node_links:
            # Isolated node — use minimum power
            rec_power = max(10.0, max_tx_power_dbm * 0.5)
            recommendations[nid] = {
                "current_power_dbm": default_power,
                "recommended_power_dbm": round(rec_power, 1),
                "reduction_db": round(default_power - rec_power, 1),
                "reason": "No links — reduce power to save energy",
            }
            total_reduction += default_power - rec_power
            continue

        # Find minimum margin across all links
        min_margin = min(link["margin_db"] for link in node_links)
        excess_margin = min_margin - min_link_margin_db

        if excess_margin > 3:
            # Can reduce power by excess margin (keep 3 dB safety)
            reduction = min(excess_margin - 3, default_power - 10)
            reduction = max(0, reduction)
            rec_power = default_power - reduction
            reason = f"Excess margin {excess_margin:.1f} dB — reduce for energy savings"
        elif excess_margin < 0:
            # Need more power
            increase = min(abs(excess_margin) + 3, max_tx_power_dbm - default_power)
            rec_power = default_power + increase
            reduction = -increase
            reason = f"Insufficient margin — increase power for reliability"
        else:
            rec_power = default_power
            reduction = 0
            reason = "Power level optimal"

        rec_power = max(5.0, min(max_tx_power_dbm, rec_power))
        total_reduction += max(0, default_power - rec_power)

        recommendations[nid] = {
            "current_power_dbm": default_power,
            "recommended_power_dbm": round(rec_power, 1),
            "reduction_db": round(default_power - rec_power, 1),
            "min_link_margin_db": round(min_margin, 1),
            "reason": reason,
        }

    n_nodes = len(nodes)
    avg_reduction = total_reduction / n_nodes if n_nodes > 0 else 0
    # Rough energy savings estimate: power reduction in linear scale
    energy_savings_pct = (1.0 - 10 ** (-avg_reduction / 10)) * 100 if avg_reduction > 0 else 0

    return {
        "recommendations": recommendations,
        "avg_power_reduction_db": round(avg_reduction, 1),
        "total_energy_savings_pct": round(energy_savings_pct, 1),
        "min_link_margin_target_db": min_link_margin_db,
        "node_count": n_nodes,
    }


def network_resilience_report(
    nodes: list[dict],
    edges: list[dict],
) -> dict:
    """Generate comprehensive resilience score and actionable recommendations.

    Builds on existing topology.network_health_score() to add specific
    recommendations for improving network reliability.

    Args:
        nodes: List of node dicts with node_id.
        edges: List of edge dicts with node_a_id, node_b_id.

    Returns:
        Dict with score, grade, findings, and recommendations.
    """
    from backend.app.services.topology import (
        TopologyGraph,
        TopologyEdge,
    )

    if not nodes:
        return {
            "score": 0,
            "grade": "F",
            "findings": ["No nodes in network"],
            "recommendations": ["Add at least 3 nodes to form a basic mesh"],
            "metrics": {},
        }

    # Build topology graph
    graph = TopologyGraph()
    for n in nodes:
        graph.add_node(n["node_id"])
    for e in edges:
        graph.add_edge(TopologyEdge(
            node_a_id=e.get("node_a_id", ""),
            node_b_id=e.get("node_b_id", ""),
        ))

    health = graph.network_health_score()
    score = health["score"]
    aps = graph.find_articulation_points()
    bridges = graph.find_bridges()

    # Grade mapping
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

    findings: list[str] = []
    recommendations: list[str] = []

    # Connectivity
    if not health.get("connected", True):
        findings.append("Network is NOT fully connected — some nodes are isolated")
        recommendations.append("Add links to connect isolated network segments")

    # Articulation points (SPOFs)
    if aps:
        findings.append(f"{len(aps)} single point(s) of failure: {', '.join(aps)}")
        for ap in aps[:3]:
            recommendations.append(
                f"Add redundant link to node '{ap}' — its failure disconnects the network"
            )

    # Bridge links
    if bridges:
        findings.append(f"{len(bridges)} critical link(s) with no redundancy")
        for a, b in bridges[:3]:
            recommendations.append(
                f"Add parallel path between '{a}' and '{b}' — link failure disconnects network"
            )

    # Node degree analysis
    degrees = {nid: len(graph.get_neighbors(nid)) for nid in graph.nodes}
    if degrees:
        min_degree = min(degrees.values())
        low_degree_nodes = [nid for nid, d in degrees.items() if d < 2]
        if low_degree_nodes:
            findings.append(
                f"{len(low_degree_nodes)} node(s) with fewer than 2 links"
            )
            for nid in low_degree_nodes[:3]:
                recommendations.append(
                    f"Add link to node '{nid}' (only {degrees[nid]} connection(s))"
                )

    # Small network
    n_nodes = len(nodes)
    n_edges = len(edges)
    if n_nodes < 3:
        findings.append(f"Very small network ({n_nodes} nodes)")
        recommendations.append("Add more nodes for meaningful mesh redundancy")

    if not findings:
        findings.append("Network topology is healthy")

    if not recommendations:
        recommendations.append("No immediate improvements needed")

    return {
        "score": score,
        "grade": grade,
        "findings": findings,
        "recommendations": recommendations,
        "metrics": {
            "node_count": n_nodes,
            "edge_count": n_edges,
            "articulation_points": len(aps),
            "bridges": len(bridges),
            "components": health.get("components", {}),
        },
    }
