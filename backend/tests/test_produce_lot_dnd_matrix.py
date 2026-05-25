from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import pytest

from app.services.dnd_move_service import DndMoveObjectRequest, DndMoveObjectService, DndObjectRef
from app.services.domain_services.gross_balance import (
    CloseGrossBalanceToolService,
    DiscardGrossBalanceProduceLotRequest,
    DiscardGrossBalanceProduceLotService,
    EmptyRequest,
    MoveGrossBalanceProduceLotToWidgetRequest,
    MoveGrossBalanceProduceLotToWidgetService,
    MoveGrossBalanceProduceLotToWorkbenchRequest,
    MoveGrossBalanceProduceLotToWorkbenchService,
    MoveWidgetProduceLotToGrossBalanceRequest,
    MoveWidgetProduceLotToGrossBalanceService,
    MoveWorkbenchProduceLotToGrossBalanceRequest,
    MoveWorkbenchProduceLotToGrossBalanceService,
    MoveWorkspaceProduceLotToGrossBalanceRequest,
    MoveWorkspaceProduceLotToGrossBalanceService,
    PlaceToolOnGrossBalanceRequest,
    PlaceToolOnGrossBalanceService,
    RestoreTrashedProduceLotToGrossBalanceRequest,
    RestoreTrashedProduceLotToGrossBalanceService,
)
from app.services.domain_services.workbench import (
    AddProduceLotToWorkbenchToolRequest,
    AddProduceLotToWorkbenchToolService,
    CloseWorkbenchToolService,
    DiscardProduceLotFromWorkbenchToolService,
    MoveProduceLotBetweenWorkbenchToolsRequest,
    MoveProduceLotBetweenWorkbenchToolsService,
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
    RestoreTrashedProduceLotToWorkbenchToolRequest,
    RestoreTrashedProduceLotToWorkbenchToolService,
    WorkbenchProduceLotRequest,
    WorkbenchSlotRequest,
)
from app.services.domain_services.workspace import (
    AddWorkspaceProduceLotToWidgetRequest,
    AddWorkspaceProduceLotToWidgetService,
    CreateOrInitProduceLotService,
    CreateProduceLotRequest,
    DiscardWidgetProduceLotRequest,
    DiscardWidgetProduceLotService,
    DiscardWorkspaceProduceLotRequest,
    DiscardWorkspaceProduceLotService,
    MoveWidgetProduceLotToWorkbenchToolRequest,
    MoveWidgetProduceLotToWorkbenchToolService,
    MoveWorkbenchProduceLotToWidgetRequest,
    MoveWorkbenchProduceLotToWidgetService,
    RestoreTrashedProduceLotToWidgetRequest,
    RestoreTrashedProduceLotToWidgetService,
)
from app.services.experiment_service import ExperimentRuntimeService

SourceKind = Literal["basket", "workbench_surface", "workbench_tool", "grinder", "trash", "gross_balance"]
TargetKind = Literal[
    "workbench_surface",
    "open_sample_bag",
    "sealed_sample_bag",
    "open_storage_jar",
    "sealed_storage_jar",
    "cutting_board",
    "empty_grinder",
    "occupied_grinder",
    "empty_gross_balance",
    "gross_balance_bag",
    "sealed_gross_balance_bag",
    "trash",
]


@dataclass(frozen=True)
class ProduceLotDndCase:
    source: SourceKind
    target: TargetKind
    allowed: bool


