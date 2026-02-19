"""Cross-platform build orchestration script for Mesh Community Planner.

Usage:
    python installers/build.py [--skip-frontend] [--skip-pyinstaller] [--platform PLATFORM]

Steps:
1. Build frontend (npm run build)
2. Run PyInstaller to create bundled executable
3. Run platform-specific installer builder (NSIS/DMG/AppImage/deb/rpm)
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INSTALLERS_DIR = Path(__file__).resolve().parent


def detect_platform() -> str:
    """Detect the current platform."""
    if sys.platform == "win32":
        return "windows"
    elif sys.platform == "darwin":
        return "macos"
    else:
        return "linux"


def build_frontend() -> bool:
    """Build the frontend using npm."""
    frontend_dir = PROJECT_ROOT / "frontend"
    if not (frontend_dir / "package.json").exists():
        print("[WARN] frontend/package.json not found, skipping frontend build")
        return True

    print("[INFO] Building frontend...")
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=str(frontend_dir),
        shell=sys.platform == "win32",  # npm needs shell on Windows
    )
    if result.returncode != 0:
        print("[ERROR] Frontend build failed")
        return False

    dist_dir = frontend_dir / "dist"
    if not dist_dir.is_dir():
        print("[ERROR] Frontend build did not produce dist/ directory")
        return False

    print("[OK] Frontend built successfully")
    return True


def run_pyinstaller() -> bool:
    """Run PyInstaller using the spec file."""
    spec_file = INSTALLERS_DIR / "mesh_planner.spec"
    if not spec_file.exists():
        print(f"[ERROR] PyInstaller spec not found: {spec_file}")
        return False

    print("[INFO] Running PyInstaller...")
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            str(spec_file),
            "--distpath",
            str(INSTALLERS_DIR / "dist"),
            "--workpath",
            str(INSTALLERS_DIR / "build"),
            "--noconfirm",
        ],
        cwd=str(PROJECT_ROOT),
    )
    if result.returncode != 0:
        print("[ERROR] PyInstaller build failed")
        return False

    print("[OK] PyInstaller build successful")
    return True


def build_windows_installer() -> bool:
    """Build Windows NSIS installer."""
    nsi_file = INSTALLERS_DIR / "windows" / "mesh_planner.nsi"
    if not nsi_file.exists():
        print("[ERROR] NSIS script not found")
        return False

    print("[INFO] Building Windows NSIS installer...")
    result = subprocess.run(
        ["makensis", str(nsi_file)],
        cwd=str(INSTALLERS_DIR / "windows"),
    )
    return result.returncode == 0


def build_macos_dmg() -> bool:
    """Build macOS DMG."""
    script = INSTALLERS_DIR / "macos" / "build_dmg.sh"
    if not script.exists():
        print("[ERROR] macOS build script not found")
        return False

    print("[INFO] Building macOS DMG...")
    result = subprocess.run(["bash", str(script)], cwd=str(INSTALLERS_DIR / "macos"))
    return result.returncode == 0


def build_linux_appimage() -> bool:
    """Build Linux AppImage."""
    script = INSTALLERS_DIR / "linux" / "build_appimage.sh"
    if not script.exists():
        print("[ERROR] Linux AppImage build script not found")
        return False

    print("[INFO] Building Linux AppImage...")
    result = subprocess.run(["bash", str(script)], cwd=str(INSTALLERS_DIR / "linux"))
    return result.returncode == 0


def build_linux_deb() -> bool:
    """Build Linux .deb package."""
    script = INSTALLERS_DIR / "linux" / "build_deb.sh"
    if not script.exists():
        print("[ERROR] Debian build script not found")
        return False

    print("[INFO] Building Linux .deb package...")
    result = subprocess.run(["bash", str(script)], cwd=str(INSTALLERS_DIR / "linux"))
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="Build Mesh Community Planner installers")
    parser.add_argument("--skip-frontend", action="store_true", help="Skip frontend build")
    parser.add_argument("--skip-pyinstaller", action="store_true", help="Skip PyInstaller step")
    parser.add_argument(
        "--platform",
        choices=["windows", "macos", "linux", "auto"],
        default="auto",
        help="Target platform (default: auto-detect)",
    )
    args = parser.parse_args()

    platform = args.platform if args.platform != "auto" else detect_platform()
    print(f"[INFO] Building for platform: {platform}")
    print(f"[INFO] Project root: {PROJECT_ROOT}")

    # Step 1: Build frontend
    if not args.skip_frontend:
        if not build_frontend():
            sys.exit(1)

    # Step 2: Run PyInstaller
    if not args.skip_pyinstaller:
        if not run_pyinstaller():
            sys.exit(1)

    # Step 3: Platform-specific installer
    if platform == "windows":
        success = build_windows_installer()
    elif platform == "macos":
        success = build_macos_dmg()
    elif platform == "linux":
        success = build_linux_appimage() and build_linux_deb()
    else:
        print(f"[ERROR] Unknown platform: {platform}")
        sys.exit(1)

    if success:
        print(f"[OK] {platform} installer built successfully")
    else:
        print(f"[ERROR] {platform} installer build failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
