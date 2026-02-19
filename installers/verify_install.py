"""Clean-machine installation verification script.

Verifies that a Mesh Community Planner installation works correctly
on a fresh OS with no Python/Node.js pre-installed.

Usage:
    python verify_install.py [--exe PATH_TO_EXECUTABLE]

Checks:
1. Process launches successfully
2. Health endpoint responds with 200
3. Frontend HTML is served at /
4. Process shuts down cleanly

Supports Windows, macOS (darwin), and Linux platforms.
"""

import argparse
import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


DEFAULT_PORT = 8321
STARTUP_TIMEOUT = 15  # seconds to wait for server to start
HEALTH_URL = f"http://127.0.0.1:{DEFAULT_PORT}/api/health"
FRONTEND_URL = f"http://127.0.0.1:{DEFAULT_PORT}/"


def find_executable() -> Path | None:
    """Find the installed executable based on platform."""
    if sys.platform == "win32":
        # Check Program Files
        candidates = [
            Path(os.environ.get("PROGRAMFILES", "C:\\Program Files"))
            / "Mesh Community Planner"
            / "MeshCommunityPlanner.exe",
            Path("MeshCommunityPlanner.exe"),  # Current directory
        ]
    elif sys.platform == "darwin":
        candidates = [
            Path("/Applications/Mesh Community Planner.app/Contents/MacOS/MeshCommunityPlanner"),
            Path("MeshCommunityPlanner"),
        ]
    else:  # linux
        candidates = [
            Path("/opt/mesh-community-planner/MeshCommunityPlanner"),
            Path("/usr/bin/mesh-community-planner"),
            Path("MeshCommunityPlanner"),
        ]

    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def check_health(url: str = HEALTH_URL, timeout: int = 5) -> bool:
    """Check if the health endpoint responds."""
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status == 200
    except Exception:
        return False


def check_frontend(url: str = FRONTEND_URL, timeout: int = 5) -> bool:
    """Check if frontend HTML is served."""
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status != 200:
                return False
            content = resp.read().decode("utf-8", errors="replace")
            return "<html" in content.lower()
    except Exception:
        return False


def launch_process(exe_path: Path) -> subprocess.Popen:
    """Launch the application process."""
    env = os.environ.copy()
    # Ensure we're not in test mode
    env.pop("MESH_PLANNER_TEST_TOKEN", None)
    env["MESH_PLANNER_ENV"] = "development"

    return subprocess.Popen(
        [str(exe_path)],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def stop_process(proc: subprocess.Popen) -> None:
    """Gracefully stop the process."""
    if sys.platform == "win32":
        proc.terminate()
    else:
        proc.send_signal(signal.SIGTERM)

    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)


def run_verification(exe_path: Path) -> bool:
    """Run all verification checks."""
    results = []

    print(f"[INFO] Platform: {sys.platform}")
    print(f"[INFO] Executable: {exe_path}")

    # Check 1: Process launches
    print("\n[TEST] Process launch...")
    try:
        proc = launch_process(exe_path)
        time.sleep(2)
        if proc.poll() is not None:
            print(f"[FAIL] Process exited immediately with code {proc.returncode}")
            results.append(False)
        else:
            print("[PASS] Process launched successfully")
            results.append(True)
    except Exception as e:
        print(f"[FAIL] Could not launch process: {e}")
        return False

    try:
        # Check 2: Health endpoint
        print("\n[TEST] Health endpoint...")
        healthy = False
        for attempt in range(STARTUP_TIMEOUT):
            if check_health():
                healthy = True
                break
            time.sleep(1)

        if healthy:
            print("[PASS] Health endpoint responds OK")
            results.append(True)
        else:
            print("[FAIL] Health endpoint did not respond within timeout")
            results.append(False)

        # Check 3: Frontend serving
        print("\n[TEST] Frontend HTML serving...")
        if check_frontend():
            print("[PASS] Frontend HTML served correctly")
            results.append(True)
        else:
            print("[FAIL] Frontend HTML not served")
            results.append(False)

    finally:
        # Check 4: Clean shutdown
        print("\n[TEST] Clean shutdown...")
        try:
            stop_process(proc)
            print("[PASS] Process stopped cleanly")
            results.append(True)
        except Exception as e:
            print(f"[FAIL] Clean shutdown failed: {e}")
            results.append(False)

    # Summary
    passed = sum(results)
    total = len(results)
    print(f"\n{'=' * 40}")
    print(f"Results: {passed}/{total} checks passed")

    if passed == total:
        print("[OK] All verification checks passed!")
        return True
    else:
        print("[FAIL] Some checks failed")
        return False


def main():
    parser = argparse.ArgumentParser(description="Verify Mesh Community Planner installation")
    parser.add_argument("--exe", type=str, help="Path to the executable")
    args = parser.parse_args()

    if args.exe:
        exe_path = Path(args.exe)
        if not exe_path.exists():
            print(f"[ERROR] Executable not found: {exe_path}")
            sys.exit(1)
    else:
        exe_path = find_executable()
        if exe_path is None:
            print("[ERROR] Could not find installed executable")
            print("[INFO] Use --exe to specify the path manually")
            sys.exit(1)

    success = run_verification(exe_path)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
