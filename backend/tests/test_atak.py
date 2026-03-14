"""Tests for the ATAK live KML endpoint (/atak/nodes.kml and /atak/local-url).

Tests use a minimal in-memory SQLite DB with the real schema migrations
so the endpoint exercises genuine DB queries.
"""

from __future__ import annotations

import re
import sqlite3
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.api.atak import router
from backend.app.db.connection import get_db_connection
from backend.app.db.database import run_migrations

# ---------------------------------------------------------------------------
# Test app factory — minimal app wired to an in-memory DB
# ---------------------------------------------------------------------------

TEST_TOKEN = "test-token-atak"


def _make_in_memory_db() -> sqlite3.Connection:
    """Create and migrate a fresh in-memory SQLite DB."""
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    run_migrations(conn)
    return conn


def _create_test_app(conn: sqlite3.Connection) -> FastAPI:
    """Minimal FastAPI app with AuthMiddleware in test mode and ATAK router."""
    from backend.app.auth.middleware import AuthMiddleware

    app = FastAPI()
    app.add_middleware(AuthMiddleware, token=TEST_TOKEN)
    app.include_router(router, prefix="/atak", tags=["atak"])
    return app


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {TEST_TOKEN}"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def db_conn():
    """Fresh in-memory DB with schema for each test."""
    conn = _make_in_memory_db()
    yield conn
    conn.close()


@pytest.fixture
def client(db_conn, monkeypatch):
    """TestClient connected to an in-memory DB."""
    monkeypatch.setenv("MESH_PLANNER_TEST_TOKEN", TEST_TOKEN)

    app = _create_test_app(db_conn)

    # Override the FastAPI dependency so it uses our in-memory connection.
    # Must reference the same function object used in atak.py's Depends().
    app.dependency_overrides[get_db_connection] = lambda: db_conn

    return TestClient(app)


# ---------------------------------------------------------------------------
# Helper: seed a plan + node into the in-memory DB
# ---------------------------------------------------------------------------


def _seed_plan(conn: sqlite3.Connection, plan_id: str = "plan-1", name: str = "Test Plan") -> None:
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO plans (id, name, description, created_at, updated_at) VALUES (?, ?, '', ?, ?)",
        (plan_id, name, now, now),
    )
    conn.commit()


def _seed_device(conn: sqlite3.Connection) -> None:
    """Insert a minimal device + antenna row required by the nodes FK."""
    conn.execute(
        "INSERT OR IGNORE INTO devices "
        "(id, name, mcu, radio_chip, max_tx_power_dbm, frequency_bands, "
        "has_gps, compatible_firmware) "
        "VALUES ('dev-1', 'Test Device', 'ESP32', 'SX1276', 20.0, '[\"915\"]', 0, '[\"meshtastic\"]')"
    )
    conn.execute(
        "INSERT OR IGNORE INTO antennas "
        "(id, name, frequency_band, gain_dbi) "
        "VALUES ('ant-1', 'Test Ant', '915', 2.0)"
    )
    conn.commit()


def _seed_node(
    conn: sqlite3.Connection,
    plan_id: str = "plan-1",
    node_id: str = "node-1",
    name: str = "Alpha Node",
    lat: float = 25.7617,
    lon: float = -80.1918,
) -> None:
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    _seed_device(conn)
    conn.execute(
        "INSERT INTO nodes "
        "(id, plan_id, name, latitude, longitude, antenna_height_m, "
        "device_id, firmware, region, frequency_mhz, tx_power_dbm, spreading_factor, "
        "bandwidth_khz, coding_rate, antenna_id, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, 3.0, 'dev-1', 'meshtastic', 'US', 915.0, 20.0, 11, 250.0, '4/5', 'ant-1', ?, ?)",
        (node_id, plan_id, name, lat, lon, now, now),
    )
    conn.commit()


# ---------------------------------------------------------------------------
# Tests: content-type and caching
# ---------------------------------------------------------------------------


class TestKMLHeaders:
    def test_content_type_is_kml(self, client):
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        assert r.status_code == 200
        assert "application/vnd.google-earth.kml+xml" in r.headers["content-type"]

    def test_no_cache_header_present(self, client):
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        assert "no-cache" in r.headers.get("cache-control", "")

    def test_pragma_no_cache(self, client):
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        assert r.headers.get("pragma", "") == "no-cache"


# ---------------------------------------------------------------------------
# Tests: valid XML structure
# ---------------------------------------------------------------------------


class TestKMLStructure:
    def test_xml_declaration(self, client):
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        assert '<?xml version="1.0"' in r.text

    def test_kml_root_element(self, client):
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        assert '<kml xmlns=' in r.text

    def test_document_element(self, client):
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        assert '<Document>' in r.text

    def test_three_folders_present(self, client):
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        assert r.text.count('<Folder>') == 3

    def test_empty_db_returns_valid_kml(self, client):
        """No nodes in DB — still returns valid KML with empty folders."""
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        assert r.status_code == 200
        assert '<kml' in r.text


