# Wizard Tooltips — Node Configuration Help Text

**Last Updated:** 2026-02-07
**Version:** 1.0
**Purpose:** User-facing tooltip content for node creation wizard

---

## Overview

This document provides tooltip text for all fields in the node creation wizard. Tooltips should be concise (1-2 sentences), user-friendly, and provide context-sensitive help.

---

## Location & Identification

### Node Name

**Tooltip:**
```
A descriptive name for this node (e.g., "Downtown Repeater" or "Bob's House").
Used for identification in the map, topology graph, and BOM.
```

**Character Limit:** 50 characters
**Required:** Yes
**Example:** "Main Street Tower", "Emergency Backup Node"

---

### Latitude

**Tooltip:**
```
North-South position in decimal degrees (-90 to 90).
Positive = North, Negative = South. Click the map to auto-fill coordinates.
```

**Range:** -90.0 to 90.0
**Required:** Yes
**Example:** 40.7128 (New York), -33.8688 (Sydney)

---

### Longitude

**Tooltip:**
```
East-West position in decimal degrees (-180 to 180).
Positive = East, Negative = West. Click the map to auto-fill coordinates.
```

**Range:** -180.0 to 180.0
**Required:** Yes
**Example:** -74.0060 (New York), 151.2093 (Sydney)

---

### Antenna Height

**Tooltip:**
```
Height of the antenna above ground level in meters (0-500m).
Higher antennas generally have better range. Include mast/tower height.
```

**Range:** 0 to 500 meters
**Required:** Yes
**Example:** 1.5m (handheld), 10m (rooftop), 30m (tower)

**Technical Note:**
- Elevation data (terrain height) is automatically added from SRTM
- This field is antenna height above local ground level
- Total height = ground elevation + antenna height

---

## Hardware Selection

### Device

**Tooltip:**
```
LoRa hardware device model (e.g., T-Beam, Heltec, RAK WisBlock).
Determines available features, power consumption, and default radio settings.
```

**Required:** Yes
**Examples:**
- T-Beam Supreme (GPS, solar-ready, outdoor)
- Heltec V3 (compact, indoor)
- RAK WisBlock (modular, low power)

**Selection Criteria:**
- **Portable:** Heltec V3, T-Beam
- **Solar/Outdoor:** T-Beam Supreme, RAK WisBlock
- **Indoor:** Heltec V3, Station G2

---

### Firmware

**Tooltip:**
```
Firmware running on the device (usually Meshtastic).
Different firmwares have different features and network compatibility.
```

**Required:** Yes
**Options:**
- **Meshtastic:** Most common, full-featured mesh networking
- **Reticulum:** Alternative protocol (experimental)

**Note:** Most devices run Meshtastic. Only change if you know the node uses different firmware.

---

## Radio Configuration

### Region

**Tooltip:**
```
Regulatory region that determines legal frequency bands and power limits.
MUST match your physical location to comply with local radio regulations.
```

**Required:** Yes
**Examples:**
- **US (FCC):** 902-928 MHz, up to 30 dBm
- **EU (ETSI):** 863-870 MHz, up to 27 dBm
- **Asia-Pacific:** 915-928 MHz (varies by country)

**Warning:** Using wrong region may violate local laws. When in doubt, consult local amateur radio regulations.

---

### Frequency (MHz)

**Tooltip:**
```
Exact transmission frequency in MHz within the allowed band for your region.
All nodes in the mesh must use the same frequency to communicate.
```

**Range:** 137-1020 MHz (varies by region)
**Required:** Yes
**Examples:**
- US: 906.875 MHz (default)
- EU: 868.3 MHz (default)

**Technical Notes:**
- Default frequencies are recommended for most users
- Custom frequencies should avoid interference with other services
- Must be within band allowed by selected region

---

### TX Power (dBm)

**Tooltip:**
```
Transmission power in dBm (0-30). Higher power = longer range but more battery drain.
Legal maximum varies by region. Check local regulations before increasing.
```

**Range:** 0 to 30 dBm
**Required:** Yes
**Default:** 20 dBm

