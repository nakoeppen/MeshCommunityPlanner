"""Elevation heatmap tile renderer.

Renders 256x256 PNG tiles with hypsometric tinting from SRTM elevation data.
Tiles follow the standard Web Mercator slippy map convention (z/x/y).
"""

from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import Optional

from backend.app.services.png_writer import encode_rgba_png

logger = logging.getLogger(__name__)

# Supported zoom range (below 9 too zoomed out, above 15 exceeds SRTM 30m resolution)
MIN_ZOOM = 9
MAX_ZOOM = 15

TILE_SIZE = 256

# ---------------------------------------------------------------------------
# Hypsometric color ramp — (elevation_m, R, G, B)
# ---------------------------------------------------------------------------
_COLOR_STOPS = [
    (-500,   70, 130, 180),   # Deep below sea level — steel blue
    (   0,   34, 139,  34),   # Sea level — forest green
    (  50,   85, 185,  85),   # Low — medium green
    ( 200,  180, 220,  90),   # Moderate — yellow-green
    ( 500,  240, 230,  80),   # Medium — bright yellow
    ( 800,  230, 175,  45),   # High-medium — amber-gold
    (1200,  200, 120,  40),   # High — deep orange
    (2000,  170,  90,  70),   # Mountain — terracotta
    (3000,  180, 180, 180),   # Alpine — medium gray
    (4500,  245, 245, 252),   # Peak — snow white
]

# Pre-compute LUT for fast rendering: elevations -500 to 9000
_LUT_MIN = -500
_LUT_MAX = 9000
_LUT: list[tuple[int, int, int]] = []


def _build_lut() -> None:
    """Build the elevation→color lookup table."""
    global _LUT  # noqa: PLW0603
    _LUT = []
    for elev in range(_LUT_MIN, _LUT_MAX + 1):
        # Find surrounding stops
        if elev <= _COLOR_STOPS[0][0]:
            _LUT.append((_COLOR_STOPS[0][1], _COLOR_STOPS[0][2], _COLOR_STOPS[0][3]))
            continue
        if elev >= _COLOR_STOPS[-1][0]:
            _LUT.append((_COLOR_STOPS[-1][1], _COLOR_STOPS[-1][2], _COLOR_STOPS[-1][3]))
            continue

        for i in range(len(_COLOR_STOPS) - 1):
            e0, r0, g0, b0 = _COLOR_STOPS[i]
            e1, r1, g1, b1 = _COLOR_STOPS[i + 1]
            if e0 <= elev <= e1:
                t = (elev - e0) / (e1 - e0)
                r = int(r0 + t * (r1 - r0))
                g = int(g0 + t * (g1 - g0))
                b = int(b0 + t * (b1 - b0))
                _LUT.append((r, g, b))
                break
        else:
            # Should not happen
            _LUT.append((0, 0, 0))


_build_lut()


def _elev_to_rgb(elev: int) -> tuple[int, int, int]:
    """Map elevation to RGB using the pre-computed LUT."""
    idx = elev - _LUT_MIN
    if idx < 0:
        idx = 0
    elif idx >= len(_LUT):
        idx = len(_LUT) - 1
    return _LUT[idx]


def _elev_to_rgb_ranged(elev: int, elev_min: int, elev_max: int) -> tuple[int, int, int]:
    """Map elevation to RGB with a custom min/max range.

    Normalizes elevation to [0, 1] within the given range, then interpolates
    through the 10 COLOR_STOPS evenly spaced across that range.
    """
    if elev_max <= elev_min:
        return _COLOR_STOPS[0][1], _COLOR_STOPS[0][2], _COLOR_STOPS[0][3]

    # Clamp to range
    clamped = max(elev_min, min(elev_max, elev))
    t = (clamped - elev_min) / (elev_max - elev_min)  # 0..1

    # Map t to a position across the N color stops (evenly spaced)
    n = len(_COLOR_STOPS)
    scaled = t * (n - 1)
    idx = int(scaled)
    if idx >= n - 1:
        return _COLOR_STOPS[-1][1], _COLOR_STOPS[-1][2], _COLOR_STOPS[-1][3]

    frac = scaled - idx
    _, r0, g0, b0 = _COLOR_STOPS[idx]
    _, r1, g1, b1 = _COLOR_STOPS[idx + 1]
    r = int(r0 + frac * (r1 - r0))
    g = int(g0 + frac * (g1 - g0))
    b = int(b0 + frac * (b1 - b0))
    return (r, g, b)


# ---------------------------------------------------------------------------
# Slippy map math
# ---------------------------------------------------------------------------

