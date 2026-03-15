"""Unit tests for the /api/signal-import/parse endpoint.

Tests cover:
1. Valid Meshtastic-format CSV returns correctly parsed rows
2. Generic format (node_a/node_b/rssi_dbm) is parsed correctly
3. RSSI out of range rows are skipped with reason in skip_reasons
4. SNR out of range rows are skipped with reason
5. Empty node name rows are skipped
6. Missing SNR column → snr_db is null in output (not an error)
7. Missing timestamp column → timestamp is null (not an error)
8. More than 500 rows → truncated to 500, total_parsed reflects actual count
9. File with no valid rows returns empty rows list, not an error
10. Auth required (401 without token)
"""

from __future__ import annotations

import io
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.api.signal_import import router

TEST_TOKEN = "test-token-signal-import"


def _create_test_app() -> FastAPI:
    """Minimal app with AuthMiddleware in test mode."""
    from backend.app.auth.middleware import AuthMiddleware

    app = FastAPI()
    app.add_middleware(AuthMiddleware, token=TEST_TOKEN)
    app.include_router(router, prefix="/api")
    return app


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {TEST_TOKEN}"}


def _csv_file(content: str, filename: str = "signal.csv") -> tuple[str, tuple[str, bytes, str]]:
    """Build a multipart file tuple for TestClient."""
    return ("file", (filename, content.encode("utf-8"), "text/csv"))


@pytest.fixture
def client(monkeypatch):
    """TestClient with auth test mode enabled."""
    monkeypatch.setenv("MESH_PLANNER_TEST_TOKEN", TEST_TOKEN)
    app = _create_test_app()
    return TestClient(app)


# ============================================================================
# Test 1: Valid Meshtastic-format CSV
# ============================================================================


class TestMeshtasticFormat:
    def test_valid_meshtastic_csv_returns_correct_rows(self, client):
        """Meshtastic export format: from, to, snr, rssi, timestamp."""
        csv_content = (
            "from,to,snr,rssi,timestamp\n"
            "!abc12345,!def67890,-5.5,-87,2026-03-14T12:00:00\n"
            "!abc12345,!ghi11111,-3.0,-92,2026-03-14T12:01:00\n"
        )
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_parsed"] == 2
        assert body["skipped"] == 0
        assert len(body["rows"]) == 2

        row = body["rows"][0]
        assert row["node_a"] == "!abc12345"
        assert row["node_b"] == "!def67890"
        assert row["rssi_dbm"] == pytest.approx(-87.0)
        assert row["snr_db"] == pytest.approx(-5.5)
        assert row["timestamp"] == "2026-03-14T12:00:00"

    def test_columns_detected_meshtastic(self, client):
        """columns_detected reflects actual CSV headers for Meshtastic format."""
        csv_content = "from,to,snr,rssi,timestamp\n!a,!b,-4,-88,2026-03-14\n"
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        cols = resp.json()["columns_detected"]
        assert cols["node_a"] == "from"
        assert cols["node_b"] == "to"
        assert cols["rssi"] == "rssi"
        assert cols["snr"] == "snr"
        assert cols["timestamp"] == "timestamp"


# ============================================================================
# Test 2: Generic format (node_a/node_b/rssi_dbm)
# ============================================================================


class TestGenericFormat:
    def test_generic_format_parsed_correctly(self, client):
        """Generic format: node_a, node_b, rssi_dbm, snr_db."""
        csv_content = (
            "node_a,node_b,rssi_dbm,snr_db\n"
            "Node Alpha,Node Beta,-91,-4.5\n"
            "Node Alpha,Node Gamma,-78,2.0\n"
        )
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["rows"]) == 2
        assert body["rows"][0]["node_a"] == "Node Alpha"
        assert body["rows"][0]["node_b"] == "Node Beta"
        assert body["rows"][0]["rssi_dbm"] == pytest.approx(-91.0)
        assert body["rows"][0]["snr_db"] == pytest.approx(-4.5)

    def test_minimal_format_from_node_to_node_rssi(self, client):
        """Minimal format: from_node, to_node, rssi."""
        csv_content = (
            "from_node,to_node,rssi\n"
            "Alpha,Beta,-88\n"
        )
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["rows"]) == 1
        assert body["rows"][0]["rssi_dbm"] == pytest.approx(-88.0)


# ============================================================================
# Test 3: RSSI out of range rows skipped
# ============================================================================


class TestRSSIOutOfRange:
    def test_rssi_below_minus140_skipped_with_reason(self, client):
        """RSSI < -140 dBm is rejected and skip_reasons contains the row reference."""
        csv_content = (
            "from,to,rssi\n"
            "!a,!b,-145\n"
            "!a,!c,-90\n"
        )
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["rows"]) == 1
        assert body["rows"][0]["rssi_dbm"] == pytest.approx(-90.0)
        assert body["skipped"] == 1
        assert any("Row 2" in r and "-145" in r for r in body["skip_reasons"])

    def test_rssi_above_zero_skipped(self, client):
        """RSSI > 0 dBm is rejected."""
        csv_content = "from,to,rssi\n!a,!b,5\n!a,!c,-90\n"
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        assert len(resp.json()["rows"]) == 1

    def test_rssi_boundary_zero_accepted(self, client):
        """RSSI exactly 0 dBm is within range and accepted."""
        csv_content = "from,to,rssi\n!a,!b,0\n"
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        assert len(resp.json()["rows"]) == 1

    def test_rssi_boundary_minus140_accepted(self, client):
        """RSSI exactly -140 dBm is within range and accepted."""
        csv_content = "from,to,rssi\n!a,!b,-140\n"
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        assert len(resp.json()["rows"]) == 1


