"""Bill of Materials generator.

Generates per-node and per-network BOMs from node configuration,
device catalog data, and power budget calculations.

Phase 13 task: 13.4.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class BOMItem:
    """A single item in a bill of materials."""

    category: str  # device, antenna, cable, connector, pa_module, battery, solar, bec, controller, enclosure, mast, misc
    name: str
    description: str = ""
    quantity: int = 1
    unit_price_usd: Optional[float] = None
    node_id: Optional[str] = None
    catalog_data: Optional[dict] = field(default=None, repr=False)

    @property
    def total_price_usd(self) -> Optional[float]:
        if self.unit_price_usd is not None:
            return self.unit_price_usd * self.quantity
        return None


@dataclass
class NodeBOM:
    """Bill of materials for a single node."""

    node_id: str
    node_name: str
    items: list[BOMItem] = field(default_factory=list)

    @property
    def total_cost_usd(self) -> float:
        total = 0.0
        for item in self.items:
            if item.total_price_usd is not None:
                total += item.total_price_usd
        return total

    @property
    def item_count(self) -> int:
        return len(self.items)


@dataclass
class NetworkBOM:
    """Aggregated bill of materials for an entire network plan."""

    plan_id: str
    plan_name: str
    node_boms: list[NodeBOM] = field(default_factory=list)
    consolidated_items: list[BOMItem] = field(default_factory=list)

    @property
    def total_cost_usd(self) -> float:
        return sum(nb.total_cost_usd for nb in self.node_boms)

    @property
    def total_nodes(self) -> int:
        return len(self.node_boms)


def _prettify_key(key: str) -> str:
    """Convert snake_case or raw keys to Title Case (e.g. 'input_voltage_range' → 'Input Voltage Range')."""
    return key.replace("_", " ").strip().title()


def _format_power_specs(component: dict) -> str:
    """Format the 'specs' JSON field from a power component into readable text."""
    import json as _json

    raw = component.get("specs", "")
    if not raw:
        return ""

    # Parse JSON string if needed
    if isinstance(raw, str):
        try:
            specs = _json.loads(raw)
        except (ValueError, TypeError):
            return raw  # Return raw string if not valid JSON
    elif isinstance(raw, dict):
        specs = raw
    else:
        return str(raw)

    # Skip internal/meta keys
    skip = {"id", "is_custom", "price_usd", "category", "name"}
    parts = []
    for k, v in specs.items():
        if k in skip or v is None:
            continue
        label = _prettify_key(k)
        parts.append(f"{label}: {v}")
    return "; ".join(parts)


def generate_node_bom(
    node_id: str,
    node_name: str,
    device: Optional[dict] = None,
    antenna: Optional[dict] = None,
    cable: Optional[dict] = None,
    cable_length_m: float = 0.0,
    pa_module: Optional[dict] = None,
    battery: Optional[dict] = None,
    solar_panel: Optional[dict] = None,
    bec: Optional[dict] = None,
    charge_controller: Optional[dict] = None,
    enclosure: Optional[dict] = None,
    mast: Optional[dict] = None,
    is_outdoor: bool = False,
) -> NodeBOM:
    """Generate a bill of materials for a single node.

    Args:
        node_id: Node identifier.
        node_name: Human-readable node name.
        device: Device dict from catalog (name, price_usd, etc.).
        antenna: Antenna dict from catalog.
        cable: Cable dict from catalog.
        cable_length_m: Cable length in meters.
        pa_module: PA module dict from catalog.
        battery: Battery/power component dict.
        solar_panel: Solar panel dict.
        bec: BEC/voltage regulator dict.
        charge_controller: Charge controller dict.
        enclosure: Enclosure dict.
        mast: Mast/mounting hardware dict.
        is_outdoor: Whether this is an outdoor installation.

    Returns:
        NodeBOM with all required items.
    """
    items: list[BOMItem] = []

    # Device
    if device:
        desc_parts = []
        if device.get("mcu"):
            desc_parts.append(f"MCU: {device['mcu']}")
        if device.get("radio_chip"):
            desc_parts.append(f"Radio: {device['radio_chip']}")
        if device.get("max_tx_power_dbm"):
            desc_parts.append(f"Max TX: {device['max_tx_power_dbm']} dBm")
        if device.get("form_factor"):
            desc_parts.append(f"Form Factor: {_prettify_key(device['form_factor'])}")
        if device.get("has_gps"):
            desc_parts.append("GPS: Yes")
        items.append(BOMItem(
            category="device",
            name=device.get("name", "LoRa Device"),
            description="; ".join(desc_parts) if desc_parts else "",
            quantity=1,
            unit_price_usd=device.get("price_usd"),
            node_id=node_id,
            catalog_data=device,
        ))

    # Antenna
    if antenna:
        desc_parts = []
        if antenna.get("gain_dbi") is not None:
            desc_parts.append(f"Gain: {antenna['gain_dbi']} dBi")
        if antenna.get("form_factor"):
            desc_parts.append(f"Type: {_prettify_key(antenna['form_factor'])}")
        if antenna.get("polarization"):
            desc_parts.append(f"Polarization: {_prettify_key(antenna['polarization'])}")
        if antenna.get("connector_type"):
            desc_parts.append(f"Connector: {antenna['connector_type']}")
        if antenna.get("frequency_band"):
            desc_parts.append(f"Band: {antenna['frequency_band']} MHz")
        items.append(BOMItem(
            category="antenna",
            name=antenna.get("name", "Antenna"),
            description="; ".join(desc_parts) if desc_parts else "",
            quantity=1,
            unit_price_usd=antenna.get("price_usd"),
            node_id=node_id,
            catalog_data=antenna,
        ))

    # Cable
    if cable and cable_length_m > 0:
        price_per_m = cable.get("price_per_m_usd")
        total_price = price_per_m * cable_length_m if price_per_m else None
        desc_parts = []
        if cable.get("cable_type"):
            desc_parts.append(f"Type: {cable['cable_type']}")
        if cable.get("loss_per_m_915mhz"):
            desc_parts.append(f"Loss: {cable['loss_per_m_915mhz']} dB/m at 915 MHz")
        if cable.get("connector_types"):
            desc_parts.append(f"Connectors: {cable['connector_types']}")
        items.append(BOMItem(
            category="cable",
            name=f"{cable.get('name', 'RF Cable')} ({cable_length_m:.1f}m)",
            description="; ".join(desc_parts) if desc_parts else "",
            quantity=1,
            unit_price_usd=total_price,
            node_id=node_id,
            catalog_data=cable,
        ))

    # Connectors (SMA adapter assumed if cable used)
    if cable and cable_length_m > 0:
        items.append(BOMItem(
            category="connector",
            name="SMA Adapter",
            description="SMA male-female adapter for RF cable termination",
            quantity=2,
            unit_price_usd=3.0,
            node_id=node_id,
        ))

    # PA module
    if pa_module:
        desc_parts = []
        if pa_module.get("max_output_power_dbm"):
            desc_parts.append(f"Max Output: {pa_module['max_output_power_dbm']} dBm")
        if pa_module.get("frequency_range"):
            desc_parts.append(f"Freq Range: {pa_module['frequency_range']}")
        if pa_module.get("input_power_range"):
            desc_parts.append(f"Input Range: {pa_module['input_power_range']}")
        if pa_module.get("current_draw_ma"):
            desc_parts.append(f"Current Draw: {pa_module['current_draw_ma']} mA")
        items.append(BOMItem(
            category="pa_module",
            name=pa_module.get("name", "PA Module"),
            description="; ".join(desc_parts) if desc_parts else "",
            quantity=1,
            unit_price_usd=pa_module.get("price_usd"),
            node_id=node_id,
            catalog_data=pa_module,
        ))

    # Battery
    if battery:
        items.append(BOMItem(
            category="battery",
            name=battery.get("name", "Battery"),
            description=_format_power_specs(battery),
            quantity=1,
            unit_price_usd=battery.get("price_usd"),
            node_id=node_id,
            catalog_data=battery,
        ))

    # Solar panel (outdoor only)
    if is_outdoor and solar_panel:
        items.append(BOMItem(
            category="solar",
            name=solar_panel.get("name", "Solar Panel"),
            description=_format_power_specs(solar_panel),
            quantity=1,
            unit_price_usd=solar_panel.get("price_usd"),
            node_id=node_id,
            catalog_data=solar_panel,
        ))

    # BEC
    if bec:
        items.append(BOMItem(
            category="bec",
            name=bec.get("name", "BEC/Voltage Regulator"),
            description=_format_power_specs(bec),
            quantity=1,
            unit_price_usd=bec.get("price_usd"),
            node_id=node_id,
            catalog_data=bec,
        ))

    # Charge controller (outdoor with solar)
    if is_outdoor and charge_controller:
        items.append(BOMItem(
            category="controller",
            name=charge_controller.get("name", "Charge Controller"),
            description=_format_power_specs(charge_controller),
            quantity=1,
            unit_price_usd=charge_controller.get("price_usd"),
            node_id=node_id,
            catalog_data=charge_controller,
        ))

    # Enclosure (outdoor)
    if is_outdoor and enclosure:
        items.append(BOMItem(
            category="enclosure",
            name=enclosure.get("name", "Enclosure"),
            description=_format_power_specs(enclosure),
            quantity=1,
            unit_price_usd=enclosure.get("price_usd"),
            node_id=node_id,
            catalog_data=enclosure,
        ))

    # Mast (outdoor)
    if is_outdoor and mast:
        items.append(BOMItem(
            category="mast",
            name=mast.get("name", "Mast/Mounting"),
            description=_format_power_specs(mast),
            quantity=1,
            unit_price_usd=mast.get("price_usd"),
            node_id=node_id,
            catalog_data=mast,
        ))

    # Cable glands (outdoor with cable)
    if is_outdoor and cable and cable_length_m > 0:
        items.append(BOMItem(
            category="misc",
            name="Cable Gland",
            description="IP68 cable gland for enclosure pass-through",
            quantity=2,
            unit_price_usd=2.0,
            node_id=node_id,
        ))

    return NodeBOM(node_id=node_id, node_name=node_name, items=items)


def consolidate_items(node_boms: list[NodeBOM]) -> list[BOMItem]:
    """Consolidate duplicate items across nodes into aggregated quantities.

    Items with the same category + name are merged, summing quantities.

    Returns:
        Sorted list of consolidated BOM items.
    """
    consolidated: dict[str, BOMItem] = {}

    for nbom in node_boms:
        for item in nbom.items:
            key = f"{item.category}::{item.name}"
            if key in consolidated:
                consolidated[key].quantity += item.quantity
            else:
                consolidated[key] = BOMItem(
                    category=item.category,
                    name=item.name,
                    description=item.description,
                    quantity=item.quantity,
                    unit_price_usd=item.unit_price_usd,
                )

    return sorted(consolidated.values(), key=lambda x: (x.category, x.name))


def generate_network_bom(
    plan_id: str,
    plan_name: str,
    node_boms: list[NodeBOM],
) -> NetworkBOM:
    """Generate an aggregated network-wide bill of materials.

    Args:
        plan_id: Plan identifier.
        plan_name: Human-readable plan name.
        node_boms: List of per-node BOMs.

    Returns:
        NetworkBOM with consolidated items and total cost.
    """
    consolidated = consolidate_items(node_boms)

    return NetworkBOM(
        plan_id=plan_id,
        plan_name=plan_name,
        node_boms=node_boms,
        consolidated_items=consolidated,
    )


def export_bom_csv(network_bom: NetworkBOM) -> str:
    """Export network BOM as CSV string.

    Columns: Item, Description, Quantity, Unit Price, Total Price, Node Assignment.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Item", "Description", "Quantity", "Unit Price (USD)", "Total Price (USD)", "Node"])

    for nbom in network_bom.node_boms:
        for item in nbom.items:
            writer.writerow([
                item.name,
                item.description,
                item.quantity,
                f"{item.unit_price_usd:.2f}" if item.unit_price_usd is not None else "",
                f"{item.total_price_usd:.2f}" if item.total_price_usd is not None else "",
                nbom.node_name,
            ])

    # Total row
    writer.writerow([])
    writer.writerow(["TOTAL", "", "", "", f"{network_bom.total_cost_usd:.2f}", ""])

    return output.getvalue()


