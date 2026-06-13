from pathlib import Path

import pytest

from app.services.domain_services.tool_contents import (
    AddLiquidToToolRequest,
    AddLiquidToToolService,
)
from app.services.domain_services.vortex import (
    EmptyRequest,
    MoveWorkbenchToolToVortexRequest,
    MoveWorkbenchToolToVortexService,
    StartVortexCycleService,
)
from app.services.domain_services.workbench import (
    AddLiquidToWorkbenchToolRequest,
    AddLiquidToWorkbenchToolService,
    CloseWorkbenchToolService,
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
    RemoveLiquidFromWorkbenchToolService,
    WorkbenchLiquidRequest,
    WorkbenchSlotRequest,
)
from app.services.domain_services.workspace import (
    AdvanceWorkspaceCryogenicsRequest,
    AdvanceWorkspaceCryogenicsService,
)
from app.services.experiment_repository import SqliteExperimentRepository
from app.services.experiment_service import ExperimentRuntimeService


def _place_tube(service: ExperimentRuntimeService, experiment_id: str) -> None:
    PlaceToolOnWorkbenchService(service).run(
        experiment_id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="centrifuge_tube_50ml"),
    )


def _add(
    service: ExperimentRuntimeService,
    experiment_id: str,
    liquid_id: str,
    volume_ml: float | None = None,
) -> None:
    AddLiquidToWorkbenchToolService(service).run(
        experiment_id,
        AddLiquidToWorkbenchToolRequest(
            slot_id="station_1",
            liquid_id=liquid_id,
            volume_ml=volume_ml,
        ),
    )


def _advance(service: ExperimentRuntimeService, experiment_id: str, elapsed_ms: float) -> None:
    while elapsed_ms > 0:
        step_ms = min(elapsed_ms, 5000)
        AdvanceWorkspaceCryogenicsService(service).run(
            experiment_id,
            AdvanceWorkspaceCryogenicsRequest(elapsed_ms=step_ms),
        )
        elapsed_ms -= step_ms


def _tube(service: ExperimentRuntimeService, experiment_id: str):
    tool = service._require_experiment(experiment_id).workbench.slots[0].tool
    assert tool is not None
    return tool


def _vortex_tool(service: ExperimentRuntimeService, experiment_id: str):
    widget = next(widget for widget in service._require_experiment(experiment_id).workspace.widgets if widget.id == "vortex")
    assert widget.tool is not None
    return widget.tool


def test_salts_added_to_wet_tube_start_exothermic_reaction_and_cementation() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)

    _add(service, experiment.id, "quechers_salts")
    _advance(service, experiment.id, 7500)

    state = _tube(service, experiment.id).quechers_state
    assert state.salts_added is True
    assert state.phase == "reacting"
    assert state.temperature_c == pytest.approx(65.0, abs=0.01)
    assert state.cementation_progress == pytest.approx(0.5, abs=0.001)
    assert state.thermal_degradation_progress > 0


@pytest.mark.parametrize(
    "tool_id",
    ("centrifuge_tube_50ml", "cleanup_tube_dspe", "sample_vial_lcms", "beaker_rinse"),
)
def test_salts_can_be_added_to_every_open_liquid_container(tool_id: str) -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id=tool_id),
    )

    _add(service, experiment.id, "quechers_salts")

    state = _tube(service, experiment.id).quechers_state
    assert state.salts_added is True
    assert state.phase == "armed"


def test_salts_can_be_added_to_a_wet_tube_on_the_vortex() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    MoveWorkbenchToolToVortexService(service).run(
        experiment.id,
        MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"),
    )

    vortex_tool = _vortex_tool(service, experiment.id)
    AddLiquidToToolService(service).run(
        experiment.id,
        AddLiquidToToolRequest(
            tool_id=vortex_tool.id,
            liquid_id="quechers_salts",
            volume_ml=1,
        ),
    )

    state = _vortex_tool(service, experiment.id).quechers_state
    assert state.salts_added is True
    assert state.phase == "reacting"


def test_unmixed_salted_tube_cements_after_fifteen_seconds() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _add(service, experiment.id, "quechers_salts")

    _advance(service, experiment.id, 15000)

    state = _tube(service, experiment.id).quechers_state
    assert state.phase == "cemented"
    assert state.cementation_progress == pytest.approx(1.0)
    assert state.is_usable is False