def tile_bounds(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    """Convert slippy map tile coords to (min_lat, min_lon, max_lat, max_lon).

    Uses standard Web Mercator tile convention.
    """
    n = 2.0 ** z
    min_lon = x / n * 360.0 - 180.0
    max_lon = (x + 1) / n * 360.0 - 180.0
    max_lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    min_lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return (min_lat, min_lon, max_lat, max_lon)


def srtm_tiles_for_tile(z: int, x: int, y: int) -> list[tuple[int, int]]:
    """Return the SRTM tile coordinates needed for a given map tile."""
    min_lat, min_lon, max_lat, max_lon = tile_bounds(z, x, y)
    from backend.app.services.propagation.srtm import tiles_for_bounds
    return tiles_for_bounds(min_lat, min_lon, max_lat, max_lon)


# ---------------------------------------------------------------------------
# Tile renderer
# ---------------------------------------------------------------------------

class ElevationTileRenderer:
    """Renders and caches elevation heatmap PNG tiles."""

    def __init__(self, srtm_manager, cache_dir: Path):
        self._srtm = srtm_manager
        self._cache_dir = cache_dir
        self._cache_dir.mkdir(parents=True, exist_ok=True)

    def _tile_path(
        self, z: int, x: int, y: int,
        elev_min: Optional[int] = None, elev_max: Optional[int] = None,
    ) -> Path:
        """Get the disk cache path for a tile.

        When custom elevation range is provided, the filename includes the range
        so different ranges are cached separately.
        """
        if elev_min is not None and elev_max is not None:
            fname = f"{y}_min{elev_min}_max{elev_max}.png"
        else:
            fname = f"{y}.png"
        return self._cache_dir / str(z) / str(x) / fname

    def get_cached(
        self, z: int, x: int, y: int,
        elev_min: Optional[int] = None, elev_max: Optional[int] = None,
    ) -> Optional[bytes]:
        """Check disk cache for a rendered tile."""
        path = self._tile_path(z, x, y, elev_min, elev_max)
        if path.exists():
            return path.read_bytes()
        return None

    def render_tile(
        self, z: int, x: int, y: int,
        elev_min: Optional[int] = None, elev_max: Optional[int] = None,
    ) -> Optional[bytes]:
        """Render a 256x256 elevation heatmap tile.

        Returns PNG bytes, or None if no SRTM data is available for this area.
        When elev_min/elev_max are provided, the full color ramp is stretched
        across that elevation range for better local contrast.
        """
        if z < MIN_ZOOM or z > MAX_ZOOM:
            return None

        # Determine if we're using a custom range
        use_ranged = (
            elev_min is not None and elev_max is not None
            and (elev_min != _LUT_MIN or elev_max != _LUT_MAX)
        )

        # Check cache first
        cached = self.get_cached(z, x, y, elev_min if use_ranged else None, elev_max if use_ranged else None)
        if cached is not None:
            return cached

        min_lat, min_lon, max_lat, max_lon = tile_bounds(z, x, y)

        # Pre-load needed SRTM tiles into memory
        srtm_tiles = srtm_tiles_for_tile(z, x, y)
        any_loaded = False
        for tlat, tlon in srtm_tiles:
            if self._srtm._load_tile_to_cache(tlat, tlon):
                any_loaded = True

        if not any_loaded:
            return None

        # Sample elevation at each pixel
        lat_step = (max_lat - min_lat) / TILE_SIZE
        lon_step = (max_lon - min_lon) / TILE_SIZE

        # Choose color mapping function
        if use_ranged:
            color_fn = lambda elev: _elev_to_rgb_ranged(elev, elev_min, elev_max)
        else:
            color_fn = _elev_to_rgb

        pixels = bytearray(TILE_SIZE * TILE_SIZE * 4)
        has_data = False

        for py in range(TILE_SIZE):
            # Top of tile = max_lat, bottom = min_lat
            lat = max_lat - (py + 0.5) * lat_step
            row_offset = py * TILE_SIZE * 4
            for px in range(TILE_SIZE):
                lon = min_lon + (px + 0.5) * lon_step
                elev = self._srtm.read_elevation_cached(lat, lon)
                if elev is not None:
                    has_data = True
                    r, g, b = color_fn(elev)
                    idx = row_offset + px * 4
                    pixels[idx] = r
                    pixels[idx + 1] = g
                    pixels[idx + 2] = b
                    pixels[idx + 3] = 180  # semi-transparent
                # else: stays (0,0,0,0) = fully transparent

        if not has_data:
            return None

        png_bytes = encode_rgba_png(TILE_SIZE, TILE_SIZE, bytes(pixels))

        # Cache to disk
        path = self._tile_path(z, x, y, elev_min if use_ranged else None, elev_max if use_ranged else None)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(png_bytes)

        return png_bytes

    def clear_cache(self) -> int:
        """Delete all cached elevation tiles. Returns number of files deleted."""
        import shutil
        count = 0
        if self._cache_dir.exists():
            for png_file in self._cache_dir.rglob("*.png"):
                png_file.unlink()
                count += 1
            # Clean up empty directories
            for d in sorted(self._cache_dir.rglob("*"), reverse=True):
                if d.is_dir():
                    try:
                        d.rmdir()
                    except OSError:
                        pass
        logger.info("Cleared %d elevation tile cache files", count)
        return count