PRODUCE_LOT_DND_CASES: tuple[ProduceLotDndCase, ...] = (
    ProduceLotDndCase("basket", "workbench_surface", True),
    ProduceLotDndCase("basket", "open_sample_bag", True),
    ProduceLotDndCase("basket", "sealed_sample_bag", False),
    ProduceLotDndCase("basket", "open_storage_jar", True),
    ProduceLotDndCase("basket", "sealed_storage_jar", False),
    ProduceLotDndCase("basket", "cutting_board", True),
    ProduceLotDndCase("basket", "empty_grinder", True),
    ProduceLotDndCase("basket", "occupied_grinder", False),
    ProduceLotDndCase("basket", "empty_gross_balance", True),
    ProduceLotDndCase("basket", "gross_balance_bag", True),
    ProduceLotDndCase("basket", "sealed_gross_balance_bag", False),
    ProduceLotDndCase("basket", "trash", True),
    ProduceLotDndCase("workbench_surface", "workbench_surface", True),
    ProduceLotDndCase("workbench_surface", "open_sample_bag", True),
    ProduceLotDndCase("workbench_surface", "sealed_sample_bag", False),
    ProduceLotDndCase("workbench_surface", "open_storage_jar", True),
    ProduceLotDndCase("workbench_surface", "sealed_storage_jar", False),
    ProduceLotDndCase("workbench_surface", "cutting_board", True),
    ProduceLotDndCase("workbench_surface", "empty_grinder", True),
    ProduceLotDndCase("workbench_surface", "occupied_grinder", False),
    ProduceLotDndCase("workbench_surface", "empty_gross_balance", True),
    ProduceLotDndCase("workbench_surface", "gross_balance_bag", True),
    ProduceLotDndCase("workbench_surface", "sealed_gross_balance_bag", False),
    ProduceLotDndCase("workbench_surface", "trash", True),
    ProduceLotDndCase("workbench_tool", "workbench_surface", True),
    ProduceLotDndCase("workbench_tool", "open_sample_bag", True),
    ProduceLotDndCase("workbench_tool", "sealed_sample_bag", False),
    ProduceLotDndCase("workbench_tool", "open_storage_jar", True),
    ProduceLotDndCase("workbench_tool", "sealed_storage_jar", False),
    ProduceLotDndCase("workbench_tool", "cutting_board", True),
    ProduceLotDndCase("workbench_tool", "empty_grinder", True),
    ProduceLotDndCase("workbench_tool", "occupied_grinder", False),
    ProduceLotDndCase("workbench_tool", "empty_gross_balance", True),
    ProduceLotDndCase("workbench_tool", "gross_balance_bag", True),
    ProduceLotDndCase("workbench_tool", "sealed_gross_balance_bag", False),
    ProduceLotDndCase("workbench_tool", "trash", True),
    ProduceLotDndCase("grinder", "workbench_surface", True),
    ProduceLotDndCase("grinder", "open_sample_bag", True),
    ProduceLotDndCase("grinder", "sealed_sample_bag", False),
    ProduceLotDndCase("grinder", "open_storage_jar", True),
    ProduceLotDndCase("grinder", "sealed_storage_jar", False),
    ProduceLotDndCase("grinder", "cutting_board", True),
    ProduceLotDndCase("grinder", "empty_gross_balance", True),
    ProduceLotDndCase("grinder", "gross_balance_bag", True),
    ProduceLotDndCase("grinder", "sealed_gross_balance_bag", False),
    ProduceLotDndCase("grinder", "trash", True),
    ProduceLotDndCase("trash", "workbench_surface", True),
    ProduceLotDndCase("trash", "open_sample_bag", True),
    ProduceLotDndCase("trash", "sealed_sample_bag", False),
    ProduceLotDndCase("trash", "open_storage_jar", True),
    ProduceLotDndCase("trash", "sealed_storage_jar", False),
    ProduceLotDndCase("trash", "cutting_board", True),
    ProduceLotDndCase("trash", "empty_grinder", True),
    ProduceLotDndCase("trash", "occupied_grinder", False),
    ProduceLotDndCase("trash", "empty_gross_balance", True),
    ProduceLotDndCase("trash", "gross_balance_bag", True),
    ProduceLotDndCase("trash", "sealed_gross_balance_bag", False),
    ProduceLotDndCase("gross_balance", "workbench_surface", True),
    ProduceLotDndCase("gross_balance", "open_sample_bag", True),
    ProduceLotDndCase("gross_balance", "sealed_sample_bag", False),
    ProduceLotDndCase("gross_balance", "open_storage_jar", True),
    ProduceLotDndCase("gross_balance", "sealed_storage_jar", False),
    ProduceLotDndCase("gross_balance", "cutting_board", True),
    ProduceLotDndCase("gross_balance", "empty_grinder", True),
    ProduceLotDndCase("gross_balance", "occupied_grinder", False),
    ProduceLotDndCase("gross_balance", "trash", True),
)


