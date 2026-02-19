"""BOM API endpoint handlers.

GET  /bom/node/{nid}            — Per-node BOM
GET  /bom/plan/{pid}            — Full-plan aggregated BOM
POST /bom/export/csv/{pid}      — Export BOM as CSV
POST /bom/export/pdf/{pid}      — Export BOM as PDF
POST /bom/export/deployment/{pid} — Export deployment cards PDF

Note: Full FastAPI route registration requires W1's app skeleton.
"""

from __future__ import annotations

from typing import Any, Optional

from backend.app.services.bom_generator import (
    BOMItem,
    NetworkBOM,
    NodeBOM,
    export_bom_csv,
    generate_network_bom,
    generate_node_bom,
    _prettify_key,
)


def _serialize_item(item: BOMItem) -> dict:
    """Serialize a BOMItem to a dict with prettified specs."""
    import json as _json

    result = {
        "category": item.category,
        "name": item.name,
        "description": item.description,
        "quantity": item.quantity,
        "unit_price_usd": item.unit_price_usd,
        "total_price_usd": item.total_price_usd,
    }

    # Include prettified catalog specs for frontend display
    if item.catalog_data:
        skip = {"id", "is_custom", "price_usd", "price_per_m_usd", "name",
                "is_default", "category"}
        specs = {}
        for k, v in item.catalog_data.items():
            if k in skip or v is None:
                continue
            # Parse JSON strings (e.g. specs, frequency_bands, compatible_firmware)
            if isinstance(v, str):
                try:
                    parsed = _json.loads(v)
                    if isinstance(parsed, dict):
                        for sk, sv in parsed.items():
                            if sv is not None:
                                specs[_prettify_key(sk)] = sv
                        continue
                    elif isinstance(parsed, list):
                        specs[_prettify_key(k)] = ", ".join(str(x) for x in parsed)
                        continue
                except (ValueError, TypeError):
                    pass
            # Convert booleans to readable strings
            if isinstance(v, bool):
                specs[_prettify_key(k)] = "Yes" if v else "No"
            else:
                specs[_prettify_key(k)] = v
        result["specs"] = specs
    else:
        result["specs"] = {}

    return result


async def handle_get_node_bom(request_data: dict) -> dict:
    """Handle GET /bom/node/{nid} — single node BOM.

    Args:
        request_data: Dict with node config and catalog references.
    """
    nbom = generate_node_bom(
        node_id=request_data["node_id"],
        node_name=request_data.get("node_name", request_data["node_id"]),
        device=request_data.get("device"),
        antenna=request_data.get("antenna"),
        cable=request_data.get("cable"),
        cable_length_m=request_data.get("cable_length_m", 0.0),
        pa_module=request_data.get("pa_module"),
        battery=request_data.get("battery"),
        solar_panel=request_data.get("solar_panel"),
        bec=request_data.get("bec"),
        charge_controller=request_data.get("charge_controller"),
        enclosure=request_data.get("enclosure"),
        mast=request_data.get("mast"),
        is_outdoor=request_data.get("is_outdoor", False),
    )

    return {
        "node_id": nbom.node_id,
        "node_name": nbom.node_name,
        "items": [_serialize_item(item) for item in nbom.items],
        "total_cost_usd": nbom.total_cost_usd,
        "item_count": nbom.item_count,
        "antenna_height_m": request_data.get("antenna_height_m"),
        "error": None,
    }


async def handle_get_plan_bom(request_data: dict) -> dict:
    """Handle GET /bom/plan/{pid} — aggregated plan BOM.

    Args:
        request_data: Dict with plan_id, plan_name, and list of node configs.
    """
    node_boms = []
    for node_config in request_data.get("nodes", []):
        nbom = generate_node_bom(
            node_id=node_config["node_id"],
            node_name=node_config.get("node_name", node_config["node_id"]),
            device=node_config.get("device"),
            antenna=node_config.get("antenna"),
            cable=node_config.get("cable"),
            cable_length_m=node_config.get("cable_length_m", 0.0),
            pa_module=node_config.get("pa_module"),
            battery=node_config.get("battery"),
            solar_panel=node_config.get("solar_panel"),
            bec=node_config.get("bec"),
            charge_controller=node_config.get("charge_controller"),
            enclosure=node_config.get("enclosure"),
            mast=node_config.get("mast"),
            is_outdoor=node_config.get("is_outdoor", False),
        )
        node_boms.append(nbom)

    network = generate_network_bom(
        plan_id=request_data["plan_id"],
        plan_name=request_data.get("plan_name", "Untitled Plan"),
        node_boms=node_boms,
    )

    return {
        "plan_id": network.plan_id,
        "plan_name": network.plan_name,
        "total_nodes": network.total_nodes,
        "total_cost_usd": network.total_cost_usd,
        "consolidated_items": [
            _serialize_item(item) for item in network.consolidated_items
        ],
        "node_boms": [
            {
                "node_id": nb.node_id,
                "node_name": nb.node_name,
                "items": [_serialize_item(item) for item in nb.items],
                "total_cost_usd": nb.total_cost_usd,
                "item_count": nb.item_count,
            }
            for nb in node_boms
        ],
        "error": None,
    }


async def handle_export_csv(network_bom: NetworkBOM) -> str:
    """Handle POST /bom/export/csv/{pid} — export BOM as CSV string."""
    return export_bom_csv(network_bom)


async def handle_export_pdf(
    network_bom: NetworkBOM,
    node_coordinates: Optional[dict[str, tuple[float, float]]] = None,
) -> bytes:
    """Handle POST /bom/export/pdf/{pid} — export BOM as PDF bytes."""
    from backend.app.services.pdf_generator import generate_bom_pdf
    return generate_bom_pdf(network_bom, node_coordinates)


async def handle_export_deployment(
    network_bom: NetworkBOM,
    node_coordinates: Optional[dict[str, tuple[float, float]]] = None,
    node_radio_config: Optional[dict[str, dict]] = None,
) -> bytes:
    """Handle POST /bom/export/deployment/{pid} — export deployment cards PDF."""
    from backend.app.services.pdf_generator import generate_deployment_cards_pdf
    return generate_deployment_cards_pdf(network_bom, node_coordinates, node_radio_config)
