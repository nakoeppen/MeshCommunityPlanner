# Troubleshooting Guide

**Mesh Community Planner - v1.0**
**Last Updated:** 2026-02-10

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation Issues](#installation-issues)
3. [Application Startup Problems](#application-startup-problems)
4. [Performance Issues](#performance-issues)
5. [Network & Connectivity](#network--connectivity)
6. [Map & Visualization](#map--visualization)
7. [Analysis & Calculation](#analysis--calculation)
8. [Import/Export Problems](#importexport-problems)
9. [Database Issues](#database-issues)
10. [Platform-Specific Issues](#platform-specific-issues)
11. [Getting Help](#getting-help)

---

## Quick Diagnostics

### Health Check Steps

Before diving into specific issues, run these quick checks:

**1. Check Application Version**
- Open Mesh Community Planner
- Go to **Help → About**
- Verify you're running the latest version (v1.0 or higher)
- If not, [download the latest release](https://github.com/PapaSierra555/MeshCommunityPlanner/releases)

**2. Check System Requirements**
- **Minimum:** 4 GB RAM, dual-core CPU, 500 MB disk space
- **Recommended:** 8 GB RAM, quad-core CPU, 1 GB disk space
- Check your system meets these requirements

**3. Check Internet Connection**
- Mesh Community Planner requires internet for:
  - Terrain elevation data
  - Map tiles
  - Software updates
- Test your connection: Open a browser and visit https://www.google.com

**4. Check Logs**

Logs are stored in:

- **Windows:** `%APPDATA%\MeshCommunityPlanner\logs\`
- **macOS:** `~/Library/Application Support/MeshCommunityPlanner/logs/`
- **Linux:** `~/.local/share/MeshCommunityPlanner/logs/`

Look for `app.log` and `error.log`.

**5. Restart the Application**

Many issues resolve with a simple restart:
1. Close Mesh Community Planner completely
2. Wait 5 seconds
3. Reopen the application

---

## Installation Issues

### Windows: "Windows protected your PC" warning

**Problem:** Windows SmartScreen blocks the installer.

**Solution:**
1. Click **More info**
2. Click **Run anyway**
3. The application is code-signed and safe to install

**Why this happens:** Windows shows this warning for new applications until they build reputation.

---

### macOS: "App is from an unidentified developer"

**Problem:** macOS Gatekeeper blocks the application.

**Solution:**
1. Right-click (or Control-click) the app icon
2. Select **Open** from the context menu
3. Click **Open** in the dialog
4. macOS will remember this choice

**Alternative:**
```bash
sudo xattr -rd com.apple.quarantine "/Applications/Mesh Community Planner.app"
```

**Why this happens:** The app is notarized, but macOS requires manual approval on first launch.

---

### Linux: AppImage won't run

**Problem:** Double-clicking the AppImage does nothing.

**Solution:**

**Option 1: Make it executable**
```bash
chmod +x MeshCommunityPlanner-x86_64.AppImage
./MeshCommunityPlanner-x86_64.AppImage
```

**Option 2: Install FUSE**
```bash
# Ubuntu/Debian
sudo apt install fuse libfuse2

# Fedora/RHEL
sudo dnf install fuse fuse-libs
```

**Option 3: Extract and run**
```bash
./MeshCommunityPlanner-x86_64.AppImage --appimage-extract
./squashfs-root/AppRun
```

---

### Linux: DEB installation fails with dependencies

**Problem:** `dpkg` reports missing dependencies.

**Solution:**
```bash
sudo apt --fix-broken install
sudo dpkg -i mesh-community-planner_1.1.0_amd64.deb
```

**Alternative:** Use `gdebi` to auto-resolve dependencies:
```bash
sudo apt install gdebi
sudo gdebi mesh-community-planner_1.1.0_amd64.deb
```

---

### Installation hangs or freezes

**Problem:** Installer appears stuck.

**Solution:**
1. Wait at least 5 minutes (large downloads may take time)
2. Check your antivirus isn't blocking the installer
3. Temporarily disable antivirus during installation
4. Download the installer again (file may be corrupted)
5. Try installing to a different location

---

## Application Startup Problems

### Application won't start at all

**Problem:** Double-clicking the icon does nothing, or application crashes immediately.

**Checklist:**

1. **Check system requirements**
   - At least 4 GB RAM
   - Dual-core 2.0 GHz CPU or better
   - 500 MB free disk space

2. **Check for conflicting software**
   - Close other mapping/GIS applications
   - Close other Electron-based apps
   - Close browser with many tabs

3. **Check antivirus/firewall**
   - Temporarily disable antivirus
   - Add Mesh Community Planner to whitelist
   - Allow network access in firewall

4. **Reinstall the application**
   ```bash
   # Uninstall completely, then reinstall
   # Windows: Use "Add/Remove Programs"
   # macOS: Drag app to Trash, empty Trash
   # Linux: sudo apt remove mesh-community-planner
   ```

5. **Check logs** (see [Quick Diagnostics](#quick-diagnostics))

---

### Application crashes on startup

**Problem:** App opens briefly, then closes with an error.

**Common Causes:**

**1. Corrupted database**

**Solution:**
```bash
# Backup and reset database
# Windows:
cd %APPDATA%\MeshCommunityPlanner
rename database.db database.db.backup
# Restart the app

# macOS:
cd ~/Library/Application\ Support/MeshCommunityPlanner
mv database.db database.db.backup
# Restart the app

# Linux:
cd ~/.local/share/MeshCommunityPlanner
mv database.db database.db.backup
# Restart the app
```

**2. Graphics driver issues**

**Solution:**
- Update your graphics drivers
- Windows: Use Device Manager or visit manufacturer website
- macOS: Install latest system updates
- Linux: Install proprietary drivers if available

**3. Missing system libraries (Linux)**

**Solution:**
```bash
# Install common dependencies
sudo apt install libgtk-3-0 libnotify4 libnss3 libxss1 \
                 libxtst6 xdg-utils libatspi2.0-0 libuuid1 \
                 libappindicator3-1 libsecret-1-0
```

---

### Application opens but shows blank window

**Problem:** Window opens but content is blank/white.

**Solution:**

1. **Disable hardware acceleration**
   - Launch with flag: `--disable-gpu`
   - Windows: Edit shortcut target, add ` --disable-gpu`
   - macOS/Linux: Run from terminal with flag

2. **Clear cache**
   ```bash
   # Windows:
   rd /s /q "%APPDATA%\MeshCommunityPlanner\Cache"

   # macOS:
   rm -rf ~/Library/Application\ Support/MeshCommunityPlanner/Cache

   # Linux:
   rm -rf ~/.cache/MeshCommunityPlanner
   ```

3. **Update graphics drivers** (see above)

---

## Performance Issues

### Application is slow or laggy

**Problem:** UI is unresponsive, actions take a long time.

**Checklist:**

1. **Check system resources**
   - Open Task Manager (Windows) / Activity Monitor (macOS) / System Monitor (Linux)
   - Look for high CPU or memory usage
   - Close unnecessary applications

2. **Reduce number of nodes**
   - Plans with 100+ nodes can be slow
   - Break large networks into sub-plans
   - Or upgrade to a more powerful system

3. **Clear terrain cache**
   ```bash
   # Windows:
   rd /s /q "%APPDATA%\MeshCommunityPlanner\terrain_cache"

   # macOS:
   rm -rf ~/Library/Application\ Support/MeshCommunityPlanner/terrain_cache

   # Linux:
   rm -rf ~/.local/share/MeshCommunityPlanner/terrain_cache
   ```

4. **Switch to simpler map layer**
   - Use "Street Map" instead of "Satellite"
   - Satellite imagery requires more bandwidth

---

### Analysis takes too long

**Problem:** "Running analysis..." hangs for more than 10 minutes.

**Checklist:**

1. **Check node count**
   - 1-50 nodes: Should complete in seconds
   - 50-100 nodes: May take 10-30 seconds
   - 100-200 nodes: May take 1-2 minutes
   - 200+ nodes: May take 5-10 minutes

2. **Check internet connection**
   - Analysis downloads terrain data (first time)
   - Slow or unstable connection will delay analysis
   - Once cached, subsequent analysis is faster

3. **Check system resources**
   - Analysis is CPU-intensive
   - Close other applications
   - Wait for background tasks to finish

4. **Reduce analysis area**
   - Smaller geographic area = faster analysis
   - Move nodes closer together if possible

**If still stuck after 10 minutes:**
1. Refresh the page (Ctrl+R / Cmd+R)
2. Reopen the plan
3. Try analysis again

---

### High memory usage

**Problem:** Application uses 2+ GB of RAM.

**Expected behavior:** Mesh Community Planner can use 1-2 GB with large plans.

**Reduce memory usage:**

1. **Close unused plans** (if you have multiple open)
2. **Reduce node count** in current plan
3. **Restart the application** periodically
5. **Close other applications** to free up system RAM

**If memory usage grows continuously:**
- This is a memory leak
- Report it as a bug: https://github.com/PapaSierra555/MeshCommunityPlanner/issues
- Restart the app as a workaround

---

## Network & Connectivity

### "Network error" when loading map

**Problem:** Map tiles don't load, shows error message.

**Checklist:**

1. **Check internet connection**
   - Open browser, visit https://www.google.com
   - If down, fix your connection

2. **Check firewall settings**
   - Allow Mesh Community Planner through firewall
   - Windows: Control Panel → Windows Defender Firewall → Allow an app
   - macOS: System Preferences → Security & Privacy → Firewall → Firewall Options
   - Linux: Depends on your firewall (ufw, firewalld, etc.)

3. **Check corporate proxy**
   - If behind corporate proxy, configure proxy settings
   - Settings → Network → Proxy Configuration

4. **Try different map layer**
   - Click layer icon (top-right of map)
   - Switch to "Street Map" or "Terrain"

5. **Check map tile service status**
   - Visit https://status.openstreetmap.org (for Street Map layer)
   - Service may be temporarily down

---

### "Cannot download terrain data"

**Problem:** Analysis fails with terrain data error.

**Checklist:**

1. **Check internet connection** (see above)

2. **Check SRTM service status**
   - Our terrain provider may be temporarily down
   - Try again in 15-30 minutes

3. **Clear terrain cache and retry**
   ```bash
   # See "Clear terrain cache" in Performance Issues section
   ```

4. **Check firewall** (see above)

5. **Try smaller geographic area**
   - Large areas require more terrain data
   - Reduce plan size or move nodes closer together

---

### Rate limiting errors

**Problem:** "Too many requests" or 429 error.

**Explanation:** Rate limits prevent server overload:
- **General API:** 100 requests/minute
- **Propagation analysis:** 10 requests/minute
- **Import/Export:** 20 requests/minute

**Solution:**
1. Wait 1 minute before retrying
2. Reduce frequency of operations
3. Don't spam the "Analyze" button

---

## Map & Visualization

### Map tiles not loading

**Problem:** Map shows gray tiles or "404" placeholders.

**Solution:** See ["Network error" when loading map](#network-error-when-loading-map)

---

### Map tiles are blurry

**Problem:** Map loads but tiles are low resolution.

**Causes:**
- Slow internet connection (lower quality tiles loaded first)
- Zoomed in too far (beyond available tile resolution)

**Solution:**
1. Wait a few seconds for higher-resolution tiles to load
2. Zoom out one level
3. Switch to "Satellite" layer (may have better resolution)

---

### Nodes don't appear on map

**Problem:** Added nodes but they're not visible.

**Checklist:**

1. **Check zoom level**
   - Zoom in closer
   - Nodes may be hidden at high zoom levels

2. **Check if nodes were actually saved**
   - Look in node list sidebar
   - If missing, re-add nodes

3. **Refresh the map**
   - Press F5 or Ctrl+R (Cmd+R on macOS)

4. **Check browser console** (if using web version)
   - Press F12 to open developer tools
   - Check Console tab for errors

---

### Coverage visualization looks wrong

**Problem:** Coverage circles are incorrect size or color.

**Checklist:**

1. **Re-run analysis**
   - Click "Analyze" again
   - Analysis may have failed silently

2. **Check node configuration**
   - Ensure antenna height, gain, transmit power are correct
   - Incorrect values = incorrect coverage

3. **Check frequency**
   - Different frequencies have different propagation characteristics
   - Ensure frequency is set correctly

---

## Analysis & Calculation

### Analysis fails with error

**Problem:** "Analysis failed" message appears.

**Common Errors:**

**1. "Not enough nodes"**
- **Cause:** Plan has fewer than 2 nodes
- **Solution:** Add at least 2 nodes to run analysis

**2. "Terrain data unavailable"**
- **Cause:** Cannot download elevation data for this region
- **Solution:** See ["Cannot download terrain data"](#cannot-download-terrain-data)

**3. "Invalid node configuration"**
- **Cause:** One or more nodes have invalid parameters (e.g., negative antenna height)
- **Solution:** Check all node configurations, fix invalid values

**4. "Analysis timeout"**
- **Cause:** Analysis took longer than 5 minutes
- **Solution:** Reduce node count or plan area

---

### RSSI values seem incorrect

**Problem:** RSSI values don't match expectations or field tests.

**Explanation:** RSSI calculation depends on:
- Distance between nodes
- Terrain elevation and obstacles
- Antenna height, gain, transmit power
- Frequency
- Propagation model (Longley-Rice ITM)

**Checklist:**

1. **Verify node parameters**
   - Antenna height (meters above ground)
   - Antenna gain (dBi)
   - Transmit power (dBm)
   - Frequency (MHz)

2. **Check for terrain obstacles**
   - Mountains, hills, valleys affect signal
   - Use terrain propagation for accurate predictions

3. **Compare to field measurements**
   - Models are estimates, not exact predictions
   - Validate with real hardware when possible

4. **Account for local factors not in model**
   - Buildings (not in terrain data)
   - Vegetation (not in model)
   - Weather (not in model)

---

### Topology analysis shows unexpected results

**Problem:** Critical nodes or redundant paths don't seem right.

**Checklist:**

1. **Check link quality threshold**
   - Topology is based on "good" or better links
   - Links with RSSI < -120 dBm are not used

2. **Re-run propagation analysis first**
   - Topology depends on up-to-date RSSI values
   - Click "Analyze" then "Topology"

3. **Check node connectivity**
   - Isolated nodes will affect topology
   - Ensure all nodes have at least one good link

---

## Import/Export Problems

### Cannot import JSON file

**Problem:** "Import failed" or "Invalid file format" error.

**Checklist:**

1. **Verify file format**
   - Must be valid JSON
   - Open in text editor, check syntax
   - Use a JSON validator: https://jsonlint.com

2. **Check file size**
   - Files > 10 MB may fail
   - Break large plans into smaller ones

3. **Verify JSON schema**
   - File must be a Mesh Community Planner export
   - Manual edits may have broken schema

4. **Try re-exporting from original plan** (if available)

---

### Cannot export to KML/GeoJSON

**Problem:** Export fails or file is empty.

**Checklist:**

1. **Check file permissions**
   - Ensure you can write to target directory
   - Try exporting to Desktop or Documents

2. **Check disk space**
   - Ensure at least 100 MB free space

3. **Check plan validity**
   - Plan must have at least 1 node
   - Nodes must have valid coordinates

4. **Try JSON export first** (to rule out format-specific issues)

---

### Cannot generate Bill of Materials

**Problem:** BOM export is empty or incomplete.

**Checklist:**

1. **Ensure nodes have device types assigned**
   - Open each node configuration
   - Select a device from catalog
   - Nodes without device types won't appear in BOM

2. **Check for custom devices**
   - Custom devices must have complete specifications
   - Missing fields may cause BOM generation to fail

3. **Try CSV export** (alternative format)

---

## Database Issues

### "Database is locked"

**Problem:** Error message when saving or loading.

**Causes:**
- Another instance of the app is running
- Previous crash left database lock file

**Solution:**

1. **Close all instances of Mesh Community Planner**
   - Check Task Manager / Activity Monitor
   - Force quit if necessary

2. **Delete lock file**
   ```bash
   # Windows:
   cd %APPDATA%\MeshCommunityPlanner
   del database.db-shm database.db-wal

   # macOS:
   cd ~/Library/Application\ Support/MeshCommunityPlanner
   rm database.db-shm database.db-wal

   # Linux:
   cd ~/.local/share/MeshCommunityPlanner
   rm database.db-shm database.db-wal
   ```

3. **Restart the app**

---

### "Database is corrupted"

**Problem:** App won't start, shows database error.

**Solution:**

**Option 1: Restore from backup** (if available)
```bash
# Windows:
cd %APPDATA%\MeshCommunityPlanner
copy database.db.backup database.db

# macOS/Linux:
cd ~/Library/Application\ Support/MeshCommunityPlanner  # or ~/.local/share/MeshCommunityPlanner on Linux
cp database.db.backup database.db
```

**Option 2: Reset database** (loses all plans)
```bash
# Backup first!
# Windows:
cd %APPDATA%\MeshCommunityPlanner
rename database.db database.db.old

# macOS/Linux:
cd ~/Library/Application\ Support/MeshCommunityPlanner  # or ~/.local/share/MeshCommunityPlanner on Linux
mv database.db database.db.old

# Restart app to create new database
```

**Option 3: Import plans from JSON exports** (if you have them)
1. Reset database (Option 2)
2. Use File → Import to restore plans

---

### Plans disappeared after update

**Problem:** After updating the app, plans are missing.

**Solution:**

1. **Check database location**
   - Database location should not change
   - See [Quick Diagnostics](#quick-diagnostics) for paths

2. **Check if old version is still running**
   - Multiple versions may use different databases
   - Uninstall old version, ensure only one version installed

3. **Search for backup files**
   - Look for `database.db.backup` in app data directory

4. **Check JSON exports** (if you exported before updating)

---

## Platform-Specific Issues

### Windows: Installer won't run on Windows 7/8

**Problem:** Minimum requirement is Windows 10.

**Solution:**
- Upgrade to Windows 10 or later
- Or run from source (requires Python 3.9+ and Node.js)

---

### macOS: "The application is damaged"

**Problem:** macOS refuses to open the app.

**Solution:**
```bash
# Remove quarantine attribute
sudo xattr -cr "/Applications/Mesh Community Planner.app"
```

**If that doesn't work:**
1. Delete the app from Applications
2. Empty Trash
3. Re-download the DMG
4. Reinstall

---

### Linux: Icon doesn't appear in application menu

**Problem:** AppImage works from terminal but not in menu.

**Solution:**

Install AppImageLauncher:
```bash
# Ubuntu/Debian
sudo add-apt-repository ppa:appimagelauncher-team/stable
sudo apt update
sudo apt install appimagelauncher

# Fedora
sudo dnf copr enable pgdev/appimagelauncher
sudo dnf install appimagelauncher
```

Then double-click the AppImage — AppImageLauncher will integrate it.

**Manual integration:**
```bash
mkdir -p ~/.local/share/applications
cat > ~/.local/share/applications/mesh-community-planner.desktop <<EOF
[Desktop Entry]
Name=Mesh Community Planner
Exec=/path/to/MeshCommunityPlanner-x86_64.AppImage
Icon=/path/to/icon.png
Type=Application
Categories=Network;Science;
EOF
```

---

### Linux: Wayland compatibility issues

**Problem:** App crashes or misbehaves on Wayland.

**Solution:**

Force X11 session:
```bash
GDK_BACKEND=x11 ./MeshCommunityPlanner-x86_64.AppImage
```

Or edit `.desktop` file:
```
Exec=env GDK_BACKEND=x11 /path/to/MeshCommunityPlanner-x86_64.AppImage
```

---

## Getting Help

### Still having issues?

**Before asking for help, please collect:**

1. **System information**
   - OS and version (Windows 10, macOS 13, Ubuntu 22.04, etc.)
   - Mesh Community Planner version (Help → About)
   - RAM and CPU specifications

2. **Error messages**
   - Exact error text (copy/paste or screenshot)
   - When the error occurs (during startup, analysis, export, etc.)

3. **Log files** (see [Quick Diagnostics](#quick-diagnostics))
   - `app.log` (last 100 lines)
   - `error.log` (full file if small)

4. **Steps to reproduce**
   - What were you doing when the error occurred?
   - Can you reproduce it reliably?

---

### Support Channels

**1. Search existing issues**
- GitHub Issues: https://github.com/PapaSierra555/MeshCommunityPlanner/issues
- Someone may have already reported your issue

**2. Ask the community**
- GitHub Discussions: https://github.com/PapaSierra555/MeshCommunityPlanner/discussions

**3. Report a bug**
- GitHub Issues: https://github.com/PapaSierra555/MeshCommunityPlanner/issues/new
- Include system info, logs, and steps to reproduce

---

### Bug Reporting Template

When filing a bug report, use this template:

```markdown
**Environment**
- OS: [e.g., Windows 11, macOS 13.2, Ubuntu 22.04]
- App Version: [e.g., v1.1.0]
- RAM: [e.g., 8 GB]
- CPU: [e.g., Intel Core i5-8250U]

**Describe the bug**
A clear description of what went wrong.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Logs**
Attach `error.log` or paste relevant portions.

**Additional context**
Any other context about the problem.
```

---

## Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `ERR_NETWORK` | Network connection failed | Check internet connection and firewall |
| `ERR_DB_LOCKED` | Database is locked | Close other instances, delete lock files |
| `ERR_DB_CORRUPT` | Database is corrupted | Restore from backup or reset database |
| `ERR_INVALID_FILE` | Import file is invalid | Check JSON syntax and schema |
| `ERR_NO_TERRAIN` | Terrain data unavailable | Check internet, retry after 15 minutes |
| `ERR_ANALYSIS_TIMEOUT` | Analysis took too long | Reduce node count or plan area |
| `ERR_GRAPHICS` | Graphics driver issue | Update drivers, disable GPU acceleration |
| `ERR_PERMISSION` | File permission denied | Check write permissions to target directory |

---

**This troubleshooting guide is continuously updated. Last updated: 2026-02-10**

**Found an error or have a suggestion? [Open an issue](https://github.com/PapaSierra555/MeshCommunityPlanner/issues) or click "Edit" on GitHub.**
