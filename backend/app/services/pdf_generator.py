"""PDF generator for BOM reports and deployment cards.

Uses ReportLab for server-side PDF generation (design.md Decision 9).
No headless browser required.

Phase 13 task: 13.6.

Note: ReportLab is an optional dependency. When not installed, functions
raise ImportError with a clear message. All user-supplied text is rendered
as plain text — no markup interpretation.
"""

from __future__ import annotations

import io
import re
from typing import Optional

from backend.app.services.bom_generator import NetworkBOM, NodeBOM

# Pre-compiled regex for HTML tag stripping — avoids re-compilation per call
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _ensure_reportlab():
    """Ensure ReportLab is available."""
    try:
        import reportlab  # noqa: F401
        return True
    except ImportError:
        raise ImportError(
            "ReportLab is required for PDF generation. "
            "Install with: pip install reportlab"
        )


def _sanitize_text(text: str) -> str:
    """Sanitize text for PDF rendering — strip any markup/script tags.

    All text is rendered as plain text, never as HTML or markup.
    """
    clean = _HTML_TAG_RE.sub("", text)
    # Strip null bytes
    clean = clean.replace("\x00", "")
    return clean


def _generate_map_image(lat: float, lon: float, width: int = 300, height: int = 200, zoom: int = 15) -> Optional[bytes]:
    """Generate a static OSM map image with a marker at lat/lon.

    Returns PNG bytes or None if offline / tiles unavailable.
    """
    try:
        from staticmap import StaticMap, CircleMarker

        m = StaticMap(
            width, height,
            url_template="https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            headers={"User-Agent": "MeshCommunityPlanner/1.0"},
        )
        # White outline + red fill = pin-style marker
        m.add_marker(CircleMarker((lon, lat), "white", 18))
        m.add_marker(CircleMarker((lon, lat), "#E74C3C", 12))
        image = m.render(zoom=zoom)

        buf = io.BytesIO()
        image.save(buf, format="PNG")
        buf.seek(0)
        return buf.getvalue()
    except Exception:
        return None


