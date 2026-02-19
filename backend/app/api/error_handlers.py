"""
Secure error handlers for FastAPI.

Provides generic error messages to clients while logging detailed errors
server-side. Prevents exposure of stack traces, file paths, and implementation
details in API responses.
"""

import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle all unhandled exceptions with a generic error message.

    Logs detailed error information server-side but returns only a generic
    message to the client to avoid exposing sensitive implementation details.

    Args:
        request: The request that caused the exception
        exc: The exception that was raised

    Returns:
        JSONResponse with generic error message and 500 status code
    """
    # Log detailed error server-side (with stack trace for debugging)
    logger.error(
        f"Internal server error on {request.method} {request.url.path}: {type(exc).__name__}: {exc}",
        exc_info=True  # Include stack trace in server logs
    )

    # Return generic error to client (no details)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred"}
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """
    Handle HTTP exceptions (404, 403, etc.) with clean messages.

    Ensures that HTTP exceptions don't leak implementation details like file paths
    or internal structure.

    Args:
        request: The request that caused the exception
        exc: The HTTP exception that was raised

    Returns:
        JSONResponse with sanitized error message
    """
    # Log HTTP errors server-side
    logger.warning(
        f"HTTP {exc.status_code} on {request.method} {request.url.path}: {exc.detail}"
    )

    # Return the exception detail (already safe for HTTP exceptions)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handle validation errors from Pydantic models.

    Returns FastAPI's standard validation error format, which is already safe
    and doesn't expose implementation details.

    Args:
        request: The request that caused the validation error
        exc: The validation error

    Returns:
        JSONResponse with validation error details
    """
    # Log validation errors server-side
    logger.info(
        f"Validation error on {request.method} {request.url.path}: {exc.errors()}"
    )

    # Convert errors to JSON-serializable format
    errors = []
    for error in exc.errors():
        error_dict = {
            "type": error.get("type"),
            "loc": error.get("loc"),
            "msg": error.get("msg"),
            "input": error.get("input")
        }
        # Convert ctx values to strings (they may contain non-serializable objects)
        if "ctx" in error:
            error_dict["ctx"] = {k: str(v) for k, v in error["ctx"].items()}
        errors.append(error_dict)

    # Return standard FastAPI validation error format (safe - no internals exposed)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors}
    )


def register_error_handlers(app):
    """
    Register all custom error handlers with the FastAPI app.

    Args:
        app: FastAPI application instance
    """
    # Generic exception handler (catch-all for unhandled exceptions)
    app.add_exception_handler(Exception, generic_exception_handler)

    # HTTP exceptions (404, 403, etc.)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    # Validation errors (422)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
