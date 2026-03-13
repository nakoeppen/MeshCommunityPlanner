"""Unit tests for PA signal chain utilities (pa_utils.py).

Tests cover:
- parse_input_range_max: all catalog string formats
- compute_pa_gain: nominal, edge cases
- compute_effective_tx_dbm: no PA, normal operation, saturation clamping
- pa_input_overdrive_db: within spec, at limit, overdriven
- Integration: E22 catalog entries
- coverage_terrain handler: PA gain applied correctly
"""

from __future__ import annotations

import pytest

from backend.app.services.pa_utils import (
    compute_effective_tx_dbm,
    compute_pa_gain,
    pa_input_overdrive_db,
    parse_input_range_max,
)


# ============================================================================
# parse_input_range_max
# ============================================================================


class TestParseInputRangeMax:
    def test_standard_format(self):
        assert parse_input_range_max("0-22 dBm") == 22.0

    def test_no_spaces(self):
        assert parse_input_range_max("0-20dBm") == 20.0

    def test_to_format(self):
        assert parse_input_range_max("0 to 20 dBm") == 20.0

    def test_negative_lower_bound(self):
        # "-5-15" — last number is upper bound
        assert parse_input_range_max("-5-15") == 15.0

    def test_single_value(self):
        assert parse_input_range_max("22") == 22.0

    def test_float_value(self):
        assert parse_input_range_max("0-22.5 dBm") == 22.5

    def test_empty_string(self):
        assert parse_input_range_max("") == 22.0

    def test_no_numbers(self):
        assert parse_input_range_max("no numbers here") == 22.0

    def test_e22_catalog_string(self):
        """Matches actual E22-900M30S catalog entry."""
        assert parse_input_range_max("0-22 dBm") == 22.0


# ============================================================================
# compute_pa_gain
# ============================================================================


class TestComputePaGain:
    def _make_pa(self, max_output: float, input_range: str) -> dict:
        return {
            "max_output_power_dbm": max_output,
            "input_power_range": input_range,
        }

    def test_e22_900m30s(self):
        """E22-900M30S: 30 dBm out, 0-22 dBm in → 8 dB gain."""
        pa = self._make_pa(30.0, "0-22 dBm")
        assert compute_pa_gain(pa) == pytest.approx(8.0)

    def test_e22_400m30s(self):
        """E22-400M30S: same specs as E22-900M30S."""
        pa = self._make_pa(30.0, "0-22 dBm")
        assert compute_pa_gain(pa) == pytest.approx(8.0)

    def test_low_gain_pa(self):
        pa = self._make_pa(27.0, "0-20 dBm")
        assert compute_pa_gain(pa) == pytest.approx(7.0)

    def test_unity_gain_edge(self):
        """PA with input_max == max_output → 0 dB gain (pass-through)."""
        pa = self._make_pa(20.0, "0-20 dBm")
        assert compute_pa_gain(pa) == pytest.approx(0.0)

    def test_missing_input_range_defaults_to_22(self):
        pa = {"max_output_power_dbm": 30.0}
        assert compute_pa_gain(pa) == pytest.approx(8.0)


# ============================================================================
# compute_effective_tx_dbm
# ============================================================================


class TestComputeEffectiveTxDbm:
    def test_no_pa_returns_device_tx(self):
        assert compute_effective_tx_dbm(22.0, None) == pytest.approx(22.0)

    def test_no_pa_low_power(self):
        assert compute_effective_tx_dbm(10.0, None) == pytest.approx(10.0)

    def test_pa_nominal_operation(self):
        """Device at 15 dBm, PA gain=8 → output 23 dBm (below 30 cap)."""
        pa = {"max_output_power_dbm": 30.0, "input_power_range": "0-22 dBm"}
        assert compute_effective_tx_dbm(15.0, pa) == pytest.approx(23.0)

    def test_pa_at_rated_input(self):
        """Device at max rated input (22 dBm), PA gain=8 → output 30 dBm."""
        pa = {"max_output_power_dbm": 30.0, "input_power_range": "0-22 dBm"}
        assert compute_effective_tx_dbm(22.0, pa) == pytest.approx(30.0)

    def test_pa_saturates_at_max_output(self):
        """Device overdriving PA input: TX 25 dBm + 8 = 33, clamped to 30."""
        pa = {"max_output_power_dbm": 30.0, "input_power_range": "0-22 dBm"}
        result = compute_effective_tx_dbm(25.0, pa)
        assert result == pytest.approx(30.0)

    def test_pa_max_output_is_hard_ceiling(self):
        """Even extreme overdrive is clamped to max_output."""
        pa = {"max_output_power_dbm": 30.0, "input_power_range": "0-22 dBm"}
        result = compute_effective_tx_dbm(47.0, pa)
        assert result == pytest.approx(30.0)

    def test_pa_low_input_power(self):
        """Very low device TX: 5 dBm + 8 gain = 13 dBm (well below max)."""
        pa = {"max_output_power_dbm": 30.0, "input_power_range": "0-22 dBm"}
        assert compute_effective_tx_dbm(5.0, pa) == pytest.approx(13.0)

    def test_pa_zero_gain(self):
        """Pass-through PA (gain=0): output = input."""
        pa = {"max_output_power_dbm": 20.0, "input_power_range": "0-20 dBm"}
        assert compute_effective_tx_dbm(15.0, pa) == pytest.approx(15.0)


