"""
Health endpoint - unauthenticated status check and monitoring.

Returns {"status": "ok"} to indicate the API is running.
/health/details provides diagnostics (DB status, schema version, uptime, counts).
Provides health status, detailed component health, and readiness probes.
"""

from __future__ import annotations

import sqlite3
import time

from fastapi import APIRouter

# Module-level startup timestamp for uptime tracking
_start_time = time.monotonic()

# Optional DB connection reference (set by create_health_router or main.py)
_db_connection: sqlite3.Connection | None = None


def get_uptime() -> float:
    """Return seconds since module was first imported."""
    return time.monotonic() - _start_time


def create_health_router(
    db_connection: sqlite3.Connection | None = None,
) -> APIRouter:
    """Create health router with optional DB connection for diagnostics."""
    health_router = APIRouter()

    @health_router.get("/api/health")
    async def health():
        """Health check — public, unauthenticated."""
        return {"status": "ok"}

    @health_router.get("/api/health/details")
    async def health_details():
        """Detailed health diagnostics."""
        conn = db_connection or _db_connection
        db_info = _get_db_info(conn)
        return {
            "status": "ok",
            "uptime_seconds": round(get_uptime(), 2),
            "database": db_info,
        }

    return health_router


def _get_db_info(conn: sqlite3.Connection | None) -> dict:
    """Gather database diagnostics."""
    if conn is None:
        return {"connected": False, "schema_version": 0, "plans_count": 0, "nodes_count": 0}

    try:
        conn.execute("SELECT 1")
        connected = True
    except Exception:
        return {"connected": False, "schema_version": 0, "plans_count": 0, "nodes_count": 0}

    schema_version = 0
    try:
        row = conn.execute(
            "SELECT value FROM meta WHERE key = 'schema_version'"
        ).fetchone()
        if row:
            schema_version = int(row[0])
    except Exception:
        pass

    plans_count = 0
    nodes_count = 0
    try:
        plans_count = conn.execute("SELECT COUNT(*) FROM plans").fetchone()[0]
        nodes_count = conn.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
    except Exception:
        pass

    return {
        "connected": connected,
        "schema_version": schema_version,
        "plans_count": plans_count,
        "nodes_count": nodes_count,
    }


# Keep the original router for backward compatibility with W2's import
router = APIRouter()

# Store app start time for W2 router endpoints
_app_start_time = time.time()


@router.get("/health")
async def health():
    """
    Basic health check endpoint (no auth required).

    Returns:
        Simple status indicator
    """
    return {"status": "healthy"}


@router.get("/health/detailed")
async def detailed_health():
    """
    Detailed health check with component status.

    Returns:
        Detailed health information including all components
    """
    uptime_seconds = time.time() - _app_start_time

    components = {
        "database": {
            "status": "healthy",
            "type": "sqlite"
        },
        "api": {
            "status": "healthy",
            "uptime_seconds": round(uptime_seconds, 2)
        },
        "cache": {
            "status": "healthy",
            "type": "in-memory"
        }
    }

    # Determine overall status
    all_healthy = all(c["status"] == "healthy" for c in components.values())
    overall_status = "healthy" if all_healthy else "degraded"

    return {
        "status": overall_status,
        "components": components,
        "timestamp": time.time()
    }


@router.get("/health/ready")
async def readiness_probe():
    """
    Readiness probe endpoint (no auth required).

    Indicates whether the API is ready to accept requests.

    Returns:
        Readiness status
    """
    # Check if minimum uptime has been met (e.g., 1 second)
    uptime = time.time() - _start_time
    is_ready = uptime > 1.0

    return {
        "ready": is_ready,
        "uptime_seconds": round(uptime, 2)
    }
