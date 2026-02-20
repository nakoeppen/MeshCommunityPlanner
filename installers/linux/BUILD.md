# Linux Build Guide (Clean Image)

Assumes a fresh Ubuntu/Debian x64 install with nothing installed.

## 1. Install system packages

```bash
sudo apt update
sudo apt install -y git curl wget python3 python3-pip python3-venv dpkg libfuse2
```

## 2. Install Node.js 18+

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

## 3. Install appimagetool

```bash
wget https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage
chmod +x appimagetool-x86_64.AppImage
sudo mv appimagetool-x86_64.AppImage /usr/local/bin/appimagetool
```

## 4. Install GitHub CLI

```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install -y gh
gh auth login
```

## 5. Clone the repo

```bash
git clone https://github.com/PapaSierra555/MeshCommunityPlanner.git
cd MeshCommunityPlanner
```

## 6. Python environment + dependencies

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install pyinstaller
```

## 7. Build frontend

```bash
cd frontend && npm install && npx vite build && cd ..
```

## 8. Build PyInstaller bundle

```bash
python3 -m PyInstaller installers/mesh_planner.spec --noconfirm
```

This creates `dist/MeshCommunityPlanner/` with the standalone executable.

## 9. Build release artifacts

```bash
# .deb package
bash installers/linux/build_deb.sh

# AppImage
bash installers/linux/build_appimage.sh
```

## 10. Verify output

```bash
ls -lh dist/mesh-community-planner_1.1.0_amd64.deb
ls -lh dist/MeshCommunityPlanner-1.1.0-x86_64.AppImage
```

## 11. Test the .deb

```bash
sudo dpkg -i dist/mesh-community-planner_1.1.0_amd64.deb
mesh-community-planner
# Should launch server + open browser to http://127.0.0.1:8321
```

## 12. Test the AppImage

```bash
chmod +x dist/MeshCommunityPlanner-1.1.0-x86_64.AppImage
./dist/MeshCommunityPlanner-1.1.0-x86_64.AppImage
```

## 13. Upload to release

```bash
gh release upload v1.1.0 \
  dist/mesh-community-planner_1.1.0_amd64.deb \
  dist/MeshCommunityPlanner-1.1.0-x86_64.AppImage
```

## How It Works

The launcher script:
1. Starts the backend server in the background
2. Polls `http://127.0.0.1:8321/api/health` until the server is ready (up to 30s)
3. Opens the default browser to the app URL
4. Traps EXIT/TERM/INT/HUP signals to cleanly shut down the server
5. The frontend sends a shutdown request when the browser tab closes

Logs are written to `~/.local/share/MeshCommunityPlanner/launcher.log`.
