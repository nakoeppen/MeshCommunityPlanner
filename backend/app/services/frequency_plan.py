"""Frequency plan and channel management for LoRa mesh networks.

Provides region-specific channel lists, frequency validation, and
channel ↔ frequency conversion for Meshtastic-compatible devices.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class ChannelInfo:
    """A single radio channel within a regulatory region."""

    channel_num: int
    frequency_mhz: float
    bandwidth_khz: float = 125.0
    max_power_dbm: float = 30.0


# Meshtastic default channel plans by region
REGIONS: dict[str, dict] = {
    "us_fcc": {
        "name": "US (FCC Part 15.247)",
        "band": "902-928 MHz",
        "channels": [
            ChannelInfo(0, 906.875, 125.0, 30.0),
            ChannelInfo(1, 907.500, 125.0, 30.0),
            ChannelInfo(2, 908.125, 125.0, 30.0),
            ChannelInfo(3, 908.750, 125.0, 30.0),
            ChannelInfo(4, 909.375, 125.0, 30.0),
            ChannelInfo(5, 910.000, 125.0, 30.0),
            ChannelInfo(6, 910.625, 125.0, 30.0),
            ChannelInfo(7, 911.250, 125.0, 30.0),
            ChannelInfo(8, 911.875, 125.0, 30.0),
            ChannelInfo(9, 912.500, 125.0, 30.0),
            ChannelInfo(10, 913.125, 125.0, 30.0),
            ChannelInfo(11, 913.750, 125.0, 30.0),
            ChannelInfo(12, 914.375, 125.0, 30.0),
            ChannelInfo(13, 915.000, 125.0, 30.0),
        ],
    },
    "eu_ce": {
        "name": "EU (CE / ETSI EN 300 220)",
        "band": "869.4-869.65 MHz",
        "channels": [
            ChannelInfo(0, 869.525, 125.0, 14.0),
        ],
    },
    "au_acma": {
        "name": "Australia (ACMA)",
        "band": "915-928 MHz",
        "channels": [
            ChannelInfo(0, 916.000, 125.0, 30.0),
            ChannelInfo(1, 917.000, 125.0, 30.0),
            ChannelInfo(2, 918.000, 125.0, 30.0),
            ChannelInfo(3, 919.000, 125.0, 30.0),
            ChannelInfo(4, 920.000, 125.0, 30.0),
            ChannelInfo(5, 921.000, 125.0, 30.0),
            ChannelInfo(6, 922.000, 125.0, 30.0),
            ChannelInfo(7, 923.000, 125.0, 30.0),
        ],
    },
    "cn": {
        "name": "China (MIIT)",
        "band": "470-510 MHz",
        "channels": [
            ChannelInfo(0, 470.000, 125.0, 17.0),
            ChannelInfo(1, 471.000, 125.0, 17.0),
            ChannelInfo(2, 472.000, 125.0, 17.0),
        ],
    },
    "jp": {
        "name": "Japan (MIC / ARIB STD-T108)",
        "band": "920-928 MHz",
        "channels": [
            ChannelInfo(0, 920.800, 125.0, 13.0),
            ChannelInfo(1, 921.200, 125.0, 13.0),
            ChannelInfo(2, 921.600, 125.0, 13.0),
            ChannelInfo(3, 922.000, 125.0, 13.0),
        ],
    },
    "kr": {
        "name": "Korea (KCC)",
        "band": "920-923 MHz",
        "channels": [
            ChannelInfo(0, 921.900, 125.0, 10.0),
            ChannelInfo(1, 922.100, 125.0, 10.0),
            ChannelInfo(2, 922.300, 125.0, 10.0),
        ],
    },
    "tw": {
        "name": "Taiwan (NCC)",
        "band": "922-928 MHz",
        "channels": [
            ChannelInfo(0, 923.000, 125.0, 27.0),
            ChannelInfo(1, 924.000, 125.0, 27.0),
            ChannelInfo(2, 925.000, 125.0, 27.0),
        ],
    },
    "in": {
        "name": "India (WPC / DoT)",
        "band": "865-867 MHz",
        "channels": [
            ChannelInfo(0, 865.200, 125.0, 14.0),
            ChannelInfo(1, 866.000, 125.0, 14.0),
            ChannelInfo(2, 866.800, 125.0, 14.0),
        ],
    },
}


def get_channels_for_region(region_id: str) -> list[ChannelInfo]:
    """Return the channel list for a given regulatory region.

    Returns empty list if region is unknown.
    """
    region = REGIONS.get(region_id)
    if region is None:
        return []
    return list(region["channels"])


def validate_frequency(frequency_mhz: float, region_id: str) -> dict:
    """Check if a frequency is valid for a region.

    Returns dict with 'valid' bool and optional 'reason' string.
    """
    if frequency_mhz <= 0:
        return {"valid": False, "reason": "Frequency must be positive"}

    region = REGIONS.get(region_id)
    if region is None:
        return {"valid": False, "reason": f"Unknown region '{region_id}'"}

    channels = region["channels"]
    for ch in channels:
        if abs(ch.frequency_mhz - frequency_mhz) < 0.001:
            return {"valid": True, "channel": ch.channel_num}

    valid_freqs = [ch.frequency_mhz for ch in channels]
    return {
        "valid": False,
        "reason": f"Frequency {frequency_mhz} MHz not in {region_id} channel plan. "
                  f"Valid: {valid_freqs}",
    }


def frequency_to_channel(frequency_mhz: float, region_id: str) -> Optional[ChannelInfo]:
    """Find the channel matching a frequency in a region.

    Returns None if no match found.
    """
    channels = get_channels_for_region(region_id)
    for ch in channels:
        if abs(ch.frequency_mhz - frequency_mhz) < 0.001:
            return ch
    return None


def channel_to_frequency(channel_num: int, region_id: str) -> Optional[float]:
    """Get the frequency for a channel number in a region.

    Returns None if region or channel is invalid.
    """
    channels = get_channels_for_region(region_id)
    for ch in channels:
        if ch.channel_num == channel_num:
            return ch.frequency_mhz
    return None
