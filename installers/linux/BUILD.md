# Linux Build Instructions

## Requirements

- **Python 3.9+** (3.9, 3.10, 3.11, 3.12 all work)
- **Node.js 18+** (for frontend build)
- **pip packages**: see `requirements.txt`
- **PyInstaller**: `pip install pyinstaller`

### For AppImage
- **appimagetool**: download from [AppImageKit releases](https://github.com/AppImage/AppImageKit/releases)
  ```bash
  wget https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage
  chmod +x appimagetool-x86_64.AppImage
  sudo mv appimagetool-x86_64.AppImage /usr/local/bin/appimagetool
  ```

### For .deb package
- **dpkg-deb**: standard on Debian/Ubuntu (part of `dpkg`)

## Build Steps

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
pip install pyinstaller
```

### 2. Build the frontend

```bash
cd frontend
npm install
npx vite build
cd ..
```

### 3. Build with PyInstaller

```bash
python3 -m PyInstaller installers/mesh_planner.spec --noconfirm
```

This creates `dist/MeshCommunityPlanner/` with the standalone executable.

### 4a. Build AppImage (recommended for distribution)

```bash
bash installers/linux/build_appimage.sh
```

Output: `dist/MeshCommunityPlanner-1.0.0-x86_64.AppImage`

### 4b. Build .deb package (Debian/Ubuntu)

```bash
bash installers/linux/build_deb.sh
```

Output: `dist/mesh-community-planner_1.0.0_amd64.deb`

Install with: `sudo dpkg -i dist/mesh-community-planner_1.0.0_amd64.deb`

## Verification

After building, run the build verification test:

```bash
# Start the executable and run tests
python3 installers/test_build.py --start-exe

# Or test against a running server
python3 installers/test_build.py
```

## How It Works

The launcher script:
1. Starts the backend server in the background
2. Polls `http://127.0.0.1:8321/api/health` until the server is ready (up to 30s)
3. Opens the default browser to the app URL
4. Traps EXIT/TERM/INT/HUP signals to cleanly shut down the server
5. The frontend sends a shutdown request when the browser tab closes

Logs are written to `~/.local/share/MeshCommunityPlanner/launcher.log`.
