"""SRTM terrain data pipeline.

Downloads SRTM 1-arc-second (30m) .hgt tiles, verifies SHA-256
checksums, converts to SDF format using srtm2sdf-hd, and caches locally.

Primary source: AWS S3 public mirror (Mapzen/Tilezen, no auth required).
Fallback: USGS EarthData (requires NASA Earthdata login — may 404 without auth).

See design.md Decision 5.
"""

from __future__ import annotations

import gzip
import hashlib
import logging
import math
import os
import struct
import subprocess
import zipfile
from pathlib import Path
from typing import Callable, Optional

import httpx

logger = logging.getLogger(__name__)

# AWS S3 public SRTM mirror (Mapzen/Tilezen — no auth required, gzip format)
SRTM_BASE_URL = "https://elevation-tiles-prod.s3.amazonaws.com/skadi"

# Fallback: USGS SRTM data source (requires NASA Earthdata auth)
SRTM_USGS_URL = "https://e4ftl01.cr.usgs.gov/MEASURES/SRTMGL1.003/2000.02.11"

# SRTM tile dimensions
SRTM1_ROWS = 3601
SRTM1_COLS = 3601
SRTM1_BYTES = SRTM1_ROWS * SRTM1_COLS * 2  # signed 16-bit big-endian

ProgressCallback = Optional[Callable[[float, str], None]]

# Safety cap: maximum tiles per bounding box request
MAX_TILES_PER_REQUEST = 100


def tile_filename(lat: int, lon: int) -> str:
    """Construct SRTM tile filename from integer lat/lon.

    Example: lat=40, lon=-74 → 'N40W074.hgt'
    """
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return f"{ns}{abs(lat):02d}{ew}{abs(lon):03d}.hgt"


def tiles_for_bounds(
    min_lat: float, min_lon: float, max_lat: float, max_lon: float
) -> list[tuple[int, int]]:
    """Return list of (lat, lon) integer pairs for all SRTM tiles needed.

    SRTM tile coordinates are the SW corner of each 1°×1° tile.
    """
    lat_start = math.floor(min_lat)
    lat_end = math.floor(max_lat)
    lon_start = math.floor(min_lon)
    lon_end = math.floor(max_lon)

    tiles = []
    for lat in range(lat_start, lat_end + 1):
        for lon in range(lon_start, lon_end + 1):
            tiles.append((lat, lon))
    return tiles


def sdf_filename(lat: int, lon: int) -> str:
    """Construct SDF filename from integer lat/lon per Signal-Server convention.

    Example: lat=40, lon=-74 → '40_41_74_73-hd.sdf'
    (min_north_max_north_min_west_max_west format)
    """
    min_north = lat
    max_north = lat + 1
    # SDF uses "west" convention (positive numbers for W longitude)
    min_west = -lon if lon < 0 else 360 - lon
    max_west = min_west - 1
    return f"{min_north}_{max_north}_{min_west}_{max_west}-hd.sdf"


