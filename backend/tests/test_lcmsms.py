"""Tests for LC-MS/MS domain services: calibration preparation and sequence execution."""
from __future__ import annotations

import json
import random
import sqlite3
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.api.experiment_routes import lcmsms as lcmsms_routes
from app.domain.acquisition_methods import (
    APPLE_PESTICIDES_MRM_V1,
    APPLE_PESTICIDES_MRM_V1_ID,
)
from app.domain.models import (
    CalibrationContext,
    InjectionContext,
    QuechersExtractionResult,
    WorkbenchTool,
    new_id,
)
from app.domain.mrm_reference import INTERNAL_STANDARD_COMPOUND_ID
from app.main import app
from app.services.domain_services.lcmsms import (
    AcquisitionSequenceLineRequest,
    AddCalibrationToVialRequest,
    AddCalibrationToVialService,
    LoadRackIntoInstrumentRequest,
    LoadRackIntoInstrumentService,
    RunSequenceRequest,
    RunSequenceService,
    UnloadRackFromInstrumentRequest,
    UnloadRackFromInstrumentService,
    _compute_calibration_responses,
    _compute_sample_responses,
    _reference_retention_time_s,
)
from app.services.domain_services.mrm_signal import BASELINE_COUNTS
from app.services.domain_services.rack import (
    PlaceToolInRackSlotRequest,
    PlaceToolInRackSlotService,
)
from app.services.domain_services.workbench import (
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
    RemoveLiquidFromWorkbenchToolService,
    WorkbenchLiquidRequest,
)
from app.services.experiment_repository import SqliteExperimentRepository
from app.services.experiment_service import ExperimentRuntimeService
from app.services.physical_simulation_service import PhysicalSimulationService


def _create(service: ExperimentRuntimeService) -> str:
    return service.create_experiment().id


def _place_vial_on_bench(service: ExperimentRuntimeService, exp_id: str, slot_id: str = "station_1") -> str:
    PlaceToolOnWorkbenchService(service).run(
        exp_id, PlaceToolOnWorkbenchRequest(slot_id=slot_id, tool_id="sample_vial_lcms")
    )
    exp = service._require_experiment(exp_id)
    slot = next(s for s in exp.workbench.slots if s.id == slot_id)
    assert slot.tool is not None
    return slot.tool.id


def _place_vial_in_rack(service: ExperimentRuntimeService, exp_id: str, rack_slot_id: str = "rack_slot_1") -> str:
    PlaceToolInRackSlotService(service).run(
        exp_id, PlaceToolInRackSlotRequest(rack_slot_id=rack_slot_id, tool_id="sample_vial_lcms")
    )
    exp = service._require_experiment(exp_id)
    slot = next(s for s in exp.rack.slots if s.id == rack_slot_id)
    assert slot.tool is not None
    return slot.tool.id


def _deploy_instrument_and_rack(service: ExperimentRuntimeService, exp_id: str) -> None:
    exp = service._require_experiment(exp_id)
    for widget in exp.workspace.widgets:
        if widget.id in ("instrument", "rack"):
            widget.is_present = True


def _load_rack_into_instrument(service: ExperimentRuntimeService, exp_id: str) -> None:
    LoadRackIntoInstrumentService(service).run(exp_id, LoadRackIntoInstrumentRequest())


# ---------------------------------------------------------------------------
# AddCalibrationToVialService
# ---------------------------------------------------------------------------