**Power Level Guide:**
- **Low (10-14 dBm):** Battery-powered, short range (100m-1km)
- **Medium (15-20 dBm):** Balanced (1-5km)
- **High (21-27 dBm):** Solar/AC powered, long range (5-15km)
- **Maximum (28-30 dBm):** Fixed infrastructure only

**Warning:** Higher power drains batteries faster. Solar/AC power recommended for >20 dBm.

---

### Spreading Factor

**Tooltip:**
```
LoRa spreading factor (7-12). Higher = longer range but slower data rate.
SF11 is recommended for most mesh networks (good balance).
```

**Range:** 7 to 12
**Required:** Yes
**Default:** 11

**Spreading Factor Guide:**
| SF | Range | Speed | Battery | Use Case |
|----|-------|-------|---------|----------|
| 7 | Shortest | Fastest | Best | Dense urban, low latency |
| 8-9 | Short | Fast | Good | Urban areas |
| 10-11 | Medium | Medium | Medium | Suburban, general use |
| 12 | Longest | Slowest | Worst | Rural, maximum range |

**Technical:** Higher SF = more air time = better range but more collisions in busy networks.

---

### Bandwidth (kHz)

**Tooltip:**
```
Channel bandwidth in kHz (125, 250, or 500). Wider = faster but shorter range.
250 kHz is recommended for most mesh networks.
```

**Options:** 125, 250, 500 kHz
**Required:** Yes
**Default:** 250 kHz

**Bandwidth Guide:**
- **125 kHz:** Maximum range, slowest speed, best for rural
- **250 kHz:** Balanced (recommended)
- **500 kHz:** Shortest range, fastest speed, best for dense urban

**Relationship to SF:** Lower bandwidth + higher SF = maximum range but minimum speed.

---

### Coding Rate

**Tooltip:**
```
Forward error correction rate (4/5, 4/6, 4/7, 4/8).
Higher denominator = more error correction but slower speed. 4/5 is standard.
```

**Options:** 4/5, 4/6, 4/7, 4/8
**Required:** Yes
**Default:** 4/5

**Coding Rate Guide:**
- **4/5:** Standard (20% overhead, best speed)
- **4/6:** Better error correction (50% overhead)
- **4/7:** High error correction (75% overhead)
- **4/8:** Maximum error correction (100% overhead)

**Use Case:** Increase for noisy RF environments or long-distance links. Most users should use 4/5.

---

## Antenna Configuration

### Antenna Type

**Tooltip:**
```
Antenna model and gain in dBi. Higher gain = more directional and longer range in that direction.
Omnidirectional (2-3 dBi) recommended for most mesh nodes.
```

**Required:** Yes

**Antenna Types:**
- **Omnidirectional (2-3 dBi):** 360° coverage, general purpose
- **High-gain omni (5-9 dBi):** Flatter pattern, better for flat terrain
- **Directional (10-15 dBi):** Point-to-point links only

**Selection Guide:**
| Type | Gain | Pattern | Use Case |
|------|------|---------|----------|
| Rubber duck | 2.15 dBi | Omni | Handheld, portable |
| Whip | 2-5 dBi | Omni | Vehicle, temporary |
| Collinear | 5-9 dBi | Omni | Fixed outdoor, repeaters |
| Yagi | 10-15 dBi | Directional | Point-to-point backhaul |

**Technical:** Antenna gain is passive amplification through focusing energy. Total ERP = TX power + antenna gain.

---

### Cable Type

**Tooltip:**
```
Coaxial cable connecting radio to antenna. Longer/thinner cables have more signal loss.
Use shortest cable possible with lowest loss (LMR-400 recommended for >3m runs).
```

**Required:** If antenna not integrated

**Cable Types:**
| Type | Loss (dB/m @ 915 MHz) | Use Case |
|------|----------------------|----------|
| RG-174 | 1.0 dB/m | Short (<1m), handheld |
| RG-58 | 0.6 dB/m | Short (<3m), portable |
| LMR-200 | 0.4 dB/m | Medium (<5m), general |
| LMR-400 | 0.22 dB/m | Long (>5m), fixed install |

