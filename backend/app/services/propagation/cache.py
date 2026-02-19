"""Propagation result cache backed by SQLite.

Uses the propagation_cache table from W1's Phase 2 schema:
    id TEXT PRIMARY KEY
    plan_id TEXT NOT NULL
    node_id TEXT (nullable for plan-wide)
    engine TEXT NOT NULL
    params_hash TEXT NOT NULL
    result_data BLOB NOT NULL
    created_at TEXT NOT NULL

Phase 11 task 11.11.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Optional


class CacheStats:
    """In-memory hit/miss statistics for the propagation cache."""

    __slots__ = ("_hits", "_misses")

    def __init__(self) -> None:
        self._hits = 0
        self._misses = 0

    @property
    def hits(self) -> int:
        return self._hits

    @property
    def misses(self) -> int:
        return self._misses

    @property
    def total(self) -> int:
        return self._hits + self._misses

    @property
    def hit_rate(self) -> float:
        """Hit rate as a fraction 0.0–1.0. Returns 0.0 if no lookups."""
        return self._hits / self.total if self.total > 0 else 0.0

    def record_hit(self) -> None:
        self._hits += 1

    def record_miss(self) -> None:
        self._misses += 1

    def reset(self) -> None:
        self._hits = 0
        self._misses = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "hits": self._hits,
            "misses": self._misses,
            "total": self.total,
            "hit_rate": round(self.hit_rate, 4),
        }


class PropagationCache:
    """Cache for propagation computation results.

    Wraps the propagation_cache table. Accepts a sqlite3.Connection
    so it can share the app's DatabaseManager connection.
    Tracks in-memory hit/miss statistics via `.stats`.
    """

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self.stats = CacheStats()

    def get(
        self,
        plan_id: str,
        engine: str,
        params_hash: str,
        node_id: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """Look up a cached result.

        Returns deserialized result dict, or None on cache miss.
        """
        if node_id:
            row = self._conn.execute(
                "SELECT result_data FROM propagation_cache "
                "WHERE plan_id = ? AND engine = ? AND params_hash = ? AND node_id = ?",
                (plan_id, engine, params_hash, node_id),
            ).fetchone()
        else:
            row = self._conn.execute(
                "SELECT result_data FROM propagation_cache "
                "WHERE plan_id = ? AND engine = ? AND params_hash = ? AND node_id IS NULL",
                (plan_id, engine, params_hash),
            ).fetchone()

        if row is None:
            self.stats.record_miss()
            return None

        self.stats.record_hit()
        result_data = row[0] if isinstance(row, (tuple, list)) else row["result_data"]
        if isinstance(result_data, bytes):
            return json.loads(result_data.decode("utf-8"))
        return json.loads(result_data)

    def put(
        self,
        plan_id: str,
        engine: str,
        params_hash: str,
        result_data: dict[str, Any],
        node_id: Optional[str] = None,
    ) -> str:
        """Store a computation result in the cache.

        Returns the cache entry ID.
        """
        cache_id = str(uuid.uuid4())
        blob = json.dumps(result_data, ensure_ascii=False).encode("utf-8")
        now = datetime.now(timezone.utc).isoformat()

        self._conn.execute(
            "INSERT INTO propagation_cache (id, plan_id, node_id, engine, params_hash, result_data, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (cache_id, plan_id, node_id, engine, params_hash, blob, now),
        )
        self._conn.commit()
        return cache_id

    def invalidate_plan(self, plan_id: str) -> int:
        """Delete all cached results for a plan.

        Returns the number of rows deleted.
        """
        cursor = self._conn.execute(
            "DELETE FROM propagation_cache WHERE plan_id = ?",
            (plan_id,),
        )
        self._conn.commit()
        return cursor.rowcount

    def invalidate_node(self, plan_id: str, node_id: str) -> int:
        """Delete cached results for a specific node.

        Returns the number of rows deleted.
        """
        cursor = self._conn.execute(
            "DELETE FROM propagation_cache WHERE plan_id = ? AND node_id = ?",
            (plan_id, node_id),
        )
        self._conn.commit()
        return cursor.rowcount

    def get_many(
        self,
        keys: list[tuple[str, str, str, Optional[str]]],
    ) -> dict[int, dict[str, Any]]:
        """Batch lookup of cached results.

        Args:
            keys: List of (plan_id, engine, params_hash, node_id) tuples.

        Returns:
            Dict mapping key index → result dict for cache hits only.
            Missing indices are cache misses.
        """
        if not keys:
            return {}

        results: dict[int, dict[str, Any]] = {}

        for idx, (plan_id, engine, params_hash, node_id) in enumerate(keys):
            if node_id:
                row = self._conn.execute(
                    "SELECT result_data FROM propagation_cache "
                    "WHERE plan_id = ? AND engine = ? AND params_hash = ? AND node_id = ?",
                    (plan_id, engine, params_hash, node_id),
                ).fetchone()
            else:
                row = self._conn.execute(
                    "SELECT result_data FROM propagation_cache "
                    "WHERE plan_id = ? AND engine = ? AND params_hash = ? AND node_id IS NULL",
                    (plan_id, engine, params_hash),
                ).fetchone()

            if row is not None:
                self.stats.record_hit()
                data = row[0] if isinstance(row, (tuple, list)) else row["result_data"]
                if isinstance(data, bytes):
                    results[idx] = json.loads(data.decode("utf-8"))
                else:
                    results[idx] = json.loads(data)
            else:
                self.stats.record_miss()

        return results

    def put_many(
        self,
        entries: list[tuple[str, str, str, dict[str, Any], Optional[str]]],
    ) -> list[str]:
        """Batch insert of cached results in a single transaction.

        Args:
            entries: List of (plan_id, engine, params_hash, result_data, node_id) tuples.

        Returns:
            List of cache entry IDs in the same order as entries.
        """
        if not entries:
            return []

        now = datetime.now(timezone.utc).isoformat()
        ids: list[str] = []
        rows: list[tuple] = []

        for plan_id, engine, params_hash, result_data, node_id in entries:
            cache_id = str(uuid.uuid4())
            blob = json.dumps(result_data, ensure_ascii=False).encode("utf-8")
            rows.append((cache_id, plan_id, node_id, engine, params_hash, blob, now))
            ids.append(cache_id)

        self._conn.executemany(
            "INSERT INTO propagation_cache "
            "(id, plan_id, node_id, engine, params_hash, result_data, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
        self._conn.commit()
        return ids

    def count(self, plan_id: Optional[str] = None) -> int:
        """Count cached entries, optionally filtered by plan."""
        if plan_id:
            row = self._conn.execute(
                "SELECT COUNT(*) FROM propagation_cache WHERE plan_id = ?",
                (plan_id,),
            ).fetchone()
        else:
            row = self._conn.execute(
                "SELECT COUNT(*) FROM propagation_cache"
            ).fetchone()
        return row[0]
