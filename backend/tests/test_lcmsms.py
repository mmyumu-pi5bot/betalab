"""Tests for LC-MS/MS domain services: calibration preparation and sequence execution."""
from __future__ import annotations

import pytest

from app.services.domain_services.lcmsms import (
    AddCalibrationToVialRequest,
    AddCalibrationToVialService,
    RunSequenceRequest,
    RunSequenceService,
)
from app.services.domain_services.rack import (
    PlaceToolInRackSlotRequest,
    PlaceToolInRackSlotService,
)
from app.services.domain_services.workbench import (
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
)
from app.services.experiment_service import ExperimentRuntimeService


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


# ---------------------------------------------------------------------------
# RunSequenceService — calibration vials
# ---------------------------------------------------------------------------

class TestRunSequenceWithCalibration:
    def test_calibration_vial_produces_calibration_status(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        vial_id = _place_vial_in_rack(service, exp_id)

        AddCalibrationToVialService(service).run(
            exp_id, AddCalibrationToVialRequest(vial_tool_id=vial_id, level_ng_per_ml=50.0)
        )
        RunSequenceService(service).run(exp_id, RunSequenceRequest())

        exp = service._require_experiment(exp_id)
        instrument = next(w for w in exp.workspace.widgets if w.id == "instrument")
        assert len(instrument.sequence_runs) == 1
        run = instrument.sequence_runs[0]
        assert len(run.injections) == 1
        inj = run.injections[0]
        assert inj.status == "calibration"
        assert len(inj.compounds) > 0
        for c in inj.compounds:
            assert c.nominal_conc_ng_per_ml == 50.0
            assert c.calculated_conc_ug_per_kg is None
            assert c.extraction_manip_factor == 1.0
            assert not c.istd_correction_applied
            assert c.pesticide_signal > 0

    def test_empty_vial_produces_no_extract_context(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)
        _place_vial_in_rack(service, exp_id)

        RunSequenceService(service).run(exp_id, RunSequenceRequest())

        exp = service._require_experiment(exp_id)
        instrument = next(w for w in exp.workspace.widgets if w.id == "instrument")
        inj = instrument.sequence_runs[0].injections[0]
        assert inj.status == "no_extract_context"

    def test_no_vials_in_rack_raises(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)
        _deploy_instrument_and_rack(service, exp_id)

        with pytest.raises(ValueError, match="no vials"):
            RunSequenceService(service).run(exp_id, RunSequenceRequest())

    def test_instrument_not_deployed_raises(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = _create(service)

        with pytest.raises(ValueError, match="instrument"):
            RunSequenceService(service).run(exp_id, RunSequenceRequest())
