"""Tests for the accelerated acquisition clock: a sequence takes time to record."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.domain.acquisition_methods import APPLE_PESTICIDES_MRM_V1
from app.services.domain_services.acquisition_clock import (
    ACQUISITION_TIME_ACCELERATION,
    is_sequence_complete,
)
from app.services.domain_services.lcmsms import (
    AcquisitionSequenceLineRequest,
    RunSequenceRequest,
    RunSequenceService,
    SkipAcquisitionRequest,
    SkipAcquisitionService,
    UnloadRackFromInstrumentRequest,
    UnloadRackFromInstrumentService,
)
from app.services.domain_services.rack import (
    PlaceToolInRackSlotRequest,
    PlaceToolInRackSlotService,
)
from app.services.experiment_service import ExperimentRuntimeService

RUNTIME_S = APPLE_PESTICIDES_MRM_V1.runtime_s
START = datetime(2026, 8, 8, 9, 0, 0, tzinfo=UTC)


def _service_at(moment: datetime) -> ExperimentRuntimeService:
    service = ExperimentRuntimeService()
    service._now_fn = lambda: moment
    return service


def _bootstrap(service: ExperimentRuntimeService, vial_count: int) -> str:
    exp_id = service.create_experiment().id
    experiment = service._require_experiment(exp_id)
    for widget in experiment.workspace.widgets:
        if widget.id in ("instrument", "rack"):
            widget.is_present = True
    for index in range(1, vial_count + 1):
        PlaceToolInRackSlotService(service).run(
            exp_id,
            PlaceToolInRackSlotRequest(rack_slot_id=f"rack_slot_{index}", tool_id="sample_vial_lcms"),
        )
    experiment.rack.state = "loaded"
    return exp_id


def _launch(service: ExperimentRuntimeService, exp_id: str, vial_count: int) -> None:
    RunSequenceService(service).run(
        exp_id,
        RunSequenceRequest(
            method_id=APPLE_PESTICIDES_MRM_V1.id,
            injections=[
                AcquisitionSequenceLineRequest(
                    rack_slot_id=f"rack_slot_{index}",
                    sample_name=f"Vial {index}",
                    injection_volume_ul=5.0,
                    repetitions=1,
                    output_filename=f"{index:02d}_vial.mzML",
                )
                for index in range(1, vial_count + 1)
            ],
        ),
    )


def _only_run(service: ExperimentRuntimeService, exp_id: str):
    experiment = service._require_experiment(exp_id)
    instrument = next(w for w in experiment.workspace.widgets if w.id == "instrument")
    return instrument.sequence_runs[-1]


class TestSequenceStartsRunning:
    def test_a_launched_sequence_has_recorded_nothing_yet(self) -> None:
        service = _service_at(START)
        exp_id = _bootstrap(service, 2)

        _launch(service, exp_id, 2)

        run = _only_run(service, exp_id)
        assert run.elapsed_s == 0.0
        assert is_sequence_complete(run) is False

    def test_the_sequence_lasts_one_run_duration_per_injection(self) -> None:
        service = _service_at(START)
        exp_id = _bootstrap(service, 3)

        _launch(service, exp_id, 3)

        assert _only_run(service, exp_id).total_duration_s == pytest.approx(3 * RUNTIME_S)

    def test_injections_start_one_after_the_other(self) -> None:
        service = _service_at(START)
        exp_id = _bootstrap(service, 3)

        _launch(service, exp_id, 3)

        offsets = [inj.start_offset_s for inj in _only_run(service, exp_id).injections]
        assert offsets == [0.0, RUNTIME_S, 2 * RUNTIME_S]

    def test_the_rack_stays_locked_while_the_sequence_runs(self) -> None:
        service = _service_at(START)
        exp_id = _bootstrap(service, 1)

        _launch(service, exp_id, 1)

        assert service._require_experiment(exp_id).rack.state == "locked"

    def test_the_rack_cannot_be_unloaded_mid_acquisition(self) -> None:
        service = _service_at(START)
        exp_id = _bootstrap(service, 1)
        _launch(service, exp_id, 1)

        with pytest.raises(ValueError, match="cannot be unloaded during an acquisition"):
            UnloadRackFromInstrumentService(service).run(exp_id, UnloadRackFromInstrumentRequest())


class TestClockAdvancesTheAcquisition:
    def test_wall_time_is_recorded_at_the_acceleration_factor(self) -> None:
        service = _service_at(START)
        exp_id = _bootstrap(service, 2)
        _launch(service, exp_id, 2)

        service._now_fn = lambda: START + timedelta(seconds=4)
        service.get_experiment(exp_id)

        assert _only_run(service, exp_id).elapsed_s == pytest.approx(4 * ACQUISITION_TIME_ACCELERATION)

    def test_the_sequence_completes_and_releases_the_rack(self) -> None:
        service = _service_at(START)
        exp_id = _bootstrap(service, 1)
        _launch(service, exp_id, 1)

        wall_seconds = RUNTIME_S / ACQUISITION_TIME_ACCELERATION
        service._now_fn = lambda: START + timedelta(seconds=wall_seconds + 1)
        service.get_experiment(exp_id)

        run = _only_run(service, exp_id)
        assert is_sequence_complete(run)
        assert service._require_experiment(exp_id).rack.state == "completed"

    def test_elapsed_never_runs_past_the_sequence_duration(self) -> None:
        service = _service_at(START)
        exp_id = _bootstrap(service, 1)
        _launch(service, exp_id, 1)

        service._now_fn = lambda: START + timedelta(hours=3)
        service.get_experiment(exp_id)

        run = _only_run(service, exp_id)
        assert run.elapsed_s == pytest.approx(run.total_duration_s)

    def test_a_finished_sequence_is_not_advanced_again(self) -> None:
        service = _service_at(START)
        exp_id = _bootstrap(service, 1)
        _launch(service, exp_id, 1)
        service._now_fn = lambda: START + timedelta(hours=1)
        service.get_experiment(exp_id)
        completions = [entry for entry in service._require_experiment(exp_id).audit_log if "completed" in entry]

        service._now_fn = lambda: START + timedelta(hours=2)
        service.get_experiment(exp_id)

        assert [entry for entry in service._require_experiment(exp_id).audit_log if "completed" in entry] == completions


class TestSkippingTheWait:
    def test_skipping_finishes_the_sequence_immediately(self) -> None:
        service = _service_at(START)
        exp_id = _bootstrap(service, 2)
        _launch(service, exp_id, 2)

        SkipAcquisitionService(service).run(exp_id, SkipAcquisitionRequest())

        run = _only_run(service, exp_id)
        assert is_sequence_complete(run)
        assert service._require_experiment(exp_id).rack.state == "completed"

    def test_skipping_does_not_change_what_was_recorded(self) -> None:
        """The traces are generated at launch, so skipping only skips waiting."""
        service = _service_at(START)
        exp_id = _bootstrap(service, 1)
        _launch(service, exp_id, 1)
        before = [list(trace.intensities) for trace in _only_run(service, exp_id).injections[0].traces]

        SkipAcquisitionService(service).run(exp_id, SkipAcquisitionRequest())

        after = [list(trace.intensities) for trace in _only_run(service, exp_id).injections[0].traces]
        assert after == before

    def test_skipping_without_a_running_sequence_is_refused(self) -> None:
        service = _service_at(START)
        exp_id = _bootstrap(service, 1)

        with pytest.raises(ValueError, match="No acquisition is currently running"):
            SkipAcquisitionService(service).run(exp_id, SkipAcquisitionRequest())
