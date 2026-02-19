# Mesh Community Planner -- Build & Installation Guide

**Version:** 1.0.0
**Date:** 2026-02-18

---

## Overview

Mesh Community Planner is a desktop application that runs a local web server (FastAPI on port 8321) and opens in your browser. It is built with PyInstaller into a self-contained executable -- no Python or Node.js installation is needed to **run** the built app.

To **build from source**, you need Python, Node.js, and PyInstaller.

---

## System Requirements

### To Run the Built Application

- **Windows 10/11** (64-bit), **macOS 11+** (Big Sur), or **Linux** (Ubuntu 20.04+, Fedora 35+)
- 4 GB RAM, 500 MB disk space
- Internet connection (for map tiles and elevation data)
- Browser: Chrome 100+, Edge 100+, Firefox 98+, or Safari 15+

### To Build from Source

- **Python 3.9+** with pip
- **Node.js 18+** with npm
- **PyInstaller 6.x** (`pip install pyinstaller`)
- Platform-specific tools (see per-platform sections below)

---

## Quick Reference -- Build Commands

All platforms follow the same three steps:

```bash
# 1. Clone and install dependencies
git clone https://github.com/PapaSierra555/MeshCommunityPlanner.git
cd MeshCommunityPlanner
pip install -r requirements.txt
pip install pyinstaller
cd frontend && npm install && cd ..

# 2. Build frontend + PyInstaller bundle
cd frontend && npx vite build && cd ..
python -m PyInstaller installers/mesh_planner.spec --noconfirm

# 3. Run it
# Windows:  dist\MeshCommunityPlanner\MeshCommunityPlanner.exe
# macOS:    dist/MeshCommunityPlanner/MeshCommunityPlanner
# Linux:    dist/MeshCommunityPlanner/MeshCommunityPlanner
```

Then open http://127.0.0.1:8321 in your browser.

---

## Windows

### Build

```powershell
# Prerequisites: Python 3.9+, Node.js 18+ (both on PATH)

git clone https://github.com/PapaSierra555/MeshCommunityPlanner.git
cd MeshCommunityPlanner

pip install -r requirements.txt
pip install pyinstaller

cd frontend
npm install
npx vite build
cd ..

python -m PyInstaller installers/mesh_planner.spec --noconfirm
```

### Run

```powershell
dist\MeshCommunityPlanner\MeshCommunityPlanner.exe
```

The app starts a local server and prints the URL. Open http://127.0.0.1:8321 in your browser. Close the console window to stop the server.

### Verify

```powershell
curl http://127.0.0.1:8321/api/health
# Should return: {"status":"ok", ...}
```

---

## macOS

### Prerequisites

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Python and Node
brew install python@3.13 node

# Install PyInstaller
pip3 install pyinstaller
```

### Build

```bash
git clone https://github.com/PapaSierra555/MeshCommunityPlanner.git
cd MeshCommunityPlanner

pip3 install -r requirements.txt

cd frontend
npm install
npx vite build
cd ..

python3 -m PyInstaller installers/mesh_planner.spec --noconfirm
```

### Run (command line)

```bash
./dist/MeshCommunityPlanner/MeshCommunityPlanner &
open http://127.0.0.1:8321
```

### Build .app Bundle + DMG (optional)

This wraps the PyInstaller output in a macOS `.app` bundle with a launcher that auto-opens the browser:

```bash
chmod +x installers/macos/build_dmg.sh
./installers/macos/build_dmg.sh
```

Output: `dist/MeshCommunityPlanner-1.0.0.dmg`

To install: mount the DMG, drag "Mesh Community Planner" to Applications.

### Gatekeeper (unsigned app warning)

Since the app is not notarized with Apple, macOS will block it on first launch:

1. Right-click the app in Applications
2. Select **Open**
3. Click **Open** in the confirmation dialog
4. The app is now whitelisted

Or via Terminal:
```bash
xattr -cr "/Applications/Mesh Community Planner.app"
```

### Optional: Ad-hoc code signing

```bash
codesign --force --deep --sign - "dist/Mesh Community Planner.app"
```

### macOS Troubleshooting

| Issue | Fix |
|-------|-----|
| `pip3: command not found` | `brew install python@3.13` then restart terminal |
| `node: command not found` | `brew install node` |
| PyInstaller: `No module named _tkinter` | Ignore -- tkinter is not used |
| Gatekeeper blocks app | Right-click > Open, or `xattr -cr` (see above) |
| Port 8321 in use | `lsof -i :8321` then `kill <PID>` |

---

## Linux

### Prerequisites (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv nodejs npm
pip3 install pyinstaller
```

