#!/bin/bash
# Build macOS DMG for Mesh Community Planner
#
# Prerequisites:
#   - PyInstaller .app bundle in dist/Mesh Community Planner.app/
#     (built by: python3 -m PyInstaller installers/mesh_planner.spec --noconfirm)
#
# Output: installers/dist/MeshCommunityPlanner-1.2.0.dmg

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLERS_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$INSTALLERS_DIR")"

APP_NAME="Mesh Community Planner"
APP_VERSION="1.2.0"
APP_BUNDLE="${APP_NAME}.app"
DMG_NAME="MeshCommunityPlanner-${APP_VERSION}.dmg"

# PyInstaller BUNDLE output (created by mesh_planner.spec on macOS)
PYINSTALLER_APP="${PROJECT_ROOT}/dist/${APP_BUNDLE}"

echo "[INFO] Building macOS DMG..."
echo "[INFO] Project root: ${PROJECT_ROOT}"

# Verify PyInstaller .app output exists
if [ ! -d "${PYINSTALLER_APP}" ]; then
    echo "[ERROR] PyInstaller .app bundle not found at ${PYINSTALLER_APP}"
    echo "[ERROR] Run: python3 -m PyInstaller installers/mesh_planner.spec --noconfirm"
    exit 1
fi

# Build .icns icon from PNGs using macOS iconutil
ICON_PNG_DIR="${PROJECT_ROOT}/branding/teal/png"
RESOURCES_DIR="${PYINSTALLER_APP}/Contents/Resources"
if [ -d "${ICON_PNG_DIR}" ] && [ -d "${RESOURCES_DIR}" ]; then
    echo "[INFO] Building AppIcon.icns from PNGs..."
    ICONSET="${RESOURCES_DIR}/AppIcon.iconset"
    mkdir -p "${ICONSET}"

    # macOS iconset requires specific filenames
    cp "${ICON_PNG_DIR}/icon-16x16.png"     "${ICONSET}/icon_16x16.png"
    cp "${ICON_PNG_DIR}/icon-32x32.png"     "${ICONSET}/icon_16x16@2x.png"
    cp "${ICON_PNG_DIR}/icon-32x32.png"     "${ICONSET}/icon_32x32.png"
    cp "${ICON_PNG_DIR}/icon-64x64.png"     "${ICONSET}/icon_32x32@2x.png"
    cp "${ICON_PNG_DIR}/icon-128x128.png"   "${ICONSET}/icon_128x128.png"
    cp "${ICON_PNG_DIR}/icon-256x256.png"   "${ICONSET}/icon_128x128@2x.png"
    cp "${ICON_PNG_DIR}/icon-256x256.png"   "${ICONSET}/icon_256x256.png"
    cp "${ICON_PNG_DIR}/icon-512x512.png"   "${ICONSET}/icon_256x256@2x.png"
    cp "${ICON_PNG_DIR}/icon-512x512.png"   "${ICONSET}/icon_512x512.png"
    cp "${ICON_PNG_DIR}/icon-1024x1024.png" "${ICONSET}/icon_512x512@2x.png"

    iconutil -c icns "${ICONSET}" -o "${RESOURCES_DIR}/AppIcon.icns"
    rm -rf "${ICONSET}"
    echo "[INFO] AppIcon.icns created"
else
    echo "[WARN] No PNG icons found at ${ICON_PNG_DIR} — app will have no icon"
fi

# Add launcher script that starts the server and opens the browser
# The original executable is the PyInstaller binary
MACOS_DIR="${PYINSTALLER_APP}/Contents/MacOS"
ORIGINAL_EXE="${MACOS_DIR}/MeshCommunityPlanner"

if [ -f "${ORIGINAL_EXE}" ]; then
    # Rename original binary
    mv "${ORIGINAL_EXE}" "${MACOS_DIR}/MeshCommunityPlanner-bin"

    # Create launcher that starts server + opens browser
    cat > "${ORIGINAL_EXE}" << 'LAUNCHER_EOF'
#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${HOME}/Library/Logs/MeshCommunityPlanner.log"

echo "$(date): Starting Mesh Community Planner..." >> "${LOG_FILE}"

# Tell the backend not to open a browser — this launcher handles it
export MESH_PLANNER_NO_BROWSER=1

