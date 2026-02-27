# Settings Tooltips — User Preferences & Configuration Help Text

**Last Updated:** 2026-02-07
**Version:** 1.0
**Purpose:** User-facing tooltip content for Settings panel fields

---

## Overview

This document provides tooltip text for all fields in the Settings panel. Tooltips should be concise (1-2 sentences), user-friendly, and provide context-sensitive help.

**Related:** See `WIZARD-TOOLTIPS.md` for node configuration wizard tooltips.

---

## General Settings

### Theme

**Tooltip:**
```
Choose the color scheme for the application interface.
"Auto" matches your system theme (light during day, dark at night).
```

**Options:**
- **Light:** Bright background, dark text (best for daytime use)
- **Dark:** Dark background, light text (reduces eye strain in low light)
- **Auto:** Automatically switches based on system preferences

**Default:** Auto

**Accessibility Note:** Dark mode does not affect color contrast ratios - all themes meet WCAG 2.2 AA standards (4.5:1 minimum).

---

### Distance Units

**Tooltip:**
```
Choose how distances are displayed throughout the app.
Affects node placement, propagation ranges, antenna heights, and BOM measurements.
```

**Options:**
- **Metric (km):** Kilometers, meters, centimeters
- **Imperial (mi):** Miles, feet, inches

**Default:** Metric

**Technical Note:**
- All internal calculations use metric units
- Unit conversion is display-only
- Exported files always use meters (international standard)

**Examples:**
- Metric: "Coverage radius: 5.2 km, Antenna height: 10 m"
- Imperial: "Coverage radius: 3.2 mi, Antenna height: 33 ft"

---

### Color Palette (Accessibility)

**Tooltip:**
```
Choose a colorblind-safe color scheme for map visualizations.
Affects coverage areas, link quality, topology graphs, and heatmaps.
```

**Options:**
- **Viridis (default):** Green/blue/purple gradient (general use)
- **Deuteranopia-safe:** Red-green colorblind friendly
- **Protanopia-safe:** Red-green colorblind friendly (alt)
- **Tritanopia-safe:** Blue-yellow colorblind friendly
- **High Contrast:** Maximum visibility (low vision)
- **Cividis:** Perceptually uniform (scientific use)

**Default:** Viridis

**Accessibility Note:** All palettes include non-color indicators (patterns, shapes, labels) for full accessibility.

---

---

## Privacy Settings

### Enable Analytics

**Tooltip:**
```
Allow Mesh Community Planner to collect anonymous usage statistics.
Helps developers understand feature usage and prioritize improvements.
```

**What is Collected:**
- Feature usage counts (e.g., "propagation run: 15 times")
- Error frequency (e.g., "import failed: 3 times")
- Performance metrics (e.g., "map render: 120ms average")

**What is NOT Collected:**
- Personal identifiers (name, email, IP address)
- Node coordinates or network topology
- Credentials
- Plan names or descriptions

**Default:** Disabled (opt-in only)

**Transmission:** Analytics sent over HTTPS to project servers (monthly summary).

**Compliance:** GDPR-compliant, no PII collected.

---

### Save Activity Log

**Tooltip:**
```
Keep a local log of external service requests for transparency and debugging.
Shows what data was sent to map tile and terrain data servers.
```

**What is Logged:**
- Timestamp of request
- Destination service (e.g., "USGS SRTM download")
- Data summary (e.g., "terrain tile N37W123")
- Response status (success/failure)

**What is NOT Logged:**
- Personal identifiers
- Full request/response bodies

**Default:** Enabled (transparency by default)

**Storage:** Stored locally in `{data_dir}/activity_log.db` (SQLite)

**Viewing:** Settings → Privacy → View Activity Log

**Clearing:** Can be cleared anytime via "Delete Activity Log" button

---

### Data Disclosure Consent Dialog

**Tooltip:**
```
When using external services (map tiles, terrain data, geocoding), you'll see a one-time consent dialog.
Explains exactly what data will be sent and to whom.
```

**Triggered When:**
- First use of geocoding search
- Any external data request per session

**Dialog Content:**
- Service name and purpose
- Exact data to be sent (e.g., "Node coordinates, frequency, TX power")
- Privacy policy link
- Confirm / Cancel buttons

**Behavior:**
- "Confirm" → API call proceeds, consent remembered for session
- "Cancel" → API call aborted, offers local-only alternatives

**Session Scope:** Consent expires when app closes (must re-confirm on next launch).

---

## Storage & Cache

### Storage Dashboard

**Tooltip:**
```
View disk space usage for cached data and manage storage limits.
Helps prevent disk space issues on long-running installations.
```

**Categories Tracked:**
- **Map Tiles:** Offline map data (OSM tiles)
- **SRTM Terrain:** Elevation data tiles (USGS .hgt files)
- **Propagation Cache:** Saved propagation calculation results
- **Saved Plans:** User-created .meshplan files

**Default Limits:**
- Map Tiles: 2 GB (approximately 50,000 tiles at zoom 15)
- SRTM Terrain: 500 MB (approximately 250 tiles, covers ~2.5 million km²)
- Propagation Cache: 100 MB (approximately 1,000 cached results)