def generate_bom_pdf(
    network_bom: NetworkBOM,
    node_coordinates: Optional[dict[str, tuple[float, float]]] = None,
) -> bytes:
    """Generate a formatted BOM PDF report.

    Structure:
    - Header with plan name and date
    - Per-node sections with item tables and coordinates
    - Network total summary
    - Price disclaimer footer

    Args:
        network_bom: The network-wide BOM data.
        node_coordinates: Dict of node_id -> (latitude, longitude).

    Returns:
        PDF file content as bytes.
    """
    if node_coordinates is None:
        node_coordinates = {}
    _ensure_reportlab()

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    elements = []

    # Title
    title_style = ParagraphStyle(
        "BOMTitle",
        parent=styles["Title"],
        fontSize=18,
        spaceAfter=12,
    )
    elements.append(Paragraph(
        _sanitize_text(f"Bill of Materials — {network_bom.plan_name}"),
        title_style,
    ))
    elements.append(Spacer(1, 12))

    # Summary
    summary_text = (
        f"Total nodes: {network_bom.total_nodes} | "
        f"Estimated total cost: ${network_bom.total_cost_usd:.2f} (USD)"
    )
    elements.append(Paragraph(summary_text, styles["Normal"]))
    elements.append(Spacer(1, 18))

    # Category labels for "Category: Name" format
    _cat_labels = {
        "device": "Device", "antenna": "Antenna", "cable": "Cable",
        "connector": "Connector", "pa_module": "PA Module", "battery": "Battery",
        "solar": "Solar Panel", "bec": "BEC", "controller": "Charge Controller",
        "enclosure": "Enclosure", "mast": "Mast", "misc": "Hardware",
    }

    desc_style = ParagraphStyle(
        "ItemDesc", parent=styles["Normal"], fontSize=8, textColor=colors.grey,
        leading=10,
    )

    # Per-node sections
    for nbom in network_bom.node_boms:
        # Node header
        node_header = ParagraphStyle(
            f"NodeHeader_{nbom.node_id}",
            parent=styles["Heading2"],
            fontSize=14,
            spaceBefore=12,
            spaceAfter=6,
        )
        elements.append(Paragraph(
            _sanitize_text(f"Node: {nbom.node_name}"),
            node_header,
        ))

        # GPS coordinates
        coords = node_coordinates.get(nbom.node_id)
        if coords:
            coord_style = ParagraphStyle(
                f"BOMCoord_{nbom.node_id}", parent=styles["Normal"],
                fontSize=9, textColor=colors.HexColor("#555555"),
            )
            elements.append(Paragraph(
                f"Location: {coords[0]:.6f}, {coords[1]:.6f}",
                coord_style,
            ))

        # Item table with "Category: Name" and specs on second line
        if nbom.items:
            table_data = [["Item", "Specifications", "Qty", "Unit (USD)", "Total (USD)"]]
            for item in nbom.items:
                cat_label = _cat_labels.get(item.category, item.category.title())
                item_cell = f"{cat_label}: {_sanitize_text(item.name)}"
                desc_text = _sanitize_text(item.description) if item.description else "—"
                table_data.append([
                    Paragraph(item_cell, styles["Normal"]),
                    Paragraph(desc_text, desc_style),
                    str(item.quantity),
                    f"${item.unit_price_usd:.2f}" if item.unit_price_usd is not None else "—",
                    f"${item.total_price_usd:.2f}" if item.total_price_usd is not None else "—",
                ])

            # Node total row
            table_data.append([
                "Subtotal", "", "", "",
                f"${nbom.total_cost_usd:.2f}",
            ])

            table = Table(table_data, colWidths=[2 * inch, 2.3 * inch, 0.4 * inch, 1 * inch, 1.1 * inch])
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4472C4")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("FONTSIZE", (0, 1), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E8E8E8")),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#F5F5F5")]),
            ]))
            elements.append(table)

        elements.append(Spacer(1, 12))

    # Disclaimers
    elements.append(Spacer(1, 24))
    disc_style = ParagraphStyle(
        "Disclaimer", parent=styles["Normal"], fontSize=7.5, textColor=colors.grey, leading=10,
    )
    elements.append(Paragraph(
        "All prices shown are estimates in USD based on typical retail pricing and may vary. "
        "Verify current pricing with suppliers before purchasing.",
        disc_style,
    ))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        "Antenna masts and outdoor installations must be properly grounded per local electrical codes. "
        "Lightning protection is recommended for all outdoor antenna installations.",
        disc_style,
    ))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        "This document is provided for planning purposes only. The user assumes all responsibility for "
        "electronics installation, electrical wiring, device assembly, and structural modifications. "
        "The software and its developers assume no liability for damage, injury, or loss resulting "
        "from the use of this tool's output.",
        disc_style,
    ))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "Generated by Mesh Community Planner",
        disc_style,
    ))

    doc.build(elements)
    return buffer.getvalue()


