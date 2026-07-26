from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import pytest

from app.services.dnd_move_service import DndMoveObjectRequest, DndMoveObjectService, DndObjectRef
from app.services.domain_services.analytical_balance import (
    MoveGrossBalanceToolToAnalyticalBalanceRequest,
    MoveGrossBalanceToolToAnalyticalBalanceService,
    MoveRackToolToAnalyticalBalanceRequest,
    MoveRackToolToAnalyticalBalanceService,
    MoveWorkbenchToolToAnalyticalBalanceRequest,
    MoveWorkbenchToolToAnalyticalBalanceService,
    PlaceToolOnAnalyticalBalanceRequest,
    PlaceToolOnAnalyticalBalanceService,
    RestoreTrashedToolToAnalyticalBalanceRequest,
    RestoreTrashedToolToAnalyticalBalanceService,
)
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
from app.services.domain_services.vortex import (
    MoveGrossBalanceToolToVortexRequest,
    MoveGrossBalanceToolToVortexService,
    MoveRackToolToVortexRequest,
    MoveRackToolToVortexService,
    MoveWorkbenchToolToVortexRequest,
    MoveWorkbenchToolToVortexService,
    PlaceToolOnVortexRequest,
    PlaceToolOnVortexService,
    RestoreTrashedToolToVortexRequest,
    RestoreTrashedToolToVortexService,
)
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
    "palette_cutting_board",
    "basket_bag",
    "workbench_vial",
    "workbench_storage_jar",
    "workbench_cutting_board",
    "rack_vial",
    "trash_vial",
    "trash_storage_jar",
    "gross_balance_vial",
    "analytical_balance_vial",
    "vortex_centrifuge",
    "centrifuge_centrifuge",
]
ToolTarget = Literal[
    "empty_workbench",
    "occupied_workbench",
    "empty_rack",
    "occupied_rack",
    "gross_balance",
    "analytical_balance",
    "vortex",
    "centrifuge",
    "trash",
]


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
    ToolDndCase("palette_cutting_board", "empty_workbench", True),
    ToolDndCase("palette_cutting_board", "occupied_workbench", False),
    ToolDndCase("palette_cutting_board", "empty_rack", False),
    ToolDndCase("palette_cutting_board", "occupied_rack", False),
    ToolDndCase("palette_cutting_board", "gross_balance", True),
    ToolDndCase("palette_cutting_board", "trash", False),
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
    ToolDndCase("workbench_cutting_board", "empty_workbench", True),
    ToolDndCase("workbench_cutting_board", "occupied_workbench", False),
    ToolDndCase("workbench_cutting_board", "empty_rack", False),
    ToolDndCase("workbench_cutting_board", "occupied_rack", False),
    ToolDndCase("workbench_cutting_board", "gross_balance", True),
    ToolDndCase("workbench_cutting_board", "trash", False),
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
    ToolDndCase("gross_balance_vial", "analytical_balance", True),
    ToolDndCase("gross_balance_vial", "vortex", False),
    ToolDndCase("gross_balance_vial", "trash", True),
    # analytical_balance target — existing sources
    ToolDndCase("palette_vial", "analytical_balance", True),
    ToolDndCase("palette_storage_jar", "analytical_balance", True),
    ToolDndCase("palette_cutting_board", "analytical_balance", False),
    ToolDndCase("basket_bag", "analytical_balance", False),
    ToolDndCase("workbench_vial", "analytical_balance", True),
    ToolDndCase("workbench_storage_jar", "analytical_balance", True),
    ToolDndCase("workbench_cutting_board", "analytical_balance", False),
    ToolDndCase("rack_vial", "analytical_balance", True),
    ToolDndCase("trash_vial", "analytical_balance", True),
    ToolDndCase("trash_storage_jar", "analytical_balance", True),
    # vortex target — existing sources (all False: only centrifuge tubes are allowed)
    ToolDndCase("palette_vial", "vortex", False),
    ToolDndCase("palette_storage_jar", "vortex", False),
    ToolDndCase("palette_cutting_board", "vortex", False),
    ToolDndCase("basket_bag", "vortex", False),
    ToolDndCase("workbench_vial", "vortex", False),
    ToolDndCase("workbench_storage_jar", "vortex", False),
    ToolDndCase("workbench_cutting_board", "vortex", False),
    ToolDndCase("rack_vial", "vortex", False),
    ToolDndCase("trash_vial", "vortex", False),
    ToolDndCase("trash_storage_jar", "vortex", False),
    # analytical_balance_vial source (sample_vial_lcms placed on analytical balance)
    ToolDndCase("analytical_balance_vial", "empty_workbench", True),
    ToolDndCase("analytical_balance_vial", "occupied_workbench", False),
    ToolDndCase("analytical_balance_vial", "empty_rack", True),
    ToolDndCase("analytical_balance_vial", "occupied_rack", False),
    ToolDndCase("analytical_balance_vial", "gross_balance", True),
    ToolDndCase("analytical_balance_vial", "analytical_balance", False),
    ToolDndCase("analytical_balance_vial", "vortex", False),
    ToolDndCase("analytical_balance_vial", "trash", True),
    # vortex_centrifuge source (centrifuge_tube_50ml placed on vortex)
    ToolDndCase("vortex_centrifuge", "empty_workbench", True),
    ToolDndCase("vortex_centrifuge", "occupied_workbench", False),
    ToolDndCase("vortex_centrifuge", "empty_rack", False),
    ToolDndCase("vortex_centrifuge", "occupied_rack", False),
    ToolDndCase("vortex_centrifuge", "gross_balance", True),
    ToolDndCase("vortex_centrifuge", "analytical_balance", True),
    ToolDndCase("vortex_centrifuge", "vortex", False),
    ToolDndCase("vortex_centrifuge", "trash", True),
    # centrifuge target — every existing concrete source is explicit
    ToolDndCase("palette_vial", "centrifuge", False),
    ToolDndCase("palette_storage_jar", "centrifuge", False),
    ToolDndCase("palette_cutting_board", "centrifuge", False),
    ToolDndCase("basket_bag", "centrifuge", False),
    ToolDndCase("workbench_vial", "centrifuge", False),
    ToolDndCase("workbench_storage_jar", "centrifuge", False),
    ToolDndCase("workbench_cutting_board", "centrifuge", False),
    ToolDndCase("rack_vial", "centrifuge", False),
    ToolDndCase("trash_vial", "centrifuge", False),
    ToolDndCase("trash_storage_jar", "centrifuge", False),
    ToolDndCase("gross_balance_vial", "centrifuge", False),
    ToolDndCase("analytical_balance_vial", "centrifuge", False),
    ToolDndCase("vortex_centrifuge", "centrifuge", True),
    # centrifuge origin — same tube compatibility from every location
    ToolDndCase("centrifuge_centrifuge", "empty_workbench", True),
    ToolDndCase("centrifuge_centrifuge", "occupied_workbench", False),
    ToolDndCase("centrifuge_centrifuge", "empty_rack", False),
    ToolDndCase("centrifuge_centrifuge", "occupied_rack", False),
    ToolDndCase("centrifuge_centrifuge", "gross_balance", True),
    ToolDndCase("centrifuge_centrifuge", "analytical_balance", True),
    ToolDndCase("centrifuge_centrifuge", "vortex", True),
    ToolDndCase("centrifuge_centrifuge", "centrifuge", False),
    ToolDndCase("centrifuge_centrifuge", "trash", True),
)