# ---------------------------------------------------------------------------
# Tests: nodes appear in KML
# ---------------------------------------------------------------------------


class TestKMLNodes:
    def test_node_appears_in_kml(self, client, db_conn):
        _seed_plan(db_conn)
        _seed_node(db_conn)
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        assert "Alpha Node" in r.text

    def test_coordinates_are_lon_lat_order(self, client, db_conn):
        """KML spec requires longitude,latitude,altitude — NOT lat,lon."""
        _seed_plan(db_conn)
        _seed_node(db_conn, lat=25.7617, lon=-80.1918)
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        coords = re.findall(r'<coordinates>(.*?)</coordinates>', r.text)
        assert len(coords) >= 1
        for coord in coords:
            parts = coord.strip().split(',')
            assert len(parts) == 3, f"Expected lon,lat,alt format — got: {coord}"
            lon_val = float(parts[0])
            lat_val = float(parts[1])
            # Our seeded node: lat=25.7617, lon=-80.1918
            # In KML coordinates lon comes first
            assert abs(lon_val - (-80.1918)) < 0.001, f"First coord should be longitude, got {lon_val}"
            assert abs(lat_val - 25.7617) < 0.001, f"Second coord should be latitude, got {lat_val}"

    def test_zero_zero_node_excluded(self, client, db_conn):
        """Nodes at 0,0 (missing placement) are skipped."""
        _seed_plan(db_conn)
        _seed_node(db_conn, lat=0.0, lon=0.0, name="Unplaced Node")
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        assert "Unplaced Node" not in r.text

    def test_plan_name_in_description(self, client, db_conn):
        _seed_plan(db_conn, name="Gulf Coast Plan")
        _seed_node(db_conn)
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        assert "Gulf Coast Plan" in r.text


# ---------------------------------------------------------------------------
# Tests: node type classification
# ---------------------------------------------------------------------------


class TestNodeClassification:
    def test_repeater_in_name_goes_to_repeater_folder(self, client, db_conn):
        _seed_plan(db_conn)
        _seed_node(db_conn, name="Hill Repeater")
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        assert "style-repeater" in r.text

    def test_gateway_in_name_goes_to_gateway_folder(self, client, db_conn):
        _seed_plan(db_conn)
        _seed_node(db_conn, name="Main Gateway")
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        assert "style-gateway" in r.text

    def test_plain_node_gets_mesh_node_style(self, client, db_conn):
        _seed_plan(db_conn)
        _seed_node(db_conn, name="Rooftop Node")
        r = client.get("/atak/nodes.kml", headers=_auth_headers())
        assert "style-mesh-node" in r.text


# ---------------------------------------------------------------------------
# Tests: plan_id filter
# ---------------------------------------------------------------------------


class TestPlanFilter:
    def test_plan_id_filter_returns_only_matching_nodes(self, client, db_conn):
        _seed_plan(db_conn, plan_id="plan-1", name="Plan One")
        _seed_plan(db_conn, plan_id="plan-2", name="Plan Two")
        _seed_node(db_conn, plan_id="plan-1", node_id="n1", name="Node In Plan One")
        _seed_node(db_conn, plan_id="plan-2", node_id="n2", name="Node In Plan Two")
        r = client.get("/atak/nodes.kml?plan_id=plan-1", headers=_auth_headers())
        assert r.status_code == 200
        assert "Node In Plan One" in r.text
        assert "Node In Plan Two" not in r.text

    def test_nonexistent_plan_id_returns_valid_empty_kml(self, client):
        r = client.get("/atak/nodes.kml?plan_id=does-not-exist", headers=_auth_headers())
        assert r.status_code == 200
        assert '<kml' in r.text


# ---------------------------------------------------------------------------
# Tests: /atak/local-url
# ---------------------------------------------------------------------------


class TestLocalUrl:
    def test_local_url_status_200(self, client):
        r = client.get("/atak/local-url", headers=_auth_headers())
        assert r.status_code == 200

    def test_local_url_has_url_key(self, client):
        r = client.get("/atak/local-url", headers=_auth_headers())
        data = r.json()
        assert "url" in data

    def test_local_url_contains_port_8000(self, client):
        r = client.get("/atak/local-url", headers=_auth_headers())
        assert "8000" in r.json()["url"]

    def test_local_url_contains_nodes_kml_path(self, client):
        r = client.get("/atak/local-url", headers=_auth_headers())
        assert "nodes.kml" in r.json()["url"]

    def test_local_url_starts_with_http(self, client):
        r = client.get("/atak/local-url", headers=_auth_headers())
        assert r.json()["url"].startswith("http://")