def test_starting_vortex_in_time_stops_cementation_and_cycle_marks_mixed() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _add(service, experiment.id, "quechers_salts")
    _advance(service, experiment.id, 10000)
    CloseWorkbenchToolService(service).run(experiment.id, WorkbenchSlotRequest(slot_id="station_1"))
    MoveWorkbenchToolToVortexService(service).run(
        experiment.id,
        MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"),
    )

    StartVortexCycleService(service).run(experiment.id, EmptyRequest())
    progress_at_start = _vortex_tool(service, experiment.id).quechers_state.cementation_progress
    _advance(service, experiment.id, 3000)

    state = _vortex_tool(service, experiment.id).quechers_state
    assert state.phase == "mixed"
    assert state.cementation_progress == pytest.approx(progress_at_start)
    assert state.is_usable is True


def test_vortexing_open_tube_with_wet_contents_contaminates_tool() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    MoveWorkbenchToolToVortexService(service).run(
        experiment.id,
        MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"),
    )

    StartVortexCycleService(service).run(experiment.id, EmptyRequest())

    state = _vortex_tool(service, experiment.id).quechers_state
    assert state.phase == "contaminated"
    assert state.faults == ["vortexed_open", "vortexed_without_salts"]
    assert state.is_usable is False

    _advance(service, experiment.id, 3000)
    assert all(not fraction.is_mixed for fraction in _vortex_tool(service, experiment.id).produce_fractions)
    with pytest.raises(ValueError, match="contaminated"):
        StartVortexCycleService(service).run(experiment.id, EmptyRequest())


def test_vortexing_open_tube_without_salts_records_both_faults() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    MoveWorkbenchToolToVortexService(service).run(
        experiment.id,
        MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"),
    )

    StartVortexCycleService(service).run(experiment.id, EmptyRequest())

    state = _vortex_tool(service, experiment.id).quechers_state
    assert state.phase == "contaminated"
    assert state.faults == ["vortexed_open", "vortexed_without_salts"]
    assert state.is_usable is False


def test_vortexing_sealed_tube_without_salts_contaminates_tool() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    CloseWorkbenchToolService(service).run(experiment.id, WorkbenchSlotRequest(slot_id="station_1"))
    MoveWorkbenchToolToVortexService(service).run(
        experiment.id,
        MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"),
    )

    StartVortexCycleService(service).run(experiment.id, EmptyRequest())

    state = _vortex_tool(service, experiment.id).quechers_state
    assert state.phase == "contaminated"
    assert state.faults == ["vortexed_without_salts"]
    assert state.is_usable is False


def test_salts_added_dry_arm_then_instantly_cement_when_liquid_arrives() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "quechers_salts")

    armed = _tube(service, experiment.id).quechers_state
    assert armed.phase == "armed"
    assert armed.cementation_progress == 0

    _add(service, experiment.id, "acetonitrile_extraction", 10)

    state = _tube(service, experiment.id).quechers_state
    assert state.phase == "cemented"
    assert state.faults == ["dry_salts_wetted"]
    assert state.cementation_progress == 1
    assert state.is_usable is False

    with pytest.raises(ValueError, match="contaminated"):
        _add(service, experiment.id, "ultrapure_water_rinse", 1)


def test_cemented_tool_rejects_liquid_removal() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    liquid_entry_id = _tube(service, experiment.id).liquids[0].id
    _add(service, experiment.id, "quechers_salts")
    _advance(service, experiment.id, 15000)

    with pytest.raises(ValueError, match="contaminated"):
        RemoveLiquidFromWorkbenchToolService(service).run(
            experiment.id,
            WorkbenchLiquidRequest(slot_id="station_1", liquid_entry_id=liquid_entry_id),
        )


def test_quechers_state_round_trips_through_sqlite(tmp_path: Path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
    first_service = ExperimentRuntimeService(repository=repository)
    experiment = first_service.create_experiment()
    _place_tube(first_service, experiment.id)
    _add(first_service, experiment.id, "acetonitrile_extraction", 10)
    _add(first_service, experiment.id, "quechers_salts")
    _advance(first_service, experiment.id, 5000)

    second_service = ExperimentRuntimeService(repository=repository)
    state = _tube(second_service, experiment.id).quechers_state

    assert state.salts_added is True
    assert state.phase == "reacting"
    assert state.temperature_c > 20
    assert state.cementation_progress > 0
