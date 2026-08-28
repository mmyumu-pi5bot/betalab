"""Tests for dispensing/pipetting volume variance (Step 3 of manipulation-volume uncertainty)."""

from __future__ import annotations

import random

import pytest

from app.services.domain_services.workbench import (
    AddLiquidToWorkbenchToolRequest,
    AddLiquidToWorkbenchToolService,
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
    UpdateWorkbenchLiquidVolumeRequest,
    UpdateWorkbenchLiquidVolumeService,
)
from app.services.experiment_service import ExperimentRuntimeService
from app.services.physical_simulation_service import PhysicalSimulationService

# ---------------------------------------------------------------------------
# draw_dispensed_volume unit tests
# ---------------------------------------------------------------------------


class TestDrawDispensedVolume:
    def test_zero_nominal_returns_zero(self) -> None:
        assert PhysicalSimulationService.draw_dispensed_volume(0.0) == 0.0

    def test_negative_nominal_returns_zero(self) -> None:
        assert PhysicalSimulationService.draw_dispensed_volume(-5.0) == 0.0

    def test_draws_stay_within_clamp_band(self) -> None:
        nominal = 1.0
        min_v = PhysicalSimulationService.dispense_factor_min * nominal
        max_v = PhysicalSimulationService.dispense_factor_max * nominal
        random.seed(42)
        for _ in range(500):
            result = PhysicalSimulationService.draw_dispensed_volume(nominal)
            assert min_v <= result <= max_v, f"Out of clamp band: {result}"

    def test_draws_are_not_always_equal_to_nominal(self) -> None:
        """With a real sigma, at least one draw in 200 must differ from nominal."""
        nominal = 10.0
        random.seed(1234)
        results = [PhysicalSimulationService.draw_dispensed_volume(nominal) for _ in range(200)]
        assert any(r != nominal for r in results), "All draws equal nominal — variance not applied"

    def test_small_volume_clamp_band(self) -> None:
        """Verify clamp for a tiny ISTD-like volume (0.05 mL)."""
        nominal = 0.05
        min_v = PhysicalSimulationService.dispense_factor_min * nominal
        max_v = PhysicalSimulationService.dispense_factor_max * nominal
        random.seed(99)
        for _ in range(200):
            result = PhysicalSimulationService.draw_dispensed_volume(nominal)
            assert min_v <= result <= max_v


# ---------------------------------------------------------------------------
# Integration: add_liquid_to_tool stores nominal in volume_ml, true in true_volume_ml
# ---------------------------------------------------------------------------


def _make_service_and_tube() -> tuple[ExperimentRuntimeService, str, str]:
    """Return (service, exp_id, tube_tool_id) with a 50 mL centrifuge tube at station_1."""
    service = ExperimentRuntimeService()
    exp_id = service.create_experiment().id
    PlaceToolOnWorkbenchService(service).run(
        exp_id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="centrifuge_tube_50ml"),
    )
    exp = service._require_experiment(exp_id)
    tube = next(s for s in exp.workbench.slots if s.id == "station_1").tool
    assert tube is not None
    return service, exp_id, tube.id


