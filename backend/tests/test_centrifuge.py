from pathlib import Path

import pytest

from app.domain.models import WorkbenchLiquid
from app.services.dnd_move_service import (
    DndMoveObjectRequest,
    DndMoveObjectService,
    DndObjectRef,
)
from app.services.domain_services.centrifuge import (
    CloseCentrifugeToolService,
    EmptyRequest,
    OpenCentrifugeToolService,
    StartCentrifugeCycleService,
)
from app.services.domain_services.workbench import (
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
)
from app.services.domain_services.workspace import (
    AdvanceWorkspaceCryogenicsRequest,
    AdvanceWorkspaceCryogenicsService,
)
from app.services.experiment_repository import SqliteExperimentRepository
from app.services.experiment_service import ExperimentRuntimeService


def _centrifuge_widget(service: ExperimentRuntimeService, experiment_id: str):
    return next(widget for widget in service._require_experiment(experiment_id).workspace.widgets if widget.id == "centrifuge")


def _load_ready_tube(service: ExperimentRuntimeService, experiment_id: str) -> None:
    PlaceToolOnWorkbenchService(service).run(
        experiment_id,
        PlaceToolOnWorkbenchRequest(
            slot_id="station_1",
            tool_id="centrifuge_tube_50ml",
        ),
    )
    tube = service._require_experiment(experiment_id).workbench.slots[0].tool
    assert tube is not None
    tube.is_sealed = True
    tube.quechers_state.phase = "mixed"
    DndMoveObjectService(service).run(
        experiment_id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="tool", id=tube.id),
            source=DndObjectRef(kind="workbench", id="station_1"),
            destination=DndObjectRef(kind="centrifuge", id="centrifuge"),
        ),
    )


def test_experiment_exposes_storable_centrifuge_drop_target() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    widget = next(widget for widget in experiment.workspace.widgets if widget.id == "centrifuge")

    assert widget.widget_type == "centrifuge"
    assert widget.drop_target_types == ["centrifuge_widget"]
    assert widget.is_storable is True
    assert widget.tool is None
    assert widget.centrifuge_can_start is False
    assert widget.centrifuge_start_block_reason == "missing_tube"


def test_generic_dnd_only_accepts_centrifuge_tubes() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(
            slot_id="station_1",
            tool_id="centrifuge_tube_50ml",
        ),
    )
    tube = service._require_experiment(experiment.id).workbench.slots[0].tool
    assert tube is not None

    moved = DndMoveObjectService(service).run(
        experiment.id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="tool", id=tube.id),
            source=DndObjectRef(kind="workbench", id="station_1"),
            destination=DndObjectRef(kind="centrifuge", id="centrifuge"),
        ),
    )
    assert next(widget for widget in moved.workspace.widgets if widget.id == "centrifuge").tool is not None

    other = ExperimentRuntimeService()
    other_experiment = other.create_experiment()
    with pytest.raises(ValueError, match="cannot be dropped"):
        DndMoveObjectService(other).run(
            other_experiment.id,
            DndMoveObjectRequest(
                entity=DndObjectRef(kind="tool", id="sample_vial_lcms"),
                source=DndObjectRef(kind="palette", id="sample_vial_lcms"),
                destination=DndObjectRef(kind="centrifuge", id="centrifuge"),
            ),
        )


def test_centrifuge_runs_unsealed_tube_but_ruins_the_result() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(
            slot_id="station_1",
            tool_id="centrifuge_tube_50ml",
        ),
    )
    tube = service._require_experiment(experiment.id).workbench.slots[0].tool
    assert tube is not None
    tube.is_sealed = False
    tube.quechers_state.phase = "mixed"
    tube.liquids.append(
        WorkbenchLiquid(
            id="extract",
            liquid_id="acetonitrile",
            name="Acetonitrile extract",
            volume_ml=10.0,
            accent="#38bdf8",
        )
    )
    moved = DndMoveObjectService(service).run(
        experiment.id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="tool", id=tube.id),
            source=DndObjectRef(kind="workbench", id="station_1"),
            destination=DndObjectRef(kind="centrifuge", id="centrifuge"),
        ),
    )
    moved_widget = next(widget for widget in moved.workspace.widgets if widget.id == "centrifuge")
    # An open tube no longer blocks the cycle — it just ruins the result.
    assert moved_widget.centrifuge_can_start is True
    assert moved_widget.centrifuge_start_block_reason is None

    started = StartCentrifugeCycleService(service).run(experiment.id, EmptyRequest())
    started_widget = next(widget for widget in started.workspace.widgets if widget.id == "centrifuge")
    assert started_widget.tool is not None
    assert started_widget.tool.quechers_state.phase == "separating"
    assert "centrifuged_open" in started_widget.tool.quechers_state.faults
    result = started_widget.tool.quechers_extraction_result
    assert result is not None
    assert result.extraction_manip_factor == pytest.approx(0.05)


