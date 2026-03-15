"""Signal Import API — parse CSV files containing RSSI/SNR observations.

POST /api/signal-import/parse
    Accepts a multipart/form-data CSV upload.
    Auto-detects column names for node identifiers, RSSI, SNR, timestamp.
    Returns structured JSON with parsed rows, skip reasons, and column detection info.
    Does NOT persist anything — parse-and-return only.

Accepted CSV formats:
  Format 1 (Meshtastic): from, to, snr, rssi, timestamp
  Format 2 (generic):    node_a, node_b, rssi_dbm, snr_db
  Format 3 (minimal):    from_node, to_node, rssi
"""

from __future__ import annotations

import csv
import io
import logging
import re
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_ROWS = 500

# Column detection patterns (case-insensitive, matched against header names)
_COL_NODE_A = re.compile(r"^(from|node_a|source|from_node)$", re.IGNORECASE)
_COL_NODE_B = re.compile(r"^(to|node_b|dest|to_node)$", re.IGNORECASE)
_COL_RSSI = re.compile(r"rssi", re.IGNORECASE)
_COL_SNR = re.compile(r"snr", re.IGNORECASE)
_COL_TIMESTAMP = re.compile(r"^(time|timestamp|ts)$", re.IGNORECASE)

RSSI_MIN = -140.0
RSSI_MAX = 0.0
SNR_MIN = -20.0
SNR_MAX = 20.0


def _detect_columns(headers: list[str]) -> dict[str, str | None]:
    """Return a map of logical column names to the first matching CSV header.

    Keys: node_a, node_b, rssi, snr, timestamp.
    Values are the actual CSV header strings, or None if not found.
    """
    detected: dict[str, str | None] = {
        "node_a": None,
        "node_b": None,
        "rssi": None,
        "snr": None,
        "timestamp": None,
    }
    for h in headers:
        h_stripped = h.strip()
        if detected["node_a"] is None and _COL_NODE_A.match(h_stripped):
            detected["node_a"] = h_stripped
        elif detected["node_b"] is None and _COL_NODE_B.match(h_stripped):
            detected["node_b"] = h_stripped
        if detected["rssi"] is None and _COL_RSSI.search(h_stripped):
            detected["rssi"] = h_stripped
        if detected["snr"] is None and _COL_SNR.search(h_stripped):
            detected["snr"] = h_stripped
        if detected["timestamp"] is None and _COL_TIMESTAMP.match(h_stripped):
            detected["timestamp"] = h_stripped
    return detected


def _parse_float(value: str | None) -> float | None:
    """Parse a string to float, returning None on failure."""
    if value is None:
        return None
    try:
        return float(value.strip())
    except (ValueError, AttributeError):
        return None