def _tool_id_for_source(source: ToolSource) -> str:
    if source in {"palette_vial", "workbench_vial", "rack_vial", "trash_vial", "gross_balance_vial", "analytical_balance_vial"}:
        return "sample_vial_lcms"
    if source in {"palette_storage_jar", "workbench_storage_jar", "trash_storage_jar"}:
        return "hdpe_storage_jar_2l"
    if source in {"palette_cutting_board", "workbench_cutting_board"}:
        return "cutting_board_hdpe"
    if source == "basket_bag":
        return "sealed_sampling_bag"
    if source in {"vortex_centrifuge", "centrifuge_centrifuge"}:
        return "centrifuge_tube_50ml"
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
    if source == "analytical_balance_vial":
        PlaceToolOnAnalyticalBalanceService(service).run(experiment_id, PlaceToolOnAnalyticalBalanceRequest(tool_id=tool_id))
        return None
    if source == "vortex_centrifuge":
        PlaceToolOnVortexService(service).run(experiment_id, PlaceToolOnVortexRequest(tool_id=tool_id))
        return None
    if source == "centrifuge_centrifuge":
        DndMoveObjectService(service).run(
            experiment_id,
            DndMoveObjectRequest(
                entity=DndObjectRef(kind="tool", id=tool_id),
                source=DndObjectRef(kind="palette", id=tool_id),
                destination=DndObjectRef(kind="centrifuge", id="centrifuge"),
            ),
        )
        return None
    raise AssertionError(f"Unhandled source: {source}")