def test_centrifuge_tube_can_be_sealed_in_place() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(
            slot_id="station_1",
            tool_id="centrifuge_tube_50ml",
        ),
    )
    tube = service._require_experiment(experiment.id).workbench.slots[0].tool
    assert tube is not None
    tube.is_sealed = False
    DndMoveObjectService(service).run(
        experiment.id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="tool", id=tube.id),
            source=DndObjectRef(kind="workbench", id="station_1"),
            destination=DndObjectRef(kind="centrifuge", id="centrifuge"),
        ),
    )

    closed = CloseCentrifugeToolService(service).run(experiment.id, EmptyRequest())
    closed_widget = next(widget for widget in closed.workspace.widgets if widget.id == "centrifuge")
    assert closed_widget.tool is not None
    assert closed_widget.tool.is_sealed is True

    opened = OpenCentrifugeToolService(service).run(experiment.id, EmptyRequest())
    opened_widget = next(widget for widget in opened.workspace.widgets if widget.id == "centrifuge")
    assert opened_widget.tool is not None
    assert opened_widget.tool.is_sealed is False


@pytest.mark.parametrize("bad_phase", ["idle", "contaminated", "cemented"])
def test_centrifuge_runs_bad_preparations_but_preserves_an_invalid_result(
    bad_phase: str,
) -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(
            slot_id="station_1",
            tool_id="centrifuge_tube_50ml",
        ),
    )
    tube = service._require_experiment(experiment.id).workbench.slots[0].tool
    assert tube is not None
    tube.is_sealed = True
    tube.quechers_state.phase = bad_phase
    if bad_phase == "contaminated":
        tube.quechers_state.faults = ["vortexed_without_salts"]

    moved = DndMoveObjectService(service).run(
        experiment.id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="tool", id=tube.id),
            source=DndObjectRef(kind="workbench", id="station_1"),
            destination=DndObjectRef(kind="centrifuge", id="centrifuge"),
        ),
    )
    moved_widget = next(widget for widget in moved.workspace.widgets if widget.id == "centrifuge")
    assert moved_widget.centrifuge_can_start is True
    assert moved_widget.centrifuge_start_block_reason is None

    started = StartCentrifugeCycleService(service).run(experiment.id, EmptyRequest())
    started_widget = next(widget for widget in started.workspace.widgets if widget.id == "centrifuge")
    assert started_widget.tool is not None
    assert started_widget.tool.quechers_state.phase == "separating"
    assert "centrifuged_without_valid_extraction" in started_widget.tool.quechers_state.faults

    AdvanceWorkspaceCryogenicsService(service).run(
        experiment.id,
        AdvanceWorkspaceCryogenicsRequest(elapsed_ms=5000),
    )
    finished = AdvanceWorkspaceCryogenicsService(service).run(
        experiment.id,
        AdvanceWorkspaceCryogenicsRequest(elapsed_ms=5000),
    )
    finished_widget = next(widget for widget in finished.workspace.widgets if widget.id == "centrifuge")
    assert finished_widget.tool is not None
    assert finished_widget.tool.quechers_state.phase == "separated"
    assert finished_widget.tool.quechers_extraction_result is None


def test_centrifuge_cycle_advances_and_completes_visible_separation() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _load_ready_tube(service, experiment.id)

    started = StartCentrifugeCycleService(service).run(experiment.id, EmptyRequest())
    started_widget = next(widget for widget in started.workspace.widgets if widget.id == "centrifuge")
    assert started_widget.centrifuge_can_start is False
    assert started_widget.centrifuge_start_block_reason == "already_running"
    assert started_widget.centrifuge_run_remaining_ms == 10000
    assert started_widget.tool is not None
    assert started_widget.tool.quechers_state.separation_progress == 0

    halfway = AdvanceWorkspaceCryogenicsService(service).run(
        experiment.id,
        AdvanceWorkspaceCryogenicsRequest(elapsed_ms=5000),
    )
    halfway_widget = next(widget for widget in halfway.workspace.widgets if widget.id == "centrifuge")
    assert halfway_widget.tool is not None
    assert halfway_widget.tool.quechers_state.phase == "separating"
    assert halfway_widget.tool.quechers_state.separation_progress == pytest.approx(0.5)

    finished = AdvanceWorkspaceCryogenicsService(service).run(
        experiment.id,
        AdvanceWorkspaceCryogenicsRequest(elapsed_ms=5000),
    )
    finished_widget = next(widget for widget in finished.workspace.widgets if widget.id == "centrifuge")
    assert finished_widget.centrifuge_run_remaining_ms == 0
    assert finished_widget.tool is not None
    assert finished_widget.tool.quechers_state.phase == "separated"
    assert finished_widget.tool.quechers_state.separation_progress == 1


def test_centrifuge_state_survives_sqlite_round_trip(tmp_path: Path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
    service = ExperimentRuntimeService(repository=repository)
    experiment = service.create_experiment()
    _load_ready_tube(service, experiment.id)
    StartCentrifugeCycleService(service).run(experiment.id, EmptyRequest())
    AdvanceWorkspaceCryogenicsService(service).run(
        experiment.id,
        AdvanceWorkspaceCryogenicsRequest(elapsed_ms=5000),
    )

    reloaded = ExperimentRuntimeService(repository=repository).get_experiment(experiment.id)
    widget = next(widget for widget in reloaded.workspace.widgets if widget.id == "centrifuge")
    assert widget.tool is not None
    assert widget.centrifuge_run_remaining_ms == pytest.approx(5000, abs=75)
    assert widget.tool.quechers_state.separation_progress == pytest.approx(0.5, abs=0.01)
