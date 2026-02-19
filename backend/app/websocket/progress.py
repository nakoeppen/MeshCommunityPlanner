"""WebSocket progress manager for propagation job updates.

Broadcasts progress events to connected WebSocket clients and supports
cancellation of running jobs. The ticket-based authentication is handled
by W1's middleware; this module manages the post-auth progress messaging.

See design.md WebSocket section for message schemas.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    """Propagation job status values."""

    DOWNLOADING_TERRAIN = "downloading_terrain"
    CONVERTING_SRTM = "converting_srtm"
    CALCULATING = "calculating"
    COMPLETE = "complete"
    ERROR = "error"
    CANCELLED = "cancelled"


@dataclass
class ProgressUpdate:
    """A progress update message to send via WebSocket."""

    job_id: str
    status: JobStatus
    progress: float  # 0.0 to 1.0
    message: str = ""
    node_id: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "type": "propagation_progress",
            "job_id": self.job_id,
            "status": self.status.value,
            "progress": self.progress,
            "message": self.message,
        }
        if self.node_id:
            result["node_id"] = self.node_id
        return result


class ProgressManager:
    """Manages WebSocket connections and propagation job progress.

    Responsibilities:
    - Track connected WebSocket clients
    - Broadcast progress updates to all connected clients
    - Track active jobs for cancellation support
    - Generate unique job IDs
    """

    def __init__(self) -> None:
        self._connections: set[Any] = set()  # WebSocket connections
        self._active_jobs: dict[str, asyncio.Event] = {}  # job_id → cancel event
        self._lock = asyncio.Lock()

    @property
    def connection_count(self) -> int:
        return len(self._connections)

    @property
    def active_job_count(self) -> int:
        return len(self._active_jobs)

    async def connect(self, websocket: Any) -> None:
        """Register a new WebSocket connection."""
        async with self._lock:
            self._connections.add(websocket)
        logger.info("WebSocket connected. Total: %d", len(self._connections))

    async def disconnect(self, websocket: Any) -> None:
        """Remove a WebSocket connection."""
        async with self._lock:
            self._connections.discard(websocket)
        logger.info("WebSocket disconnected. Total: %d", len(self._connections))

    def create_job(self) -> str:
        """Create a new propagation job and return its ID."""
        job_id = str(uuid.uuid4())
        self._active_jobs[job_id] = asyncio.Event()
        logger.info("Created propagation job: %s", job_id)
        return job_id

    def is_cancelled(self, job_id: str) -> bool:
        """Check if a job has been cancelled."""
        cancel_event = self._active_jobs.get(job_id)
        if cancel_event is None:
            return False
        return cancel_event.is_set()

    def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job. Returns True if job existed and was cancelled."""
        cancel_event = self._active_jobs.get(job_id)
        if cancel_event is None:
            return False
        cancel_event.set()
        logger.info("Cancelled propagation job: %s", job_id)
        return True

    def complete_job(self, job_id: str) -> None:
        """Mark a job as complete and clean up."""
        self._active_jobs.pop(job_id, None)

    async def broadcast(self, update: ProgressUpdate) -> None:
        """Send a progress update to all connected clients."""
        if not self._connections:
            return

        message = update.to_dict()
        dead_connections = set()

        logger = logging.getLogger(__name__)
        for ws in self._connections:
            try:
                await ws.send_json(message)
            except (ConnectionError, OSError):
                dead_connections.add(ws)
            except Exception as exc:
                logger.debug("Broadcast failed for connection: %s", exc)
                dead_connections.add(ws)

        # Clean up dead connections
        if dead_connections:
            async with self._lock:
                self._connections -= dead_connections

    async def send_progress(
        self,
        job_id: str,
        status: JobStatus,
        progress: float,
        message: str = "",
        node_id: Optional[str] = None,
    ) -> None:
        """Convenience method to create and broadcast a progress update."""
        update = ProgressUpdate(
            job_id=job_id,
            status=status,
            progress=progress,
            message=message,
            node_id=node_id,
        )
        await self.broadcast(update)

    async def handle_client_message(self, data: dict) -> None:
        """Handle an incoming WebSocket message from a client.

        Supports:
        - {"type": "cancel_propagation", "job_id": "..."}
        """
        msg_type = data.get("type")
        if msg_type == "cancel_propagation":
            job_id = data.get("job_id", "")
            if job_id:
                self.cancel_job(job_id)


# Singleton instance for the application
progress_manager = ProgressManager()