def _create_basket_lot(service: ExperimentRuntimeService, experiment_id: str) -> str:
    created = CreateOrInitProduceLotService(service).run(experiment_id, CreateProduceLotRequest(produce_type="apple"))
    return created.basket_tools[-1].produce_lots[0].id


def _prepare_target(service: ExperimentRuntimeService, experiment_id: str, target: TargetKind) -> None:
    if target == "open_sample_bag":
        PlaceToolOnWorkbenchService(service).run(experiment_id, PlaceToolOnWorkbenchRequest(slot_id="station_2", tool_id="sealed_sampling_bag"))
        return
    if target == "sealed_sample_bag":
        PlaceToolOnWorkbenchService(service).run(experiment_id, PlaceToolOnWorkbenchRequest(slot_id="station_2", tool_id="sealed_sampling_bag"))
        CloseWorkbenchToolService(service).run(experiment_id, WorkbenchSlotRequest(slot_id="station_2"))
        return
    if target == "open_storage_jar":
        PlaceToolOnWorkbenchService(service).run(experiment_id, PlaceToolOnWorkbenchRequest(slot_id="station_2", tool_id="hdpe_storage_jar_2l"))
        return
    if target == "sealed_storage_jar":
        PlaceToolOnWorkbenchService(service).run(experiment_id, PlaceToolOnWorkbenchRequest(slot_id="station_2", tool_id="hdpe_storage_jar_2l"))
        CloseWorkbenchToolService(service).run(experiment_id, WorkbenchSlotRequest(slot_id="station_2"))
        return
    if target == "cutting_board":
        PlaceToolOnWorkbenchService(service).run(experiment_id, PlaceToolOnWorkbenchRequest(slot_id="station_2", tool_id="cutting_board_hdpe"))
        return
    if target == "occupied_grinder":
        occupying_lot_id = _create_basket_lot(service, experiment_id)
        AddWorkspaceProduceLotToWidgetService(service).run(
            experiment_id, AddWorkspaceProduceLotToWidgetRequest(widget_id="grinder", produce_lot_id=occupying_lot_id)
        )
        return
    if target == "gross_balance_bag":
        PlaceToolOnGrossBalanceService(service).run(experiment_id, PlaceToolOnGrossBalanceRequest(tool_id="sealed_sampling_bag"))
        return
    if target == "sealed_gross_balance_bag":
        PlaceToolOnGrossBalanceService(service).run(experiment_id, PlaceToolOnGrossBalanceRequest(tool_id="sealed_sampling_bag"))
        CloseGrossBalanceToolService(service).run(experiment_id, EmptyRequest())


def _prepare_source(service: ExperimentRuntimeService, experiment_id: str, source: SourceKind) -> tuple[str, str | None]:
    produce_lot_id = _create_basket_lot(service, experiment_id)

    if source == "basket":
        return produce_lot_id, None
    if source == "workbench_surface":
        AddProduceLotToWorkbenchToolService(service).run(
            experiment_id, AddProduceLotToWorkbenchToolRequest(slot_id="station_1", produce_lot_id=produce_lot_id)
        )
        return produce_lot_id, None
    if source == "workbench_tool":
        PlaceToolOnWorkbenchService(service).run(experiment_id, PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="cutting_board_hdpe"))
        AddProduceLotToWorkbenchToolService(service).run(
            experiment_id, AddProduceLotToWorkbenchToolRequest(slot_id="station_1", produce_lot_id=produce_lot_id)
        )
        return produce_lot_id, None
    if source == "grinder":
        AddWorkspaceProduceLotToWidgetService(service).run(
            experiment_id, AddWorkspaceProduceLotToWidgetRequest(widget_id="grinder", produce_lot_id=produce_lot_id)
        )
        return produce_lot_id, None
    if source == "trash":
        discarded = DiscardWorkspaceProduceLotService(service).run(experiment_id, DiscardWorkspaceProduceLotRequest(produce_lot_id=produce_lot_id))
        return produce_lot_id, discarded.trash.produce_lots[0].id
    if source == "gross_balance":
        MoveWorkspaceProduceLotToGrossBalanceService(service).run(
            experiment_id, MoveWorkspaceProduceLotToGrossBalanceRequest(produce_lot_id=produce_lot_id)
        )
        return produce_lot_id, None

    raise AssertionError(f"Unhandled source kind: {source}")