**Cable Loss Example:**
- 10m of LMR-400 @ 915 MHz = 2.2 dB loss
- Equivalent to cutting TX power from 20 dBm to 18 dBm
- **Recommendation:** Keep cables <10m or use LMR-400/equivalent

---

### Cable Length (m)

**Tooltip:**
```
Length of cable from radio to antenna in meters. Used to calculate signal loss.
Shorter is better – every meter of cable reduces your range.
```

**Range:** 0 to 50 meters
**Required:** If cable specified
**Recommendation:** <10m for best performance

**Signal Loss Impact:**
- 1m of LMR-400: -0.22 dB (negligible)
- 5m of LMR-400: -1.1 dB (minor)
- 10m of LMR-400: -2.2 dB (noticeable)
- 20m of LMR-400: -4.4 dB (significant, adds <1 battery)

---

## Power Configuration

### Power Source

**Tooltip:**
```
How the node is powered (battery, solar, AC mains, USB).
Affects uptime, placement options, and available TX power budget.
```

**Required:** Yes

**Power Sources:**
- **Battery only:** Portable, limited runtime (hours to days)
- **Solar + battery:** Outdoor repeaters, unlimited runtime
- **AC mains:** Indoor, unlimited runtime, highest reliability
- **USB (5V):** Desktop, vehicle, portable charger
- **PoE (Power over Ethernet):** Outdoor installations with wired backhaul

**Selection Guide:**
| Source | Uptime | Mobility | TX Power | Use Case |
|--------|--------|----------|----------|----------|
| Battery | Hours-Days | High | Low-Med | Portable, emergency |
| Solar | Unlimited* | None | Medium | Remote repeaters |
| AC Mains | Unlimited | None | High | Infrastructure, indoor |
| USB | Variable | Medium | Low-Med | Desktop, vehicle |
| PoE | Unlimited | None | High | Outdoor + wired |

*With proper solar sizing and battery capacity

---

### Battery Capacity (mAh)

**Tooltip:**
```
Battery capacity in milliamp-hours. Larger = longer runtime.
Typical: 3000-5000 mAh for portable, 10000-20000 mAh for solar nodes.
```

**Range:** 0 to 100,000 mAh
**Required:** If battery-powered

**Battery Sizing Guide:**
- **Small (1000-3000 mAh):** Handheld, a few hours runtime
- **Medium (3000-10000 mAh):** Portable, 1-3 days runtime
- **Large (10000-20000 mAh):** Solar backup, 3-7 days autonomy
- **Extra Large (>20000 mAh):** Off-grid, >7 days autonomy

**Runtime Calculator:**
- Runtime (hours) ≈ Battery (mAh) / Current Draw (mA)
- Example: 5000 mAh @ 50 mA average = 100 hours (4 days)
- TX at 20 dBm ≈ 120 mA, RX ≈ 40 mA, Sleep ≈ 5 mA

---

### Solar Panel Wattage

**Tooltip:**
```
Solar panel power in Watts. Required for solar-powered nodes.
Typical: 5-10W for single node, 20-50W for repeaters in low-light areas.
```

**Range:** 0 to 200 Watts
**Required:** If solar-powered

**Solar Sizing Guide:**
| Panel | Battery | Use Case | Location |
|-------|---------|----------|----------|
| 5-6W | 5000-10000 mAh | Single node, low duty | Sunny climates |
| 10-20W | 10000-20000 mAh | Repeater, medium duty | Most locations |
| 20-50W | 20000-40000 mAh | High-power repeater | Cloudy/northern |
| >50W | >40000 mAh | Multi-radio hub | Off-grid critical |

**Rule of Thumb:** Panel wattage (W) ÷ 5 ≥ average current draw (mA) for most climates.

---

## Advanced Settings

### Node Role

**Tooltip:**
```
Node's function in the mesh network (client, router, repeater).
Repeaters relay messages but don't originate them. Most nodes are "router" (default).
```

**Required:** Yes
**Default:** Router

**Roles:**
- **Client:** Receives messages only, doesn't relay (battery-saving mode)
- **Router:** Full participant, relays for others (default)
- **Repeater:** Relay only, no local messages (dedicated infrastructure)