class SRTMManager:
    """Manages SRTM tile download, verification, SDF conversion, and LRU eviction."""

    # Max number of .hgt tiles held in memory (each ~25MB)
    MAX_MEMORY_TILES = 9

    def __init__(
        self,
        srtm_dir: str,
        sdf_dir: str,
        converter_path: str = "srtm2sdf-hd",
        known_hashes: Optional[dict[str, str]] = None,
        max_cache_bytes: Optional[int] = None,
    ):
        self._srtm_dir = Path(srtm_dir)
        self._sdf_dir = Path(sdf_dir)
        self._converter_path = converter_path
        self._known_hashes = known_hashes or {}
        self._max_cache_bytes = max_cache_bytes  # None = unlimited

        # In-memory tile cache for fast elevation reads (coverage grids)
        # Key: (tile_lat, tile_lon), Value: raw bytes of .hgt file
        self._tile_memory_cache: dict[tuple[int, int], bytes] = {}
        self._tile_access_order: list[tuple[int, int]] = []

        # Create directories
        self._srtm_dir.mkdir(parents=True, exist_ok=True)
        self._sdf_dir.mkdir(parents=True, exist_ok=True)

    @property
    def srtm_dir(self) -> Path:
        return self._srtm_dir

    @property
    def sdf_dir(self) -> Path:
        return self._sdf_dir

    def has_hgt(self, lat: int, lon: int) -> bool:
        """Check if .hgt tile is cached."""
        return (self._srtm_dir / tile_filename(lat, lon)).exists()

    def has_sdf(self, lat: int, lon: int) -> bool:
        """Check if .sdf tile is cached."""
        return (self._sdf_dir / sdf_filename(lat, lon)).exists()

    def verify_hgt_hash(self, lat: int, lon: int) -> bool:
        """Verify SHA-256 hash of a cached .hgt tile.

        Returns True if no known hash (skip check) or hash matches.
        Returns False if hash mismatch.
        """
        fname = tile_filename(lat, lon)
        expected_hash = self._known_hashes.get(fname)
        if expected_hash is None:
            return True  # No known hash, skip verification

        hgt_path = self._srtm_dir / fname
        if not hgt_path.exists():
            return False

        sha256 = hashlib.sha256()
        with open(hgt_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)

        return sha256.hexdigest() == expected_hash

    async def download_tile(
        self,
        lat: int,
        lon: int,
        progress: ProgressCallback = None,
    ) -> Path:
        """Download an SRTM .hgt tile.

        Tries AWS S3 public mirror first (gzip, no auth), then falls back
        to USGS (zip, may require NASA Earthdata auth).

        Returns path to the downloaded .hgt file.
        """
        fname = tile_filename(lat, lon)
        hgt_path = self._srtm_dir / fname

        # Check cache
        if hgt_path.exists() and self.verify_hgt_hash(lat, lon):
            logger.info("SRTM tile %s already cached", fname)
            if progress:
                progress(1.0, f"Tile {fname} cached")
            return hgt_path

        if progress:
            progress(0.0, f"Downloading {fname}...")

        # --- Try AWS S3 mirror first (gzip, no auth) ---
        ns = "N" if lat >= 0 else "S"
        ew = "E" if lon >= 0 else "W"
        skadi_dir = f"{ns}{abs(lat):02d}"
        aws_url = f"{SRTM_BASE_URL}/{skadi_dir}/{fname}.gz"
        gz_path = self._srtm_dir / f"{fname}.gz"

        try:
            async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
                async with client.stream("GET", aws_url) as response:
                    response.raise_for_status()
                    total = int(response.headers.get("content-length", 0))
                    downloaded = 0

                    with open(gz_path, "wb") as f:
                        async for chunk in response.aiter_bytes(chunk_size=65536):
                            f.write(chunk)
                            downloaded += len(chunk)
                            if progress and total > 0:
                                progress(downloaded / total * 0.9, f"Downloading {fname}...")

            # Decompress gzip → .hgt
            with gzip.open(gz_path, "rb") as gz_in:
                with open(hgt_path, "wb") as hgt_out:
                    while True:
                        chunk = gz_in.read(65536)
                        if not chunk:
                            break
                        hgt_out.write(chunk)

            gz_path.unlink(missing_ok=True)
            logger.info("Downloaded SRTM tile %s from AWS S3 mirror", fname)

        except (httpx.HTTPError, gzip.BadGzipFile, OSError) as aws_err:
            gz_path.unlink(missing_ok=True)
            logger.warning("AWS S3 download failed for %s: %s — trying USGS fallback", fname, aws_err)

            # --- Fallback: USGS source (zip format) ---
            usgs_url = f"{SRTM_USGS_URL}/{fname}.zip"
            zip_path = self._srtm_dir / f"{fname}.zip"

            try:
                async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
                    async with client.stream("GET", usgs_url) as response:
                        response.raise_for_status()
                        total = int(response.headers.get("content-length", 0))
                        downloaded = 0

                        with open(zip_path, "wb") as f:
                            async for chunk in response.aiter_bytes(chunk_size=65536):
                                f.write(chunk)
                                downloaded += len(chunk)
                                if progress and total > 0:
                                    progress(downloaded / total * 0.9, f"Downloading {fname}...")
            except httpx.HTTPError as e:
                zip_path.unlink(missing_ok=True)
                raise IOError(f"Failed to download SRTM tile {fname} from both sources: {e}") from e

            try:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extract(fname, self._srtm_dir)
            except (zipfile.BadZipFile, KeyError) as e:
                raise IOError(f"Failed to extract {fname} from zip: {e}") from e
            finally:
                zip_path.unlink(missing_ok=True)

            logger.info("Downloaded SRTM tile %s from USGS fallback", fname)

        # Verify hash
        if not self.verify_hgt_hash(lat, lon):
            hgt_path.unlink(missing_ok=True)
            raise IOError(f"SHA-256 hash mismatch for {fname}")

        if progress:
            progress(1.0, f"Downloaded {fname}")

        return hgt_path

    async def convert_to_sdf(
        self,
        lat: int,
        lon: int,
        progress: ProgressCallback = None,
    ) -> Path:
        """Convert .hgt tile to SDF format using srtm2sdf-hd.

        Returns path to the .sdf file.
        """
        sdf_name = sdf_filename(lat, lon)
        sdf_path = self._sdf_dir / sdf_name

        # Check cache
        if sdf_path.exists():
            logger.info("SDF tile %s already cached", sdf_name)
            if progress:
                progress(1.0, f"SDF {sdf_name} cached")
            return sdf_path

        hgt_name = tile_filename(lat, lon)
        hgt_path = self._srtm_dir / hgt_name

        if not hgt_path.exists():
            raise FileNotFoundError(f"HGT tile not found: {hgt_path}")

        if progress:
            progress(0.0, f"Converting {hgt_name} to SDF...")

        try:
            result = subprocess.run(
                [self._converter_path, str(hgt_path)],
                shell=False,
                capture_output=True,
                timeout=120,
                cwd=str(self._sdf_dir),
            )
        except FileNotFoundError:
            raise FileNotFoundError(
                f"srtm2sdf-hd binary not found at: {self._converter_path}"
            )
        except subprocess.TimeoutExpired:
            raise TimeoutError("SDF conversion timed out after 120s")

        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="replace")
            raise RuntimeError(
                f"srtm2sdf-hd failed with code {result.returncode}: {stderr[:500]}"
            )

        if progress:
            progress(1.0, f"Converted {sdf_name}")

        return sdf_path

    async def ensure_tiles(
        self,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
        progress: ProgressCallback = None,
    ) -> list[Path]:
        """Ensure all SRTM tiles for a bounding box are downloaded and converted.

        Returns list of SDF file paths.
        """
        tiles = tiles_for_bounds(min_lat, min_lon, max_lat, max_lon)
        if len(tiles) > MAX_TILES_PER_REQUEST:
            raise ValueError(
                f"Bounding box requires {len(tiles)} SRTM tiles, "
                f"exceeds safety limit of {MAX_TILES_PER_REQUEST}. "
                f"Reduce the area or process in smaller batches."
            )
        sdf_paths = []
        total = len(tiles)

        for i, (lat, lon) in enumerate(tiles):
            tile_progress = None
            if progress:
                base = i / total

                def tile_progress(pct: float, msg: str, b=base, t=total) -> None:
                    progress(b + pct / t, msg)

            # Download if needed
            await self.download_tile(lat, lon, progress=tile_progress)
            # Convert if needed
            sdf_path = await self.convert_to_sdf(lat, lon, progress=tile_progress)
            sdf_paths.append(sdf_path)

        return sdf_paths

    def cache_size_bytes(self) -> int:
        """Total size of all cached .hgt and .sdf files in bytes."""
        total = 0
        for f in self._srtm_dir.glob("*.hgt"):
            total += f.stat().st_size
        for f in self._sdf_dir.glob("*-hd.sdf"):
            total += f.stat().st_size
        return total

    def cached_tiles(self) -> list[dict]:
        """List all cached tiles sorted by last access time (oldest first).

        Returns list of dicts with keys: path, size, atime, type.
        """
        entries = []
        for f in self._srtm_dir.glob("*.hgt"):
            stat = f.stat()
            entries.append({
                "path": f,
                "size": stat.st_size,
                "atime": stat.st_atime,
                "type": "hgt",
            })
        for f in self._sdf_dir.glob("*-hd.sdf"):
            stat = f.stat()
            entries.append({
                "path": f,
                "size": stat.st_size,
                "atime": stat.st_atime,
                "type": "sdf",
            })
        entries.sort(key=lambda e: e["atime"])
        return entries

    def evict_lru(self, target_bytes: Optional[int] = None) -> int:
        """Evict least-recently-used tiles until cache is under the limit.

        Args:
            target_bytes: Target cache size. If None, uses max_cache_bytes.

        Returns:
            Number of files deleted.
        """
        limit = target_bytes if target_bytes is not None else self._max_cache_bytes
        if limit is None:
            return 0  # No limit configured

        deleted = 0
        current_size = self.cache_size_bytes()
        if current_size <= limit:
            return 0

        tiles = self.cached_tiles()
        for entry in tiles:
            if current_size <= limit:
                break
            try:
                entry["path"].unlink()
                current_size -= entry["size"]
                deleted += 1
                logger.info("Evicted %s (%d bytes)", entry["path"].name, entry["size"])
            except OSError:
                continue

        return deleted

    def read_elevation(self, lat: float, lon: float) -> Optional[int]:
        """Read elevation at a specific lat/lon from cached .hgt data.

        Returns elevation in meters AMSL, or None if tile not available.
        """
        tile_lat = math.floor(lat)
        tile_lon = math.floor(lon)
        hgt_path = self._srtm_dir / tile_filename(tile_lat, tile_lon)

        if not hgt_path.exists():
            return None

        # Calculate position within the tile
        # .hgt files are 3601x3601, covering 1 degree
        row = int(round((tile_lat + 1 - lat) * (SRTM1_ROWS - 1)))
        col = int(round((lon - tile_lon) * (SRTM1_COLS - 1)))

        row = max(0, min(row, SRTM1_ROWS - 1))
        col = max(0, min(col, SRTM1_COLS - 1))

        offset = (row * SRTM1_COLS + col) * 2

        try:
            with open(hgt_path, "rb") as f:
                f.seek(offset)
                data = f.read(2)
                if len(data) < 2:
                    return None
                elev = struct.unpack(">h", data)[0]
                if elev == -32768:  # Void
                    return None
                return elev
        except (IOError, struct.error):
            return None

    def _load_tile_to_cache(self, tile_lat: int, tile_lon: int) -> bool:
        """Load a full .hgt tile into memory for fast repeated reads.

        Uses LRU eviction when cache exceeds MAX_MEMORY_TILES.
        Returns True if tile is now in cache, False if file not available.
        """
        key = (tile_lat, tile_lon)
        if key in self._tile_memory_cache:
            # Move to end of access order (most recent)
            if key in self._tile_access_order:
                self._tile_access_order.remove(key)
            self._tile_access_order.append(key)
            return True

        hgt_path = self._srtm_dir / tile_filename(tile_lat, tile_lon)
        if not hgt_path.exists():
            return False

        try:
            with open(hgt_path, "rb") as f:
                data = f.read()
            if len(data) < SRTM1_BYTES:
                logger.warning("SRTM tile %s too small (%d bytes)", hgt_path.name, len(data))
                return False
        except IOError as e:
            logger.warning("Failed to read SRTM tile %s: %s", hgt_path.name, e)
            return False

        # Evict LRU tiles if over limit
        while len(self._tile_memory_cache) >= self.MAX_MEMORY_TILES:
            if self._tile_access_order:
                evict_key = self._tile_access_order.pop(0)
                self._tile_memory_cache.pop(evict_key, None)
                logger.debug("Evicted memory tile %s", evict_key)

        self._tile_memory_cache[key] = data
        self._tile_access_order.append(key)
        logger.debug("Loaded tile %s into memory (%d bytes)", hgt_path.name, len(data))
        return True

    def read_elevation_cached(self, lat: float, lon: float) -> Optional[int]:
        """Read elevation from in-memory tile cache (fast path for coverage grids).

        Same logic as read_elevation() but reads from memory instead of disk.
        Call _load_tile_to_cache() first, or this will attempt to load on demand.
        Returns elevation in meters AMSL, or None if tile not available.
        """
        tile_lat = math.floor(lat)
        tile_lon = math.floor(lon)
        key = (tile_lat, tile_lon)

        # Auto-load if not cached
        if key not in self._tile_memory_cache:
            if not self._load_tile_to_cache(tile_lat, tile_lon):
                return None

        data = self._tile_memory_cache[key]

        # Calculate position within the tile
        row = int(round((tile_lat + 1 - lat) * (SRTM1_ROWS - 1)))
        col = int(round((lon - tile_lon) * (SRTM1_COLS - 1)))

        row = max(0, min(row, SRTM1_ROWS - 1))
        col = max(0, min(col, SRTM1_COLS - 1))

        offset = (row * SRTM1_COLS + col) * 2

        try:
            if offset + 2 > len(data):
                return None
            elev = struct.unpack(">h", data[offset:offset + 2])[0]
            if elev == -32768:  # Void
                return None
            return elev
        except struct.error:
            return None

    def clear_memory_cache(self) -> int:
        """Clear the in-memory tile cache and return number of tiles freed."""
        count = len(self._tile_memory_cache)
        self._tile_memory_cache.clear()
        self._tile_access_order.clear()
        if count > 0:
            logger.info("Cleared %d tiles from memory cache", count)
        return count
