from __future__ import annotations

import pytest

from app.domain.models import ProduceFraction, QuechersExtractionResult
from app.services.domain_services.pipette import (
    AspiratePipetteRequest,
    AspiratePipetteService,
    DispensePipetteRequest,
    DispensePipetteService,
)
from app.services.domain_services.workbench import (
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
)
from app.services.experiment_repository import SqliteExperimentRepository
from app.services.experiment_service import ExperimentRuntimeService


def _prepared_experiment(
    service: ExperimentRuntimeService | None = None,
) -> tuple[ExperimentRuntimeService, str, str, str]:
    service = service or ExperimentRuntimeService()
    experiment_id = service.create_experiment().id
    PlaceToolOnWorkbenchService(service).run(
        experiment_id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="centrifuge_tube_50ml"),
    )
    PlaceToolOnWorkbenchService(service).run(
        experiment_id,
        PlaceToolOnWorkbenchRequest(slot_id="station_2", tool_id="sample_vial_lcms"),
    )
    experiment = service._require_experiment(experiment_id)
    tube = experiment.workbench.slots[0].tool
    vial = experiment.workbench.slots[1].tool
    assert tube is not None and vial is not None
    tube.quechers_state.phase = "cemented"
    tube.quechers_extraction_result = QuechersExtractionResult(
        extraction_manip_factor=1.0,
        istd_manip_factor=None,
        istd_phase=None,
    )
    tube.produce_fractions = [
        ProduceFraction(
            id="fraction_1",
            produce_lot_id="lot_1",
            produce_material_state_id="state_1",
            mass_g=10.0,
            location_kind="workbench_tool",
            location_id=tube.id,
            container_id=tube.id,
        )
    ]
    tube.liquids[0:0] = []
    return service, experiment_id, tube.id, vial.id


def test_pipette_aspirates_requested_volume_and_caps_at_capacity() -> None:
    service, experiment_id, tube_id, _ = _prepared_experiment()

    updated = AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=1.3)
    )

    assert updated.pipette.volume_ml == pytest.approx(1.0)
    assert updated.pipette.source_tool_id == tube_id


def test_loaded_pipette_dispenses_incrementally_and_prepares_vial() -> None:
    service, experiment_id, tube_id, vial_id = _prepared_experiment()
    AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.8)
    )

    updated = DispensePipetteService(service).run(
        experiment_id, DispensePipetteRequest(target_tool_id=vial_id, delta_volume_ml=0.3)
    )

    assert updated.pipette.volume_ml == pytest.approx(0.5)
    vial = updated.workbench.slots[1].tool
    assert vial is not None and vial.injection_context is not None
    assert vial.injection_context.extract_volume_ml == pytest.approx(0.3)
    assert vial.injection_context.sample_mass_g == pytest.approx(0.3)


def test_pipette_rejects_aspiration_from_a_vial() -> None:
    service, experiment_id, tube_id, vial_id = _prepared_experiment()
    AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.2)
    )

    with pytest.raises(ValueError, match="centrifuge tube only"):
        AspiratePipetteService(service).run(
            experiment_id, AspiratePipetteRequest(source_tool_id=vial_id, delta_volume_ml=0.1)
        )


def test_loaded_pipette_round_trips_through_sqlite(tmp_path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "pipette.sqlite3"))
    service, experiment_id, tube_id, _ = _prepared_experiment(
        ExperimentRuntimeService(repository=repository)
    )
    AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.4)
    )

    reloaded = ExperimentRuntimeService(repository=repository)._require_experiment(experiment_id)

    assert reloaded.pipette.volume_ml == pytest.approx(0.4)
    assert reloaded.pipette.source_tool_id == tube_id
    assert reloaded.pipette.injection_context is not None
