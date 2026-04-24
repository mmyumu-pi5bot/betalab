from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import pytest

from app.services.domain_services.gross_balance import (
    DiscardGrossBalanceToolService,
    EmptyRequest,
    MoveBasketToolToGrossBalanceRequest,
    MoveBasketToolToGrossBalanceService,
    MoveGrossBalanceToolToRackRequest,
    MoveGrossBalanceToolToRackService,
    MoveGrossBalanceToolToWorkbenchRequest,
    MoveGrossBalanceToolToWorkbenchService,
    MoveRackToolToGrossBalanceRequest,
    MoveRackToolToGrossBalanceService,
    MoveWorkbenchToolToGrossBalanceRequest,
    MoveWorkbenchToolToGrossBalanceService,
    PlaceToolOnGrossBalanceRequest,
    PlaceToolOnGrossBalanceService,
    RestoreTrashedToolToGrossBalanceRequest,
    RestoreTrashedToolToGrossBalanceService,
)
from app.services.domain_services.rack import (
    DiscardRackToolRequest,
    DiscardRackToolService,
    MoveRackToolBetweenSlotsRequest,
    MoveRackToolBetweenSlotsService,
    PlaceToolInRackSlotRequest,
    PlaceToolInRackSlotService,
    PlaceWorkbenchToolInRackSlotRequest,
    PlaceWorkbenchToolInRackSlotService,
    RemoveRackToolToWorkbenchSlotRequest,
    RemoveRackToolToWorkbenchSlotService,
    RestoreTrashedToolToRackSlotRequest,
    RestoreTrashedToolToRackSlotService,
)
from app.services.domain_services.reception import (
    PlaceReceivedBagOnWorkbenchRequest,
    PlaceReceivedBagOnWorkbenchService,
)
from app.services.domain_services.trash import DiscardBasketToolRequest, DiscardBasketToolService
from app.services.domain_services.workbench import (
    DiscardToolFromPaletteRequest,
    DiscardToolFromPaletteService,
    DiscardWorkbenchToolService,
    MoveToolBetweenWorkbenchSlotsRequest,
    MoveToolBetweenWorkbenchSlotsService,
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
    RestoreTrashedToolToWorkbenchSlotRequest,
    RestoreTrashedToolToWorkbenchSlotService,
    WorkbenchSlotRequest,
)
from app.services.experiment_service import ExperimentRuntimeService

ToolSource = Literal[
    "palette_vial",
    "palette_storage_jar",
    "basket_bag",
    "workbench_vial",
    "workbench_storage_jar",
    "rack_vial",
    "trash_vial",
    "trash_storage_jar",
    "gross_balance_vial",
]
ToolTarget = Literal["empty_workbench", "occupied_workbench", "empty_rack", "occupied_rack", "gross_balance", "trash"]


@dataclass(frozen=True)
class ToolDndCase:
    source: ToolSource
    target: ToolTarget
    allowed: bool


TOOL_DND_CASES: tuple[ToolDndCase, ...] = (
    ToolDndCase("palette_vial", "empty_workbench", True),
    ToolDndCase("palette_vial", "occupied_workbench", False),
    ToolDndCase("palette_vial", "empty_rack", True),
    ToolDndCase("palette_vial", "occupied_rack", False),
    ToolDndCase("palette_vial", "gross_balance", True),
    ToolDndCase("palette_vial", "trash", True),
    ToolDndCase("palette_storage_jar", "empty_workbench", True),
    ToolDndCase("palette_storage_jar", "occupied_workbench", False),
    ToolDndCase("palette_storage_jar", "empty_rack", False),
    ToolDndCase("palette_storage_jar", "occupied_rack", False),
    ToolDndCase("palette_storage_jar", "gross_balance", True),
    ToolDndCase("palette_storage_jar", "trash", True),
    ToolDndCase("basket_bag", "empty_workbench", True),
    ToolDndCase("basket_bag", "occupied_workbench", False),
    ToolDndCase("basket_bag", "empty_rack", False),
    ToolDndCase("basket_bag", "occupied_rack", False),
    ToolDndCase("basket_bag", "gross_balance", True),
    ToolDndCase("basket_bag", "trash", True),
    ToolDndCase("workbench_vial", "empty_workbench", True),
    ToolDndCase("workbench_vial", "occupied_workbench", False),
    ToolDndCase("workbench_vial", "empty_rack", True),
    ToolDndCase("workbench_vial", "occupied_rack", False),
    ToolDndCase("workbench_vial", "gross_balance", True),
    ToolDndCase("workbench_vial", "trash", True),
    ToolDndCase("workbench_storage_jar", "empty_workbench", True),
    ToolDndCase("workbench_storage_jar", "occupied_workbench", False),
    ToolDndCase("workbench_storage_jar", "empty_rack", False),
    ToolDndCase("workbench_storage_jar", "occupied_rack", False),
    ToolDndCase("workbench_storage_jar", "gross_balance", True),
    ToolDndCase("workbench_storage_jar", "trash", True),
    ToolDndCase("rack_vial", "empty_workbench", True),
    ToolDndCase("rack_vial", "occupied_workbench", False),
    ToolDndCase("rack_vial", "empty_rack", True),
    ToolDndCase("rack_vial", "occupied_rack", False),
    ToolDndCase("rack_vial", "gross_balance", True),
    ToolDndCase("rack_vial", "trash", True),
    ToolDndCase("trash_vial", "empty_workbench", True),
    ToolDndCase("trash_vial", "occupied_workbench", False),
    ToolDndCase("trash_vial", "empty_rack", True),
    ToolDndCase("trash_vial", "occupied_rack", False),
    ToolDndCase("trash_vial", "gross_balance", True),
    ToolDndCase("trash_storage_jar", "empty_workbench", True),
    ToolDndCase("trash_storage_jar", "occupied_workbench", False),
    ToolDndCase("trash_storage_jar", "empty_rack", False),
    ToolDndCase("trash_storage_jar", "occupied_rack", False),
    ToolDndCase("trash_storage_jar", "gross_balance", True),
    ToolDndCase("gross_balance_vial", "empty_workbench", True),
    ToolDndCase("gross_balance_vial", "occupied_workbench", False),
    ToolDndCase("gross_balance_vial", "empty_rack", True),
    ToolDndCase("gross_balance_vial", "occupied_rack", False),
    ToolDndCase("gross_balance_vial", "trash", True),
)


