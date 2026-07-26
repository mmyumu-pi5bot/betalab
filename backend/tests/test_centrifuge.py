from pathlib import Path

import pytest

from app.services.dnd_move_service import (
    DndMoveObjectRequest,
    DndMoveObjectService,
    DndObjectRef,
)
from app.services.domain_services.centrifuge import EmptyRequest, StartCentrifugeCycleService
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
    return next(
        widget
        for widget in service._require_experiment(experiment_id).workspace.widgets
        if widget.id == "centrifuge"
    )


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


def test_centrifuge_requires_a_closed_mixed_tube() -> None:
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
    DndMoveObjectService(service).run(
        experiment.id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="tool", id=tube.id),
            source=DndObjectRef(kind="workbench", id="station_1"),
            destination=DndObjectRef(kind="centrifuge", id="centrifuge"),
        ),
    )

    with pytest.raises(ValueError, match="sealed"):
        StartCentrifugeCycleService(service).run(experiment.id, EmptyRequest())

    tube.is_sealed = True
    with pytest.raises(ValueError, match="mixed"):
        StartCentrifugeCycleService(service).run(experiment.id, EmptyRequest())


def test_centrifuge_cycle_advances_and_completes_visible_separation() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _load_ready_tube(service, experiment.id)

    started = StartCentrifugeCycleService(service).run(experiment.id, EmptyRequest())
    started_widget = next(widget for widget in started.workspace.widgets if widget.id == "centrifuge")
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
