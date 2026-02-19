# Mesh Community Planner — Branding Assets

Production icon assets for the Mesh Community Planner application.
Generated February 2026 by the Art Director agent.

## Directory Structure

```
branding/
  teal/                              ← PRIMARY (Mesh Community Planner)
    mesh-community-planner.svg       Master vector (1024x1024 viewBox)
    mesh-community-planner.ico       Windows multi-res (16/24/32/48/256)
    favicon.svg                      Web favicon (SVG)
    png/
      icon-16x16.png                 Favicon, title bar
      icon-24x24.png                 Windows notification area
      icon-32x32.png                 System tray, small icon
      icon-48x48.png                 Windows Explorer, taskbar
      icon-64x64.png                 macOS dock @1x
      icon-128x128.png               macOS, Linux app icon
      icon-256x256.png               Windows large icon, macOS @2x
      icon-512x512.png               macOS @2x, splash screens
      icon-1024x1024.png             App store, marketing

  red/                               ← ALTERNATE (future fork)
    (same structure as teal/)
```

## Usage

### Web (favicon)
Already deployed: `frontend/public/favicon.svg` (teal)
Referenced in: `frontend/index.html` as `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`

### Windows (PyInstaller)
Set in `installers/mesh_planner.spec`:
```python
icon='branding/teal/mesh-community-planner.ico'
```

### macOS
Use `iconutil` to generate `.icns` from the PNG set. See `icon-concepts/README.md` for details.

### Linux
Ship the SVG as the primary icon. Place PNGs in the hicolor theme:
```
/usr/share/icons/hicolor/48x48/apps/mesh-community-planner.png
/usr/share/icons/hicolor/128x128/apps/mesh-community-planner.png
/usr/share/icons/hicolor/256x256/apps/mesh-community-planner.png
/usr/share/icons/hicolor/scalable/apps/mesh-community-planner.svg
```

## Forking to Red Variant

The `branding/red/` directory contains identical assets in the red/rose colorway.
To switch a fork to the red variant:

1. Copy `branding/red/favicon.svg` → `frontend/public/favicon.svg`
2. Update PyInstaller spec to use `branding/red/mesh-community-planner.ico`
3. Update any UI color references from teal to red palette

### Color Palettes

**Teal / Amber (primary):**
| Role | Hex |
|------|-----|
| Primary Teal | #0D9488 |
| Bright Teal | #14B8A6 |
| Warm Amber | #F59E0B |
| Light Gold | #FCD34D |
| Dark Slate | #1E293B |

**Red / Rose (fork):**
| Role | Hex |
|------|-----|
| Deep Rose | #BE123C |
| Bright Rose | #E11D48 |
| Soft Red | #EF4444 |
| Light Coral | #FCA5A5 |
| Warm Charcoal | #1C1917 |
