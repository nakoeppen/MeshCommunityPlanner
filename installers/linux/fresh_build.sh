#!/bin/bash
# =============================================================================
# Mesh Community Planner — Linux Fresh Build & Install
# =============================================================================
#
# Performs a complete clean build cycle:
#   1. Uninstalls any existing installation (.deb, icons, data)
#   2. Removes and re-clones the repo
#   3. Sets up Python venv and installs dependencies
#   4. Builds frontend, PyInstaller bundle, .deb, and AppImage
#   5. Installs the .deb package
#
# Usage:
#   chmod +x fresh_build.sh
#   ./fresh_build.sh
#
# Prerequisites:
#   - sudo apt install git curl python3 python3-pip python3-venv dpkg libfuse2
#   - Node.js 18+ installed (via nodesource)
#   - appimagetool in PATH
#   - gh CLI installed and authenticated
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

echo "=== Mesh Community Planner — Linux Fresh Build & Install ==="
echo ""

# ---- Step 1: Uninstall ----
echo "[1/8] Cleaning previous installation..."
if dpkg -l 2>/dev/null | grep -q mesh-community-planner; then
    sudo dpkg --remove mesh-community-planner 2>/dev/null || true
fi
sudo rm -rf /opt/mesh-community-planner
sudo rm -f /usr/bin/mesh-community-planner
sudo rm -f /usr/share/applications/mesh-community-planner.desktop
sudo rm -f /usr/share/icons/hicolor/256x256/apps/mesh-community-planner.png
sudo gtk-update-icon-cache /usr/share/icons/hicolor/ 2>/dev/null || true
rm -rf ~/.local/share/MeshCommunityPlanner

# ---- Step 2: Remove old clone and re-clone ----
echo "[2/8] Cloning fresh repo..."
rm -rf "$REPO_DIR"
git clone "$REPO_SSH" "$REPO_DIR"
cd "$REPO_DIR"

# ---- Step 3: Python venv ----
echo "[3/8] Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate
pip install --quiet -r requirements.txt pyinstaller

# ---- Step 4: Build frontend ----
echo "[4/8] Building frontend..."
cd frontend
npm install --silent
npx vite build
cd ..

# ---- Step 5: PyInstaller bundle ----
echo "[5/8] Building PyInstaller bundle..."
python3 -m PyInstaller installers/mesh_planner.spec --noconfirm

# ---- Step 6: Build .deb package ----
echo "[6/8] Building .deb package..."
bash installers/linux/build_deb.sh

# ---- Step 7: Build AppImage ----
echo "[7/8] Building AppImage..."
bash installers/linux/build_appimage.sh

# ---- Step 8: Install .deb ----
echo "[8/8] Installing .deb package..."
sudo dpkg -i "dist/mesh-community-planner_${APP_VERSION}_amd64.deb"

echo ""
echo "=== Build complete ==="
echo ""
echo "Run the app with:  mesh-community-planner"
echo "Or find it in your application menu."