# ============================================================================
# Test 4: SNR out of range rows skipped
# ============================================================================


class TestSNROutOfRange:
    def test_snr_below_minus20_skipped_with_reason(self, client):
        """SNR < -20 dB is rejected with skip reason."""
        csv_content = (
            "from,to,rssi,snr\n"
            "!a,!b,-90,-25\n"
            "!a,!c,-88,-3\n"
        )
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["rows"]) == 1
        assert body["skipped"] == 1
        assert any("Row 2" in r and "-25" in r for r in body["skip_reasons"])

    def test_snr_above_plus20_skipped(self, client):
        """SNR > 20 dB is rejected."""
        csv_content = "from,to,rssi,snr\n!a,!b,-90,25\n!a,!c,-88,5\n"
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        assert len(resp.json()["rows"]) == 1


# ============================================================================
# Test 5: Empty node name rows skipped
# ============================================================================


class TestEmptyNodeName:
    def test_empty_node_a_skipped(self, client):
        """Rows with empty node_a are skipped."""
        csv_content = (
            "from,to,rssi\n"
            ",!b,-90\n"
            "!a,!b,-88\n"
        )
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["rows"]) == 1
        assert body["skipped"] == 1
        assert any("empty node name" in r for r in body["skip_reasons"])

    def test_empty_node_b_skipped(self, client):
        """Rows with empty node_b are skipped."""
        csv_content = "from,to,rssi\n!a,,-90\n!a,!b,-88\n"
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        assert len(resp.json()["rows"]) == 1


# ============================================================================
# Test 6: Missing SNR column → snr_db is null
# ============================================================================


class TestMissingSNRColumn:
    def test_missing_snr_column_snr_db_is_null(self, client):
        """When no SNR column exists, snr_db is null — not an error."""
        csv_content = (
            "from,to,rssi\n"
            "!a,!b,-90\n"
        )
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["rows"]) == 1
        assert body["rows"][0]["snr_db"] is None
        assert body["skipped"] == 0


# ============================================================================
# Test 7: Missing timestamp column → timestamp is null
# ============================================================================


class TestMissingTimestampColumn:
    def test_missing_timestamp_column_timestamp_is_null(self, client):
        """When no timestamp column exists, timestamp is null — not an error."""
        csv_content = (
            "from,to,rssi,snr\n"
            "!a,!b,-90,-5\n"
        )
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["rows"]) == 1
        assert body["rows"][0]["timestamp"] is None


# ============================================================================
# Test 8: More than 500 rows → truncated to 500
# ============================================================================


class TestRowTruncation:
    def test_more_than_500_rows_truncated_to_500(self, client):
        """Files with > 500 valid rows are truncated to MAX_ROWS=500."""
        lines = ["from,to,rssi"]
        for i in range(600):
            lines.append(f"NodeA{i},NodeB{i},-80")
        csv_content = "\n".join(lines)

        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["rows"]) == 500
        assert body["total_parsed"] == 600
        assert "truncated_note" in body


# ============================================================================
# Test 9: File with no valid rows returns empty list (not an error)
# ============================================================================


class TestNoValidRows:
    def test_all_rows_invalid_returns_empty_list_not_error(self, client):
        """When all rows fail validation, return empty rows — not a 4xx."""
        csv_content = (
            "from,to,rssi\n"
            ",,-999\n"
            ",NodeB,-200\n"
            "NodeA,,abc\n"
        )
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["rows"] == []
        assert body["total_parsed"] == 3
        assert body["skipped"] == 3
        assert len(body["skip_reasons"]) > 0

    def test_empty_file_returns_empty_rows(self, client):
        """Completely empty file returns 200 with empty rows, no error."""
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file("")],
            headers=_auth_headers(),
        )
        assert resp.status_code == 200
        assert resp.json()["rows"] == []


# ============================================================================
# Test 10: Auth required
# ============================================================================


class TestAuth:
    def test_no_auth_token_returns_401(self, client):
        """Request without Authorization header → 401."""
        csv_content = "from,to,rssi\n!a,!b,-90\n"
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            # No auth headers
        )
        assert resp.status_code == 401

    def test_wrong_token_returns_401(self, client):
        """Request with wrong token → 401."""
        csv_content = "from,to,rssi\n!a,!b,-90\n"
        resp = client.post(
            "/api/signal-import/parse",
            files=[_csv_file(csv_content)],
            headers={"Authorization": "Bearer wrong-token"},
        )
        assert resp.status_code == 401
