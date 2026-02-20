# Known Issues — v1.1.0

**Last Updated:** February 2026
**Release:** v1.1.0

This document tracks known issues, limitations, and workarounds for Mesh Community Planner v1.1.0.

---

## Platform-Specific Issues

### Windows: SmartScreen Warning on First Run

Windows Defender SmartScreen may flag the installer as unrecognized because it is not widely distributed yet.

**Workaround:** Click **More info** → **Run anyway**.

### macOS: Gatekeeper Warning on First Run

macOS blocks the app because it is not notarized with Apple.

**Workaround:** Right-click the app in Applications → Select **Open** → Click **Open** in the confirmation dialog. Or run `xattr -cr "/Applications/Mesh Community Planner.app"` in Terminal.

### Linux: AppImage May Not Integrate with Desktop

The AppImage may not automatically create desktop shortcuts or file associations.

**Workaround:** Manually create a `.desktop` file, or use [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher) for automatic integration.

---

## Propagation and Analysis

### Terrain Data Download Can Be Slow

First-time terrain data download (SRTM tiles from USGS) can take 1-5 minutes depending on area size and connection speed.

**Workaround:** Wait for the download to complete. Once cached, subsequent runs in the same area are much faster.

### FSPL Preview Does Not Account for Terrain

The instant FSPL coverage circles assume flat earth. They may be significantly more optimistic than actual terrain-aware propagation results.

**Workaround:** Always run Signal-Server terrain propagation before making deployment decisions. FSPL is for quick estimates only.

### Coverage Overlay Not Visible at Low Zoom Levels

When zoomed out far, the propagation coverage overlay may be too small to see on the map.

**Workaround:** Zoom in to the area around your nodes to see coverage details.

---

## Import and Export

### CSV Import: Device Names Are Case-Sensitive

When importing nodes from CSV, the `device` column must exactly match a device name in the catalog (case-sensitive).

**Workaround:** Check the device catalog for exact spelling. Example: use "Heltec V3" not "heltec v3".

### KML Export Does Not Include Propagation Data

KML export includes node locations but not propagation coverage overlays.

**Workaround:** Use screenshots to capture coverage data, or export the plan as `.meshplan` for full fidelity.

---

## User Interface

### Browser Tab Close Does Not Always Stop the Server

In some cases, closing the browser tab may not cleanly shut down the backend server process.

**Workaround:** Check Task Manager (Windows) or Activity Monitor (macOS) and manually end the `MeshCommunityPlanner` process if it persists.

### Map Tiles Require Internet on First View

Map tiles from OpenStreetMap require an internet connection the first time an area is viewed. If offline on first launch, the map background will be blank.

**Workaround:** Ensure internet connectivity for initial use. After viewing an area, tiles are cached for offline use.

---

## Limitations

- **Maximum plan size:** Performance tested with plans up to ~100 nodes. Larger plans may experience slower rendering and analysis times.
- **Terrain resolution:** SRTM data provides 30m resolution. Building-level obstructions are not modeled.
- **Single user:** The app is designed for single-user local operation. There is no multi-user or collaboration support.
- **Browser-based UI:** The interface runs in your web browser. A standalone window (Electron/Tauri) is not currently available.

---

## Reporting Issues

If you encounter an issue not listed here, please report it on [GitHub Issues](https://github.com/PapaSierra555/MeshCommunityPlanner/issues).

Include:
1. Operating system and version
2. Browser and version
3. Steps to reproduce the issue
4. Expected vs. actual behavior
5. Screenshots if applicable

For security vulnerabilities, see [SECURITY.md](../SECURITY.md).

---

**Version:** 1.1.0
**Last Updated:** February 2026