def _parse_csv(content: str) -> dict[str, Any]:
    """Parse CSV content and return structured result.

    Returns:
        {
            "rows": [...],
            "total_parsed": int,
            "skipped": int,
            "skip_reasons": [...],
            "columns_detected": {...},
        }
    """
    try:
        reader = csv.DictReader(io.StringIO(content))
        headers = reader.fieldnames or []
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"CSV parse error: {exc}") from exc

    if not headers:
        return {
            "rows": [],
            "total_parsed": 0,
            "skipped": 0,
            "skip_reasons": [],
            "columns_detected": {"node_a": None, "node_b": None, "rssi": None, "snr": None, "timestamp": None},
        }

    cols = _detect_columns(list(headers))

    if cols["node_a"] is None or cols["node_b"] is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not detect node identifier columns. "
                "Expected headers matching: from/node_a/source/from_node and to/node_b/dest/to_node."
            ),
        )

    if cols["rssi"] is None:
        raise HTTPException(
            status_code=422,
            detail="Could not detect an RSSI column. Expected a header containing 'rssi'.",
        )

    rows: list[dict[str, Any]] = []
    skip_reasons: list[str] = []
    total_raw = 0
    truncated = False

    try:
        all_rows = list(reader)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"CSV read error: {exc}") from exc

    total_raw = len(all_rows)

    for row_num, raw in enumerate(all_rows, start=2):  # row 1 = header
        # Truncate at MAX_ROWS accepted rows
        if len(rows) >= MAX_ROWS:
            truncated = True
            break

        node_a_val = (raw.get(cols["node_a"]) or "").strip()
        node_b_val = (raw.get(cols["node_b"]) or "").strip()

        # Skip rows with empty node names
        if not node_a_val or not node_b_val:
            skip_reasons.append(f"Row {row_num}: empty node name")
            continue

        rssi_raw = raw.get(cols["rssi"])
        rssi = _parse_float(rssi_raw)

        # Skip rows where RSSI is not a valid number
        if rssi is None:
            skip_reasons.append(f"Row {row_num}: RSSI '{rssi_raw}' is not a valid number")
            continue

        # Skip rows where RSSI is out of range
        if rssi < RSSI_MIN or rssi > RSSI_MAX:
            skip_reasons.append(
                f"Row {row_num}: RSSI {rssi} dBm out of range ({RSSI_MIN} to {RSSI_MAX})"
            )
            continue

        # SNR — optional column
        snr: float | None = None
        if cols["snr"] is not None:
            snr_raw = raw.get(cols["snr"])
            if snr_raw and snr_raw.strip():
                snr = _parse_float(snr_raw)
                if snr is not None and (snr < SNR_MIN or snr > SNR_MAX):
                    skip_reasons.append(
                        f"Row {row_num}: SNR {snr} dB out of range ({SNR_MIN} to {SNR_MAX})"
                    )
                    continue

        # Timestamp — optional
        timestamp: str | None = None
        if cols["timestamp"] is not None:
            ts_raw = raw.get(cols["timestamp"])
            if ts_raw and ts_raw.strip():
                timestamp = ts_raw.strip()

        rows.append({
            "node_a": node_a_val,
            "node_b": node_b_val,
            "rssi_dbm": rssi,
            "snr_db": snr,
            "timestamp": timestamp,
        })

    skipped = total_raw - len(rows)
    if truncated:
        skipped = total_raw - MAX_ROWS

    return {
        "rows": rows,
        "total_parsed": total_raw,
        "skipped": skipped,
        "skip_reasons": skip_reasons,
        "columns_detected": cols,
        **({"truncated_note": f"File had {total_raw} data rows; returned first {MAX_ROWS}."} if truncated else {}),
    }


@router.post("/signal-import/parse")
async def parse_signal_csv(file: UploadFile) -> dict[str, Any]:
    """Parse a CSV file containing RSSI/SNR signal observation data.

    Accepts multipart/form-data with a 'file' field (CSV).
    Auto-detects column names and returns structured observations.
    Does not persist any data.

    Returns:
        JSON with rows, total_parsed, skipped, skip_reasons, columns_detected.

    Raises:
        HTTPException 400: No file provided or wrong content type
        HTTPException 422: CSV cannot be parsed or required columns not found
    """
    if file is None or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    raw_bytes = await file.read()

    # Attempt UTF-8, fall back to latin-1 (common for Meshtastic exports)
    try:
        content = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        try:
            content = raw_bytes.decode("latin-1")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Could not decode file as UTF-8 or latin-1: {exc}",
            ) from exc

    if not content.strip():
        return {
            "rows": [],
            "total_parsed": 0,
            "skipped": 0,
            "skip_reasons": [],
            "columns_detected": {"node_a": None, "node_b": None, "rssi": None, "snr": None, "timestamp": None},
        }

    result = _parse_csv(content)

    logger.info(
        "Signal CSV import: %d rows parsed, %d skipped, file='%s'",
        result["total_parsed"],
        result["skipped"],
        file.filename or "unknown",
    )

    return result
