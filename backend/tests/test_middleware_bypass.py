"""Tests for auth middleware bypass on elevation tile endpoints."""

from __future__ import annotations

from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.api.router import create_w3_router
from backend.app.auth.middleware import AuthMiddleware

TEST_TOKEN = "test-token-xyz789"


def _create_test_app() -> FastAPI:
    """Create a minimal FastAPI app with AuthMiddleware."""
    app = FastAPI()
    app.add_middleware(AuthMiddleware, token=TEST_TOKEN)
    mock_srtm = MagicMock()
    mock_srtm._load_tile_to_cache.return_value = True
    mock_srtm.read_elevation_cached.return_value = 500
    mock_srtm.has_hgt.return_value = True
    router = create_w3_router(auth_token=TEST_TOKEN, srtm_manager=mock_srtm)
    app.include_router(router)
    return app


class TestMiddlewareBypass:
    """Tests that elevation tile routes bypass Bearer header auth."""

    def test_elevation_tile_bypasses_bearer_auth(self):
        """/api/elevation/tile/ without Bearer header passes middleware (uses query param)."""
        app = _create_test_app()
        client = TestClient(app)
        # No Authorization header — middleware should let it through
        # Auth checked via ?token= query param in the endpoint itself
        resp = client.get(f"/api/elevation/tile/10/1/1.png?token={TEST_TOKEN}")
        # Should not get 401 from middleware — gets 204 (no SRTM data) or 200
        assert resp.status_code != 401

    def test_los_profile_requires_bearer_auth(self):
        """/api/los/profile without Bearer header fails 401."""
        app = _create_test_app()
        client = TestClient(app)
        resp = client.post(
            "/api/los/profile",
            json={},
            # No Authorization header
        )
        assert resp.status_code == 401