class TestAddCalibrationToVial:
    def test_happy_path(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        vial_id = _place_vial_on_bench(service, exp_id)

        AddCalibrationToVialService(service).run(
            exp_id, AddCalibrationToVialRequest(vial_tool_id=vial_id, level_ng_per_ml=10.0)
        )

        exp = service._require_experiment(exp_id)
        vial = exp.workbench.slots[0].tool
        assert vial is not None
        assert vial.calibration_context is not None
        assert vial.calibration_context.level_ng_per_ml == 10.0
        assert len(vial.calibration_context.compound_ids) > 0
        assert [(liquid.liquid_id, liquid.volume_ml) for liquid in vial.liquids] == [
            ("calibration_solution", 1.0)
        ]

    def test_roundtrip_preserves_calibration_liquid_and_hidden_level(self, tmp_path) -> None:
        repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
        service = ExperimentRuntimeService(repository=repository)
        exp_id = _create(service)
        vial_id = _place_vial_on_bench(service, exp_id)

        AddCalibrationToVialService(service).run(
            exp_id, AddCalibrationToVialRequest(vial_tool_id=vial_id, level_ng_per_ml=10.0)
        )
        original_vial = service._require_experiment(exp_id).workbench.slots[0].tool
        assert original_vial is not None
        assert original_vial.calibration_context is not None
        original_true_level = original_vial.calibration_context.true_level_ng_per_ml
        original_true_volume = original_vial.liquids[0].true_volume_ml

        reloaded = ExperimentRuntimeService(repository=repository)._require_experiment(exp_id)
        vial = reloaded.workbench.slots[0].tool
        assert vial is not None
        assert vial.calibration_context is not None
        assert vial.calibration_context.true_level_ng_per_ml == original_true_level
        assert len(vial.liquids) == 1
        assert vial.liquids[0].liquid_id == "calibration_solution"
        assert vial.liquids[0].true_volume_ml == original_true_volume

    def test_negative_level_raises(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        vial_id = _place_vial_on_bench(service, exp_id)

        with pytest.raises(ValueError, match="positive"):
            AddCalibrationToVialService(service).run(
                exp_id, AddCalibrationToVialRequest(vial_tool_id=vial_id, level_ng_per_ml=0.0)
            )

    def test_double_calibration_raises(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        vial_id = _place_vial_on_bench(service, exp_id)

        AddCalibrationToVialService(service).run(
            exp_id, AddCalibrationToVialRequest(vial_tool_id=vial_id, level_ng_per_ml=5.0)
        )
        with pytest.raises(ValueError, match="already contains a calibration"):
            AddCalibrationToVialService(service).run(
                exp_id, AddCalibrationToVialRequest(vial_tool_id=vial_id, level_ng_per_ml=10.0)
            )

    def test_removing_calibration_liquid_clears_calibration_context(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        vial_id = _place_vial_on_bench(service, exp_id)
        AddCalibrationToVialService(service).run(
            exp_id, AddCalibrationToVialRequest(vial_tool_id=vial_id, level_ng_per_ml=10.0)
        )
        vial = service._require_experiment(exp_id).workbench.slots[0].tool
        assert vial is not None

        RemoveLiquidFromWorkbenchToolService(service).run(
            exp_id,
            WorkbenchLiquidRequest(
                slot_id="station_1",
                liquid_entry_id=vial.liquids[0].id,
            ),
        )

        assert vial.liquids == []
        assert vial.calibration_context is None

    def test_tool_not_found_raises(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)

        with pytest.raises(ValueError, match="not found"):
            AddCalibrationToVialService(service).run(
                exp_id, AddCalibrationToVialRequest(vial_tool_id="nonexistent", level_ng_per_ml=10.0)
            )

    def test_centrifuge_tube_accepts_calibrant(self) -> None:
        # A liquid can physically go into any container that holds liquids. A calibrant
        # prepared in a centrifuge tube is accepted — it is simply never injected, since
        # a tube cannot enter the autosampler rack. Useless, but not an error.
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        PlaceToolOnWorkbenchService(service).run(
            exp_id, PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="centrifuge_tube_50ml")
        )
        exp = service._require_experiment(exp_id)
        tube = next(s for s in exp.workbench.slots if s.id == "station_1").tool
        assert tube is not None

        AddCalibrationToVialService(service).run(
            exp_id, AddCalibrationToVialRequest(vial_tool_id=tube.id, level_ng_per_ml=10.0)
        )

        assert tube.calibration_context is not None
        assert tube.calibration_context.level_ng_per_ml == 10.0

    def test_true_level_within_clamp_band_of_nominal(self) -> None:
        nominal = 25.0
        factor_min = PhysicalSimulationService.calibration_prep_factor_min
        factor_max = PhysicalSimulationService.calibration_prep_factor_max
        random.seed(42)
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        vial_id = _place_vial_on_bench(service, exp_id)

        AddCalibrationToVialService(service).run(
            exp_id, AddCalibrationToVialRequest(vial_tool_id=vial_id, level_ng_per_ml=nominal)
        )

        exp = service._require_experiment(exp_id)
        vial = exp.workbench.slots[0].tool
        assert vial is not None
        ctx = vial.calibration_context
        assert ctx is not None
        assert ctx.level_ng_per_ml == nominal
        assert ctx.true_level_ng_per_ml is not None
        assert factor_min * nominal <= ctx.true_level_ng_per_ml <= factor_max * nominal

    def test_true_level_differs_from_nominal_for_some_seed(self) -> None:
        """With at least one seed, true_level_ng_per_ml != level_ng_per_ml."""
        any_differs = False
        for seed in range(50):
            random.seed(seed)
            service = ExperimentRuntimeService()
            exp_id = _create(service)
            vial_id = _place_vial_on_bench(service, exp_id)

            AddCalibrationToVialService(service).run(
                exp_id, AddCalibrationToVialRequest(vial_tool_id=vial_id, level_ng_per_ml=25.0)
            )

            exp = service._require_experiment(exp_id)
            vial = exp.workbench.slots[0].tool
            assert vial is not None
            ctx = vial.calibration_context
            assert ctx is not None
            assert ctx.level_ng_per_ml == 25.0
            if ctx.true_level_ng_per_ml != ctx.level_ng_per_ml:
                any_differs = True
                break
        assert any_differs, "true_level_ng_per_ml never differed from level_ng_per_ml across 50 seeds"


# ---------------------------------------------------------------------------
# draw_prepared_level unit tests
# ---------------------------------------------------------------------------

class TestDrawPreparedLevel:
    def test_zero_nominal_returns_zero(self) -> None:
        assert PhysicalSimulationService.draw_prepared_level(0.0) == 0.0

    def test_negative_nominal_returns_zero(self) -> None:
        assert PhysicalSimulationService.draw_prepared_level(-5.0) == 0.0

    def test_draws_stay_within_clamp_band(self) -> None:
        nominal = 50.0
        min_v = PhysicalSimulationService.calibration_prep_factor_min * nominal
        max_v = PhysicalSimulationService.calibration_prep_factor_max * nominal
        random.seed(42)
        for _ in range(500):
            result = PhysicalSimulationService.draw_prepared_level(nominal)
            assert min_v <= result <= max_v, f"Out of clamp band: {result}"

    def test_draws_are_not_always_equal_to_nominal(self) -> None:
        nominal = 50.0
        random.seed(1234)
        results = [PhysicalSimulationService.draw_prepared_level(nominal) for _ in range(200)]
        assert any(r != nominal for r in results), "All draws equal nominal — variance not applied"


# ---------------------------------------------------------------------------
# _compute_calibration_compounds — true-level-driven signal scatter
# ---------------------------------------------------------------------------

class TestComputeCalibrationResponses:
    def test_response_follows_the_truly_prepared_level_not_the_declared_one(self) -> None:
        nominal = 50.0
        true_level_a = 49.0
        true_level_b = 52.0
        ctx_a = CalibrationContext(
            level_ng_per_ml=nominal,
            compound_ids=["chlorpyrifos"],
            true_level_ng_per_ml=true_level_a,
        )
        ctx_b = CalibrationContext(
            level_ng_per_ml=nominal,
            compound_ids=["chlorpyrifos"],
            true_level_ng_per_ml=true_level_b,
        )

        random.seed(SEED)
        responses_a = _compute_calibration_responses(ctx_a)
        random.seed(SEED)
        responses_b = _compute_calibration_responses(ctx_b)

        # Same seed → same env_noise draw → responses differ exactly by the true-level ratio.
        assert responses_b["chlorpyrifos"] == pytest.approx(
            responses_a["chlorpyrifos"] * (true_level_b / true_level_a), rel=1e-6
        )

    def test_covers_every_compound_of_the_standard(self) -> None:
        ctx = CalibrationContext(
            level_ng_per_ml=10.0,
            compound_ids=["boscalid", "acetamiprid"],
        )

        responses = _compute_calibration_responses(ctx)

        assert set(responses) == {"boscalid", "acetamiprid"}

    def test_a_pure_standard_carries_no_internal_standard_channel(self) -> None:
        ctx = CalibrationContext(level_ng_per_ml=10.0, compound_ids=["boscalid"])

        assert INTERNAL_STANDARD_COMPOUND_ID not in _compute_calibration_responses(ctx)


# ---------------------------------------------------------------------------
# RunSequenceService — calibration vials
# ---------------------------------------------------------------------------

class TestLoadRackIntoInstrument:
    def test_loads_a_non_empty_deployed_rack_and_persists_the_state(self, tmp_path) -> None:
        repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
        service = ExperimentRuntimeService(repository=repository)
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        _place_vial_in_rack(service, exp_id)

        result = LoadRackIntoInstrumentService(service).run(
            exp_id,
            LoadRackIntoInstrumentRequest(),
        )

        assert result.rack.state == "loaded"
        reloaded = ExperimentRuntimeService(repository=repository)._require_experiment(exp_id)
        assert reloaded.rack.state == "loaded"

    def test_rejects_an_empty_rack(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)

        with pytest.raises(ValueError, match="contains no vials"):
            _load_rack_into_instrument(service, exp_id)


class TestUnloadRackFromInstrument:
    def test_unloads_a_loaded_rack_and_persists_the_state(self, tmp_path) -> None:
        repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
        service = ExperimentRuntimeService(repository=repository)
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        _place_vial_in_rack(service, exp_id)
        _load_rack_into_instrument(service, exp_id)

        result = UnloadRackFromInstrumentService(service).run(
            exp_id,
            UnloadRackFromInstrumentRequest(),
        )

        assert result.rack.state == "available"
        reloaded = ExperimentRuntimeService(repository=repository)._require_experiment(exp_id)
        assert reloaded.rack.state == "available"

    def test_rejects_unloading_an_available_rack(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)

        with pytest.raises(ValueError, match="not loaded"):
            UnloadRackFromInstrumentService(service).run(
                exp_id,
                UnloadRackFromInstrumentRequest(),
            )


class TestRunSequenceWithCalibration:
    def test_console_configuration_drives_injection_order_and_metadata(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        sample_vial_id = _place_vial_in_rack(service, exp_id, "rack_slot_4")
        calibration_vial_id = _place_vial_in_rack(service, exp_id, "rack_slot_2")

        AddCalibrationToVialService(service).run(
            exp_id,
            AddCalibrationToVialRequest(
                vial_tool_id=calibration_vial_id,
                level_ng_per_ml=50.0,
            ),
        )
        _load_rack_into_instrument(service, exp_id)
        RunSequenceService(service).run(
            exp_id,
            RunSequenceRequest(
                method_id=APPLE_PESTICIDES_MRM_V1_ID,
                injections=[
                    AcquisitionSequenceLineRequest(
                        rack_slot_id="rack_slot_4",
                        sample_name="Apple sample",
                        injection_volume_ul=3.0,
                        repetitions=2,
                        output_filename="apple_sample.mzML",
                    ),
                    AcquisitionSequenceLineRequest(
                        rack_slot_id="rack_slot_2",
                        sample_name="Calibration 50",
                        injection_volume_ul=5.0,
                        repetitions=1,
                        output_filename="calibration_50.mzML",
                    ),
                ],
            ),
        )

        exp = service._require_experiment(exp_id)
        instrument = next(w for w in exp.workspace.widgets if w.id == "instrument")
        assert len(instrument.sequence_runs) == 1
        run = instrument.sequence_runs[0]
        assert run.method_id == APPLE_PESTICIDES_MRM_V1_ID
        assert [injection.rack_slot_id for injection in run.injections] == [
            "rack_slot_2",
            "rack_slot_4",
            "rack_slot_4",
        ]
        calibration = run.injections[0]
        assert calibration.vial_id == calibration_vial_id
        assert calibration.sample_name == "Calibration 50"
        assert calibration.injection_volume_ul == 5.0
        assert calibration.replicate_index == 1
        assert calibration.output_filename == "calibration_50.mzML"
        assert calibration.status == "calibration"
        assert calibration.id
        # Every declared channel is recorded, whatever the vial holds.
        assert len(calibration.traces) == len(APPLE_PESTICIDES_MRM_V1.transitions)
        assert all(trace.injection_id == calibration.id for trace in calibration.traces)
        boscalid_quantifier = next(
            trace for trace in calibration.traces if trace.transition.id == "boscalid__quantifier"
        )
        assert max(boscalid_quantifier.intensities) > 1000.0

        first_sample, second_sample = run.injections[1:]
        assert first_sample.vial_id == sample_vial_id
        assert first_sample.sample_name == "Apple sample"
        assert first_sample.injection_volume_ul == 3.0
        assert first_sample.replicate_index == 1
        assert first_sample.output_filename == "apple_sample_r1.mzML"
        assert second_sample.replicate_index == 2
        assert second_sample.output_filename == "apple_sample_r2.mzML"

    def test_injection_status_follows_the_physical_vial_only(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        physical_calibration_id = _place_vial_in_rack(service, exp_id, "rack_slot_1")
        empty_vial_id = _place_vial_in_rack(service, exp_id, "rack_slot_2")
        AddCalibrationToVialService(service).run(
            exp_id,
            AddCalibrationToVialRequest(
                vial_tool_id=physical_calibration_id,
                level_ng_per_ml=20.0,
            ),
        )
        _load_rack_into_instrument(service, exp_id)

        RunSequenceService(service).run(
            exp_id,
            RunSequenceRequest(
                method_id=APPLE_PESTICIDES_MRM_V1_ID,
                injections=[
                    AcquisitionSequenceLineRequest(
                        rack_slot_id="rack_slot_1",
                        sample_name="Vial one",
                        injection_volume_ul=5.0,
                        repetitions=1,
                        output_filename="vial_one.mzML",
                    ),
                    AcquisitionSequenceLineRequest(
                        rack_slot_id="rack_slot_2",
                        sample_name="Vial two",
                        injection_volume_ul=5.0,
                        repetitions=1,
                        output_filename="vial_two.mzML",
                    ),
                ],
            ),
        )

        exp = service._require_experiment(exp_id)
        instrument = next(w for w in exp.workspace.widgets if w.id == "instrument")
        physical_calibration, empty_vial = instrument.sequence_runs[0].injections
        assert physical_calibration.vial_id == physical_calibration_id
        assert physical_calibration.status == "calibration"
        assert empty_vial.vial_id == empty_vial_id
        assert empty_vial.status == "no_extract_context"

    def test_accepts_a_single_vial(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        _place_vial_in_rack(service, exp_id, "rack_slot_1")
        _load_rack_into_instrument(service, exp_id)

        RunSequenceService(service).run(
            exp_id,
            RunSequenceRequest(
                method_id=APPLE_PESTICIDES_MRM_V1_ID,
                injections=[
                    AcquisitionSequenceLineRequest(
                        rack_slot_id="rack_slot_1",
                        sample_name="Lone vial",
                        injection_volume_ul=5.0,
                        repetitions=1,
                        output_filename="lone_vial.mzML",
                    )
                ],
            ),
        )

        exp = service._require_experiment(exp_id)
        instrument = next(w for w in exp.workspace.widgets if w.id == "instrument")
        assert [inj.sample_name for inj in instrument.sequence_runs[0].injections] == [
            "Lone vial"
        ]

    def test_accepts_two_calibrants_and_one_sample(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        first_calibrant_id = _place_vial_in_rack(service, exp_id, "rack_slot_1")
        second_calibrant_id = _place_vial_in_rack(service, exp_id, "rack_slot_2")
        _place_vial_in_rack(service, exp_id, "rack_slot_3")
        for vial_id, level in ((first_calibrant_id, 10.0), (second_calibrant_id, 50.0)):
            AddCalibrationToVialService(service).run(
                exp_id,
                AddCalibrationToVialRequest(vial_tool_id=vial_id, level_ng_per_ml=level),
            )
        _load_rack_into_instrument(service, exp_id)

        RunSequenceService(service).run(
            exp_id,
            RunSequenceRequest(
                method_id=APPLE_PESTICIDES_MRM_V1_ID,
                injections=[
                    AcquisitionSequenceLineRequest(
                        rack_slot_id=f"rack_slot_{position}",
                        sample_name=name,
                        injection_volume_ul=5.0,
                        repetitions=1,
                        output_filename=f"{name.lower()}.mzML",
                    )
                    for position, name in ((1, "Cal10"), (2, "Cal50"), (3, "AppleA"))
                ],
            ),
        )

        exp = service._require_experiment(exp_id)
        instrument = next(w for w in exp.workspace.widgets if w.id == "instrument")
        injections = instrument.sequence_runs[0].injections
        assert [inj.sample_name for inj in injections] == ["Cal10", "Cal50", "AppleA"]
        assert [inj.status for inj in injections] == [
            "calibration",
            "calibration",
            "no_extract_context",
        ]

    def test_accepts_several_samples_without_any_calibrant(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        for position in (1, 2, 3):
            _place_vial_in_rack(service, exp_id, f"rack_slot_{position}")
        _load_rack_into_instrument(service, exp_id)

        RunSequenceService(service).run(
            exp_id,
            RunSequenceRequest(
                method_id=APPLE_PESTICIDES_MRM_V1_ID,
                injections=[
                    AcquisitionSequenceLineRequest(
                        rack_slot_id=f"rack_slot_{position}",
                        sample_name=f"Apple {position}",
                        injection_volume_ul=5.0,
                        repetitions=1,
                        output_filename=f"apple_{position}.mzML",
                    )
                    for position in (1, 2, 3)
                ],
            ),
        )

        exp = service._require_experiment(exp_id)
        instrument = next(w for w in exp.workspace.widgets if w.id == "instrument")
        assert len(instrument.sequence_runs[0].injections) == 3

    def test_rejects_a_sequence_line_without_a_sample_name(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        _place_vial_in_rack(service, exp_id, "rack_slot_1")
        _load_rack_into_instrument(service, exp_id)

        with pytest.raises(ValueError, match="sample name"):
            RunSequenceService(service).run(
                exp_id,
                RunSequenceRequest(
                    method_id=APPLE_PESTICIDES_MRM_V1_ID,
                    injections=[
                        AcquisitionSequenceLineRequest(
                            rack_slot_id="rack_slot_1",
                            sample_name="   ",
                            injection_volume_ul=5.0,
                            repetitions=1,
                            output_filename="unnamed.mzML",
                        )
                    ],
                ),
            )

    def test_rejects_duplicate_rack_positions(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        _place_vial_in_rack(service, exp_id, "rack_slot_1")
        _load_rack_into_instrument(service, exp_id)

        with pytest.raises(ValueError, match="exactly once"):
            RunSequenceService(service).run(
                exp_id,
                RunSequenceRequest(
                    method_id=APPLE_PESTICIDES_MRM_V1_ID,
                    injections=[
                        AcquisitionSequenceLineRequest(
                            rack_slot_id="rack_slot_1",
                            sample_name=name,
                            injection_volume_ul=5.0,
                            repetitions=1,
                            output_filename=f"{name}.mzML",
                        )
                        for name in ("first", "second")
                    ],
                ),
            )

    def test_rejects_duplicate_output_filenames(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        _place_vial_in_rack(service, exp_id, "rack_slot_1")
        _place_vial_in_rack(service, exp_id, "rack_slot_2")
        _load_rack_into_instrument(service, exp_id)

        with pytest.raises(ValueError, match="unique"):
            RunSequenceService(service).run(
                exp_id,
                RunSequenceRequest(
                    method_id=APPLE_PESTICIDES_MRM_V1_ID,
                    injections=[
                        AcquisitionSequenceLineRequest(
                            rack_slot_id=f"rack_slot_{position}",
                            sample_name=f"Vial {position}",
                            injection_volume_ul=5.0,
                            repetitions=1,
                            output_filename="same.mzML",
                        )
                        for position in (1, 2)
                    ],
                ),
            )

    def test_no_vials_in_rack_raises(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)

        with pytest.raises(ValueError, match="no vials"):
            RunSequenceService(service).run(
                exp_id,
                RunSequenceRequest(
                    method_id=APPLE_PESTICIDES_MRM_V1_ID,
                    injections=[],
                ),
            )

    def test_rack_not_loaded_into_instrument_raises(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        _place_vial_in_rack(service, exp_id, "rack_slot_1")

        with pytest.raises(ValueError, match="loaded into the LC-MS/MS"):
            RunSequenceService(service).run(
                exp_id,
                RunSequenceRequest(
                    method_id=APPLE_PESTICIDES_MRM_V1_ID,
                    injections=[],
                ),
            )

    def test_instrument_not_deployed_raises(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)

        with pytest.raises(ValueError, match="instrument"):
            RunSequenceService(service).run(
                exp_id,
                RunSequenceRequest(
                    method_id=APPLE_PESTICIDES_MRM_V1_ID,
                    injections=[],
                ),
            )

    def test_freezes_an_immutable_method_snapshot_into_the_run(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        _place_vial_in_rack(service, exp_id, "rack_slot_1")
        _load_rack_into_instrument(service, exp_id)

        RunSequenceService(service).run(
            exp_id,
            RunSequenceRequest(
                method_id=APPLE_PESTICIDES_MRM_V1_ID,
                injections=[
                    AcquisitionSequenceLineRequest(
                        rack_slot_id="rack_slot_1",
                        sample_name="Apple A",
                        injection_volume_ul=5.0,
                        repetitions=1,
                        output_filename="apple_a.mzML",
                    )
                ],
            ),
        )

        exp = service._require_experiment(exp_id)
        instrument = next(w for w in exp.workspace.widgets if w.id == "instrument")
        run = instrument.sequence_runs[0]
        assert run.method_id == APPLE_PESTICIDES_MRM_V1_ID
        assert run.method_snapshot == APPLE_PESTICIDES_MRM_V1
        assert run.method_snapshot.version == "1.0.0"
        assert run.method_snapshot.is_educational is True
        assert len(run.method_snapshot.transitions) == len(APPLE_PESTICIDES_MRM_V1.transitions)
        with pytest.raises(AttributeError):
            run.method_snapshot.version = "9.9.9"  # type: ignore[misc]

    def test_an_injected_run_is_reproducible_from_its_seed(self) -> None:
        def run_once() -> list[list[float]]:
            service = ExperimentRuntimeService()
            exp_id = _create(service)
            _deploy_instrument_and_rack(service, exp_id)
            vial_id = _place_vial_in_rack(service, exp_id, "rack_slot_1")
            AddCalibrationToVialService(service).run(
                exp_id,
                AddCalibrationToVialRequest(vial_tool_id=vial_id, level_ng_per_ml=10.0),
            )
            _load_rack_into_instrument(service, exp_id)
            RunSequenceService(service, rng=random.Random(4242)).run(
                exp_id,
                RunSequenceRequest(
                    method_id=APPLE_PESTICIDES_MRM_V1_ID,
                    injections=[
                        AcquisitionSequenceLineRequest(
                            rack_slot_id="rack_slot_1",
                            sample_name="Cal 10",
                            injection_volume_ul=5.0,
                            repetitions=1,
                            output_filename="cal_10.mzML",
                        )
                    ],
                ),
            )
            exp = service._require_experiment(exp_id)
            instrument = next(w for w in exp.workspace.widgets if w.id == "instrument")
            return [
                trace.intensities
                for trace in instrument.sequence_runs[0].injections[0].traces
            ]

        random.seed(SEED)
        first = run_once()
        random.seed(SEED)
        second = run_once()

        assert first == second

    def test_traces_follow_the_selected_method(self) -> None:
        """A method declaring fewer channels records fewer traces."""
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        _place_vial_in_rack(service, exp_id, "rack_slot_1")
        _load_rack_into_instrument(service, exp_id)
        two_channel_method = replace(
            APPLE_PESTICIDES_MRM_V1,
            id="two_channel_educational",
            transitions=APPLE_PESTICIDES_MRM_V1.transitions[:2],
        )

        RunSequenceService(service, method_resolver=lambda _id: two_channel_method).run(
            exp_id,
            RunSequenceRequest(
                method_id="two_channel_educational",
                injections=[
                    AcquisitionSequenceLineRequest(
                        rack_slot_id="rack_slot_1",
                        sample_name="Apple A",
                        injection_volume_ul=5.0,
                        repetitions=1,
                        output_filename="apple_a.mzML",
                    )
                ],
            ),
        )

        exp = service._require_experiment(exp_id)
        instrument = next(w for w in exp.workspace.widgets if w.id == "instrument")
        injection = instrument.sequence_runs[0].injections[0]
        assert len(injection.traces) == 2
        assert [trace.transition.id for trace in injection.traces] == [
            t.id for t in two_channel_method.transitions
        ]

    def test_roundtrip_preserves_the_traces(self, tmp_path) -> None:
        repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
        service = ExperimentRuntimeService(repository=repository)
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        vial_id = _place_vial_in_rack(service, exp_id, "rack_slot_1")
        AddCalibrationToVialService(service).run(
            exp_id,
            AddCalibrationToVialRequest(vial_tool_id=vial_id, level_ng_per_ml=25.0),
        )
        _load_rack_into_instrument(service, exp_id)
        RunSequenceService(service).run(
            exp_id,
            RunSequenceRequest(
                method_id=APPLE_PESTICIDES_MRM_V1_ID,
                injections=[
                    AcquisitionSequenceLineRequest(
                        rack_slot_id="rack_slot_1",
                        sample_name="Cal 25",
                        injection_volume_ul=5.0,
                        repetitions=1,
                        output_filename="cal_25.mzML",
                    )
                ],
            ),
        )
        original = next(
            w for w in service._require_experiment(exp_id).workspace.widgets
            if w.id == "instrument"
        ).sequence_runs[0].injections[0]

        reloaded_experiment = ExperimentRuntimeService(
            repository=repository
        )._require_experiment(exp_id)
        instrument = next(
            w for w in reloaded_experiment.workspace.widgets if w.id == "instrument"
        )
        reloaded = instrument.sequence_runs[0].injections[0]

        assert reloaded.id == original.id
        assert len(reloaded.traces) == len(original.traces)
        assert reloaded.traces[0].times_s == original.traces[0].times_s
        assert reloaded.traces[0].intensities == original.traces[0].intensities
        assert reloaded.traces[0].transition == original.traces[0].transition
        assert reloaded.traces[0].acquisition == original.traces[0].acquisition

    def test_a_pre_trace_run_reloads_without_traces(self, tmp_path) -> None:
        """Explicit migration: runs acquired before traces existed keep their metadata.

        Raw signal cannot be reconstructed after the fact — the generator state is
        gone — so such a run reloads with an empty trace list rather than with
        invented data.
        """
        repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
        service = ExperimentRuntimeService(repository=repository)
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        _place_vial_in_rack(service, exp_id, "rack_slot_1")
        _load_rack_into_instrument(service, exp_id)
        RunSequenceService(service).run(
            exp_id,
            RunSequenceRequest(
                method_id=APPLE_PESTICIDES_MRM_V1_ID,
                injections=[
                    AcquisitionSequenceLineRequest(
                        rack_slot_id="rack_slot_1",
                        sample_name="Legacy",
                        injection_volume_ul=5.0,
                        repetitions=1,
                        output_filename="legacy.mzML",
                    )
                ],
            ),
        )
        # Rewrite the stored payload in the pre-trace shape.
        with sqlite3.connect(str(tmp_path / "experiments.sqlite3")) as connection:
            row = connection.execute(
                "SELECT payload FROM experiments WHERE id = ?", (exp_id,)
            ).fetchone()
            payload = json.loads(row[0])
            for widget in payload["workspace"]["widgets"]:
                for run in widget.get("sequence_runs", []):
                    for injection in run["injections"]:
                        injection.pop("traces", None)
                        injection.pop("id", None)
                        injection["compounds"] = [
                            {"compound_id": "boscalid", "pesticide_signal": 1.0}
                        ]
            connection.execute(
                "UPDATE experiments SET payload = ? WHERE id = ?",
                (json.dumps(payload), exp_id),
            )
            connection.commit()

        reloaded = ExperimentRuntimeService(repository=repository)._require_experiment(exp_id)
        instrument = next(w for w in reloaded.workspace.widgets if w.id == "instrument")
        injection = instrument.sequence_runs[0].injections[0]

        assert injection.traces == []
        assert injection.sample_name == "Legacy"
        assert injection.output_filename == "legacy.mzML"
        assert not hasattr(injection, "compounds")

    def test_rejects_an_unknown_acquisition_method(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        _place_vial_in_rack(service, exp_id, "rack_slot_1")
        _load_rack_into_instrument(service, exp_id)

        with pytest.raises(ValueError, match="Unknown acquisition method"):
            RunSequenceService(service).run(
                exp_id,
                RunSequenceRequest(
                    method_id="not_a_method",
                    injections=[
                        AcquisitionSequenceLineRequest(
                            rack_slot_id="rack_slot_1",
                            sample_name="Apple A",
                            injection_volume_ul=5.0,
                            repetitions=1,
                            output_filename="apple_a.mzML",
                        )
                    ],
                ),
            )

    def test_roundtrip_rebuilds_the_stored_snapshot_rather_than_the_registry(
        self, tmp_path
    ) -> None:
        """A past run must reload its own frozen method, not today's registry entry."""
        repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
        service = ExperimentRuntimeService(repository=repository)
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        _place_vial_in_rack(service, exp_id, "rack_slot_1")
        _load_rack_into_instrument(service, exp_id)
        RunSequenceService(service).run(
            exp_id,
            RunSequenceRequest(
                method_id=APPLE_PESTICIDES_MRM_V1_ID,
                injections=[
                    AcquisitionSequenceLineRequest(
                        rack_slot_id="rack_slot_1",
                        sample_name="Apple A",
                        injection_volume_ul=5.0,
                        repetitions=1,
                        output_filename="apple_a.mzML",
                    )
                ],
            ),
        )
        # Rewrite the persisted run as if it had been acquired with an older
        # revision of the method: two transitions only, and a different version.
        experiment = service._require_experiment(exp_id)
        instrument = next(w for w in experiment.workspace.widgets if w.id == "instrument")
        instrument.sequence_runs[0].method_snapshot = replace(
            APPLE_PESTICIDES_MRM_V1,
            version="0.9.0",
            transitions=APPLE_PESTICIDES_MRM_V1.transitions[:2],
        )
        repository.save(experiment)

        reloaded = ExperimentRuntimeService(repository=repository)._require_experiment(exp_id)
        instrument = next(w for w in reloaded.workspace.widgets if w.id == "instrument")
        snapshot = instrument.sequence_runs[0].method_snapshot

        assert snapshot.version == "0.9.0"
        assert len(snapshot.transitions) == 2
        assert snapshot.transitions[0] == APPLE_PESTICIDES_MRM_V1.transitions[0]
        assert isinstance(snapshot.transitions, tuple)
        assert isinstance(snapshot.liquid_chromatography.gradient, tuple)
        assert snapshot.ion_source == APPLE_PESTICIDES_MRM_V1.ion_source

    def test_roundtrip_preserves_acquisition_metadata(self, tmp_path) -> None:
        repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
        service = ExperimentRuntimeService(repository=repository)
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        calibration_vial_id = _place_vial_in_rack(service, exp_id, "rack_slot_1")
        _place_vial_in_rack(service, exp_id, "rack_slot_2")
        AddCalibrationToVialService(service).run(
            exp_id,
            AddCalibrationToVialRequest(
                vial_tool_id=calibration_vial_id,
                level_ng_per_ml=10.0,
            ),
        )
        _load_rack_into_instrument(service, exp_id)
        request = RunSequenceRequest(
            method_id=APPLE_PESTICIDES_MRM_V1_ID,
            injections=[
                AcquisitionSequenceLineRequest(
                    rack_slot_id="rack_slot_1",
                    sample_name="Cal 10",
                    injection_volume_ul=5.0,
                    repetitions=1,
                    output_filename="cal_10.mzML",
                ),
                AcquisitionSequenceLineRequest(
                    rack_slot_id="rack_slot_2",
                    sample_name="Apple A",
                    injection_volume_ul=3.0,
                    repetitions=1,
                    output_filename="apple_a.mzML",
                ),
            ],
        )
        RunSequenceService(service).run(exp_id, request)

        reloaded = ExperimentRuntimeService(repository=repository)._require_experiment(exp_id)
        instrument = next(w for w in reloaded.workspace.widgets if w.id == "instrument")
        run = instrument.sequence_runs[0]
        assert run.method_id == APPLE_PESTICIDES_MRM_V1_ID
        assert run.injections[0].sample_name == "Cal 10"
        assert run.injections[0].output_filename == "cal_10.mzML"
        assert run.injections[1].sample_name == "Apple A"
        assert run.injections[1].injection_volume_ul == 3.0


def test_run_sequence_route_accepts_the_console_contract(monkeypatch) -> None:
    service = ExperimentRuntimeService()
    monkeypatch.setattr(lcmsms_routes, "experiment_service", service)
    exp_id = _create(service)
    _deploy_instrument_and_rack(service, exp_id)
    calibration_vial_id = _place_vial_in_rack(service, exp_id, "rack_slot_1")
    _place_vial_in_rack(service, exp_id, "rack_slot_2")
    AddCalibrationToVialService(service).run(
        exp_id,
        AddCalibrationToVialRequest(
            vial_tool_id=calibration_vial_id,
            level_ng_per_ml=10.0,
        ),
    )
    _load_rack_into_instrument(service, exp_id)

    response = TestClient(app).post(
        f"/experiments/{exp_id}/lcmsms/run-sequence",
        json={
            "method_id": APPLE_PESTICIDES_MRM_V1_ID,
            "injections": [
                {
                    "rack_slot_id": "rack_slot_1",
                    "sample_name": "Cal 10",
                    "injection_volume_ul": 5,
                    "repetitions": 1,
                    "output_filename": "cal_10.mzML",
                },
                {
                    "rack_slot_id": "rack_slot_2",
                    "sample_name": "Apple A",
                    "injection_volume_ul": 5,
                    "repetitions": 1,
                    "output_filename": "apple_a.mzML",
                },
            ],
        },
    )

    assert response.status_code == 200
    instrument = next(
        widget
        for widget in response.json()["workspace"]["widgets"]
        if widget["id"] == "instrument"
    )
    assert instrument["sequence_runs"][0]["method_id"] == APPLE_PESTICIDES_MRM_V1_ID
    assert instrument["sequence_runs"][0]["injections"][1]["sample_name"] == "Apple A"


def test_load_rack_route_marks_the_rack_as_loaded(monkeypatch) -> None:
    service = ExperimentRuntimeService()
    monkeypatch.setattr(lcmsms_routes, "experiment_service", service)
    exp_id = _create(service)
    _deploy_instrument_and_rack(service, exp_id)
    _place_vial_in_rack(service, exp_id)

    response = lcmsms_routes.load_rack_into_instrument(exp_id)

    assert response.rack.state == "loaded"


def test_unload_rack_route_marks_the_rack_as_available(monkeypatch) -> None:
    service = ExperimentRuntimeService()
    monkeypatch.setattr(lcmsms_routes, "experiment_service", service)
    exp_id = _create(service)
    _deploy_instrument_and_rack(service, exp_id)
    _place_vial_in_rack(service, exp_id)
    _load_rack_into_instrument(service, exp_id)

    response = lcmsms_routes.unload_rack_from_instrument(exp_id)

    assert response.rack.state == "available"


# ---------------------------------------------------------------------------
# _compute_compounds unit tests — four invariants
# ---------------------------------------------------------------------------

def _make_vial() -> WorkbenchTool:
    """Return a minimal valid WorkbenchTool to pass as the vial arg."""
    return WorkbenchTool(
        id=new_id("vial"),
        tool_id="sample_vial_lcms",
        label="Test Vial",
        subtitle="",
        accent="blue",
        tool_type="sample_vial",
        capacity_ml=2.0,
    )


def _make_ctx(
    *,
    true_effective_ug_per_kg: float = 100.0,
    sample_mass_g: float = 10.0,
    sample_true_mass_g: float | None = None,
    extract_nominal: float = 10.0,
    extract_true: float | None = None,
    istd_nominal: float | None = 0.05,
    istd_true: float | None = None,
    extraction_manip: float = 1.0,
    istd_manip: float | None = 1.0,
    istd_phase: str | None = "pre_solvent",
    ref_conc: float = 100.0,
) -> InjectionContext:
    extraction_result: QuechersExtractionResult | None = None
    if extraction_manip != 1.0 or istd_manip is not None:
        extraction_result = QuechersExtractionResult(
            extraction_manip_factor=extraction_manip,
            istd_manip_factor=istd_manip,
            istd_phase=istd_phase,
        )
    elif istd_manip is None and istd_nominal is None:
        # external calibration path: no ISTD
        extraction_result = QuechersExtractionResult(
            extraction_manip_factor=extraction_manip,
            istd_manip_factor=None,
            istd_phase=None,
        )
    else:
        extraction_result = QuechersExtractionResult(
            extraction_manip_factor=extraction_manip,
            istd_manip_factor=istd_manip,
            istd_phase=istd_phase,
        )

    return InjectionContext(
        source_tube_id="tube_test",
        sample_mass_g=sample_mass_g,
        sample_true_mass_g=sample_true_mass_g,
        extract_volume_ml=extract_nominal,
        effective_residues_ug_per_kg={"boscalid": true_effective_ug_per_kg},
        extraction_result=extraction_result,
        istd_volume_ml=istd_nominal,
        istd_reference_conc_ng_per_ml=ref_conc,
        extract_true_volume_ml=extract_true,
        istd_true_volume_ml=istd_true,
    )


SEED = 1234




class TestSampleResponseInvariants:
    """The extraction physics, restated on the raw observable.

    Betalab no longer computes a concentration, so these invariants are asserted
    where they are actually visible: on the detector response, and on the
    pesticide/ISTD response ratio the analysis application will work from.
    """

    def _ratio(self, responses: dict[str, float]) -> float:
        return responses["boscalid"] / responses[INTERNAL_STANDARD_COMPOUND_ID]

    def test_response_ratio_matches_the_theoretical_amount_ratio(self) -> None:
        """INV0: all factors = 1 → the ratio is amount_pesticide / amount_istd."""
        ctx = _make_ctx(
            true_effective_ug_per_kg=100.0,
            sample_mass_g=10.0,
            sample_true_mass_g=10.0,
            extract_nominal=10.0,
            extract_true=10.0,
            istd_nominal=0.05,
            istd_true=0.05,
            extraction_manip=1.0,
            istd_manip=1.0,
            ref_conc=100.0,
        )

        random.seed(SEED)
        responses = _compute_sample_responses(_make_vial(), ctx)

        expected = (100.0 * 10.0 * 1e-3) / (0.05 * 100.0)
        assert self._ratio(responses) == pytest.approx(expected, rel=0.02)

    def test_solvent_volume_error_cancels_in_the_ratio_inv1(self) -> None:
        """INV1: a wrong solvent volume dilutes analyte and ISTD alike."""
        ctx_nominal = _make_ctx(extract_nominal=10.0, extract_true=10.0)
        ctx_biased = _make_ctx(extract_nominal=10.0, extract_true=8.0)

        random.seed(SEED)
        nominal = _compute_sample_responses(_make_vial(), ctx_nominal)
        random.seed(SEED)
        biased = _compute_sample_responses(_make_vial(), ctx_biased)

        # Both channels rise together, so the ratio is untouched. Cancellation is
        # near-perfect rather than exact because suppression depends on retention
        # time, and boscalid elutes six seconds from the standard.
        assert self._ratio(biased) == pytest.approx(self._ratio(nominal), rel=0.01)
        # The raw responses clearly moved — but by less than 10/8, because
        # concentrating the extract concentrates the matrix and suppresses more.
        gain = biased["boscalid"] / nominal["boscalid"]
        assert 1.0 < gain < 10.0 / 8.0

    def test_hidden_sample_mass_bias_survives_in_the_ratio(self) -> None:
        baseline = _make_ctx(sample_mass_g=10.0, sample_true_mass_g=10.0)
        undersampled = _make_ctx(sample_mass_g=10.0, sample_true_mass_g=8.0)

        random.seed(SEED)
        baseline_responses = _compute_sample_responses(_make_vial(), baseline)
        random.seed(SEED)
        undersampled_responses = _compute_sample_responses(_make_vial(), undersampled)

        # Less sample really was weighed, and no ISTD ratio can hide it.
        assert self._ratio(undersampled_responses) / self._ratio(baseline_responses) == (
            pytest.approx(0.8, rel=1e-3)
        )

    def test_istd_pipetting_error_biases_the_ratio_inv2(self) -> None:
        istd_nominal = 0.05
        istd_true = 0.04

        ctx_baseline = _make_ctx(istd_nominal=istd_nominal, istd_true=istd_nominal)
        ctx_biased = _make_ctx(istd_nominal=istd_nominal, istd_true=istd_true)

        random.seed(SEED)
        baseline_responses = _compute_sample_responses(_make_vial(), ctx_baseline)
        random.seed(SEED)
        biased_responses = _compute_sample_responses(_make_vial(), ctx_biased)

        # Too little ISTD delivered → its channel is weaker → the ratio inflates.
        assert self._ratio(biased_responses) / self._ratio(baseline_responses) == (
            pytest.approx(istd_nominal / istd_true, rel=1e-4)
        )
        assert biased_responses["boscalid"] == pytest.approx(
            baseline_responses["boscalid"], rel=1e-4
        )

    def test_without_istd_the_response_carries_the_full_bias_inv4(self) -> None:
        """INV4: no ISTD channel, so extraction and solvent errors stay visible."""
        true_effective = 100.0
        extraction_manip = 0.9
        extract_true = 8.0

        ctx = _make_ctx(
            true_effective_ug_per_kg=true_effective,
            sample_mass_g=10.0,
            sample_true_mass_g=10.0,
            extract_nominal=10.0,
            extract_true=extract_true,
            istd_nominal=None,
            istd_true=None,
            extraction_manip=extraction_manip,
            istd_manip=None,
            istd_phase=None,
        )

        random.seed(SEED)
        responses = _compute_sample_responses(_make_vial(), ctx)

        assert INTERNAL_STANDARD_COMPOUND_ID not in responses
        suppression = PhysicalSimulationService.matrix_suppression_factor(
            PhysicalSimulationService.matrix_load_g_per_ml(10.0, extract_true),
            _reference_retention_time_s("boscalid"),
        )
        expected = (
            true_effective * 10.0 * 1e-3 * extraction_manip * suppression
        ) / extract_true
        assert responses["boscalid"] == pytest.approx(expected, rel=0.02)

    def test_returns_no_quantification_only_raw_responses(self) -> None:
        responses = _compute_sample_responses(_make_vial(), _make_ctx())

        assert set(responses) == {"boscalid", INTERNAL_STANDARD_COMPOUND_ID}
        assert all(isinstance(value, float) for value in responses.values())


class TestInjectionsConsumeTheVial:
    """An injection really withdraws liquid: a vial cannot be re-run forever."""

    def _vial_volume_ml(self, service: ExperimentRuntimeService, exp_id: str) -> float:
        exp = service._require_experiment(exp_id)
        vial = exp.rack.slots[0].tool
        assert vial is not None
        return sum(liquid.volume_ml for liquid in vial.liquids)

    def _run(self, service: ExperimentRuntimeService, exp_id: str, volume_ul: float = 5.0) -> None:
        RunSequenceService(service).run(
            exp_id,
            RunSequenceRequest(
                method_id=APPLE_PESTICIDES_MRM_V1_ID,
                injections=[
                    AcquisitionSequenceLineRequest(
                        rack_slot_id="rack_slot_1",
                        sample_name="Cal 10",
                        injection_volume_ul=volume_ul,
                        repetitions=1,
                        output_filename="01_cal.mzML",
                    )
                ],
            ),
        )

    def _prepare(self, service: ExperimentRuntimeService) -> str:
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        vial_id = _place_vial_in_rack(service, exp_id)
        AddCalibrationToVialService(service).run(
            exp_id, AddCalibrationToVialRequest(vial_tool_id=vial_id, level_ng_per_ml=10.0)
        )
        _load_rack_into_instrument(service, exp_id)
        return exp_id

    def test_an_injection_removes_its_volume_from_the_vial(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = self._prepare(service)
        before = self._vial_volume_ml(service, exp_id)

        self._run(service, exp_id, volume_ul=5.0)

        assert self._vial_volume_ml(service, exp_id) == pytest.approx(before - 0.005, abs=1e-6)

    def test_a_drained_vial_is_still_injected_but_records_baseline(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = self._prepare(service)
        exp = service._require_experiment(exp_id)
        vial = exp.rack.slots[0].tool
        assert vial is not None
        # Leave only the dead volume the needle cannot reach.
        for liquid in vial.liquids:
            liquid.volume_ml = 0.04

        self._run(service, exp_id, volume_ul=5.0)

        instrument = next(w for w in exp.workspace.widgets if w.id == "instrument")
        injection = instrument.sequence_runs[-1].injections[0]
        assert injection.status == "insufficient_volume"
        assert injection.traces, "the channels are still recorded, they are simply flat"
        assert max(max(t.intensities) for t in injection.traces) < BASELINE_COUNTS * 3

    def test_a_dry_vial_is_not_drawn_from_any_further(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = self._prepare(service)
        exp = service._require_experiment(exp_id)
        vial = exp.rack.slots[0].tool
        assert vial is not None
        for liquid in vial.liquids:
            liquid.volume_ml = 0.04

        self._run(service, exp_id, volume_ul=5.0)

        assert self._vial_volume_ml(service, exp_id) == pytest.approx(0.04, abs=1e-9)
