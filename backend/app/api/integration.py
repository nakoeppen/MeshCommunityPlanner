"""W3-W2 integration adapters.

Stateless conversion functions that bridge W2 data shapes (node dicts with
device_id/antenna_id references) to W3 internal types (NodeParams, TopologyGraph,
NetworkBOM).  These live in W3's codebase so that W0 can wire them into the
merged router without touching W3's service layer.
"""

from __future__ import annotations

from typing import Any, Optional

from backend.app.services.propagation.engine import NodeParams
from backend.app.services.topology import TopologyEdge, TopologyGraph
from backend.app.services.bom_generator import (
    NetworkBOM,
    generate_network_bom,
    generate_node_bom,
)


# ---------------------------------------------------------------------------
# Node conversion
# ---------------------------------------------------------------------------

def node_dict_to_params(
    node: dict[str, Any],
    antenna: Optional[dict[str, Any]] = None,
    cable: Optional[dict[str, Any]] = None,
) -> NodeParams:
    """Convert a W2-format node dict to W3's NodeParams.

    W2 nodes carry ``device_id`` / ``antenna_id`` foreign keys that get
    resolved to catalog rows by the API layer.  This function accepts the
    *resolved* antenna and cable dicts so it can extract gain / loss values.

    Direct fields on ``node`` (``antenna_gain_dbi``, ``cable_loss_db``) take
    precedence over catalog-derived values.

    Args:
        node: Node dict — must contain at least ``latitude``, ``longitude``.
        antenna: Resolved antenna catalog dict (optional).
            Expected key: ``gain_dbi``.
        cable: Resolved cable catalog dict (optional).
            Expected keys: ``loss_per_m_db``, ``length_m``.
    """
    # Antenna gain: prefer direct field, fall back to catalog
    antenna_gain = node.get("antenna_gain_dbi")
    if antenna_gain is None and antenna is not None:
        antenna_gain = antenna.get("gain_dbi", 3.0)
    if antenna_gain is None:
        antenna_gain = 3.0

    # Cable loss: prefer direct field, fall back to catalog-based calculation
    cable_loss = node.get("cable_loss_db")
    if cable_loss is None and cable is not None:
        loss_per_m = cable.get("loss_per_m_db", 0.0)
        length_m = cable.get("length_m", node.get("cable_length_m", 0.0))
        cable_loss = loss_per_m * length_m
    if cable_loss is None:
        cable_loss = 0.0

    return NodeParams(
        node_id=node.get("node_id", node.get("id", "node")),
        latitude=node["latitude"],
        longitude=node["longitude"],
        antenna_height_m=node.get("antenna_height_m", 2.0),
        frequency_mhz=node.get("frequency_mhz", 906.875),
        tx_power_dbm=node.get("tx_power_dbm", 22.0),
        antenna_gain_dbi=float(antenna_gain),
        cable_loss_db=float(cable_loss),
        receiver_sensitivity_dbm=node.get("receiver_sensitivity_dbm", -130.0),
    )


# ---------------------------------------------------------------------------
# Topology graph construction
# ---------------------------------------------------------------------------

def build_topology_graph(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
) -> TopologyGraph:
    """Construct a ``TopologyGraph`` from lists of node and edge dicts.

    Args:
        nodes: List of dicts with at least ``node_id``.
            Optional: ``latitude``, ``longitude``.
        edges: List of dicts with ``node_a_id``, ``node_b_id``.
            Optional: ``distance_m``, ``link_quality``, ``is_viable``.
    """
    graph = TopologyGraph()

    for n in nodes:
        graph.add_node(
            node_id=n["node_id"],
            latitude=n.get("latitude", 0.0),
            longitude=n.get("longitude", 0.0),
        )

    for e in edges:
        graph.add_edge(TopologyEdge(
            node_a_id=e["node_a_id"],
            node_b_id=e["node_b_id"],
            distance_m=e.get("distance_m", 0.0),
            link_quality=e.get("link_quality", "weak"),
            is_viable=e.get("is_viable", True),
        ))

    return graph


# ---------------------------------------------------------------------------
# BOM construction
# ---------------------------------------------------------------------------

def build_network_bom(
    plan_id: str,
    plan_name: str,
    node_configs: list[dict[str, Any]],
) -> NetworkBOM:
    """Build a ``NetworkBOM`` from a list of enriched node config dicts.

    Each node config dict uses the same shape as ``BOMNodeRequest``:
    ``node_id``, ``node_name``, ``device``, ``antenna``, etc.
    """
    node_boms = []
    for nc in node_configs:
        nbom = generate_node_bom(
            node_id=nc["node_id"],
            node_name=nc.get("node_name", nc["node_id"]),
            device=nc.get("device"),
            antenna=nc.get("antenna"),
            cable=nc.get("cable"),
            cable_length_m=nc.get("cable_length_m", 0.0),
            pa_module=nc.get("pa_module"),
            battery=nc.get("battery"),
            solar_panel=nc.get("solar_panel"),
            bec=nc.get("bec"),
            charge_controller=nc.get("charge_controller"),
            enclosure=nc.get("enclosure"),
            mast=nc.get("mast"),
            is_outdoor=nc.get("is_outdoor", False),
        )
        node_boms.append(nbom)

    return generate_network_bom(
        plan_id=plan_id,
        plan_name=plan_name,
        node_boms=node_boms,
    )
