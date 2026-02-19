"""Shared database connection dependency for FastAPI.

Provides a single get_db_connection() callable for use with Depends()
across all API routers. The DatabaseManager is initialized during app
lifespan startup via init_db_manager().
"""

from __future__ import annotations

import sqlite3
import threading

from backend.app.db.database import DatabaseManager

_db_manager: DatabaseManager | None = None


def init_db_manager(manager: DatabaseManager) -> None:
    """Set the module-level DatabaseManager reference.

    Called once during app lifespan startup after the manager is opened
    and migrations have run.
    """
    global _db_manager  # noqa: PLW0603
    _db_manager = manager


def get_db_connection() -> sqlite3.Connection:
    """FastAPI dependency that returns the active database connection.

    Usage in routers:
        @router.get("/example")
        def example(conn=Depends(get_db_connection)):
            ...
    """
    if _db_manager is None:
        msg = "Database not initialized. App lifespan has not started."
        raise RuntimeError(msg)
    return _db_manager.connection


def get_db_write_lock() -> threading.Lock:
    """FastAPI dependency that returns the database write lock.

    Usage in routers that perform write operations:
        @router.post("/example")
        def example(conn=Depends(get_db_connection), lock=Depends(get_db_write_lock)):
            with lock:
                conn.execute(...)
                conn.commit()
    """
    if _db_manager is None:
        msg = "Database not initialized. App lifespan has not started."
        raise RuntimeError(msg)
    return _db_manager.write_lock