def _tool_id_for_source(source: ToolSource) -> str:
    if source in {"palette_vial", "workbench_vial", "rack_vial", "trash_vial", "gross_balance_vial"}:
        return "sample_vial_lcms"
    if source in {"palette_storage_jar", "workbench_storage_jar", "trash_storage_jar"}:
        return "hdpe_storage_jar_2l"
    if source == "basket_bag":
        return "sealed_sampling_bag"
    raise AssertionError(f"Unhandled source: {source}")


def _prepare_target(service: ExperimentRuntimeService, experiment_id: str, target: ToolTarget) -> None:
    if target == "occupied_workbench":
        PlaceToolOnWorkbenchService(service).run(experiment_id, PlaceToolOnWorkbenchRequest(slot_id="station_2", tool_id="sample_vial_lcms"))
        return
    if target == "occupied_rack":
        PlaceToolInRackSlotService(service).run(experiment_id, PlaceToolInRackSlotRequest(rack_slot_id="rack_slot_2", tool_id="sample_vial_lcms"))


def _prepare_source(service: ExperimentRuntimeService, experiment_id: str, source: ToolSource) -> str | None:
    tool_id = _tool_id_for_source(source)
    if source.startswith("palette_"):
        return None
    if source == "basket_bag":
        return None
    if source.startswith("workbench_"):
        PlaceToolOnWorkbenchService(service).run(experiment_id, PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id=tool_id))
        return None
    if source == "rack_vial":
        PlaceToolInRackSlotService(service).run(experiment_id, PlaceToolInRackSlotRequest(rack_slot_id="rack_slot_1", tool_id=tool_id))
        return None
    if source.startswith("trash_"):
        PlaceToolOnWorkbenchService(service).run(experiment_id, PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id=tool_id))
        discarded = DiscardWorkbenchToolService(service).run(experiment_id, WorkbenchSlotRequest(slot_id="station_1"))
        return discarded.trash.children[0].id
    if source == "gross_balance_vial":
        PlaceToolOnGrossBalanceService(service).run(experiment_id, PlaceToolOnGrossBalanceRequest(tool_id=tool_id))
        return None
    raise AssertionError(f"Unhandled source: {source}")


