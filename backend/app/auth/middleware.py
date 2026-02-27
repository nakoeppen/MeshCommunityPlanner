"""Auth middleware and brute-force protection.

AuthMiddleware: validates Bearer token on all routes except /health.
BruteForceProtection: tracks failed auth attempts per source IP,
blocks after threshold within time window.
"""

import secrets
import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from backend.app.config import is_test_mode


class BruteForceProtection:
    """Track failed auth attempts and block sources exceeding threshold.

    Args:
        max_attempts: Number of failures before blocking (default 10).
        window_seconds: Time window for counting failures (default 60).
        block_seconds: Duration of block after threshold hit (default 300 = 5 min).
    """

    def __init__(
        self,
        max_attempts: int = 10,
        window_seconds: int = 60,
        block_seconds: int = 300,
    ):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.block_seconds = block_seconds
        self._failures: dict[str, list[float]] = defaultdict(list)
        self._blocks: dict[str, float] = {}
        self._cleanup_counter = 0
        self._cleanup_interval = 100  # cleanup every N calls

    def record_failure(self, source: str) -> None:
        """Record a failed auth attempt from a source."""
        now = time.monotonic()
        self._failures[source].append(now)
        # Prune old entries outside window
        cutoff = now - self.window_seconds
        self._failures[source] = [
            t for t in self._failures[source] if t > cutoff
        ]
        # Check if threshold reached
        if len(self._failures[source]) >= self.max_attempts:
            self._blocks[source] = now + self.block_seconds
            self._failures[source].clear()

        # Periodic cleanup of stale sources
        self._cleanup_counter += 1
        if self._cleanup_counter >= self._cleanup_interval:
            self._cleanup_counter = 0
            self._cleanup_stale(now)

    def _cleanup_stale(self, now: float) -> None:
        """Remove sources with no recent failures and expired blocks."""
        cutoff = now - self.window_seconds
        stale = [s for s, ts in self._failures.items() if not ts or ts[-1] < cutoff]
        for s in stale:
            del self._failures[s]
        expired = [s for s, exp in self._blocks.items() if now > exp]
        for s in expired:
            del self._blocks[s]

    def is_blocked(self, source: str) -> bool:
        """Check if a source is currently blocked."""
        if source not in self._blocks:
            return False
        if time.monotonic() > self._blocks[source]:
            del self._blocks[source]
            return False
        return True


# Path prefixes that bypass auth.
# /api/shutdown is included because the browser's sendBeacon API (used on
# tab close) cannot set custom headers like Authorization.
# Safe because the server only listens on 127.0.0.1 (not externally reachable).
_AUTH_BYPASS_PATHS = frozenset({"/api/health", "/api/shutdown"})

# Path prefixes that bypass Bearer header auth (use query param token instead)
_AUTH_BYPASS_PREFIXES = ("/api/elevation/tile/",)


class AuthMiddleware(BaseHTTPMiddleware):
    """Validate Bearer token on all API requests except health.

    Args:
        app: ASGI application.
        token: The valid auth token for this session.
    """

    def __init__(self, app, token: str):
        super().__init__(app)
        self._token = token
        self._test_mode = is_test_mode()
        # Disable brute-force protection in test mode to allow integration tests
        self._brute_force = None if self._test_mode else BruteForceProtection()

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Allow health endpoint without auth
        if path in _AUTH_BYPASS_PATHS:
            return await call_next(request)

        # Allow tile endpoints that use query param auth instead of Bearer header
        if any(path.startswith(prefix) for prefix in _AUTH_BYPASS_PREFIXES):
            return await call_next(request)

        # Only check auth for /api/ routes (skip static files)
        if not path.startswith("/api/"):
            return await call_next(request)

        source = request.client.host if request.client else "unknown"

        # Check brute-force block (skip in test mode)
        if self._brute_force is not None and self._brute_force.is_blocked(source):
            return JSONResponse(
                status_code=403,
                content={"detail": "Too many failed attempts. Try again later."},
            )

        # Validate Bearer token
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            if self._brute_force is not None:
                self._brute_force.record_failure(source)
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid authentication token."},
            )

        provided_token = auth_header[7:]  # Strip "Bearer "
        if not provided_token or not secrets.compare_digest(provided_token, self._token):
            if self._brute_force is not None:
                self._brute_force.record_failure(source)
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid authentication token."},
            )

        return await call_next(request)