def _execute_drop(
    service: ExperimentRuntimeService,
    experiment_id: str,
    source: SourceKind,
    target: TargetKind,
    produce_lot_id: str,
    trash_produce_lot_id: str | None,
):
    if target in {
        "workbench_surface",
        "open_sample_bag",
        "sealed_sample_bag",
        "open_storage_jar",
        "sealed_storage_jar",
        "cutting_board",
    }:
        if source == "basket":
            return AddProduceLotToWorkbenchToolService(service).run(
                experiment_id,
                AddProduceLotToWorkbenchToolRequest(slot_id="station_2", produce_lot_id=produce_lot_id),
            )
        if source in {"workbench_surface", "workbench_tool"}:
            return MoveProduceLotBetweenWorkbenchToolsService(service).run(
                experiment_id,
                MoveProduceLotBetweenWorkbenchToolsRequest(
                    source_slot_id="station_1",
                    target_slot_id="station_2",
                    produce_lot_id=produce_lot_id,
                ),
            )
        if source == "grinder":
            return MoveWidgetProduceLotToWorkbenchToolService(service).run(
                experiment_id,
                MoveWidgetProduceLotToWorkbenchToolRequest(
                    widget_id="grinder",
                    produce_lot_id=produce_lot_id,
                    target_slot_id="station_2",
                ),
            )
        if source == "trash":
            assert trash_produce_lot_id is not None
            return RestoreTrashedProduceLotToWorkbenchToolService(service).run(
                experiment_id,
                RestoreTrashedProduceLotToWorkbenchToolRequest(
                    trash_produce_lot_id=trash_produce_lot_id,
                    target_slot_id="station_2",
                ),
            )
        if source == "gross_balance":
            return MoveGrossBalanceProduceLotToWorkbenchService(service).run(
                experiment_id,
                MoveGrossBalanceProduceLotToWorkbenchRequest(
                    target_slot_id="station_2",
                    produce_lot_id=produce_lot_id,
                ),
            )

    if target in {"empty_grinder", "occupied_grinder"}:
        if source == "basket":
            return AddWorkspaceProduceLotToWidgetService(service).run(
                experiment_id,
                AddWorkspaceProduceLotToWidgetRequest(widget_id="grinder", produce_lot_id=produce_lot_id),
            )
        if source in {"workbench_surface", "workbench_tool"}:
            return MoveWorkbenchProduceLotToWidgetService(service).run(
                experiment_id,
                MoveWorkbenchProduceLotToWidgetRequest(
                    widget_id="grinder",
                    source_slot_id="station_1",
                    produce_lot_id=produce_lot_id,
                ),
            )
        if source == "trash":
            assert trash_produce_lot_id is not None
            return RestoreTrashedProduceLotToWidgetService(service).run(
                experiment_id,
                RestoreTrashedProduceLotToWidgetRequest(
                    trash_produce_lot_id=trash_produce_lot_id,
                    widget_id="grinder",
                ),
            )
        if source == "gross_balance":
            return MoveGrossBalanceProduceLotToWidgetService(service).run(
                experiment_id,
                MoveGrossBalanceProduceLotToWidgetRequest(widget_id="grinder", produce_lot_id=produce_lot_id),
            )

    if target in {"empty_gross_balance", "gross_balance_bag", "sealed_gross_balance_bag"}:
        if source == "basket":
            return MoveWorkspaceProduceLotToGrossBalanceService(service).run(
                experiment_id, MoveWorkspaceProduceLotToGrossBalanceRequest(produce_lot_id=produce_lot_id)
            )
        if source in {"workbench_surface", "workbench_tool"}:
            return MoveWorkbenchProduceLotToGrossBalanceService(service).run(
                experiment_id,
                MoveWorkbenchProduceLotToGrossBalanceRequest(
                    source_slot_id="station_1",
                    produce_lot_id=produce_lot_id,
                ),
            )
        if source == "grinder":
            return MoveWidgetProduceLotToGrossBalanceService(service).run(
                experiment_id,
                MoveWidgetProduceLotToGrossBalanceRequest(widget_id="grinder", produce_lot_id=produce_lot_id),
            )
        if source == "trash":
            assert trash_produce_lot_id is not None
            return RestoreTrashedProduceLotToGrossBalanceService(service).run(
                experiment_id,
                RestoreTrashedProduceLotToGrossBalanceRequest(trash_produce_lot_id=trash_produce_lot_id),
            )

    if target == "trash":
        if source == "basket":
            return DiscardWorkspaceProduceLotService(service).run(experiment_id, DiscardWorkspaceProduceLotRequest(produce_lot_id=produce_lot_id))
        if source in {"workbench_surface", "workbench_tool"}:
            return DiscardProduceLotFromWorkbenchToolService(service).run(
                experiment_id, WorkbenchProduceLotRequest(slot_id="station_1", produce_lot_id=produce_lot_id)
            )
        if source == "grinder":
            return DiscardWidgetProduceLotService(service).run(
                experiment_id, DiscardWidgetProduceLotRequest(widget_id="grinder", produce_lot_id=produce_lot_id)
            )
        if source == "gross_balance":
            return DiscardGrossBalanceProduceLotService(service).run(
                experiment_id, DiscardGrossBalanceProduceLotRequest(produce_lot_id=produce_lot_id)
            )

    raise AssertionError(f"Unhandled drop case: {source} -> {target}")