# ============================================================================
# pa_input_overdrive_db
# ============================================================================


class TestPaInputOverdriveDb:
    def _make_pa(self, input_range: str = "0-22 dBm") -> dict:
        return {"max_output_power_dbm": 30.0, "input_power_range": input_range}

    def test_within_spec_returns_zero(self):
        assert pa_input_overdrive_db(20.0, self._make_pa()) == pytest.approx(0.0)

    def test_at_spec_limit_returns_zero(self):
        assert pa_input_overdrive_db(22.0, self._make_pa()) == pytest.approx(0.0)

    def test_overdrive_by_3db(self):
        assert pa_input_overdrive_db(25.0, self._make_pa()) == pytest.approx(3.0)

    def test_overdrive_by_9db(self):
        assert pa_input_overdrive_db(31.0, self._make_pa()) == pytest.approx(9.0)

    def test_zero_input_no_overdrive(self):
        assert pa_input_overdrive_db(0.0, self._make_pa()) == pytest.approx(0.0)


# ============================================================================
# Integration: coverage_terrain handler applies PA gain
# ============================================================================

def _make_mock_grid(captured: dict):
    """Return a mock compute_terrain_coverage_grid that captures tx_power_dbm."""
    def mock_grid(**kwargs):
        captured["tx_power_dbm"] = kwargs["tx_power_dbm"]
        return {
            "points": [],
            "bounds": {"min_lat": 0, "min_lon": 0, "max_lat": 1, "max_lon": 1},
            "elevation_source": "flat_terrain",
            "computation_time_ms": 0,
            "stats": {},
        }
    return mock_grid


class TestCoverageTerrainPaIntegration:
    """Verify that handle_terrain_coverage_grid applies PA gain before calling
    compute_terrain_coverage_grid.  We patch the grid function to capture the
    tx_power_dbm it receives."""

    @pytest.mark.asyncio
    async def test_no_pa_passes_device_tx_unchanged(self, monkeypatch):
        import backend.app.services.propagation.coverage_grid as cg_module
        captured: dict = {}
        monkeypatch.setattr(cg_module, "compute_terrain_coverage_grid", _make_mock_grid(captured))

        from backend.app.api.coverage_terrain import handle_terrain_coverage_grid
        await handle_terrain_coverage_grid({
            "latitude": 40.0, "longitude": -74.0,
            "tx_power_dbm": 22.0,
            "_srtm_manager": None,
        })
        assert captured["tx_power_dbm"] == pytest.approx(22.0)

    @pytest.mark.asyncio
    async def test_pa_normal_operation_adjusts_tx(self, monkeypatch):
        """Device 15 dBm + E22 PA (gain=8) → effective 23 dBm passed to grid."""
        import backend.app.services.propagation.coverage_grid as cg_module
        captured: dict = {}
        monkeypatch.setattr(cg_module, "compute_terrain_coverage_grid", _make_mock_grid(captured))

        from backend.app.api.coverage_terrain import handle_terrain_coverage_grid
        await handle_terrain_coverage_grid({
            "latitude": 40.0, "longitude": -74.0,
            "tx_power_dbm": 15.0,
            "pa_max_output_power_dbm": 30.0,
            "pa_input_range_max_dbm": 22.0,
            "_srtm_manager": None,
        })
        assert captured["tx_power_dbm"] == pytest.approx(23.0)

    @pytest.mark.asyncio
    async def test_pa_saturation_clamps_effective_tx(self, monkeypatch):
        """Device 25 dBm into PA rated 0-22: effective = 30 (clamped)."""
        import backend.app.services.propagation.coverage_grid as cg_module
        captured: dict = {}
        monkeypatch.setattr(cg_module, "compute_terrain_coverage_grid", _make_mock_grid(captured))

        from backend.app.api.coverage_terrain import handle_terrain_coverage_grid
        await handle_terrain_coverage_grid({
            "latitude": 40.0, "longitude": -74.0,
            "tx_power_dbm": 25.0,
            "pa_max_output_power_dbm": 30.0,
            "pa_input_range_max_dbm": 22.0,
            "_srtm_manager": None,
        })
        assert captured["tx_power_dbm"] == pytest.approx(30.0)

    @pytest.mark.asyncio
    async def test_partial_pa_params_no_adjustment(self, monkeypatch):
        """If only one PA param is present, skip PA gain (defensive)."""
        import backend.app.services.propagation.coverage_grid as cg_module
        captured: dict = {}
        monkeypatch.setattr(cg_module, "compute_terrain_coverage_grid", _make_mock_grid(captured))

        from backend.app.api.coverage_terrain import handle_terrain_coverage_grid
        await handle_terrain_coverage_grid({
            "latitude": 40.0, "longitude": -74.0,
            "tx_power_dbm": 22.0,
            "pa_max_output_power_dbm": 30.0,  # only one PA param — skip PA gain
            "_srtm_manager": None,
        })
        assert captured["tx_power_dbm"] == pytest.approx(22.0)
