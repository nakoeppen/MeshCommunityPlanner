"""Database write serialization middleware.

Serializes all mutating HTTP requests (POST, PUT, PATCH, DELETE) through
an asyncio lock to prevent concurrent SQLite write operations.

For a single-user desktop app this is the safest approach — correctness
matters more than write throughput.  Read requests (GET, HEAD, OPTIONS)
pass through without locking.
"""

from __future__ import annotations

import asyncio

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

# Methods that may write to the database
_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


class WriteSerializationMiddleware(BaseHTTPMiddleware):
    """Serialize write requests through an async lock to protect SQLite."""

    def __init__(self, app):
        super().__init__(app)
        self._lock = asyncio.Lock()

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.method in _WRITE_METHODS:
            async with self._lock:
                return await call_next(request)
        return await call_next(request)
