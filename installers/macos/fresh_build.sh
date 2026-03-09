#!/bin/bash
# =============================================================================
# Mesh Community Planner — macOS Fresh Build & Install
# =============================================================================
#
# Performs a complete clean build cycle:
#   1. Uninstalls any existing installation
#   2. Removes and re-clones the repo
#   3. Sets up Python venv and installs dependencies
#   4. Builds frontend, PyInstaller bundle, and DMG
#   5. Installs the app and launches it
#
# Usage:
#   cd ~ && curl -fsSL <raw-github-url> | bash
#   — or —
#   chmod +x fresh_build.sh
#   ./fresh_build.sh
#
# Prerequisites:
#   - Homebrew installed (https://brew.sh)
#   - brew install python@3.12 node git dos2unix create-dmg gh
#   - SSH key registered on GitHub for this machine
#
# If you forked this repo, update REPO_SSH below to your fork's SSH URL.
# =============================================================================

set -euo pipefail

# Always start from home to avoid "current directory deleted" errors
cd "$HOME"

REPO_SSH="git@github.com:PapaSierra555/MeshCommunityPlanner.git"
REPO_DIR="$HOME/MeshCommunityPlanner"
APP_VERSION="1.2.0"

echo "=== Mesh Community Planner — macOS Fresh Build & Install ==="
echo ""

# ---- Step 1: Uninstall ----
echo "[1/9] Cleaning previous installation..."
rm -rf /Applications/MeshCommunityPlanner.app
rm -rf "/Applications/Mesh Community Planner.app"
hdiutil detach "/Volumes/Mesh Community Planner" 2>/dev/null || true
rm -rf ~/Library/Logs/MeshCommunityPlanner.log
rm -rf ~/.local/share/MeshCommunityPlanner

# ---- Step 2: Remove old clone and re-clone ----
echo "[2/9] Cloning fresh repo..."
rm -rf "$REPO_DIR"
git clone "$REPO_SSH" "$REPO_DIR"
cd "$REPO_DIR"

# ---- Step 3: Python venv ----
echo "[3/9] Setting up Python virtual environment..."
python3.12 -m venv venv
source venv/bin/activate
pip install --quiet -r requirements.txt pyinstaller

# ---- Step 4: Build frontend ----
echo "[4/9] Building frontend..."
cd frontend
npm install --silent
npx vite build
cd ..

# ---- Step 5: Fix line endings on build script ----
echo "[5/9] Fixing line endings..."
dos2unix installers/macos/build_dmg.sh 2>/dev/null
chmod +x installers/macos/build_dmg.sh

# ---- Step 6: PyInstaller bundle ----
echo "[6/9] Building PyInstaller bundle..."
python3 -m PyInstaller installers/mesh_planner.spec --noconfirm

# ---- Step 7: Build DMG ----
echo "[7/9] Building DMG..."
./installers/macos/build_dmg.sh

# ---- Step 8: Install ----
echo "[8/9] Installing app..."
hdiutil attach "installers/dist/MeshCommunityPlanner-${APP_VERSION}.dmg"
cp -R "/Volumes/Mesh Community Planner/MeshCommunityPlanner.app" /Applications/
xattr -cr /Applications/MeshCommunityPlanner.app
codesign --force --deep --sign - /Applications/MeshCommunityPlanner.app
hdiutil detach "/Volumes/Mesh Community Planner"

# ---- Step 9: Launch ----
echo "[9/9] Launching..."
open /Applications/MeshCommunityPlanner.app

echo ""
echo "=== Build complete — app launched ==="