def _dnd_dest_ref(target: ToolTarget) -> DndObjectRef:
    if target in {"empty_workbench", "occupied_workbench"}:
        return DndObjectRef(kind="workbench_slot", id="station_2")
    if target in {"empty_rack", "occupied_rack"}:
        return DndObjectRef(kind="rack_slot", id="rack_slot_2")
    if target == "gross_balance":
        return DndObjectRef(kind="gross_balance", id="gross_balance")
    if target == "analytical_balance":
        return DndObjectRef(kind="analytical_balance", id="analytical_balance")
    if target == "vortex":
        return DndObjectRef(kind="vortex", id="vortex")
    if target == "centrifuge":
        return DndObjectRef(kind="centrifuge", id="centrifuge")
    if target == "trash":
        return DndObjectRef(kind="trash_bin", id="trash")
    raise AssertionError(f"Unhandled target: {target}")


def _execute_drop(
    service: ExperimentRuntimeService,
    experiment_id: str,
    source: ToolSource,
    target: ToolTarget,
    trash_tool_id: str | None,
):
    if target == "centrifuge":
        return _execute_generic_drop_to_centrifuge(
            service,
            experiment_id,
            source,
            trash_tool_id,
        )
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
        if source in {"analytical_balance_vial", "vortex_centrifuge", "centrifuge_centrifuge"}:
            return _execute_dnd_drop(service, experiment_id, source, target)
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
        if source in {"analytical_balance_vial", "vortex_centrifuge", "centrifuge_centrifuge"}:
            return _execute_dnd_drop(service, experiment_id, source, target)
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
        if source in {"analytical_balance_vial", "vortex_centrifuge", "centrifuge_centrifuge"}:
            return _execute_dnd_drop(service, experiment_id, source, target)
    if target == "analytical_balance":
        if source.startswith("palette_"):
            return PlaceToolOnAnalyticalBalanceService(service).run(experiment_id, PlaceToolOnAnalyticalBalanceRequest(tool_id=tool_id))
        if source == "basket_bag":
            basket_tool_id = service.get_experiment(experiment_id).basket_tools[0].id
            return DndMoveObjectService(service).run(
                experiment_id,
                DndMoveObjectRequest(
                    entity=DndObjectRef(kind="tool", id=basket_tool_id),
                    source=DndObjectRef(kind="basket", id="produce_basket"),
                    destination=DndObjectRef(kind="analytical_balance", id="analytical_balance"),
                ),
            )
        if source.startswith("workbench_"):
            return MoveWorkbenchToolToAnalyticalBalanceService(service).run(
                experiment_id, MoveWorkbenchToolToAnalyticalBalanceRequest(source_slot_id="station_1")
            )
        if source == "rack_vial":
            return MoveRackToolToAnalyticalBalanceService(service).run(
                experiment_id, MoveRackToolToAnalyticalBalanceRequest(rack_slot_id="rack_slot_1")
            )
        if source.startswith("trash_"):
            assert trash_tool_id is not None
            return RestoreTrashedToolToAnalyticalBalanceService(service).run(
                experiment_id, RestoreTrashedToolToAnalyticalBalanceRequest(trash_tool_id=trash_tool_id)
            )
        if source == "gross_balance_vial":
            return MoveGrossBalanceToolToAnalyticalBalanceService(service).run(experiment_id, MoveGrossBalanceToolToAnalyticalBalanceRequest())
        if source in {"analytical_balance_vial", "vortex_centrifuge", "centrifuge_centrifuge"}:
            return _execute_dnd_drop(service, experiment_id, source, target)
    if target == "vortex":
        if source.startswith("palette_"):
            return PlaceToolOnVortexService(service).run(experiment_id, PlaceToolOnVortexRequest(tool_id=tool_id))
        if source == "basket_bag":
            basket_tool_id = service.get_experiment(experiment_id).basket_tools[0].id
            return DndMoveObjectService(service).run(
                experiment_id,
                DndMoveObjectRequest(
                    entity=DndObjectRef(kind="tool", id=basket_tool_id),
                    source=DndObjectRef(kind="basket", id="produce_basket"),
                    destination=DndObjectRef(kind="vortex", id="vortex"),
                ),
            )
        if source.startswith("workbench_"):
            return MoveWorkbenchToolToVortexService(service).run(experiment_id, MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"))
        if source == "rack_vial":
            return MoveRackToolToVortexService(service).run(experiment_id, MoveRackToolToVortexRequest(rack_slot_id="rack_slot_1"))
        if source.startswith("trash_"):
            assert trash_tool_id is not None
            return RestoreTrashedToolToVortexService(service).run(experiment_id, RestoreTrashedToolToVortexRequest(trash_tool_id=trash_tool_id))
        if source == "gross_balance_vial":
            return MoveGrossBalanceToolToVortexService(service).run(experiment_id, MoveGrossBalanceToolToVortexRequest())
        if source in {"analytical_balance_vial", "vortex_centrifuge", "centrifuge_centrifuge"}:
            return _execute_dnd_drop(service, experiment_id, source, target)
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
        if source in {"analytical_balance_vial", "vortex_centrifuge", "centrifuge_centrifuge"}:
            return _execute_dnd_drop(service, experiment_id, source, target)
    raise ValueError(f"Unsupported tool drop: {source} -> {target}")


def _execute_generic_drop_to_centrifuge(
    service: ExperimentRuntimeService,
    experiment_id: str,
    source: ToolSource,
    trash_tool_id: str | None,
):
    state = service.get_experiment(experiment_id)
    tool_id = _tool_id_for_source(source)
    if source.startswith("palette_"):
        entity_id = tool_id
        source_ref = DndObjectRef(kind="palette", id=tool_id)
    elif source == "basket_bag":
        entity_id = state.basket_tools[0].id
        source_ref = DndObjectRef(kind="basket", id="produce_basket")
    elif source.startswith("workbench_"):
        tool = state.workbench.slots[0].tool
        assert tool is not None
        entity_id = tool.id
        source_ref = DndObjectRef(kind="workbench", id="station_1")
    elif source == "rack_vial":
        tool = state.rack.slots[0].tool
        assert tool is not None
        entity_id = tool.id
        source_ref = DndObjectRef(kind="rack", id="rack_slot_1")
    elif source.startswith("trash_"):
        assert trash_tool_id is not None
        entity_id = trash_tool_id
        source_ref = DndObjectRef(kind="trash", id=trash_tool_id)
    elif source == "gross_balance_vial":
        tool = next(w for w in state.workspace.widgets if w.id == "gross_balance").tool
        assert tool is not None
        entity_id = tool.id
        source_ref = DndObjectRef(kind="gross_balance", id="gross_balance")
    elif source == "analytical_balance_vial":
        tool = next(w for w in state.workspace.widgets if w.id == "analytical_balance").tool
        assert tool is not None
        entity_id = tool.id
        source_ref = DndObjectRef(kind="analytical_balance", id="analytical_balance")
    elif source == "vortex_centrifuge":
        tool = next(w for w in state.workspace.widgets if w.id == "vortex").tool
        assert tool is not None
        entity_id = tool.id
        source_ref = DndObjectRef(kind="vortex", id="vortex")
    elif source == "centrifuge_centrifuge":
        tool = next(w for w in state.workspace.widgets if w.id == "centrifuge").tool
        assert tool is not None
        entity_id = tool.id
        source_ref = DndObjectRef(kind="centrifuge", id="centrifuge")
    else:
        raise AssertionError(f"Unhandled centrifuge source: {source}")
    return DndMoveObjectService(service).run(
        experiment_id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="tool", id=entity_id),
            source=source_ref,
            destination=DndObjectRef(kind="centrifuge", id="centrifuge"),
        ),
    )


