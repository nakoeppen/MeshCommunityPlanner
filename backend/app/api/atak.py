"""ATAK Live KML endpoint.

Provides:
- GET /atak/nodes.kml  — live KML feed of all (or plan-filtered) nodes
- GET /atak/local-url  — returns the LAN IP URL to paste into ATAK
"""

from __future__ import annotations

import logging
import socket
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from backend.app.db.connection import get_db_connection
import sqlite3

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_KML_NO_CACHE = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
}


def _get_lan_ip() -> str:
    """Return the LAN IP of the host machine.

    Falls back to 127.0.0.1 if resolution fails.
    """
    try:
        return socket.gethostbyname(socket.gethostname())
    except Exception:
        return "127.0.0.1"


def _classify_node(name: str, device_id: Optional[str]) -> str:
    """Return the KML style ID for a node based on its name / device_id."""
    name_lower = name.lower()
    device_lower = (device_id or "").lower()
    if "gateway" in name_lower or "gateway" in device_lower:
        return "style-gateway"
    if "repeater" in name_lower or "repeater" in device_lower:
        return "style-repeater"
    return "style-mesh-node"


def _placemark(node: dict[str, Any], plan_name: str, lan_ip: str) -> str:
    """Build a KML <Placemark> string for a single node."""
    style_id = _classify_node(node["name"], node.get("device_id"))
    env = node.get("coverage_environment") or "global default"
    device = node.get("device_id") or "unknown"
    freq = node.get("frequency_mhz", "")
    antenna = node.get("antenna_height_m", "")
    lon = node["longitude"]
    lat = node["latitude"]
    return (
        f"    <Placemark>\n"
        f"      <name>{node['name']}</name>\n"
        f"      <description><![CDATA[\n"
        f"        <b>Plan:</b> {plan_name}<br/>\n"
        f"        <b>Freq:</b> {freq} MHz<br/>\n"
        f"        <b>Antenna:</b> {antenna} m<br/>\n"
        f"        <b>Environment:</b> {env}<br/>\n"
        f"        <b>Device:</b> {device}\n"
        f"      ]]></description>\n"
        f"      <styleUrl>#{style_id}</styleUrl>\n"
        f"      <Point><coordinates>{lon},{lat},0</coordinates></Point>\n"
        f"    </Placemark>"
    )


def _build_kml(
    nodes_by_plan: list[dict[str, Any]],
    plan_map: dict[str, str],
    lan_ip: str,
) -> str:
    """Build a complete KML document string from a flat list of node rows."""
    mesh_placemarks: list[str] = []
    repeater_placemarks: list[str] = []
    gateway_placemarks: list[str] = []

    for node in nodes_by_plan:
        lat = node.get("latitude")
        lon = node.get("longitude")
        # Skip nodes with null or 0,0 coordinates
        if lat is None or lon is None:
            continue
        try:
            lat = float(lat)
            lon = float(lon)
        except (TypeError, ValueError):
            continue
        if lat == 0.0 and lon == 0.0:
            continue

        plan_name = plan_map.get(str(node.get("plan_id", "")), "Unknown Plan")
        pm = _placemark(node, plan_name, lan_ip)
        style_id = _classify_node(node["name"], node.get("device_id"))

        if style_id == "style-gateway":
            gateway_placemarks.append(pm)
        elif style_id == "style-repeater":
            repeater_placemarks.append(pm)
        else:
            mesh_placemarks.append(pm)

    mesh_block = "\n".join(mesh_placemarks)
    repeater_block = "\n".join(repeater_placemarks)
    gateway_block = "\n".join(gateway_placemarks)

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Mesh Community Planner \u2014 Live Nodes</name>
    <Style id="style-mesh-node">
      <IconStyle><color>ff00cc00</color><scale>1.2</scale>
        <Icon><href>http://{lan_ip}:8000/static/icons/mesh_node.png</href></Icon>
        <hotSpot x="0.5" y="0.5" xunits="fraction" yunits="fraction"/>
      </IconStyle><LabelStyle><scale>0.9</scale></LabelStyle>
    </Style>
    <Style id="style-repeater">
      <IconStyle><color>ffff8800</color><scale>1.2</scale>
        <Icon><href>http://{lan_ip}:8000/static/icons/repeater.png</href></Icon>
        <hotSpot x="0.5" y="0.5" xunits="fraction" yunits="fraction"/>
      </IconStyle><LabelStyle><scale>0.9</scale></LabelStyle>
    </Style>
    <Style id="style-gateway">
      <IconStyle><color>ff0000ff</color><scale>1.4</scale>
        <Icon><href>http://{lan_ip}:8000/static/icons/gateway.png</href></Icon>
        <hotSpot x="0.5" y="0.5" xunits="fraction" yunits="fraction"/>
      </IconStyle><LabelStyle><scale>0.9</scale></LabelStyle>
    </Style>
    <Folder><name>Mesh Nodes</name>
{mesh_block}
    </Folder>
    <Folder><name>Repeaters</name>
{repeater_block}
    </Folder>
    <Folder><name>Gateways</name>
{gateway_block}
    </Folder>
  </Document>
</kml>"""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/nodes.kml")
def get_nodes_kml(
    plan_id: Optional[str] = Query(default=None, description="Filter to a specific plan by ID"),
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> Response:
    """Return a live KML feed of mesh nodes for ATAK import.

    Query params:
        plan_id: Optional integer plan ID to restrict output to one plan.

    Returns:
        KML document with nodes grouped into Mesh Nodes / Repeaters / Gateways folders.
    """
    try:
        if plan_id is not None:
            rows = conn.execute(
                "SELECT n.id, n.plan_id, n.name, n.latitude, n.longitude, "
                "n.frequency_mhz, n.antenna_height_m, n.device_id, n.coverage_environment "
                "FROM nodes n WHERE n.plan_id = ?",
                (plan_id,),
            ).fetchall()
            plan_rows = conn.execute(
                "SELECT id, name FROM plans WHERE id = ?", (plan_id,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT n.id, n.plan_id, n.name, n.latitude, n.longitude, "
                "n.frequency_mhz, n.antenna_height_m, n.device_id, n.coverage_environment "
                "FROM nodes n"
            ).fetchall()
            plan_rows = conn.execute("SELECT id, name FROM plans").fetchall()
    except Exception as exc:
        logger.error("ATAK KML DB query failed: %s", exc)
        rows = []
        plan_rows = []

    plan_map = {str(r["id"]): r["name"] for r in plan_rows}
    nodes = [dict(r) for r in rows]

    lan_ip = _get_lan_ip()
    kml_string = _build_kml(nodes, plan_map, lan_ip)

    return Response(
        content=kml_string,
        media_type="application/vnd.google-earth.kml+xml",
        headers=_KML_NO_CACHE,
    )


@router.get("/local-url")
def get_local_url() -> dict[str, str]:
    """Return the LAN-accessible URL for the KML feed.

    ATAK clients on the same network can poll this URL as a Network Link.
    """
    lan_ip = _get_lan_ip()
    return {"url": f"http://{lan_ip}:8000/atak/nodes.kml"}