### Prerequisites (Fedora/RHEL)

```bash
sudo dnf install python3 python3-pip nodejs npm
pip3 install pyinstaller
```

### Build

```bash
git clone https://github.com/PapaSierra555/MeshCommunityPlanner.git
cd MeshCommunityPlanner

pip3 install -r requirements.txt

cd frontend
npm install
npx vite build
cd ..

python3 -m PyInstaller installers/mesh_planner.spec --noconfirm
```

### Run

```bash
./dist/MeshCommunityPlanner/MeshCommunityPlanner &
xdg-open http://127.0.0.1:8321
```

### Build AppImage (optional)

Creates a portable single-file executable:

```bash
# Install appimagetool first:
# https://github.com/AppImage/AppImageKit/releases

chmod +x installers/linux/build_appimage.sh
./installers/linux/build_appimage.sh
```

Output: `dist/MeshCommunityPlanner-1.0.0-x86_64.AppImage`

Run it:
```bash
chmod +x dist/MeshCommunityPlanner-1.0.0-x86_64.AppImage
./dist/MeshCommunityPlanner-1.0.0-x86_64.AppImage
```

### Linux Troubleshooting

| Issue | Fix |
|-------|-----|
| Missing `libGL.so` | `sudo apt install libgl1` (Ubuntu) or `sudo dnf install mesa-libGL` (Fedora) |
| Missing `libglib-2.0` | `sudo apt install libglib2.0-0` |
| Permission denied on AppImage | `chmod +x *.AppImage` |
| Port 8321 in use | `lsof -i :8321` then `kill <PID>` |

---

## Clean Rebuild (all platforms)

If you suspect stale build artifacts, do a full clean rebuild:

```bash
# Remove all build artifacts
rm -rf frontend/dist build dist

# Rebuild frontend
cd frontend && npx vite build && cd ..

# Rebuild PyInstaller bundle
python3 -m PyInstaller installers/mesh_planner.spec --noconfirm
```

**Important:** After any frontend code change, you MUST rebuild both Vite and PyInstaller. PyInstaller bundles `frontend/dist/` at build time -- if you only rebuild Vite, the `.exe` still serves the old assets.

---

## Verification

After building on any platform:

```bash
# 1. Start the app
./dist/MeshCommunityPlanner/MeshCommunityPlanner   # (or .exe on Windows)

# 2. Test the health endpoint
curl http://127.0.0.1:8321/api/health

# 3. Open in browser
# Navigate to http://127.0.0.1:8321
# You should see the map interface with a welcome tour
```

---

## How the Application Works

- The executable starts a **FastAPI** server on `http://127.0.0.1:8321`
- The server serves the frontend (React/TypeScript) as static files
- Data is stored in a local **SQLite** database (auto-created on first run)
- Map tiles are fetched from OpenStreetMap (requires internet)
- No accounts, no cloud services, no external dependencies at runtime

---

## Project Structure (for builders)

```
MeshCommunityPlanner/
  backend/app/          # Python backend (FastAPI)
  frontend/src/         # TypeScript frontend (React + Leaflet)
  frontend/dist/        # Vite build output (generated)
  installers/
    mesh_planner.spec   # PyInstaller spec (cross-platform)
    macos/              # macOS .app bundle + DMG builder
    linux/              # AppImage + .deb builders
    windows/            # NSIS installer script
  requirements.txt      # Python dependencies
  dist/                 # PyInstaller output (generated)
```

---

*Last Updated: 2026-02-18*
