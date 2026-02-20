# Frequently Asked Questions

---

## General

### What is Mesh Community Planner?

A desktop application for planning LoRa mesh network deployments. You place nodes on a map, simulate RF coverage using real terrain data, select hardware from a built-in catalog, and generate a bill of materials — all running locally on your computer.

### Is it free?

Yes. Mesh Community Planner is open-source software licensed under CC BY-NC-SA 4.0. It is free to use and modify for non-commercial purposes.

### What platforms does it run on?

Windows 10+, macOS 11+, and Linux (Ubuntu 20.04+, Fedora 35+, or equivalent). Pre-built binaries are available for all three platforms on the [GitHub Releases page](https://github.com/PapaSierra555/MeshCommunityPlanner/releases).

### Do I need to install Python or Node.js?

No. The downloadable installers are self-contained. Python and Node.js are only needed if you want to build from source.

### Does it require an internet connection?

An internet connection is needed for the initial download of map tiles and terrain elevation data. After that, the app works fully offline using cached data.

### Does it collect any data or telemetry?

No. There is no analytics, no telemetry, no user accounts, and no cloud services. All data stays on your machine.

---

## Installation

### How do I install it?

Download the installer for your platform from the [GitHub Releases page](https://github.com/PapaSierra555/MeshCommunityPlanner/releases):

- **Windows:** Run `MeshCommunityPlanner-1.1.0-Setup.exe`
- **macOS:** Open `MeshCommunityPlanner-1.1.0.dmg` and drag to Applications
- **Linux:** Make `MeshCommunityPlanner-1.1.0-x86_64.AppImage` executable and run it

### macOS says the app is from an unidentified developer. What do I do?

The app is not notarized with Apple. To open it:

1. Right-click the app in Applications
2. Select **Open**
3. Click **Open** in the confirmation dialog

Or run `xattr -cr "/Applications/Mesh Community Planner.app"` in Terminal.

### Windows Defender flags the installer. Is it safe?

Yes. Because the app is not widely distributed yet, Windows SmartScreen may show a warning. Click **More info** → **Run anyway**.

### Where is my data stored?

Plans and settings are stored in a local SQLite database:

- **Windows:** `%LOCALAPPDATA%\MeshCommunityPlanner\mesh_planner.db`
- **macOS:** `~/Library/Application Support/MeshCommunityPlanner/mesh_planner.db`
- **Linux:** `~/.local/share/mesh-community-planner/mesh_planner.db`

---

## Usage

### How do I create a plan?

1. Click **New Plan** in the toolbar
2. Enter a name, select firmware (Meshtastic, MeshCore, or Reticulum), and choose your region
3. Click **Create**
4. Start placing nodes on the map

### How do I add nodes?

Click **Add Node** (or press `Insert`), then click on the map where you want the node. The Node Configuration Wizard walks you through device selection, radio parameters, antenna, and power settings.

### How do I import nodes from a CSV file?

1. Prepare a CSV with columns: `name`, `latitude`, `longitude` (minimum). Optional columns include `antenna_height`, `device`, `frequency`, `tx_power`.
2. Click **Import** in the toolbar
3. Select your CSV file
4. Review the column mapping and click **Import Nodes**

See the [Quick Start Tutorials](QUICK-START-TUTORIALS.md) for a detailed walkthrough.

### What is the difference between FSPL and terrain propagation?

- **FSPL (Free-Space Path Loss):** Instant circular coverage estimate assuming flat terrain. Useful for quick planning.
- **Terrain propagation (Signal-Server):** Accurate coverage accounting for hills, valleys, and terrain obstruction. Uses SRTM 30m elevation data. Takes longer to compute but gives realistic results.

### How do I run terrain propagation analysis?

1. Place nodes on the map
2. Click **Run Propagation** in the toolbar
3. Select **Signal-Server (Terrain-Aware)**
4. Wait for terrain data to download (first time only) and analysis to complete
5. Coverage overlay appears on the map

### How do I generate a bill of materials?

Click **BOM** in the toolbar. The BOM table shows all hardware needed for your plan with quantities and estimated pricing. Export as CSV (for purchasing) or PDF (for documentation).

### What file formats are supported?

- **Plans:** `.meshplan` (JSON with checksum)
- **Single nodes:** `.meshnode`
- **Templates:** `.meshtemplate`
- **Import:** CSV, `.meshplan`
- **Export:** CSV, PDF, KML, `.meshplan`, `.meshnode`, `.meshtemplate`

### Can I use it for non-LoRa networks?

The app is designed for LoRa mesh networks, but the propagation and terrain analysis tools work with any frequency. You can configure custom radio parameters to match other RF technologies.

---

## Hardware and Firmware

### What devices are in the catalog?

The catalog includes 11+ LoRa devices across three firmware families:

- **Meshtastic:** T-Beam, Heltec V3, RAK19007, and others
- **MeshCore:** Supported devices with MeshCore firmware
- **Reticulum/RNode:** RNode-compatible devices

### What regulatory regions are supported?

- US FCC 915 MHz
- EU 868 MHz
- EU 433 MHz
- ANZ (Australia/New Zealand)

Each region enforces appropriate frequency, power, and duty cycle limits.

---

## Data and Privacy

### How do I back up my plans?

Click **Export** in the toolbar and save the `.meshplan` file. This JSON file contains your complete plan and can be re-imported on any machine.

### How do I share a plan with someone?

Export your plan as a `.meshplan` file and send it to them. They can import it using **Import** → **Import Plan** in their copy of the app.

### How do I delete all my data?

Delete the SQLite database file at the location listed above under "Where is my data stored?" The app will create a fresh database on next launch.

---

## Troubleshooting

### The map is blank or not loading.

- Check your internet connection (map tiles require internet on first view)
- Try a different browser
- Clear browser cache and reload

### Terrain propagation is taking a long time.

First-time terrain data download can take 1-5 minutes depending on area size. Subsequent runs use cached data and are much faster. Plans with many nodes take longer to analyze.

### The app won't start or the browser shows "connection refused."

- Check that port 8321 is not already in use by another application
- On Windows, check Task Manager for an existing MeshCommunityPlanner process
- On macOS/Linux, run `lsof -i :8321` to check for port conflicts

### Coverage looks wrong or too optimistic.

- Verify antenna height is set correctly (default 10m may not match your deployment)
- Make sure you ran terrain propagation, not just FSPL preview
- Check that frequency and transmit power match your actual hardware

For more troubleshooting help, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

**Last Updated:** February 2026
**Version:** 1.1.0
