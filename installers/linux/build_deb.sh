#!/bin/bash
# Build Linux .deb package for Mesh Community Planner
#
# Prerequisites:
#   - PyInstaller output in dist/MeshCommunityPlanner/
#   - dpkg-deb (standard on Debian/Ubuntu)
#
# Output: dist/mesh-community-planner_1.1.0_amd64.deb

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLERS_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$INSTALLERS_DIR")"

APP_VERSION="1.1.0"
PKG_NAME="mesh-community-planner"
PYINSTALLER_DIST="${PROJECT_ROOT}/dist/MeshCommunityPlanner"
DEB_ROOT="${PROJECT_ROOT}/dist/deb_build"

echo "[INFO] Building .deb package..."
echo "[INFO] Project root: ${PROJECT_ROOT}"

# Verify PyInstaller output exists
if [ ! -d "${PYINSTALLER_DIST}" ]; then
    echo "[ERROR] PyInstaller output not found at ${PYINSTALLER_DIST}"
    echo "[ERROR] Run: python3 -m PyInstaller installers/mesh_planner.spec --noconfirm"
    exit 1
fi

# Clean previous build
rm -rf "${DEB_ROOT}"

# Create directory structure per Debian policy
mkdir -p "${DEB_ROOT}/DEBIAN"
mkdir -p "${DEB_ROOT}/opt/${PKG_NAME}"
mkdir -p "${DEB_ROOT}/usr/bin"
mkdir -p "${DEB_ROOT}/usr/share/applications"
mkdir -p "${DEB_ROOT}/usr/share/icons/hicolor/256x256/apps"

# Copy control file
cp "${SCRIPT_DIR}/debian/control" "${DEB_ROOT}/DEBIAN/control"

# Copy PyInstaller output
cp -R "${PYINSTALLER_DIST}/"* "${DEB_ROOT}/opt/${PKG_NAME}/"

# Create launcher in /usr/bin with health-check polling and signal trap
cat > "${DEB_ROOT}/usr/bin/${PKG_NAME}" << 'LAUNCHER_EOF'
#!/bin/bash
# Launcher for Mesh Community Planner (.deb install)
LOG_DIR="${HOME}/.local/share/MeshCommunityPlanner"
LOG_FILE="${LOG_DIR}/launcher.log"
mkdir -p "${LOG_DIR}"

echo "$(date): Starting Mesh Community Planner..." >> "${LOG_FILE}"

# Start the backend server
/opt/mesh-community-planner/MeshCommunityPlanner >> "${LOG_FILE}" 2>&1 &
SERVER_PID=$!

echo "$(date): Server PID: ${SERVER_PID}" >> "${LOG_FILE}"

# Kill the server when the launcher exits
cleanup() {
    echo "$(date): Shutting down server (PID ${SERVER_PID})..." >> "${LOG_FILE}"
    kill ${SERVER_PID} 2>/dev/null
    wait ${SERVER_PID} 2>/dev/null
    echo "$(date): Server stopped" >> "${LOG_FILE}"
}
trap cleanup EXIT TERM INT HUP

# Wait for server to be ready (up to 30 seconds)
STARTED=0
for i in $(seq 1 30); do
    if ! kill -0 ${SERVER_PID} 2>/dev/null; then
        echo "$(date): Server process died (exit early)" >> "${LOG_FILE}"
        break
    fi
    if curl -s -o /dev/null "http://127.0.0.1:8321/api/health" 2>/dev/null; then
        echo "$(date): Server ready after ${i}s — opening browser" >> "${LOG_FILE}"
        xdg-open "http://127.0.0.1:8321" 2>/dev/null || true
        STARTED=1
        break
    fi
    sleep 1
done

if [ ${STARTED} -eq 0 ]; then
    echo "$(date): Server failed to start within 30s — check ${LOG_FILE}" >> "${LOG_FILE}"
fi

# Wait for server process
wait ${SERVER_PID}
echo "$(date): Server exited" >> "${LOG_FILE}"
LAUNCHER_EOF
chmod +x "${DEB_ROOT}/usr/bin/${PKG_NAME}"

# Copy desktop file
cp "${SCRIPT_DIR}/mesh-community-planner.desktop" "${DEB_ROOT}/usr/share/applications/"

# Copy icon from branding
ICON_SRC="${PROJECT_ROOT}/branding/teal/png/icon-256x256.png"
if [ -f "${ICON_SRC}" ]; then
    cp "${ICON_SRC}" "${DEB_ROOT}/usr/share/icons/hicolor/256x256/apps/${PKG_NAME}.png"
    echo "[INFO] Icon copied from branding"
else
    echo "[WARN] No icon found at ${ICON_SRC}"
fi

# Build .deb
DEB_OUTPUT="${PROJECT_ROOT}/dist/${PKG_NAME}_${APP_VERSION}_amd64.deb"
dpkg-deb --build "${DEB_ROOT}" "${DEB_OUTPUT}"

echo "[OK] .deb package created at ${DEB_OUTPUT}"