def generate_network_report_pdf(
    plan_name: str = "Untitled Plan",
    plan_description: str = "",
    nodes: Optional[list[dict]] = None,
    links: Optional[list[dict]] = None,
    map_screenshot_bytes: Optional[bytes] = None,
    include_executive_summary: bool = True,
    include_bom_summary: bool = True,
    include_recommendations: bool = True,
    coverage_data: Optional[dict] = None,
    bom_summary: Optional[dict] = None,
    page_size: str = "letter",
    sections: Optional[list[str]] = None,
) -> bytes:
    """Generate a multi-page network report PDF.

    Sections:
    - Executive summary (network health overview)
    - Cover & network overview (with optional map screenshot)
    - Node details table
    - Link analysis table
    - Coverage statistics
    - BOM summary
    - Recommendations

    Args:
        plan_name: Name of the plan.
        plan_description: Optional description text.
        nodes: List of node dicts (from NetworkReportNodeInput).
        links: List of link dicts (from NetworkReportLinkInput).
        map_screenshot_bytes: Optional JPEG bytes for the map image.
        include_executive_summary: Include executive summary page.
        include_bom_summary: Include BOM summary section.
        include_recommendations: Include recommendations section.
        coverage_data: Coverage statistics dict (coverage_pct, avg_signal, etc.).
        bom_summary: BOM summary dict (total_cost, item_count, etc.).
        page_size: Page size ("letter" or "A4").
        sections: Optional list of section names to include.

    Returns:
        PDF file content as bytes.
    """
    _ensure_reportlab()

    from datetime import datetime

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        Image,
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    if nodes is None:
        nodes = []
    if links is None:
        links = []

    # Determine which sections to include
    _all_sections = {"executive_summary", "map", "nodes", "links", "coverage", "bom", "recommendations"}
    if sections:
        active_sections = set(sections)
    else:
        active_sections = set(_all_sections)
        if not include_executive_summary:
            active_sections.discard("executive_summary")
        if not include_bom_summary:
            active_sections.discard("bom")
        if not include_recommendations:
            active_sections.discard("recommendations")

    BLUE = colors.HexColor("#4472C4")
    ALT_ROW = colors.HexColor("#F5F5F5")

    # Link quality colors (matching LinkReportModal CSS)
    CLR_STRONG = colors.HexColor("#2ecc71")
    CLR_MARGINAL = colors.HexColor("#f1c40f")
    CLR_NLOS = colors.HexColor("#e67e22")
    CLR_NONVIABLE = colors.HexColor("#e74c3c")

    page = A4 if page_size == "A4" else letter

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    elements: list = []

    def _footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.grey)
        canvas.drawCentredString(
            letter[0] / 2,
            0.4 * inch,
            f"Page {doc.page} — Generated by Mesh Community Planner",
        )
        canvas.restoreState()

    # === PAGE 1: Cover & Network Overview ===
    title_style = ParagraphStyle(
        "ReportTitle", parent=styles["Title"], fontSize=20, spaceAfter=12,
    )
    elements.append(
        Paragraph(_sanitize_text(f"Network Report — {plan_name}"), title_style)
    )
    elements.append(Spacer(1, 6))
    elements.append(
        Paragraph(
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            styles["Normal"],
        )
    )
    elements.append(Spacer(1, 12))

    if plan_description:
        elements.append(Paragraph(_sanitize_text(plan_description), styles["Normal"]))
        elements.append(Spacer(1, 12))

    # Map screenshot
    if map_screenshot_bytes:
        try:
            img_buf = io.BytesIO(map_screenshot_bytes)
            img = Image(img_buf, width=6.5 * inch, height=4.0 * inch, kind="proportional")
            elements.append(img)
            elements.append(Spacer(1, 12))
        except Exception:
            pass  # skip image on error

    # Summary stats
    viable_links = sum(1 for l in links if l.get("isViable"))
    obstructed = sum(1 for l in links if not l.get("hasLos", True))
    summary = (
        f"Nodes: {len(nodes)} | Links: {len(links)} | "
        f"Viable links: {viable_links} | Obstructed links: {obstructed}"
    )
    elements.append(Paragraph(summary, styles["Normal"]))

    # === Executive Summary ===
    if "executive_summary" in active_sections:
        elements.append(Spacer(1, 18))
        exec_style = ParagraphStyle(
            "ExecTitle", parent=styles["Heading2"], fontSize=14, spaceAfter=8,
        )
        elements.append(Paragraph("Executive Summary", exec_style))

        # Network health assessment
        if len(nodes) == 0:
            health = "No nodes configured."
        elif viable_links == 0 and len(links) > 0:
            health = "Critical — no viable links. Nodes cannot communicate."
        elif obstructed > len(links) * 0.5:
            health = "Poor — majority of links are terrain-obstructed."
        elif viable_links < len(links) * 0.5:
            health = "Fair — less than half of links are viable."
        elif viable_links == len(links):
            health = "Excellent — all links are viable with clear line of sight."
        else:
            health = "Good — most links are viable."

        exec_items = [
            ("Network Health", health),
            ("Total Nodes", str(len(nodes))),
            ("Total Links Analyzed", str(len(links))),
            ("Viable Links", f"{viable_links} ({(viable_links / max(len(links), 1) * 100):.0f}%)"),
            ("Obstructed Links", str(obstructed)),
        ]

        # Radio config from first node
        if nodes:
            n0 = nodes[0]
            radio = (
                f"SF{n0.get('spreading_factor', 11)}/BW{n0.get('bandwidth_khz', 250)}/"
                f"CR{n0.get('coding_rate', '4/5')} @ {n0.get('frequency_mhz', 906.875)} MHz"
            )
            exec_items.append(("Radio Configuration", radio))
            exec_items.append(("Firmware", n0.get("firmware", "N/A")))

        for label, val in exec_items:
            elements.append(Paragraph(f"<b>{label}:</b> {val}", styles["Normal"]))
            elements.append(Spacer(1, 2))

    # === PAGE 2+: Node Details ===
    elements.append(PageBreak())
    section_style = ParagraphStyle(
        "SectionTitle", parent=styles["Heading2"], fontSize=16, spaceAfter=10,
    )
    elements.append(Paragraph("Node Details", section_style))
    elements.append(Spacer(1, 6))

    if nodes:
        cell_style = ParagraphStyle(
            "CellText", parent=styles["Normal"], fontSize=7, leading=9,
        )
        header = ["Name", "Lat/Lon", "Device", "Firmware", "Freq", "TX", "SF/BW/CR", "Height", "Solar"]
        table_data = [header]
        for n in nodes:
            lat_lon = f"{n.get('latitude', 0):.4f}, {n.get('longitude', 0):.4f}"
            freq = f"{n.get('frequency_mhz', 906.875):.1f}"
            tx = f"{n.get('tx_power_dbm', 20)} dBm"
            sf_bw_cr = (
                f"SF{n.get('spreading_factor', 11)}/"
                f"{n.get('bandwidth_khz', 250)}/"
                f"{n.get('coding_rate', '4/5')}"
            )
            height = f"{n.get('antenna_height_m', 2.0)}m"
            solar = "Yes" if n.get("is_solar") else "No"
            table_data.append([
                Paragraph(_sanitize_text(n.get("name", "")), cell_style),
                lat_lon,
                _sanitize_text(n.get("device_id", "")),
                _sanitize_text(n.get("firmware", "")),
                freq,
                tx,
                sf_bw_cr,
                height,
                solar,
            ])

        col_widths = [1.1 * inch, 1.0 * inch, 0.8 * inch, 0.7 * inch, 0.55 * inch, 0.55 * inch, 0.8 * inch, 0.5 * inch, 0.4 * inch]
        tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
        tbl_style = [
            ("BACKGROUND", (0, 0), (-1, 0), BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("FONTSIZE", (0, 1), (-1, -1), 7),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ALT_ROW]),
        ]
        tbl.setStyle(TableStyle(tbl_style))
        elements.append(tbl)
    else:
        elements.append(Paragraph("No nodes in this plan.", styles["Normal"]))

    # === PAGE 3+: Link Analysis ===
    elements.append(PageBreak())
    elements.append(Paragraph("Link Analysis", section_style))
    elements.append(Spacer(1, 6))

    if links:
        viable = sum(1 for l in links if l.get("isViable"))
        obs = sum(1 for l in links if not l.get("hasLos", True))
        elements.append(
            Paragraph(
                f"{len(links)} links, {viable} viable, {obs} obstructed",
                styles["Normal"],
            )
        )
        elements.append(Spacer(1, 6))

        # Sort: non-viable → NLOS → marginal → strong
        def _sort_key(l: dict) -> int:
            if not l.get("isViable"):
                return 0
            if not l.get("hasLos", True):
                return 1
            if l.get("linkQuality") == "marginal":
                return 2
            return 3

        sorted_links = sorted(links, key=_sort_key)

        link_cell_style = ParagraphStyle(
            "LinkCell", parent=styles["Normal"], fontSize=7, leading=9,
        )

        # Column indices: 0=Link, 1=Quality, 2=Distance, 3=Margin,
        #   4=Rx, 5=Fresnel%, 6=Obstruct, 7=PathLoss, 8=Terrain
        lheader = ["Link", "Quality", "Distance", "Margin", "Rx (dBm)", "Fresnel %", "Obstruct", "Path Loss", "Terrain"]
        link_data = [lheader]
        row_colors: list[list[tuple]] = []  # per-row TEXTCOLOR style commands

        for row_idx, l in enumerate(sorted_links):
            row = row_idx + 1  # +1 for header row
            name = f"{l.get('nodeAName', '')} ↔ {l.get('nodeBName', '')}"

            # Quality label + color
            if not l.get("isViable"):
                q, q_clr = "Not Viable", CLR_NONVIABLE
            elif not l.get("hasLos", True):
                q, q_clr = "NLOS", CLR_NLOS
            elif l.get("linkQuality") == "marginal":
                q, q_clr = "Marginal", CLR_MARGINAL
            else:
                q, q_clr = "Strong", CLR_STRONG

            # Margin color: >=10 good, >=3 warn, <3 bad
            margin_db = l.get("linkMarginDb", 0)
            margin = f"{margin_db:+.1f} dB"
            if margin_db >= 10:
                m_clr = CLR_STRONG
            elif margin_db >= 3:
                m_clr = CLR_MARGINAL
            else:
                m_clr = CLR_NONVIABLE

            # Fresnel color: >=60 good, >=20 warn, <20 bad
            fresnel_pct = l.get("fresnelClearancePct", 0)
            fresnel = f"{fresnel_pct:.0f}%"
            if fresnel_pct >= 60:
                f_clr = CLR_STRONG
            elif fresnel_pct >= 20:
                f_clr = CLR_MARGINAL
            else:
                f_clr = CLR_NONVIABLE

            dist_m = l.get("distanceM", 0)
            dist = f"{dist_m / 1000:.2f} km" if dist_m >= 1000 else f"{int(dist_m)} m"
            rx = f"{l.get('receivedSignalDbm', 0):.1f}"
            obs_m = l.get("maxObstructionM", 0)
            obstruct = f"{obs_m:.1f}m" if not l.get("hasLos", True) and obs_m > 0 else "--"
            ploss = f"{l.get('totalPathLossDb', 0):.1f} dB"
            terrain = _sanitize_text(l.get("elevationSource", "flat_terrain"))

            link_data.append([
                Paragraph(_sanitize_text(name), link_cell_style),
                q, dist, margin, rx, fresnel, obstruct, ploss, terrain,
            ])

            # Collect per-cell text color overrides for this row
            row_colors.append([
                ("TEXTCOLOR", (1, row), (1, row), q_clr),      # Quality
                ("TEXTCOLOR", (3, row), (3, row), m_clr),      # Margin
                ("TEXTCOLOR", (5, row), (5, row), f_clr),      # Fresnel %
            ])

        lcol_widths = [1.3 * inch, 0.6 * inch, 0.6 * inch, 0.6 * inch, 0.55 * inch, 0.5 * inch, 0.55 * inch, 0.6 * inch, 0.65 * inch]
        ltbl = Table(link_data, colWidths=lcol_widths, repeatRows=1)
        base_style = [
            ("BACKGROUND", (0, 0), (-1, 0), BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("FONTSIZE", (0, 1), (-1, -1), 7),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ALT_ROW]),
        ]
        # Flatten per-row color overrides into the style list
        for rc in row_colors:
            base_style.extend(rc)
        ltbl.setStyle(TableStyle(base_style))
        elements.append(ltbl)
    else:
        elements.append(
            Paragraph(
                "No link analysis data. Run Line of Sight analysis first.",
                styles["Normal"],
            )
        )

    # === Coverage Statistics ===
    if "coverage" in active_sections and coverage_data:
        elements.append(PageBreak())
        elements.append(Paragraph("Coverage Statistics", section_style))
        elements.append(Spacer(1, 6))
        cov_items = [
            ("Coverage Area", f"{coverage_data.get('coverage_pct', 0):.1f}%"),
            ("Average Signal", f"{coverage_data.get('avg_signal', 0):.1f} dBm"),
            ("Environment", coverage_data.get("environment", "N/A")),
            ("Nodes with Coverage", str(coverage_data.get("nodes_with_coverage", len(nodes)))),
        ]
        for label, val in cov_items:
            elements.append(Paragraph(f"<b>{label}:</b> {val}", styles["Normal"]))
            elements.append(Spacer(1, 3))

    # === BOM Summary ===
    if "bom" in active_sections and bom_summary:
        elements.append(PageBreak())
        elements.append(Paragraph("Bill of Materials Summary", section_style))
        elements.append(Spacer(1, 6))
        total_cost = bom_summary.get("total_cost", 0)
        item_count = bom_summary.get("item_count", 0)
        elements.append(
            Paragraph(
                f"Estimated Total Cost: <b>${total_cost:.2f} USD</b> | "
                f"Total Items: <b>{item_count}</b>",
                styles["Normal"],
            )
        )
        elements.append(Spacer(1, 6))
        # List consolidated items if available
        consolidated = bom_summary.get("consolidated_items", [])
        if consolidated:
            bom_data = [["Item", "Category", "Qty", "Unit ($)", "Total ($)"]]
            for item in consolidated:
                bom_data.append([
                    _sanitize_text(str(item.get("name", ""))),
                    _sanitize_text(str(item.get("category", ""))),
                    str(item.get("quantity", 1)),
                    f"${item.get('unit_price_usd', 0):.2f}",
                    f"${item.get('total_price_usd', 0):.2f}",
                ])
            bom_tbl = Table(bom_data, colWidths=[2.5 * inch, 1.0 * inch, 0.5 * inch, 0.8 * inch, 0.8 * inch])
            bom_tbl.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), BLUE),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ALT_ROW]),
                ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
            ]))
            elements.append(bom_tbl)
    elif "bom" in active_sections:
        elements.append(PageBreak())
        elements.append(Paragraph("Bill of Materials", section_style))
        elements.append(Spacer(1, 6))
        elements.append(
            Paragraph(
                "BOM data not included in this report. "
                "Generate a BOM from Tools > Export Material List.",
                styles["Normal"],
            )
        )

    # === Recommendations ===
    if "recommendations" in active_sections:
        elements.append(PageBreak())
        elements.append(Paragraph("Recommendations", section_style))
        elements.append(Spacer(1, 6))

        recs: list[str] = []
        if len(nodes) < 3:
            recs.append("Consider adding more nodes for better mesh redundancy (minimum 3 recommended).")
        if links:
            non_viable = sum(1 for l in links if not l.get("isViable"))
            if non_viable > 0:
                recs.append(
                    f"{non_viable} link(s) are not viable. Consider adjusting antenna heights, "
                    "repositioning nodes, or using higher-gain antennas."
                )
            obstructed = sum(1 for l in links if not l.get("hasLos", True))
            if obstructed > 0:
                recs.append(
                    f"{obstructed} link(s) have terrain obstructions. Raising antenna height "
                    "or relocating nodes to higher ground may improve connectivity."
                )
            weak = sum(1 for l in links if l.get("linkMarginDb", 0) < 6 and l.get("isViable"))
            if weak > 0:
                recs.append(
                    f"{weak} link(s) have low link margin (<6 dB). These links may be unreliable "
                    "in adverse weather. Consider adding relay nodes."
                )
        else:
            recs.append("Run Line of Sight analysis to evaluate link quality between nodes.")

        solar_count = sum(1 for n in nodes if n.get("is_solar"))
        if solar_count == 0 and len(nodes) > 0:
            recs.append("No nodes are solar-powered. Consider solar for remote or hard-to-access locations.")

        if not recs:
            recs.append("Network configuration looks good. No critical issues detected.")

        for i, rec in enumerate(recs, 1):
            elements.append(Paragraph(f"{i}. {rec}", styles["Normal"]))
            elements.append(Spacer(1, 4))

    doc.build(elements, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()


def generate_deployment_cards_pdf(
    network_bom: NetworkBOM,
    node_coordinates: Optional[dict[str, tuple[float, float]]] = None,
    node_radio_config: Optional[dict[str, dict]] = None,
) -> bytes:
    """Generate deployment cards PDF — one page per node.

    Each page contains:
    - Node name and ID
    - GPS coordinates
    - Hardware checklist (BOM items as checkboxes)
    - Power wiring summary
    - Network overview (on first page)

    Args:
        network_bom: The network-wide BOM data.
        node_coordinates: Dict of node_id → (latitude, longitude).

    Returns:
        PDF file content as bytes.
    """
    _ensure_reportlab()

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        Image as RLImage,
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    if node_coordinates is None:
        node_coordinates = {}
    if node_radio_config is None:
        node_radio_config = {}

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    elements = []

    # Network overview page
    title_style = ParagraphStyle(
        "DeployTitle",
        parent=styles["Title"],
        fontSize=20,
        spaceAfter=12,
    )
    elements.append(Paragraph(
        _sanitize_text(f"Deployment Cards — {network_bom.plan_name}"),
        title_style,
    ))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(
        f"Total nodes: {network_bom.total_nodes}",
        styles["Normal"],
    ))
    elements.append(Spacer(1, 6))

    # Node list summary
    for nbom in network_bom.node_boms:
        coords = node_coordinates.get(nbom.node_id)
        coord_str = f" ({coords[0]:.6f}, {coords[1]:.6f})" if coords else ""
        elements.append(Paragraph(
            _sanitize_text(f"  - {nbom.node_name}{coord_str}"),
            styles["Normal"],
        ))

    # Category labels for "Category: Name" format
    _cat_labels = {
        "device": "Device", "antenna": "Antenna", "cable": "Cable",
        "connector": "Connector", "pa_module": "PA Module", "battery": "Battery",
        "solar": "Solar Panel", "bec": "BEC", "controller": "Charge Controller",
        "enclosure": "Enclosure", "mast": "Mast", "misc": "Hardware",
    }

    spec_style = ParagraphStyle(
        "SpecDetail", parent=styles["Normal"], fontSize=8, textColor=colors.grey,
        leftIndent=24, leading=10,
    )
    note_style = ParagraphStyle(
        "CardNote", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#555555"),
        spaceBefore=4, leftIndent=24,
    )

    # Per-node deployment cards
    for nbom in network_bom.node_boms:
        elements.append(PageBreak())

        # Node header
        header_style = ParagraphStyle(
            f"CardHeader_{nbom.node_id}",
            parent=styles["Title"],
            fontSize=16,
            spaceAfter=6,
        )
        elements.append(Paragraph(
            _sanitize_text(f"Deployment Card: {nbom.node_name}"),
            header_style,
        ))
        elements.append(Spacer(1, 6))

        # GPS Coordinates and map image
        coords = node_coordinates.get(nbom.node_id)
        if coords:
            elements.append(Paragraph(
                f"GPS: {coords[0]:.6f}, {coords[1]:.6f}",
                ParagraphStyle("GPS", parent=styles["Normal"], fontSize=12, fontName="Helvetica-Bold"),
            ))
            elements.append(Spacer(1, 6))

            # Static map image from OpenStreetMap
            map_bytes = _generate_map_image(coords[0], coords[1])
            if map_bytes:
                map_img = RLImage(io.BytesIO(map_bytes), width=3 * inch, height=2 * inch)
                elements.append(map_img)
                elements.append(Paragraph(
                    "Map data \u00A9 OpenStreetMap contributors",
                    ParagraphStyle("MapAttrib", parent=styles["Normal"],
                                   fontSize=6, textColor=colors.grey),
                ))
        elements.append(Spacer(1, 12))

        # Radio Configuration section
        radio = node_radio_config.get(nbom.node_id)
        if radio and any(radio.get(k) for k in ("frequency_mhz", "tx_power_dbm", "spreading_factor")):
            elements.append(Paragraph("Radio Configuration:", styles["Heading3"]))
            elements.append(Spacer(1, 4))

            radio_rows = []
            if radio.get("modem_preset"):
                radio_rows.append(("Modem Preset", str(radio["modem_preset"])))
            if radio.get("frequency_mhz"):
                radio_rows.append(("Frequency", f"{radio['frequency_mhz']} MHz"))
            if radio.get("tx_power_dbm") is not None:
                radio_rows.append(("TX Power", f"{radio['tx_power_dbm']} dBm"))
            if radio.get("spreading_factor"):
                radio_rows.append(("Spreading Factor", f"SF{radio['spreading_factor']}"))
            if radio.get("bandwidth_khz"):
                radio_rows.append(("Bandwidth", f"{radio['bandwidth_khz']} kHz"))
            if radio.get("coding_rate"):
                radio_rows.append(("Coding Rate", str(radio["coding_rate"])))
            if radio.get("region"):
                radio_rows.append(("Region", str(radio["region"]).upper()))
            if radio.get("firmware"):
                radio_rows.append(("Firmware", str(radio["firmware"]).title()))
            if radio.get("antenna_height_m") is not None:
                radio_rows.append(("Antenna Height", f"{radio['antenna_height_m']} m"))

            if radio_rows:
                radio_table = Table(
                    radio_rows,
                    colWidths=[1.5 * inch, 2.5 * inch],
                    hAlign="LEFT",
                )
                radio_table.setStyle(TableStyle([
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#333333")),
                    ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#555555")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#DDDDDD")),
                ]))
                elements.append(radio_table)
            elements.append(Spacer(1, 12))

        # Antenna height mounting note
        antenna_items = [i for i in nbom.items if i.category == "antenna"]
        if antenna_items:
            # Get height from catalog_data if available
            height_note = ("This device's antenna must be mounted at the configured height above ground. "
                           "A suitable mast, pole, rooftop mount, or elevated mounting point may be required.")
            elements.append(Paragraph(
                f"\u26A0 {height_note}",
                ParagraphStyle("HeightNote", parent=styles["Normal"], fontSize=9,
                               textColor=colors.HexColor("#CC6600"), spaceBefore=0, spaceAfter=8),
            ))

        # Hardware checklist with "Category: Name" format and specs
        elements.append(Paragraph("Hardware Checklist:", styles["Heading3"]))
        elements.append(Spacer(1, 6))

        for item in nbom.items:
            cat_label = _cat_labels.get(item.category, item.category.title())
            checkbox_text = f"\u2610  {cat_label}: {_sanitize_text(item.name)}"
            if item.quantity > 1:
                checkbox_text += f" (x{item.quantity})"
            elements.append(Paragraph(checkbox_text, styles["Normal"]))
            # Specs on second line
            if item.description:
                elements.append(Paragraph(_sanitize_text(item.description), spec_style))

        elements.append(Spacer(1, 12))

        # Power wiring section
        power_items = [i for i in nbom.items if i.category in ("battery", "solar", "bec", "controller")]
        if power_items:
            elements.append(Paragraph("Power Wiring:", styles["Heading3"]))
            elements.append(Spacer(1, 6))
            for item in power_items:
                cat_label = _cat_labels.get(item.category, item.category.title())
                elements.append(Paragraph(
                    f"  - {cat_label}: {_sanitize_text(item.name)}",
                    styles["Normal"],
                ))
                if item.description:
                    elements.append(Paragraph(
                        f"    {_sanitize_text(item.description)}",
                        spec_style,
                    ))

        # Mast grounding note
        mast_items = [i for i in nbom.items if i.category in ("mast", "enclosure")]
        if mast_items:
            elements.append(Spacer(1, 8))
            elements.append(Paragraph(
                "\u26A1 Antenna masts must be properly grounded per local electrical codes. "
                "Lightning protection is recommended for all outdoor antenna installations.",
                note_style,
            ))

        # Per-card disclaimer
        elements.append(Spacer(1, 16))
        disc_style = ParagraphStyle(
            "CardDisclaimer", parent=styles["Normal"], fontSize=7, textColor=colors.grey, leading=9,
        )
        elements.append(Paragraph(
            "All prices are estimates in USD. This document is for planning purposes only. "
            "The user assumes all responsibility for electronics installation, wiring, device assembly, "
            "and structural modifications. The software and its developers assume no liability for "
            "damage, injury, or loss resulting from the use of this tool's output.",
            disc_style,
        ))

    doc.build(elements)
    return buffer.getvalue()
