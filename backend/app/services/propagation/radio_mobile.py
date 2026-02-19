"""Radio Mobile Online propagation engine stub.

Implements the PropagationEngine interface but raises NotImplementedError
for all methods. This is a placeholder for future implementation (task 11.8).
"""

from __future__ import annotations

from backend.app.services.propagation.engine import (
    BoundingBox,
    CoverageResult,
    LinkResult,
    NodeParams,
    PropagationEngine,
    PropagationModel,
)


class RadioMobileEngine(PropagationEngine):
    """Radio Mobile Online propagation engine (not yet implemented)."""

    @property
    def model(self) -> PropagationModel:
        return PropagationModel.RADIO_MOBILE

    async def calculate_coverage(
        self, node: NodeParams, bounds: BoundingBox
    ) -> CoverageResult:
        raise NotImplementedError(
            "Radio Mobile Online engine is not yet implemented. "
            "Use Signal-Server instead."
        )

    async def calculate_link(
        self, node_a: NodeParams, node_b: NodeParams
    ) -> LinkResult:
        raise NotImplementedError(
            "Radio Mobile Online engine is not yet implemented. "
            "Use Signal-Server instead."
        )
