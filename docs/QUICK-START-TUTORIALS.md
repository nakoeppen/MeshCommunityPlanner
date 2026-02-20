# Quick Start Tutorials

Step-by-step guides for common tasks in Mesh Community Planner.

---

## Tutorial 1: Your First Plan

**Goal:** Create a simple 3-node mesh network from scratch.

### Step 1: Create a New Plan

1. Click **New Plan** in the toolbar
2. Name: "My First Mesh"
3. Firmware: **Meshtastic**
4. Region: **US FCC** (or your region)
5. Click **Create**

### Step 2: Place Your First Node

1. Click **Add Node** (or press `Insert`)
2. Click on the map where you want to place the node
3. The **Node Configuration Wizard** opens:

   - **Basic Info:** Name it "Gateway", set antenna height to 10 meters
   - **Device:** Choose **T-Beam** (a popular Meshtastic device)
   - **Radio:** Defaults are fine (915 MHz, 22 dBm, Long/Fast modem preset)
   - **Antenna:** Default 915 MHz 3 dBi omnidirectional
   - **Power:** Battery powered

4. Click **Done**

The node appears on the map with a green FSPL coverage circle.

### Step 3: Place Two More Nodes

Repeat Step 2 twice:

- **Node 2:** Name "Relay", place it 5-10 km from Gateway, choose **Heltec V3**
- **Node 3:** Name "Client", place it between Gateway and Relay, choose **RAK19007**

### Step 4: View the Network

1. You now have 3 nodes on the map with overlapping coverage circles
2. Click **Topology** in the toolbar to see the network graph
3. All 3 nodes should be connected with links

You have created your first mesh network plan.

### Next Steps

- Run terrain propagation for accurate coverage (Tutorial 2)
- Generate a bill of materials (Tutorial 3)
- Export your plan to share with others

---

## Tutorial 2: Running Propagation Analysis

**Goal:** Get accurate terrain-aware coverage predictions.

**Prerequisite:** A plan with at least one node placed (see Tutorial 1).

### Step 1: Understand FSPL vs. Terrain Propagation

The green circles around your nodes are **FSPL (Free-Space Path Loss)** estimates — they assume flat earth. For real-world accuracy, you need terrain-aware propagation that accounts for hills and valleys.

### Step 2: Run Terrain Propagation

1. Click **Run Propagation** in the toolbar
2. Select **Signal-Server (Terrain-Aware)**
3. Click **Run**

### Step 3: Wait for Terrain Data

On first run, SRTM terrain tiles download automatically:

- Small area (10 km): ~30 seconds
- Large area (100 km): ~2-5 minutes
- After first download, data is cached locally

### Step 4: View Results

A coverage overlay appears on the map:

- **Green:** Strong signal (-80 dBm or better)
- **Yellow:** Marginal signal (-80 to -100 dBm)
- **Red:** Weak signal (-100 to -120 dBm)

Notice the coverage is no longer circular — it follows the terrain. Hills block signals, while elevated nodes get extended range.

### Step 5: Adjust if Needed

If coverage is insufficient:

- **Increase antenna height:** Edit the node, change antenna height from 10m to 20m, re-run propagation
- **Increase transmit power:** Edit the node, increase TX power (within regulatory limits)
- **Add a relay node:** Place a new node on high ground to bridge coverage gaps

### Step 6: Check Line-of-Sight

1. Click on a node
2. In the details panel, view terrain profiles to neighboring nodes
3. The elevation profile shows ground level, radio path, and Fresnel zone clearance
4. Green Fresnel zone = clear path; red = obstruction

---

## Tutorial 3: Generating a Bill of Materials

**Goal:** Create a hardware shopping list for your mesh network.

**Prerequisite:** A plan with configured nodes (see Tutorial 1).

### Step 1: Open the BOM View

Click **BOM** in the toolbar (or press `Ctrl+B`).

### Step 2: Review the BOM Table

The table shows all hardware aggregated from your plan:

| Component | Quantity | Unit Cost | Total Cost |
|-----------|----------|-----------|------------|
| T-Beam 915 MHz | 1 | $35.00 | $35.00 |
| Heltec V3 915 MHz | 1 | $20.00 | $20.00 |
| RAK19007 915 MHz | 1 | $25.00 | $25.00 |
| 915 MHz 3 dBi Omni Antenna | 3 | $12.00 | $36.00 |
| 18650 Battery (3000 mAh) | 3 | $5.00 | $15.00 |
| **TOTAL** | | | **$131.00** |

Categories include devices, antennas, cables, power supplies, enclosures, and mounting hardware.

### Step 3: Export the BOM

**For purchasing:**
1. Click **Export CSV**
2. Open the CSV in a spreadsheet application
3. Add vendor links, adjust quantities, track your orders

**For documentation:**
1. Click **Export PDF**
2. The PDF includes plan summary, BOM table, node details, and cost breakdown

### Step 4: Export Deployment Cards

1. Click **Export Deployment Cards**
2. A PDF generates with one page per node
3. Each card shows the node's location, hardware specs, and installation notes
4. Print the cards and take them to the field for installation

### Tips

- **Ensure all nodes are fully configured** before generating the BOM — incomplete nodes will have missing items
- **Use templates** to standardize node configurations: configure one node, save as template, reuse for others
- Prices are estimates based on the built-in catalog. Verify current pricing with your preferred vendor.

---

## Common Tips

### Auto-Save

Your plan is automatically saved to the local database on every change. No manual save needed. To create a portable file for sharing, use **Export**.

### Templates

Save time by creating node templates:

1. Configure a node completely through the wizard
2. Select it and click **Save as Template**
3. When adding new nodes, select the template to pre-fill all settings
4. Only change the name and antenna height per site

### Offline Use

After viewing an area online (map tiles cache) and running propagation once (terrain data caches), the app works fully offline. Plan field trips accordingly — view and cache your entire deployment area while online.

---

For detailed documentation, see the [User Guide](USER_GUIDE.md). For troubleshooting, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

**Version:** 1.1.0
**Last Updated:** February 2026