# Start the actual server binary in background, capture output to log
"${DIR}/MeshCommunityPlanner-bin" >> "${LOG_FILE}" 2>&1 &
SERVER_PID=$!

echo "$(date): Server PID: ${SERVER_PID}" >> "${LOG_FILE}"

# Kill the server when the .app is quit (Cmd+Q, Dock > Quit, force quit)
cleanup() {
    echo "$(date): Shutting down server (PID ${SERVER_PID})..." >> "${LOG_FILE}"
    kill ${SERVER_PID} 2>/dev/null
    wait ${SERVER_PID} 2>/dev/null
    echo "$(date): Server stopped" >> "${LOG_FILE}"
}
trap cleanup EXIT TERM INT HUP

# Wait for server to actually be ready (up to 30 seconds)
STARTED=0
for i in $(seq 1 30); do
    # Check if server process is still alive
    if ! kill -0 ${SERVER_PID} 2>/dev/null; then
        echo "$(date): Server process died (exit early)" >> "${LOG_FILE}"
        break
    fi
    if curl -s -o /dev/null "http://127.0.0.1:8321/api/health" 2>/dev/null; then
        echo "$(date): Server ready after ${i}s — opening browser" >> "${LOG_FILE}"
        open "http://127.0.0.1:8321"
        STARTED=1
        break
    fi
    sleep 1
done

if [ ${STARTED} -eq 0 ]; then
    echo "$(date): Server failed to start within 30s" >> "${LOG_FILE}"
fi

# Wait for server process (keeps app "running" in Dock)
wait ${SERVER_PID}
echo "$(date): Server exited" >> "${LOG_FILE}"
LAUNCHER_EOF
    chmod +x "${ORIGINAL_EXE}"
    echo "[INFO] Launcher script installed (original binary renamed to MeshCommunityPlanner-bin)"
fi

echo "[INFO] .app bundle ready at ${PYINSTALLER_APP}"

# Build DMG
mkdir -p "${INSTALLERS_DIR}/dist"
DMG_PATH="${INSTALLERS_DIR}/dist/${DMG_NAME}"
rm -f "${DMG_PATH}"

if command -v create-dmg &> /dev/null; then
    echo "[INFO] Using create-dmg..."
    # create-dmg has a bug with spaces in paths;
    # copy source .app and icon to /tmp to avoid space issues
    TMP_SRC="/tmp/MeshPlannerDmgBuild"
    rm -rf "${TMP_SRC}"
    mkdir -p "${TMP_SRC}"
    cp -R "${PYINSTALLER_APP}" "${TMP_SRC}/MeshCommunityPlanner.app"

    VOLUME_ICON="${RESOURCES_DIR}/AppIcon.icns"
    if [ -f "${VOLUME_ICON}" ]; then
        cp "${VOLUME_ICON}" "${TMP_SRC}/volicon.icns"
        create-dmg \
            --volname "${APP_NAME}" \
            --window-size 600 400 \
            --icon-size 100 \
            --icon "MeshCommunityPlanner.app" 150 200 \
            --app-drop-link 450 200 \
            --volicon "${TMP_SRC}/volicon.icns" \
            "${DMG_PATH}" \
            "${TMP_SRC}/MeshCommunityPlanner.app"
    else
        create-dmg \
            --volname "${APP_NAME}" \
            --window-size 600 400 \
            --icon-size 100 \
            --icon "MeshCommunityPlanner.app" 150 200 \
            --app-drop-link 450 200 \
            "${DMG_PATH}" \
            "${TMP_SRC}/MeshCommunityPlanner.app"
    fi
    rm -rf "${TMP_SRC}"
else
    echo "[INFO] create-dmg not found, using hdiutil..."
    STAGING="${INSTALLERS_DIR}/dist/dmg_staging"
    rm -rf "${STAGING}"
    mkdir -p "${STAGING}"
    cp -R "${PYINSTALLER_APP}" "${STAGING}/"
    ln -s /Applications "${STAGING}/Applications"

    hdiutil create -volname "${APP_NAME}" \
        -srcfolder "${STAGING}" \
        -ov -format UDZO \
        "${DMG_PATH}"

    rm -rf "${STAGING}"
fi

echo "[OK] DMG created at ${DMG_PATH}"
