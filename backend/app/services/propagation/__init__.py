"""Propagation engine package.

Exports:
- PropagationEngine (abstract base)
- FSPLEngine
- SignalServerEngine
- RadioMobileEngine
- PropagationCache
- Data classes: NodeParams, BoundingBox, CoverageResult, LinkResult
- SRTMManager
"""

from backend.app.services.propagation.engine import (
    BoundingBox,
    CoverageResult,
    LinkResult,
    NodeParams,
    PropagationEngine,
    PropagationModel,
)
from backend.app.services.propagation.fspl import FSPLEngine
from backend.app.services.propagation.signal_server import SignalServerEngine
from backend.app.services.propagation.radio_mobile import RadioMobileEngine
from backend.app.services.propagation.srtm import SRTMManager
from backend.app.services.propagation.cache import CacheStats, PropagationCache

__all__ = [
    "PropagationEngine",
    "PropagationModel",
    "FSPLEngine",
    "SignalServerEngine",
    "RadioMobileEngine",
    "SRTMManager",
    "PropagationCache",
    "CacheStats",
    "NodeParams",
    "BoundingBox",
    "CoverageResult",
    "LinkResult",
]
