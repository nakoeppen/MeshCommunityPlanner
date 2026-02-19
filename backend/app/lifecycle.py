"""Application lifecycle management.

Provides:
- ShutdownManager: sync/async cleanup callbacks with error isolation
- PID/port file management: single-instance enforcement
- Stale process cleanup: detect and terminate leftover instances on startup
- Signal handlers: graceful cleanup before os._exit() on Ctrl+C / console close
"""

from __future__ import annotations

import atexit
import logging
import os
import signal
import sys
import threading
from collections.abc import Callable, Coroutine
from pathlib import Path
from typing import Any

from backend.app.config import get_data_dir

logger = logging.getLogger(__name__)

# ---- Module-level state for PID/signal management ----
_pid_path: Path | None = None
_port_path: Path | None = None
_shutdown_manager: ShutdownManager | None = None
_cleanup_done = False


class ShutdownManager:
    """Manages graceful application shutdown.

    Register cleanup callbacks with on_shutdown() / on_shutdown_async().
    Call initiate() or initiate_async() to run them in order.

    Args:
        timeout_seconds: Maximum time to wait for callbacks (default 10).
    """

    def __init__(self, timeout_seconds: float = 10.0):
        self._timeout = timeout_seconds
        self._shutting_down = False
        self._sync_callbacks: list[Callable[[], Any]] = []
        self._async_callbacks: list[Callable[[], Coroutine]] = []

    @property
    def is_shutting_down(self) -> bool:
        """Whether shutdown has been initiated."""
        return self._shutting_down

    def on_shutdown(self, callback: Callable[[], Any]) -> None:
        """Register a sync cleanup callback."""
        self._sync_callbacks.append(callback)

    def on_shutdown_async(self, callback: Callable[[], Coroutine]) -> None:
        """Register an async cleanup callback."""
        self._async_callbacks.append(callback)

    def initiate(self) -> None:
        """Run all sync shutdown callbacks.

        Idempotent — only runs once even if called multiple times.
        Each callback runs in isolation: errors don't block others.
        """
        if self._shutting_down:
            return
        self._shutting_down = True

        for cb in self._sync_callbacks:
            try:
                cb()
            except Exception:
                logger.exception("Shutdown callback failed: %s", cb)

    async def initiate_async(self) -> None:
        """Run all shutdown callbacks (sync first, then async).

        Idempotent — only runs once even if called multiple times.
        """
        if self._shutting_down:
            return
        self._shutting_down = True

        # Run sync callbacks first
        for cb in self._sync_callbacks:
            try:
                cb()
            except Exception:
                logger.exception("Sync shutdown callback failed: %s", cb)

        # Run async callbacks
        for cb in self._async_callbacks:
            try:
                await cb()
            except Exception:
                logger.exception("Async shutdown callback failed: %s", cb)


# ========================================================================
# PID / port file management
# ========================================================================

def get_pid_file_path() -> Path:
    return get_data_dir() / "mesh_planner.pid"


def get_port_file_path() -> Path:
    return get_data_dir() / "mesh_planner.port"


def write_pid_file(port: int) -> None:
    """Write current PID and port to data directory files."""
    global _pid_path, _port_path
    _pid_path = get_pid_file_path()
    _port_path = get_port_file_path()

    _pid_path.parent.mkdir(parents=True, exist_ok=True)
    _pid_path.write_text(str(os.getpid()), encoding="utf-8")
    _port_path.write_text(str(port), encoding="utf-8")
    logger.info("PID file written: pid=%d, port=%d", os.getpid(), port)


def remove_pid_file() -> None:
    """Remove PID and port files if they belong to this process."""
    for path in (_pid_path, _port_path):
        if path and path.exists():
            try:
                path.unlink()
            except OSError:
                pass


def _read_pid_file() -> int | None:
    path = get_pid_file_path()
    if not path.exists():
        return None
    try:
        return int(path.read_text(encoding="utf-8").strip())
    except (ValueError, OSError):
        path.unlink(missing_ok=True)
        return None


def _read_port_file() -> int | None:
    path = get_port_file_path()
    if not path.exists():
        return None
    try:
        return int(path.read_text(encoding="utf-8").strip())
    except (ValueError, OSError):
        return None


# ========================================================================
# Process detection and termination
# ========================================================================

def _is_process_running(pid: int) -> bool:
    """Check whether a process with the given PID exists."""
    if sys.platform == "win32":
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
            if handle:
                kernel32.CloseHandle(handle)
                return True
            return False
        except Exception:
            return False
    else:
        try:
            os.kill(pid, 0)  # Signal 0 = existence check only
            return True
        except (OSError, ProcessLookupError):
            return False


