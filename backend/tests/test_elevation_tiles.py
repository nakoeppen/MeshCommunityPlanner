"""Tests for elevation heatmap tile renderer."""

from __future__ import annotations

import math
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from backend.app.services.elevation_tiles import (
    ElevationTileRenderer,
    _elev_to_rgb,
    _elev_to_rgb_ranged,
    tile_bounds,
)


class TestTileBounds:
    """Tests for slippy map tile_bounds()."""

    def test_known_tile(self):
        """tile_bounds returns correct lat/lon for a known z/x/y."""
        min_lat, min_lon, max_lat, max_lon = tile_bounds(10, 163, 395)
        # Tile 10/163/395 covers part of San Francisco area
        assert -90 < min_lat < max_lat < 90
        assert -180 < min_lon < max_lon < 180

    def test_zoom_zero_covers_world(self):
        """Zoom 0 tile covers the full world longitude range."""
        min_lat, min_lon, max_lat, max_lon = tile_bounds(0, 0, 0)
        assert min_lon == pytest.approx(-180.0)
        assert max_lon == pytest.approx(180.0)
        assert max_lat == pytest.approx(85.0511, abs=0.01)


class TestColorRamp:
    """Tests for elevation-to-color mapping."""

    def test_sea_level(self):
        """0m maps to forest green (34, 139, 34)."""
        assert _elev_to_rgb(0) == (34, 139, 34)

    def test_mountain(self):
        """2000m maps to terracotta (170, 90, 70)."""
        assert _elev_to_rgb(2000) == (170, 90, 70)

    def test_below_sea(self):
        """Negative elevation maps to steel blue (70, 130, 180)."""
        assert _elev_to_rgb(-500) == (70, 130, 180)

    def test_clamp_above_max(self):
        """Elevations above 9000m clamp to snow white (245, 245, 252)."""
        assert _elev_to_rgb(10000) == (245, 245, 252)


class TestColorRampRanged:
    """Tests for ranged elevation-to-color mapping."""

    def test_bottom_of_range(self):
        """Elevation at range minimum maps to first color stop (steel blue)."""
        r, g, b = _elev_to_rgb_ranged(100, 100, 400)
        assert (r, g, b) == (70, 130, 180)

    def test_top_of_range(self):
        """Elevation at range maximum maps to last color stop (snow white)."""
        r, g, b = _elev_to_rgb_ranged(400, 100, 400)
        assert (r, g, b) == (245, 245, 252)

    def test_mid_range(self):
        """Elevation at midpoint maps to a middle color (not first or last)."""
        r, g, b = _elev_to_rgb_ranged(250, 100, 400)
        # Should be somewhere in the middle of the ramp, not the endpoints
        assert (r, g, b) != (70, 130, 180)
        assert (r, g, b) != (245, 245, 252)

    def test_clamp_below_min(self):
        """Elevation below range min clamps to first color stop."""
        r, g, b = _elev_to_rgb_ranged(0, 100, 400)
        assert (r, g, b) == (70, 130, 180)

    def test_clamp_above_max(self):
        """Elevation above range max clamps to last color stop."""
        r, g, b = _elev_to_rgb_ranged(1000, 100, 400)
        assert (r, g, b) == (245, 245, 252)

    def test_inverted_range_returns_first_stop(self):
        """When max <= min, returns first color stop (degenerate range)."""
        r, g, b = _elev_to_rgb_ranged(200, 400, 100)
        assert (r, g, b) == (70, 130, 180)

    def test_full_default_range_bottom(self):
        """Using the full default range, bottom matches static LUT."""
        r, g, b = _elev_to_rgb_ranged(-500, -500, 9000)
        assert (r, g, b) == (70, 130, 180)

    def test_full_default_range_top(self):
        """Using the full default range, top matches static LUT."""
        r, g, b = _elev_to_rgb_ranged(9000, -500, 9000)
        assert (r, g, b) == (245, 245, 252)


