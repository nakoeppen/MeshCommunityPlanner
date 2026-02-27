# Release Notes — Mesh Community Planner v1.2.0

**Release Date:** March 2026
**Previous Release:** [v1.1.0](RELEASE_NOTES_v1.1.md)

---

## Summary

v1.2.0 adds a full Elevation Heatmap overlay with precision range controls, an Exit Application confirmation dialog, and comprehensive accessibility improvements. The elevation controls support direct number entry, mouse-wheel fine-tuning, Page Up/Down coarse steps, and a "Remember range" checkbox that persists settings across sessions. All new UI is fully keyboard-accessible, focus-trapped where appropriate, and passes axe-core audits.

![Elevation Heatmap](../1.2.0ElevationHeatmap.png)

---

## New Features

### Elevation Heatmap Overlay

Toggle a terrain elevation heatmap via **Tools > Elevation Heatmap**. The overlay uses a hypsometric color ramp from blue (sea level) through green, yellow, orange, terracotta, gray, to white (snow peaks). Terrain data is downloaded on-demand from AWS S3 SRTM 30m tiles and cached locally.

### Elevation Range Controls

Full-featured min/max elevation bounds in the legend panel:

- **Dual-handle range slider** with coloured fill; drag Min/Max thumbs on one track
- **Number fields** for precise direct entry; press Enter to commit, Escape to cancel
- **Mouse wheel** fine-tuning on a focused slider (±10m per tick; page scroll suppressed)
- **Keyboard navigation**: arrow keys ±10m, Page Up/Down ±100m
- **Dynamic legend swatches** recompute terrain colors with terrain-type labels
- **Reset button** restores the full default range (-500m to 9000m)
- **"Remember range" checkbox** persists Min/Max to `localStorage`; build-ID gated so new builds start fresh

| Key | Action |
|-----|--------|
| Arrow keys | ±10m |
| Page Up | +100m |
| Page Down | -100m |
| Tab | Move between controls |
| Enter | Commit number-field value |
| Escape | Cancel number-field edit |

### Exit Application Dialog

A top-level **Exit** button in the toolbar opens a styled confirmation dialog:

- Message: "Closing this tab or window will close the Mesh Community Planner app. Are you sure?"
- Danger variant (red header) with Cancel, Exit, and X close buttons
- Full focus trap — Tab/Shift+Tab cycle within the dialog; Escape dismisses
- `role="alertdialog"` and `aria-modal="true"` for screen reader support
- Browser `beforeunload` safety net for accidental tab closes (production only)
- Intentional exit via the dialog bypasses the browser's native "Leave site?" prompt

### Windowless Mode (Windows)

The Windows build now runs without a visible console window (`console=False`). Standard streams are safely redirected so uvicorn operates normally.

---

## Test Suite

| Suite | v1.1.0 | v1.2.0 |
|-------|--------|--------|
| Backend pytest | 23 | 36 |
| Frontend vitest | 22 | 73 |
| Playwright integration | 14 | 132 (130 pass + 2 Firefox skip) |
| **Total** | **59** | **241** |

---

## Downloads

| Platform | Format | Filename |
|----------|--------|----------|
| Windows | Portable zip | `MeshCommunityPlanner-1.2.0-win.zip` |
| macOS | Disk image | `MeshCommunityPlanner-1.2.0.dmg` |
| Linux | AppImage | `MeshCommunityPlanner-1.2.0-x86_64.AppImage` |
| Linux | Debian package | `mesh-community-planner_1.2.0_amd64.deb` |

---

## Bug Fixes

- Fixed checkbox and number input vertical sizing in the elevation legend panel
- Fixed `beforeunload` event blocking Playwright tests in dev mode

## Known Issues

See [KNOWN-ISSUES.md](KNOWN-ISSUES.md) for the current list.
