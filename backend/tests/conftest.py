"""Shared test fixtures for backend tests."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest


@pytest.fixture
def mock_srtm_manager():
    """Mock SRTMManager with configurable return values."""
    manager = MagicMock()
    manager.read_elevation_cached.return_value = 500
    manager.has_hgt.return_value = True
    manager._load_tile_to_cache.return_value = True
    return manager


@pytest.fixture
def tmp_cache_dir(tmp_path: Path) -> Path:
    """Temporary directory for tile cache."""
    cache = tmp_path / "elevation_tiles"
    cache.mkdir()
    return cache