class TestElevationTileRenderer:
    """Tests for ElevationTileRenderer."""

    def test_out_of_zoom_range(self, mock_srtm_manager, tmp_cache_dir):
        """render_tile returns None for z=5 (below MIN_ZOOM)."""
        renderer = ElevationTileRenderer(mock_srtm_manager, tmp_cache_dir)
        assert renderer.render_tile(5, 0, 0) is None

    def test_no_srtm_data(self, tmp_cache_dir):
        """render_tile returns None when no SRTM tiles can be loaded."""
        manager = MagicMock()
        manager._load_tile_to_cache.return_value = False
        renderer = ElevationTileRenderer(manager, tmp_cache_dir)
        assert renderer.render_tile(10, 163, 395) is None

    def test_render_returns_png(self, mock_srtm_manager, tmp_cache_dir):
        """render_tile with mock SRTM returns valid PNG bytes."""
        renderer = ElevationTileRenderer(mock_srtm_manager, tmp_cache_dir)
        result = renderer.render_tile(10, 163, 395)
        assert result is not None
        assert result[:8] == b"\x89PNG\r\n\x1a\n"

    def test_disk_cache_hit(self, mock_srtm_manager, tmp_cache_dir):
        """Second render_tile call returns cached bytes from disk."""
        renderer = ElevationTileRenderer(mock_srtm_manager, tmp_cache_dir)
        first = renderer.render_tile(10, 163, 395)
        # Reset mock to verify it's not called again for elevation data
        mock_srtm_manager.read_elevation_cached.reset_mock()
        second = renderer.render_tile(10, 163, 395)
        assert second == first
        mock_srtm_manager.read_elevation_cached.assert_not_called()

    def test_clear_cache(self, mock_srtm_manager, tmp_cache_dir):
        """clear_cache deletes all cached PNGs."""
        renderer = ElevationTileRenderer(mock_srtm_manager, tmp_cache_dir)
        renderer.render_tile(10, 163, 395)
        count = renderer.clear_cache()
        assert count >= 1
        # Cache dir should have no PNGs left
        assert list(tmp_cache_dir.rglob("*.png")) == []

    def test_tile_path_default(self, mock_srtm_manager, tmp_cache_dir):
        """Default tile path uses z/x/y.png format."""
        renderer = ElevationTileRenderer(mock_srtm_manager, tmp_cache_dir)
        path = renderer._tile_path(10, 163, 395)
        assert path.name == "395.png"

    def test_tile_path_with_range(self, mock_srtm_manager, tmp_cache_dir):
        """Custom range tile path includes min/max in filename."""
        renderer = ElevationTileRenderer(mock_srtm_manager, tmp_cache_dir)
        path = renderer._tile_path(10, 163, 395, elev_min=100, elev_max=400)
        assert path.name == "395_min100_max400.png"

    def test_render_with_range_returns_png(self, mock_srtm_manager, tmp_cache_dir):
        """render_tile with custom range returns valid PNG bytes."""
        renderer = ElevationTileRenderer(mock_srtm_manager, tmp_cache_dir)
        result = renderer.render_tile(10, 163, 395, elev_min=100, elev_max=400)
        assert result is not None
        assert result[:8] == b"\x89PNG\r\n\x1a\n"

    def test_render_range_cached_separately(self, mock_srtm_manager, tmp_cache_dir):
        """Default and ranged tiles produce separate cache files."""
        renderer = ElevationTileRenderer(mock_srtm_manager, tmp_cache_dir)
        default_result = renderer.render_tile(10, 163, 395)
        ranged_result = renderer.render_tile(10, 163, 395, elev_min=100, elev_max=400)
        assert default_result is not None
        assert ranged_result is not None
        # Both cache files should exist
        assert renderer._tile_path(10, 163, 395).exists()
        assert renderer._tile_path(10, 163, 395, elev_min=100, elev_max=400).exists()