class TestAddLiquidDispenseVariance:
    def test_nominal_volume_is_preserved(self) -> None:
        random.seed(7)
        service, exp_id, _ = _make_service_and_tube()
        nominal = 10.0
        AddLiquidToWorkbenchToolService(service).run(
            exp_id,
            AddLiquidToWorkbenchToolRequest(
                slot_id="station_1",
                liquid_id="acetonitrile_extraction",
                volume_ml=nominal,
            ),
        )
        exp = service._require_experiment(exp_id)
        tube = next(s for s in exp.workbench.slots if s.id == "station_1").tool
        assert tube is not None
        liquid = next(liq for liq in tube.liquids if liq.liquid_id == "acetonitrile_extraction")
        # nominal is always stored as-is (round_volume precision)
        assert liquid.volume_ml == round(nominal, 3)

    def test_true_volume_differs_from_nominal_for_some_seed(self) -> None:
        """With at least one seed, true_volume_ml != volume_ml."""
        any_differs = False
        for seed in range(50):
            random.seed(seed)
            service, exp_id, _ = _make_service_and_tube()
            AddLiquidToWorkbenchToolService(service).run(
                exp_id,
                AddLiquidToWorkbenchToolRequest(
                    slot_id="station_1",
                    liquid_id="acetonitrile_extraction",
                    volume_ml=10.0,
                ),
            )
            exp = service._require_experiment(exp_id)
            tube = next(s for s in exp.workbench.slots if s.id == "station_1").tool
            assert tube is not None
            liquid = next(liq for liq in tube.liquids if liq.liquid_id == "acetonitrile_extraction")
            if liquid.true_volume_ml != liquid.volume_ml:
                any_differs = True
                break
        assert any_differs, "true_volume_ml never differed from volume_ml across 50 seeds"

    def test_true_volume_within_clamp_band(self) -> None:
        nominal = 10.0
        factor_min = PhysicalSimulationService.dispense_factor_min
        factor_max = PhysicalSimulationService.dispense_factor_max
        random.seed(42)
        service, exp_id, _ = _make_service_and_tube()
        AddLiquidToWorkbenchToolService(service).run(
            exp_id,
            AddLiquidToWorkbenchToolRequest(
                slot_id="station_1",
                liquid_id="acetonitrile_extraction",
                volume_ml=nominal,
            ),
        )
        exp = service._require_experiment(exp_id)
        tube = next(s for s in exp.workbench.slots if s.id == "station_1").tool
        assert tube is not None
        liquid = next(liq for liq in tube.liquids if liq.liquid_id == "acetonitrile_extraction")
        assert liquid.true_volume_ml is not None
        assert factor_min * nominal <= liquid.true_volume_ml <= factor_max * nominal

    def test_merge_accumulates_both_nominal_and_true(self) -> None:
        """Two successive adds to the same liquid accumulate both volume_ml and true_volume_ml."""
        random.seed(11)
        service, exp_id, _ = _make_service_and_tube()
        nominal1 = 5.0
        nominal2 = 3.0

        AddLiquidToWorkbenchToolService(service).run(
            exp_id,
            AddLiquidToWorkbenchToolRequest(
                slot_id="station_1",
                liquid_id="acetonitrile_extraction",
                volume_ml=nominal1,
            ),
        )
        exp = service._require_experiment(exp_id)
        tube = next(s for s in exp.workbench.slots if s.id == "station_1").tool
        assert tube is not None
        liquid_after_first = next(liq for liq in tube.liquids if liq.liquid_id == "acetonitrile_extraction")
        true_after_first = liquid_after_first.true_volume_ml

        AddLiquidToWorkbenchToolService(service).run(
            exp_id,
            AddLiquidToWorkbenchToolRequest(
                slot_id="station_1",
                liquid_id="acetonitrile_extraction",
                volume_ml=nominal2,
            ),
        )
        exp = service._require_experiment(exp_id)
        tube = next(s for s in exp.workbench.slots if s.id == "station_1").tool
        assert tube is not None
        liquid_after_second = next(liq for liq in tube.liquids if liq.liquid_id == "acetonitrile_extraction")

        # Nominal: exact sum rounded to 3 decimals
        assert liquid_after_second.volume_ml == round(nominal1 + nominal2, 3)
        # True: should be greater than after the first addition (second true volume added)
        assert liquid_after_second.true_volume_ml is not None
        assert liquid_after_second.true_volume_ml > (true_after_first or 0.0)

    def test_volume_correction_preserves_the_dispensing_error_factor(self) -> None:
        random.seed(11)
        service, exp_id, _ = _make_service_and_tube()
        AddLiquidToWorkbenchToolService(service).run(
            exp_id,
            AddLiquidToWorkbenchToolRequest(
                slot_id="station_1",
                liquid_id="acetonitrile_extraction",
                volume_ml=10.0,
            ),
        )
        tool = service._require_experiment(exp_id).workbench.slots[0].tool
        assert tool is not None
        liquid = tool.liquids[0]
        assert liquid.true_volume_ml is not None
        original_factor = liquid.true_volume_ml / liquid.volume_ml

        UpdateWorkbenchLiquidVolumeService(service).run(
            exp_id,
            UpdateWorkbenchLiquidVolumeRequest(
                slot_id="station_1",
                liquid_entry_id=liquid.id,
                volume_ml=2.0,
            ),
        )

        assert liquid.volume_ml == 2.0
        assert liquid.true_volume_ml is not None
        assert liquid.true_volume_ml / liquid.volume_ml == pytest.approx(original_factor)
