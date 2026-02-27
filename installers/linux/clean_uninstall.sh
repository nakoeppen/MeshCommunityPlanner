#!/bin/bash
# =============================================================================
# Mesh Community Planner — Linux Clean Uninstall
# =============================================================================
#
# Removes ALL traces of Mesh Community Planner from this Linux system:
#   - Installed .deb package (if installed via dpkg)
#   - Desktop entry and icon from system directories
#   - Application logs and local data
#   - Cloned source repo (if in ~/MeshCommunityPlanner)
#
# Usage:
#   chmod +x clean_uninstall.sh
#   ./clean_uninstall.sh
#
# Safe to run multiple times. Will not error if files are already gone.
#
# If you forked this repo and are building locally, run this before
# each fresh build/test cycle to ensure no stale artifacts remain.
# =============================================================================

set -euo pipefail

echo "=== Mesh Community Planner — Linux Clean Uninstall ==="
echo ""

# 1. Remove .deb package if installed
echo "[1/7] Removing .deb package (if installed)..."
if dpkg -l | grep -q mesh-community-planner 2>/dev/null; then
    sudo dpkg --remove mesh-community-planner 2>/dev/null || true
    echo "  Removed .deb package"
else
    echo "  No .deb package installed — skipping"
fi

# 2. Remove application directory (left behind by .deb or manual install)
echo "[2/7] Removing /opt/mesh-community-planner/..."
sudo rm -rf /opt/mesh-community-planner

# 3. Remove launcher symlink
echo "[3/7] Removing launcher from /usr/bin/..."
sudo rm -f /usr/bin/mesh-community-planner

# 4. Remove desktop entry and icon
echo "[4/7] Removing desktop entry and icon..."
sudo rm -f /usr/share/applications/mesh-community-planner.desktop
sudo rm -f /usr/share/icons/hicolor/256x256/apps/mesh-community-planner.png
sudo gtk-update-icon-cache /usr/share/icons/hicolor/ 2>/dev/null || true

# 5. Remove application logs and local data
echo "[5/7] Removing application logs and data..."
rm -rf ~/.local/share/MeshCommunityPlanner

# 6. Remove source repo clone (default location)
echo "[6/7] Removing source repo clone (~/MeshCommunityPlanner)..."
rm -rf ~/MeshCommunityPlanner

# 7. Verify cleanup
echo "[7/7] Verifying cleanup..."
echo ""
CLEAN=true

if [ -d /opt/mesh-community-planner ]; then
    echo "  [WARN] /opt/mesh-community-planner still exists"
    CLEAN=false
fi

if [ -f /usr/bin/mesh-community-planner ]; then
    echo "  [WARN] /usr/bin/mesh-community-planner still exists"
    CLEAN=false
fi

if [ -f /usr/share/applications/mesh-community-planner.desktop ]; then
    echo "  [WARN] Desktop entry still exists"
    CLEAN=false
fi

if [ -f /usr/share/icons/hicolor/256x256/apps/mesh-community-planner.png ]; then
    echo "  [WARN] Icon still exists"
    CLEAN=false
fi

if [ -d ~/.local/share/MeshCommunityPlanner ]; then
    echo "  [WARN] Data directory still exists: ~/.local/share/MeshCommunityPlanner"
    CLEAN=false
fi

if [ -d ~/MeshCommunityPlanner ]; then
    echo "  [WARN] Source repo still exists: ~/MeshCommunityPlanner"
    CLEAN=false
fi

if dpkg -l 2>/dev/null | grep -q mesh-community-planner; then
    echo "  [WARN] .deb package still shows in dpkg"
    CLEAN=false
fi

if $CLEAN; then
    echo "  [OK] All clear — no traces of Mesh Community Planner found."
fi

echo ""
echo "=== Uninstall complete ==="