**Warning Threshold:** Alert at 90% usage (non-blocking notification)

---

### Clear Cache by Category

**Tooltip:**
```
Delete cached data to free disk space.
Does not affect saved plans or settings.
```

**Options:**
- **Clear Map Tiles:** Removes offline map cache (will re-download as needed)
- **Clear SRTM Terrain:** Removes elevation data (will re-download for terrain calculations)
- **Clear Propagation Cache:** Removes saved calculation results (will re-calculate on demand)
- **Clear All:** Removes all cached data (confirmation required)

**Behavior:**
- Requires confirmation (shows amount to be freed)
- Immediate effect (no restart required)
- Does NOT affect saved plans or templates

**Use Cases:**
- Running low on disk space
- Corrupted cache data (troubleshooting)
- Moving to different geographic region (different SRTM tiles)

---

### Cache Limits Configuration

**Tooltip:**
```
Set maximum disk space for each cache category.
Automatically evicts oldest/least-used data when limit reached.
```

**Map Tiles Limit:**
- **Range:** 100 MB to 10 GB
- **Default:** 2 GB
- **Eviction:** LRU (least recently used)
- **Recommendation:** 2-5 GB for typical use, 10 GB for extensive offline use

**SRTM Terrain Limit:**
- **Range:** 50 MB to 2 GB
- **Default:** 500 MB
- **Eviction:** LRU, prioritizes tiles from saved plans
- **Recommendation:** 500 MB covers most use cases, increase for global coverage

**Propagation Cache Limit:**
- **Range:** 10 MB to 1 GB
- **Default:** 100 MB
- **Eviction:** Cleared on plan switch, LRU within plan
- **Recommendation:** 100 MB is sufficient, increase for very large networks

---

## About Tab

### Application Version

**Tooltip:**
```
Current version of Mesh Community Planner.
Check for updates at github.com/project/releases
```

**Format:** v1.2.0 (MAJOR.MINOR.PATCH)

---

### License Information

**Tooltip:**
```
Mesh Community Planner is open-source software.
See LICENSE.md for full terms and third-party attributions.
```

---

### Delete All My Data (GDPR)

**Tooltip:**
```
Permanently delete ALL data stored by Mesh Community Planner.
Includes plans, templates, settings, cache, credentials, and activity log.
```

**Warning:** ⚠️ **CANNOT BE UNDONE**

**What is Deleted:**
- All saved plans (.meshplan files)
- All templates
- All settings and preferences
- All cached data (map tiles, SRTM, propagation)
- Activity log

**What is NOT Deleted:**
- Application installation (executable remains)
- Exported files (if saved outside app data directory)

**Confirmation Required:**
- Must type "DELETE" to confirm
- Checkbox: "I understand this cannot be undone"

**Use Cases:**
- GDPR "right to be forgotten" request
- Uninstalling app
- Starting fresh after extensive testing

---

## Contextual Tooltips

### When to Show Extended Tooltips

**First-Time User:**
- Show full tooltips with examples
- Include "Why this matters" context
- Highlight implications for destructive actions

**Experienced User:**
- Show concise tooltips (first sentence only)
- Assume familiarity with concepts

**Expert Mode:**
- Minimal tooltips (just warnings for destructive actions)

---

## Validation Messages

### Storage Limit Warning

**Message:**
```
⚠️ [Category] cache is at 90% capacity (XXX MB / YYY MB).
Consider clearing old data or increasing the limit in Settings.
```

### Delete All Data Confirmation

**Message:**
```
⚠️ WARNING: This will permanently delete ALL data

This includes:
✗ All plans and templates
✗ All settings and preferences
✗ All cached data
✗ Activity log

This action CANNOT be undone.

Type "DELETE" to confirm:
[input field]

☑ I understand this cannot be undone
```

---

## Accessibility Notes

**All tooltips must:**
- Be associated with form fields via `aria-describedby`
- Be keyboard-accessible (visible on focus)
- Have sufficient color contrast (4.5:1 minimum)
- Not rely solely on color to convey meaning
- Work with screen readers

**Implementation Example:**
```html
<label for="theme-select">Theme</label>
<select
  id="theme-select"
  aria-describedby="theme-help"
>
  <option value="light">Light</option>
  <option value="dark">Dark</option>
  <option value="auto">Auto</option>
</select>
<span id="theme-help" class="tooltip">
  Choose the color scheme for the application interface.
  "Auto" matches your system theme.
</span>
```

---

## Security & Privacy Considerations

### Data Disclosure

**Transparency:**
- Consent dialog before first external API call per session
- Activity log shows all external calls
- Privacy policy links provided

**User Control:**
- Can decline external services (offers local alternatives)
- Can clear activity log anytime
- Can delete all data (GDPR compliance)

---

## Update History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-07 | 1.0 | Initial settings tooltip content creation |

---

**For implementation questions, see:**
- `docs/USER_GUIDE.md` for user-facing documentation (Settings section)
- `docs/TROUBLESHOOTING.md` for common issues
- WCAG 2.2 AA guidelines for accessibility requirements
