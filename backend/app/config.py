"""Application configuration and mode detection."""

import os
import sys
from pathlib import Path


def is_test_mode() -> bool:
    """Check if running in test mode (MESH_PLANNER_TEST_TOKEN env var set)."""
    return "MESH_PLANNER_TEST_TOKEN" in os.environ


def get_port() -> int:
    """Get the server port from env or default.

    Validates port is in range 1-65535.
    """
    port = int(os.environ.get("MESH_PLANNER_PORT", "8321"))
    if not 1 <= port <= 65535:
        msg = f"Invalid port {port}: must be 1-65535"
        raise ValueError(msg)
    return port


def get_data_dir() -> Path:
    """Get the platform-appropriate data directory."""
    if custom := os.environ.get("MESH_PLANNER_DATA_DIR"):
        return Path(custom)

    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        return base / "MeshCommunityPlanner"
    elif sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "MeshCommunityPlanner"
    else:
        return Path.home() / ".local" / "share" / "mesh-community-planner"


def get_db_path() -> Path:
    """Get the database file path."""
    return get_data_dir() / "db" / "mesh_planner.db"


def find_available_port(host: str = "127.0.0.1") -> int:
    """Find an available port using a three-tier strategy.

    1. Try the preferred port (from MESH_PLANNER_PORT env or default 8321)
    2. Scan a small range above it (preferred+1 through preferred+9)
    3. Fall back to OS-assigned ephemeral port

    Returns an available port number.
    """
    import socket

    preferred = get_port()

    # Tier 1: preferred port
    if _port_is_free(host, preferred):
        return preferred

    # Tier 2: scan range
    for port in range(preferred + 1, preferred + 10):
        if _port_is_free(host, port):
            return port

    # Tier 3: OS-assigned
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((host, 0))
        return s.getsockname()[1]


def _port_is_free(host: str, port: int) -> bool:
    """Check if a port is available for binding."""
    import socket

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind((host, port))
            return True
    except OSError:
        return False


def is_production_mode() -> bool:
    """Production mode: debug off, docs off, test tokens rejected."""
    return not is_test_mode() and os.environ.get("MESH_PLANNER_ENV") != "development"


class ConfigurationError(Exception):
    """Raised when application configuration is invalid."""


def validate_config() -> list[str]:
    """Validate all configuration at startup.

    Returns list of warning messages for non-critical issues.
    Raises ConfigurationError for critical issues.
    """
    warnings = []

    # Validate port
    try:
        get_port()
    except (ValueError, TypeError) as e:
        msg = f"Invalid port configuration: {e}"
        raise ConfigurationError(msg) from e

    # Validate data directory is writable
    data_dir = get_data_dir()
    if str(data_dir) != ":memory:":
        try:
            data_dir.mkdir(parents=True, exist_ok=True)
            test_file = data_dir / ".config_test"
            test_file.write_text("test", encoding="utf-8")
            test_file.unlink()
        except OSError as e:
            msg = f"Data directory not writable: {data_dir} ({e})"
            raise ConfigurationError(msg) from e

    # Validate MESH_PLANNER_ENV if set
    env_mode = os.environ.get("MESH_PLANNER_ENV", "")
    valid_modes = {"", "development", "production", "test"}
    if env_mode and env_mode not in valid_modes:
        warnings.append(f"Unknown MESH_PLANNER_ENV '{env_mode}', expected: development, production, test")

    # Warn if test token set in production mode
    if os.environ.get("MESH_PLANNER_ENV") == "production" and is_test_mode():
        warnings.append("MESH_PLANNER_TEST_TOKEN is set in production mode — this is insecure")

    return warnings
