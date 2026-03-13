"""PA (Power Amplifier) signal chain utilities.

Signal chain: Device → PA (optional) → Cable → Antenna

Key concepts:
- tx_power_dbm: device radio output (PA input when PA is present)
- pa_gain: max_output_power_dbm − input_range_max (derived from catalog)
- effective_tx_dbm: PA output (clamped to max_output_power_dbm), or device
  output if no PA — this is what enters the cable/antenna chain
"""

from __future__ import annotations

import re
from typing import Optional


def parse_input_range_max(input_power_range: str) -> float:
    """Parse PA input power range string and return max input power in dBm.

    Handles catalog formats:
      "0-22 dBm"   → 22.0
      "0 to 20dBm" → 20.0
      "-5-15"      → 15.0   (last number is always the upper bound)
      "22"         → 22.0   (single value)

    Returns 22.0 as a safe default when the string cannot be parsed.
    """
    if not input_power_range:
        return 22.0
    # Leading \b prevents hyphen-in-range ("0-22") being parsed as negative sign.
    # No trailing \b so "20dBm" still matches (digit followed by letter has no \b).
    nums = re.findall(r'\b\d+(?:\.\d+)?', str(input_power_range))
    if not nums:
        return 22.0
    return float(nums[-1])


def compute_pa_gain(pa: dict) -> float:
    """Derive PA gain in dB from catalog entry.

    gain_db = max_output_power_dbm - input_range_max

    Example: E22-900M30S has max_output=30, input_range="0-22 dBm"
    → gain = 30 - 22 = 8 dB
    """
    max_output = float(pa.get("max_output_power_dbm", 30.0))
    input_range = pa.get("input_power_range", "0-22 dBm")
    input_max = parse_input_range_max(str(input_range))
    return max_output - input_max


def compute_effective_tx_dbm(tx_power_dbm: float, pa: Optional[dict]) -> float:
    """Compute effective TX power entering the cable/antenna chain.

    With no PA:  effective = tx_power_dbm (device output)
    With PA:     effective = min(tx_power_dbm + pa_gain, pa.max_output_power_dbm)
                             (PA saturates at its rated max output)

    Args:
        tx_power_dbm: Radio/device output power setting (dBm).
        pa: PA catalog dict with keys max_output_power_dbm and input_power_range,
            or None if no PA is fitted.

    Returns:
        Effective TX power in dBm to be used as the propagation model input.
    """
    if pa is None:
        return tx_power_dbm
    pa_gain = compute_pa_gain(pa)
    max_output = float(pa.get("max_output_power_dbm", 30.0))
    return min(tx_power_dbm + pa_gain, max_output)


def pa_input_overdrive_db(tx_power_dbm: float, pa: dict) -> float:
    """Return how much the TX power overdrives the PA input, in dB.

    Returns 0.0 when within spec.  Positive = overdriven.

    Example: TX 25 dBm into PA rated 0-22 dBm → overdrive = 3 dB.
    """
    input_max = parse_input_range_max(str(pa.get("input_power_range", "0-22 dBm")))
    return max(0.0, tx_power_dbm - input_max)