@pytest.mark.parametrize(
    ("source", "target", "allowed"),
    [(case.source, case.target, case.allowed) for case in PRODUCE_LOT_DND_CASES],
    ids=[f"{case.source}_to_{case.target}_{'allow' if case.allowed else 'reject'}" for case in PRODUCE_LOT_DND_CASES],
)
def test_produce_lot_dnd_matrix(source: SourceKind, target: TargetKind, allowed: bool) -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    _prepare_target(service, experiment.id, target)
    produce_lot_id, trash_produce_lot_id = _prepare_source(service, experiment.id, source)

    if not allowed:
        with pytest.raises(ValueError):
            _execute_drop(service, experiment.id, source, target, produce_lot_id, trash_produce_lot_id)
        return

    updated = _execute_drop(service, experiment.id, source, target, produce_lot_id, trash_produce_lot_id)

    if target == "trash":
        assert updated.trash.produce_lots[-1].produce_lot.id == produce_lot_id
        return

    if target in {
        "workbench_surface",
        "open_sample_bag",
        "sealed_sample_bag",
        "open_storage_jar",
        "sealed_storage_jar",
        "cutting_board",
    }:
        target_slot = next(slot for slot in updated.workbench.slots if slot.id == "station_2")
        if target == "workbench_surface":
            assert [lot.id for lot in target_slot.surface_produce_lots] == [produce_lot_id]
            return
        assert target_slot.tool is not None
        assert [lot.id for lot in target_slot.tool.produce_lots] == [produce_lot_id]
        return

    if target in {"empty_grinder", "occupied_grinder"}:
        grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")
        assert [lot.id for lot in grinder.produce_lots][-1] == produce_lot_id
        return

    if target in {"empty_gross_balance", "gross_balance_bag", "sealed_gross_balance_bag"}:
        gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
        if gross_balance.tool is not None:
            assert [lot.id for lot in gross_balance.tool.produce_lots] == [produce_lot_id]
            return
        assert [lot.id for lot in gross_balance.produce_lots] == [produce_lot_id]


def test_dnd_move_rejects_produce_lot_drop_onto_current_location() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    produce_lot_id = _create_basket_lot(service, experiment.id)
    AddProduceLotToWorkbenchToolService(service).run(
        experiment.id,
        AddProduceLotToWorkbenchToolRequest(slot_id="station_1", produce_lot_id=produce_lot_id),
    )

    with pytest.raises(ValueError, match="current location"):
        DndMoveObjectService(service).run(
            experiment.id,
            DndMoveObjectRequest(
                entity=DndObjectRef(kind="produce_lot", id=produce_lot_id),
                source=DndObjectRef(kind="workbench", id="station_1"),
                destination=DndObjectRef(kind="workbench_slot", id="station_1"),
            ),
        )