def _kill_process(pid: int) -> bool:
    """Terminate a process. Returns True if it stopped."""
    import time

    try:
        if sys.platform == "win32":
            os.kill(pid, signal.SIGTERM)
        else:
            os.kill(pid, signal.SIGTERM)
    except (OSError, ProcessLookupError):
        return True  # Already dead

    # Wait up to 3 seconds for graceful exit
    for _ in range(30):
        time.sleep(0.1)
        if not _is_process_running(pid):
            return True

    # Force kill
    try:
        if sys.platform == "win32":
            import subprocess
            subprocess.run(
                ["taskkill", "/PID", str(pid), "/F"],
                capture_output=True, timeout=5,
            )
        else:
            os.kill(pid, signal.SIGKILL)
    except Exception:
        pass

    time.sleep(0.5)
    return not _is_process_running(pid)


# ========================================================================
# Stale instance cleanup (called on startup)
# ========================================================================

def cleanup_stale_instance() -> None:
    """Detect and clean up any stale previous instance.

    Called before the server starts. Checks the PID file:
    - No PID file → nothing to do
    - PID file references a dead process → remove stale files
    - PID file references a live process → terminate it, clean up
    """
    stale_pid = _read_pid_file()
    if stale_pid is None:
        return

    if stale_pid == os.getpid():
        return

    if not _is_process_running(stale_pid):
        logger.info("Removing stale PID file (pid=%d no longer running)", stale_pid)
        get_pid_file_path().unlink(missing_ok=True)
        get_port_file_path().unlink(missing_ok=True)
        return

    stale_port = _read_port_file()
    port_msg = f" on port {stale_port}" if stale_port else ""
    logger.warning(
        "Found existing instance (pid=%d%s) — terminating...", stale_pid, port_msg
    )

    if _kill_process(stale_pid):
        logger.info("Previous instance (pid=%d) terminated", stale_pid)
    else:
        logger.error("Could not terminate previous instance (pid=%d)", stale_pid)

    get_pid_file_path().unlink(missing_ok=True)
    get_port_file_path().unlink(missing_ok=True)


# ========================================================================
# Signal handlers — cleanup-then-exit
# ========================================================================

def _run_cleanup() -> None:
    """Execute ShutdownManager callbacks + remove PID file.

    Safe to call multiple times (idempotent via _cleanup_done flag).
    Wrapped in try/except to never crash the signal handler.
    """
    global _cleanup_done
    if _cleanup_done:
        return
    _cleanup_done = True

    try:
        if _shutdown_manager is not None:
            _shutdown_manager.initiate()
    except Exception:
        pass  # DB close failed — don't crash the shutdown sequence

    try:
        remove_pid_file()
    except Exception:
        pass

    try:
        logger.info("Shutdown cleanup complete")
    except Exception:
        pass


def install_signal_handlers(shutdown_manager: ShutdownManager) -> None:
    """Install signal/console handlers that do cleanup before force-exiting.

    Replaces the raw os._exit(0) approach: runs all registered cleanup
    callbacks (DB close, etc.), removes PID/port files, then os._exit(0)
    to bypass uvicorn's event loop hang.
    """
    global _shutdown_manager
    _shutdown_manager = shutdown_manager

    def _graceful_exit(*_args):
        # Run cleanup in a daemon thread with a timeout to prevent hanging
        t = threading.Thread(target=_run_cleanup, daemon=True)
        t.start()
        t.join(timeout=3)
        os._exit(0)

    signal.signal(signal.SIGINT, _graceful_exit)
    signal.signal(signal.SIGTERM, _graceful_exit)

    # Normal exit paths (e.g. uvicorn stops itself)
    atexit.register(_run_cleanup)

    # Windows: handle console close / logoff / shutdown events
    if sys.platform == "win32":
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            _handler_type = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_ulong)

            @_handler_type
            def _console_handler(event):
                # CTRL_C=0, CTRL_BREAK=1, CTRL_CLOSE=2, LOGOFF=5, SHUTDOWN=6
                t = threading.Thread(target=_run_cleanup, daemon=True)
                t.start()
                t.join(timeout=3)
                os._exit(0)
                return True  # noqa: unreachable

            kernel32.SetConsoleCtrlHandler(_console_handler, True)
        except Exception:
            pass  # Non-critical — SIGINT handler is the fallback