**Use Cases:**
- **Client:** Battery-critical portable nodes, sensors
- **Router:** General-purpose nodes (recommended for most)
- **Repeater:** Solar-powered hilltop installations

---

### Hop Limit

**Tooltip:**
```
Maximum number of hops a message can travel through the mesh (1-7).
Default is 3. Higher = larger network but more RF congestion.
```

**Range:** 1 to 7
**Required:** Yes
**Default:** 3

**Hop Limit Guide:**
- **1-2 hops:** Small network, minimal latency
- **3 hops:** Standard (recommended, ~10-20 nodes)
- **4-5 hops:** Medium network (~20-50 nodes)
- **6-7 hops:** Large network (>50 nodes, higher latency)

**Technical:** Each hop adds latency and airtime. Use minimum hops needed for network size.

---

### Neighbor Info Interval (seconds)

**Tooltip:**
```
How often this node broadcasts its presence to neighbors (in seconds).
Default is 900s (15 min). Lower = faster discovery but more battery drain.
```

**Range:** 60 to 3600 seconds
**Required:** No
**Default:** 900 seconds (15 minutes)

**Interval Guide:**
- **60-300s (1-5 min):** Mobile nodes, rapid topology changes
- **900s (15 min):** Default, good balance
- **1800-3600s (30-60 min):** Fixed infrastructure, battery-saving

---

## Description Field

### Description

**Tooltip:**
```
Optional notes about this node (owner, purpose, access instructions, etc.).
Visible to other mesh users. Maximum 200 characters.
```

**Character Limit:** 200 characters
**Required:** No
**Example:** "Solar-powered repeater on water tower. Maintained by ARES group."

**Recommended Content:**
- Owner/contact info
- Installation notes
- Maintenance schedule
- Special features (e.g., "Has MQTT gateway")

---

## Contextual Tooltips

### When to Show Extended Tooltips

**Beginner Mode:**
- Show full tooltips with examples
- Include "Why this matters" context
- Provide recommendations ("Use 20 dBm for balanced performance")

**Advanced Mode:**
- Show concise tooltips (first sentence only)
- Assume user understands RF concepts
- Focus on valid ranges and constraints

**Expert Mode:**
- Minimal tooltips (just valid ranges)
- Or hide tooltips entirely, show on hover only

---

## Validation Messages

### Invalid Latitude

**Message:**
```
Latitude must be between -90 and 90 degrees.
Tip: Click the map to auto-fill coordinates.
```

### Invalid Frequency

**Message:**
```
Frequency {value} MHz is outside the legal band for {region}.
Valid range for {region}: {min}-{max} MHz
```

### High TX Power Warning

**Message:**
```
⚠️ TX power above 27 dBm may be illegal in some regions.
Verify local regulations before using high power.
Also: High power drains batteries quickly.
```

### Cable Too Long Warning

**Message:**
```
⚠️ Cable length >10m will cause significant signal loss ({loss} dB).
Consider: Moving radio closer to antenna or using lower-loss cable (LMR-400).
```

---

## Accessibility Notes

**All tooltips must:**
- Be associated with form fields via `aria-describedby`
- Be keyboard-accessible (visible on focus)
- Have sufficient color contrast (4.5:1 minimum)
- Not rely solely on color to convey meaning
- Work with screen readers

**Implementation:**
```html
<label for="tx-power">TX Power (dBm)</label>
<input
  id="tx-power"
  type="number"
  aria-describedby="tx-power-help"
/>
<span id="tx-power-help" class="tooltip">
  Transmission power in dBm (0-30). Higher = longer range but more battery drain.
</span>
```

---

## Update History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-07 | 1.0 | Initial tooltip content creation |

---

**For implementation questions, see:**
- W4 (Frontend) for tooltip component integration
- `docs/USERGUIDE.md` for user-facing documentation
- WCAG 2.2 AA guidelines for accessibility requirements

---

*Prepared by: W5 (QA, Accessibility & Documentation)*
*For: W4 Frontend Implementation*
*Task: 20.4 - Tooltip content for wizard fields*