def _execute_drop(
    service: ExperimentRuntimeService,
    experiment_id: str,
    source: ToolSource,
    target: ToolTarget,
    trash_tool_id: str | None,
):
    tool_id = _tool_id_for_source(source)
    if target in {"empty_workbench", "occupied_workbench"}:
        if source.startswith("palette_"):
            return PlaceToolOnWorkbenchService(service).run(experiment_id, PlaceToolOnWorkbenchRequest(slot_id="station_2", tool_id=tool_id))
        if source == "basket_bag":
            tool_id = service.get_experiment(experiment_id).basket_tools[0].id
            return PlaceReceivedBagOnWorkbenchService(service).run(
                experiment_id, PlaceReceivedBagOnWorkbenchRequest(target_slot_id="station_2", tool_id=tool_id)
            )
        if source.startswith("workbench_"):
            return MoveToolBetweenWorkbenchSlotsService(service).run(
                experiment_id,
                MoveToolBetweenWorkbenchSlotsRequest(source_slot_id="station_1", target_slot_id="station_2"),
            )
        if source == "rack_vial":
            return RemoveRackToolToWorkbenchSlotService(service).run(
                experiment_id,
                RemoveRackToolToWorkbenchSlotRequest(rack_slot_id="rack_slot_1", target_slot_id="station_2"),
            )
        if source.startswith("trash_"):
            assert trash_tool_id is not None
            return RestoreTrashedToolToWorkbenchSlotService(service).run(
                experiment_id,
                RestoreTrashedToolToWorkbenchSlotRequest(trash_tool_id=trash_tool_id, target_slot_id="station_2"),
            )
        if source == "gross_balance_vial":
            return MoveGrossBalanceToolToWorkbenchService(service).run(
                experiment_id, MoveGrossBalanceToolToWorkbenchRequest(target_slot_id="station_2")
            )
    if target in {"empty_rack", "occupied_rack"}:
        if source.startswith("palette_"):
            return PlaceToolInRackSlotService(service).run(experiment_id, PlaceToolInRackSlotRequest(rack_slot_id="rack_slot_2", tool_id=tool_id))
        if source == "workbench_vial":
            return PlaceWorkbenchToolInRackSlotService(service).run(
                experiment_id,
                PlaceWorkbenchToolInRackSlotRequest(source_slot_id="station_1", rack_slot_id="rack_slot_2"),
            )
        if source == "rack_vial":
            return MoveRackToolBetweenSlotsService(service).run(
                experiment_id,
                MoveRackToolBetweenSlotsRequest(source_rack_slot_id="rack_slot_1", target_rack_slot_id="rack_slot_2"),
            )
        if source == "trash_vial":
            assert trash_tool_id is not None
            return RestoreTrashedToolToRackSlotService(service).run(
                experiment_id,
                RestoreTrashedToolToRackSlotRequest(trash_tool_id=trash_tool_id, rack_slot_id="rack_slot_2"),
            )
        if source == "gross_balance_vial":
            return MoveGrossBalanceToolToRackService(service).run(experiment_id, MoveGrossBalanceToolToRackRequest(rack_slot_id="rack_slot_2"))
    if target == "gross_balance":
        if source.startswith("palette_"):
            return PlaceToolOnGrossBalanceService(service).run(experiment_id, PlaceToolOnGrossBalanceRequest(tool_id=tool_id))
        if source == "basket_bag":
            basket_tool_id = service.get_experiment(experiment_id).basket_tools[0].id
            return MoveBasketToolToGrossBalanceService(service).run(experiment_id, MoveBasketToolToGrossBalanceRequest(tool_id=basket_tool_id))
        if source.startswith("workbench_"):
            return MoveWorkbenchToolToGrossBalanceService(service).run(
                experiment_id, MoveWorkbenchToolToGrossBalanceRequest(source_slot_id="station_1")
            )
        if source == "rack_vial":
            return MoveRackToolToGrossBalanceService(service).run(experiment_id, MoveRackToolToGrossBalanceRequest(rack_slot_id="rack_slot_1"))
        if source.startswith("trash_"):
            assert trash_tool_id is not None
            return RestoreTrashedToolToGrossBalanceService(service).run(
                experiment_id, RestoreTrashedToolToGrossBalanceRequest(trash_tool_id=trash_tool_id)
            )
    if target == "trash":
        if source.startswith("palette_"):
            return DiscardToolFromPaletteService(service).run(experiment_id, DiscardToolFromPaletteRequest(tool_id=tool_id))
        if source == "basket_bag":
            basket_tool_id = service.get_experiment(experiment_id).basket_tools[0].id
            return DiscardBasketToolService(service).run(experiment_id, DiscardBasketToolRequest(tool_id=basket_tool_id))
        if source.startswith("workbench_"):
            return DiscardWorkbenchToolService(service).run(experiment_id, WorkbenchSlotRequest(slot_id="station_1"))
        if source == "rack_vial":
            return DiscardRackToolService(service).run(experiment_id, DiscardRackToolRequest(rack_slot_id="rack_slot_1"))
        if source == "gross_balance_vial":
            return DiscardGrossBalanceToolService(service).run(experiment_id, EmptyRequest())
    raise ValueError(f"Unsupported tool drop: {source} -> {target}")


@pytest.mark.parametrize(
    ("source", "target", "allowed"),
    [(case.source, case.target, case.allowed) for case in TOOL_DND_CASES],
    ids=[f"{case.source}_to_{case.target}_{'allow' if case.allowed else 'reject'}" for case in TOOL_DND_CASES],
)
def test_tool_dnd_matrix(source: ToolSource, target: ToolTarget, allowed: bool) -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    _prepare_target(service, experiment.id, target)
    trash_tool_id = _prepare_source(service, experiment.id, source)

    if not allowed:
        with pytest.raises(ValueError):
            _execute_drop(service, experiment.id, source, target, trash_tool_id)
        return

    updated = _execute_drop(service, experiment.id, source, target, trash_tool_id)

    if target in {"empty_workbench", "occupied_workbench"}:
        assert next(slot for slot in updated.workbench.slots if slot.id == "station_2").tool is not None
        return
    if target in {"empty_rack", "occupied_rack"}:
        assert next(slot for slot in updated.rack.slots if slot.id == "rack_slot_2").tool is not None
        return
    if target == "gross_balance":
        gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
        assert gross_balance.tool is not None
        return
    if target == "trash":
        assert updated.trash.children