def _execute_dnd_drop(
    service: ExperimentRuntimeService,
    experiment_id: str,
    source: ToolSource,
    target: ToolTarget,
):
    experiment_state = service.get_experiment(experiment_id)
    if source == "analytical_balance_vial":
        ab = next(w for w in experiment_state.workspace.widgets if w.id == "analytical_balance")
        assert ab.tool is not None
        entity_id = ab.tool.id
        source_ref = DndObjectRef(kind="analytical_balance", id="analytical_balance")
    elif source == "vortex_centrifuge":
        vortex_w = next(w for w in experiment_state.workspace.widgets if w.id == "vortex")
        assert vortex_w.tool is not None
        entity_id = vortex_w.tool.id
        source_ref = DndObjectRef(kind="vortex", id="vortex")
    elif source == "centrifuge_centrifuge":
        centrifuge_w = next(w for w in experiment_state.workspace.widgets if w.id == "centrifuge")
        assert centrifuge_w.tool is not None
        entity_id = centrifuge_w.tool.id
        source_ref = DndObjectRef(kind="centrifuge", id="centrifuge")
    else:
        raise AssertionError(f"_execute_dnd_drop called for unexpected source: {source}")
    return DndMoveObjectService(service).run(
        experiment_id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="tool", id=entity_id),
            source=source_ref,
            destination=_dnd_dest_ref(target),
        ),
    )


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
    if target == "analytical_balance":
        ab = next(widget for widget in updated.workspace.widgets if widget.id == "analytical_balance")
        assert ab.tool is not None
        return
    if target == "vortex":
        vortex = next(widget for widget in updated.workspace.widgets if widget.id == "vortex")
        assert vortex.tool is not None
        return
    if target == "centrifuge":
        centrifuge = next(widget for widget in updated.workspace.widgets if widget.id == "centrifuge")
        assert centrifuge.tool is not None
        return
    if target == "trash":
        assert updated.trash.children


def test_dnd_move_rejects_tool_entity_that_does_not_match_source() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    PlaceToolOnWorkbenchService(service).run(experiment.id, PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="sample_vial_lcms"))

    with pytest.raises(ValueError, match="Moved tool entity does not match"):
        DndMoveObjectService(service).run(
            experiment.id,
            DndMoveObjectRequest(
                entity=DndObjectRef(kind="tool", id="wrong_tool"),
                source=DndObjectRef(kind="workbench", id="station_1"),
                destination=DndObjectRef(kind="gross_balance", id="gross_balance"),
            ),
        )


def test_dnd_move_rejects_tool_drop_onto_current_location() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    updated = PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="sample_vial_lcms"),
    )
    tool = next(slot for slot in updated.workbench.slots if slot.id == "station_1").tool
    assert tool is not None

    with pytest.raises(ValueError, match="current location"):
        DndMoveObjectService(service).run(
            experiment.id,
            DndMoveObjectRequest(
                entity=DndObjectRef(kind="tool", id=tool.id),
                source=DndObjectRef(kind="workbench", id="station_1"),
                destination=DndObjectRef(kind="workbench_slot", id="station_1"),
            ),
        )
