"""Rate limiting configuration using slowapi.

Three rate groups per design:
- general: 100/min (CRUD, catalog lookups)
- propagation: 10/min (CPU-intensive Signal-Server runs)
- import_export: 20/min (file I/O, PDF generation)
"""

from fastapi import FastAPI
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.requests import Request
from starlette.responses import JSONResponse

# Rate limit strings for decorating endpoints
RATE_GENERAL = "100/minute"
RATE_PROPAGATION = "10/minute"
RATE_IMPORT_EXPORT = "20/minute"


def get_rate_limiter() -> Limiter:
    """Create a configured rate limiter instance."""
    return Limiter(key_func=get_remote_address)


async def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Custom 429 handler that includes Retry-After header."""
    # Extract window from slowapi detail (e.g. "10 per 1 minute")
    retry_after = "60"
    if exc.detail:
        detail = str(exc.detail)
        if "second" in detail:
            retry_after = "1"
        elif "minute" in detail:
            retry_after = "60"
        elif "hour" in detail:
            retry_after = "3600"
    response = JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Try again later."},
    )
    response.headers["Retry-After"] = retry_after
    return response


def configure_rate_limiting(app: FastAPI) -> Limiter:
    """Configure rate limiting on a FastAPI application.

    Returns the limiter instance for use as a decorator on endpoints.
    """
    limiter = get_rate_limiter()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    return limiter