def export_bom_json(network_bom: NetworkBOM) -> dict:
    """Export network BOM as a JSON-serializable dict.

    Suitable for API responses. Includes per-node items and consolidated view.
    """
    def _item_dict(item: BOMItem) -> dict:
        return {
            "category": item.category,
            "name": item.name,
            "description": item.description,
            "quantity": item.quantity,
            "unit_price_usd": item.unit_price_usd,
            "total_price_usd": item.total_price_usd,
        }

    return {
        "plan_id": network_bom.plan_id,
        "plan_name": network_bom.plan_name,
        "total_cost_usd": network_bom.total_cost_usd,
        "total_nodes": network_bom.total_nodes,
        "nodes": [
            {
                "node_id": nbom.node_id,
                "node_name": nbom.node_name,
                "total_cost_usd": nbom.total_cost_usd,
                "items": [_item_dict(it) for it in nbom.items],
            }
            for nbom in network_bom.node_boms
        ],
        "consolidated": [_item_dict(it) for it in network_bom.consolidated_items],
    }


def compute_bom_statistics(network_bom: NetworkBOM) -> dict:
    """Compute cost breakdown and statistics for a network BOM.

    Returns a dict with total cost, item counts, per-category breakdown
    (count, cost, percentage), most expensive category/node, and average
    cost per node.
    """
    total_cost = network_bom.total_cost_usd
    total_nodes = network_bom.total_nodes

    # Gather all items across all nodes
    all_items: list[BOMItem] = []
    for nbom in network_bom.node_boms:
        all_items.extend(nbom.items)

    items_without_price = sum(1 for it in all_items if it.unit_price_usd is None)

    # Per-category breakdown
    categories: dict[str, dict] = {}
    for item in all_items:
        cat = item.category
        if cat not in categories:
            categories[cat] = {"count": 0, "cost_usd": 0.0}
        categories[cat]["count"] += item.quantity
        if item.total_price_usd is not None:
            categories[cat]["cost_usd"] += item.total_price_usd

    # Add percentage
    for cat_data in categories.values():
        if total_cost > 0:
            cat_data["pct_of_total"] = round(cat_data["cost_usd"] / total_cost * 100, 1)
        else:
            cat_data["pct_of_total"] = 0.0

    # Most expensive category
    most_expensive_cat = ""
    if categories:
        most_expensive_cat = max(categories, key=lambda c: categories[c]["cost_usd"])

    # Most expensive node
    most_expensive_node = ""
    if network_bom.node_boms:
        most_expensive_nbom = max(network_bom.node_boms, key=lambda nb: nb.total_cost_usd)
        most_expensive_node = most_expensive_nbom.node_id

    return {
        "total_cost_usd": total_cost,
        "total_items": len(all_items),
        "total_nodes": total_nodes,
        "avg_cost_per_node": round(total_cost / total_nodes, 2) if total_nodes > 0 else 0.0,
        "items_without_price": items_without_price,
        "categories": categories,
        "most_expensive_category": most_expensive_cat,
        "most_expensive_node": most_expensive_node,
    }
