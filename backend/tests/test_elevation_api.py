"""Tests for elevation API endpoints using FastAPI TestClient."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.api.router import create_w3_router
from backend.app.auth.middleware import AuthMiddleware

TEST_TOKEN = "test-token-abc123"


def _create_test_app(srtm_manager=None) -> FastAPI:
    """Create a minimal FastAPI app with the W3 router for testing."""
    app = FastAPI()
    app.add_middleware(AuthMiddleware, token=TEST_TOKEN)
    router = create_w3_router(auth_token=TEST_TOKEN, srtm_manager=srtm_manager)
    app.include_router(router)
    return app


class TestElevationTileEndpoint:
    """Tests for GET /api/elevation/tile/{z}/{x}/{y}.png."""

    def test_valid_token_returns_png(self):
        """GET with valid ?token= returns 200 + image/png when renderer has data."""
        mock_srtm = MagicMock()
        mock_srtm._load_tile_to_cache.return_value = True
        mock_srtm.read_elevation_cached.return_value = 500
        mock_srtm.has_hgt.return_value = True

        app = _create_test_app(srtm_manager=mock_srtm)
        client = TestClient(app)
        resp = client.get(f"/api/elevation/tile/10/163/395.png?token={TEST_TOKEN}")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/png"
        assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"

    def test_invalid_token_returns_401(self):
        """GET with wrong token returns 401."""
        mock_srtm = MagicMock()
        app = _create_test_app(srtm_manager=mock_srtm)
        client = TestClient(app)
        resp = client.get("/api/elevation/tile/10/163/395.png?token=wrong")
        assert resp.status_code == 401

    def test_no_srtm_data_returns_204(self):
        """GET returns 204 when no SRTM data available."""
        mock_srtm = MagicMock()
        mock_srtm._load_tile_to_cache.return_value = False
        mock_srtm.has_hgt.return_value = False
        mock_srtm.read_elevation_cached.return_value = None

        app = _create_test_app(srtm_manager=mock_srtm)
        client = TestClient(app)
        # Use unique tile coords to avoid disk cache from other tests
        resp = client.get(f"/api/elevation/tile/14/8000/5000.png?token={TEST_TOKEN}")
        assert resp.status_code == 204

    def test_zoom_out_of_range_returns_204(self):
        """GET with z=5 returns 204 (out of supported zoom range)."""
        mock_srtm = MagicMock()
        app = _create_test_app(srtm_manager=mock_srtm)
        client = TestClient(app)
        resp = client.get(f"/api/elevation/tile/5/0/0.png?token={TEST_TOKEN}")
        assert resp.status_code == 204


class TestElevationEnsureTilesEndpoint:
    """Tests for POST /api/elevation/ensure-tiles."""

    def test_ensure_tiles_returns_counts(self):
        """POST returns JSON with tiles_needed/available/downloaded."""
        mock_srtm = MagicMock()
        mock_srtm.has_hgt.return_value = True

        app = _create_test_app(srtm_manager=mock_srtm)
        client = TestClient(app)
        resp = client.post(
            "/api/elevation/ensure-tiles",
            json={"min_lat": 37.7, "min_lon": -122.5, "max_lat": 37.8, "max_lon": -122.4},
            headers={"Authorization": f"Bearer {TEST_TOKEN}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "tiles_needed" in data
        assert "tiles_available" in data
        assert "tiles_downloaded" in data

    def test_ensure_tiles_no_srtm_returns_503(self):
        """POST returns 503 when srtm_manager is None."""
        app = _create_test_app(srtm_manager=None)
        client = TestClient(app)
        resp = client.post(
            "/api/elevation/ensure-tiles",
            json={"min_lat": 37.7, "min_lon": -122.5, "max_lat": 37.8, "max_lon": -122.4},
            headers={"Authorization": f"Bearer {TEST_TOKEN}"},
        )
        assert resp.status_code == 503
