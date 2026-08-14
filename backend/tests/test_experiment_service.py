import re
import sqlite3
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest

from app.domain.models import ProduceFraction, ProduceLot, ProduceMaterialState
from app.services.dnd_move_service import DndMoveObjectRequest, DndMoveObjectService, DndObjectRef
from app.services.domain_services.debug import (
    CreateDebugProduceLotOnWorkbenchRequest,
    CreateDebugProduceLotOnWorkbenchService,
    CreateDebugProduceLotToWidgetRequest,
    CreateDebugProduceLotToWidgetService,
)
from app.services.domain_services.gross_balance import (
    CloseGrossBalanceToolService,
    DiscardGrossBalanceProduceLotRequest,
    DiscardGrossBalanceProduceLotService,
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
    OpenGrossBalanceToolService,
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
    ApplyPrintedLimsLabelRequest,
    ApplyPrintedLimsLabelService,
    ApplyPrintedLimsLabelToBasketBagService,
    ApplyPrintedLimsLabelToGrossBalanceBagService,
    CreateLimsReceptionRequest,
    CreateLimsReceptionService,
    DiscardPrintedLimsLabelService,
    EmptyReceptionRequest,
    PlaceReceivedBagOnWorkbenchRequest,
    PlaceReceivedBagOnWorkbenchService,
    PrintLimsLabelRequest,
    PrintLimsLabelService,
    RecordGrossWeightRequest,
    RecordGrossWeightService,
    SetGrossMassOffsetRequest,
    SetGrossMassOffsetService,
)
from app.services.domain_services.trash import DiscardBasketToolRequest, DiscardBasketToolService
from app.services.domain_services.vortex import (
    EmptyRequest as EmptyVortexRequest,
)
from app.services.domain_services.vortex import (
    MoveWorkbenchToolToVortexRequest,
    MoveWorkbenchToolToVortexService,
    StartVortexCycleService,
)
from app.services.domain_services.workbench import (
    AddLiquidToWorkbenchToolRequest,
    AddLiquidToWorkbenchToolService,
    AddWorkbenchSlotService,
    ApplySampleLabelToWorkbenchToolService,
    CloseWorkbenchToolService,
    CutWorkbenchProduceLotService,
    DiscardSampleLabelFromPaletteRequest,
    DiscardSampleLabelFromPaletteService,
    DiscardSampleLabelFromWorkbenchToolService,
    DiscardToolFromPaletteRequest,
    DiscardToolFromPaletteService,
    DiscardWorkbenchToolService,
    EmptyWorkbenchRequest,
    LoadSpatulaFromWorkbenchToolService,
    MoveToolBetweenWorkbenchSlotsRequest,
    MoveToolBetweenWorkbenchSlotsService,
    OpenWorkbenchToolService,
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
    PourSpatulaIntoWorkbenchToolRequest,
    PourSpatulaIntoWorkbenchToolService,
    RemoveLiquidFromWorkbenchToolService,
    RemoveWorkbenchSlotService,
    RestoreTrashedToolToWorkbenchSlotRequest,
    RestoreTrashedToolToWorkbenchSlotService,
    StoreWorkbenchToolService,
    UpdateWorkbenchLiquidVolumeRequest,
    UpdateWorkbenchLiquidVolumeService,
    UpdateWorkbenchToolSampleLabelTextRequest,
    UpdateWorkbenchToolSampleLabelTextService,
    WorkbenchLiquidRequest,
    WorkbenchProduceLotRequest,
    WorkbenchSampleLabelRequest,
    WorkbenchSlotRequest,
)
from app.services.domain_services.workspace import (
    AddLiquidToWorkspaceWidgetRequest,
    AddLiquidToWorkspaceWidgetService,
    AddWorkspaceWidgetService,
    AdvanceWorkspaceCryogenicsRequest,
    AdvanceWorkspaceCryogenicsService,
    CompleteGrinderCycleService,
    CreateOrInitProduceLotService,
    CreateProduceLotRequest,
    MoveWorkspaceWidgetService,
    RemoveLiquidFromWorkspaceWidgetService,
    StartGrinderCycleService,
    StoreWorkspaceWidgetService,
    UpdateWorkspaceWidgetLiquidVolumeRequest,
    UpdateWorkspaceWidgetLiquidVolumeService,
    WorkspaceWidgetLayoutRequest,
    WorkspaceWidgetLiquidRequest,
    WorkspaceWidgetRequest,
)
from app.services.experiment_repository import SqliteExperimentRepository
from app.services.experiment_service import ExperimentRuntimeService
from app.services.helpers.produce_material_states import set_material_state_name
from app.services.helpers.workbench import build_workbench_tool
from app.services.received_sample_generation import (
    SAMPLE_BAG_TARE_MASS_G,
)


def _lot_state(experiment, produce_lot_id: str):
    state = next((s for s in experiment.produce_material_states if s.produce_lot_id == produce_lot_id), None)
    assert state is not None
    return state


def _material_state_name(experiment, produce_lot_id: str) -> str:
    state = next((s for s in experiment.produce_material_states if s.produce_lot_id == produce_lot_id), None)
    return state.material_state if state is not None else "whole"


def _lot_temperature_c(experiment, produce_lot_id: str) -> float:
    return _lot_state(experiment, produce_lot_id).temperature_c


def _lot_grind_quality_label(experiment, produce_lot_id: str):
    return _lot_state(experiment, produce_lot_id).grind_quality_label


def _lot_homogeneity_score(experiment, produce_lot_id: str):
    return _lot_state(experiment, produce_lot_id).homogeneity_score


def _lot_residual_co2_mass_g(experiment, produce_lot_id: str) -> float:
    return _lot_state(experiment, produce_lot_id).residual_co2_mass_g


def _fraction_is_contaminated(fractions, produce_lot_id: str) -> bool:
    fraction = next(f for f in fractions if f.produce_lot_id == produce_lot_id)
    return fraction.is_contaminated


def print_lims_label(service: ExperimentRuntimeService, experiment_id: str, entry_id: str | None = None):
    return PrintLimsLabelService(service).run(experiment_id, PrintLimsLabelRequest(entry_id=entry_id))


def move_basket_tool_to_gross_balance(service: ExperimentRuntimeService, experiment_id: str):
    tool_id = service.get_experiment(experiment_id).basket_tools[0].id
    return MoveBasketToolToGrossBalanceService(service).run(experiment_id, MoveBasketToolToGrossBalanceRequest(tool_id=tool_id))


def place_tool_on_gross_balance(service: ExperimentRuntimeService, experiment_id: str, tool_id: str):
    return PlaceToolOnGrossBalanceService(service).run(experiment_id, PlaceToolOnGrossBalanceRequest(tool_id=tool_id))


def move_gross_balance_tool_to_rack(service: ExperimentRuntimeService, experiment_id: str, rack_slot_id: str):
    return MoveGrossBalanceToolToRackService(service).run(experiment_id, MoveGrossBalanceToolToRackRequest(rack_slot_id=rack_slot_id))


def create_debug_produce_lot_to_widget(
    service: ExperimentRuntimeService,
    experiment_id: str,
    preset_id: str,
    widget_id: str,
    total_mass_g: float | None = None,
    temperature_c: float | None = None,
    residual_co2_mass_g: float | None = None,
):
    return CreateDebugProduceLotToWidgetService(service).run(
        experiment_id,
        CreateDebugProduceLotToWidgetRequest(
            preset_id=preset_id,
            widget_id=widget_id,
            total_mass_g=total_mass_g,
            temperature_c=temperature_c,
            residual_co2_mass_g=residual_co2_mass_g,
        ),
    )


def create_produce_lot(service: ExperimentRuntimeService, experiment_id: str, produce_type: str):
    return CreateOrInitProduceLotService(service).run(experiment_id, CreateProduceLotRequest(produce_type=produce_type))


def create_lims_reception(
    service: ExperimentRuntimeService,
    experiment_id: str,
    orchard_name: str,
    harvest_date: str,
    indicative_mass_g: float,
    measured_gross_mass_g: float | None,
    measured_sample_mass_g: float | None = None,
    entry_id: str | None = None,
):
    return CreateLimsReceptionService(service).run(
        experiment_id,
        CreateLimsReceptionRequest(
            orchard_name=orchard_name,
            harvest_date=harvest_date,
            indicative_mass_g=indicative_mass_g,
            measured_gross_mass_g=measured_gross_mass_g,
            measured_sample_mass_g=measured_sample_mass_g,
            entry_id=entry_id,
        ),
    )


def place_tool_on_workbench(service: ExperimentRuntimeService, experiment_id: str, slot_id: str, tool_id: str):
    return PlaceToolOnWorkbenchService(service).run(experiment_id, PlaceToolOnWorkbenchRequest(slot_id=slot_id, tool_id=tool_id))


def move_workbench_tool_to_gross_balance(service: ExperimentRuntimeService, experiment_id: str, source_slot_id: str):
    return MoveWorkbenchToolToGrossBalanceService(service).run(
        experiment_id,
        MoveWorkbenchToolToGrossBalanceRequest(source_slot_id=source_slot_id),
    )


def place_tool_in_rack_slot(service: ExperimentRuntimeService, experiment_id: str, rack_slot_id: str, tool_id: str):
    return PlaceToolInRackSlotService(service).run(
        experiment_id,
        PlaceToolInRackSlotRequest(rack_slot_id=rack_slot_id, tool_id=tool_id),
    )


def discard_tool_from_palette(service: ExperimentRuntimeService, experiment_id: str, tool_id: str):
    return DiscardToolFromPaletteService(service).run(experiment_id, DiscardToolFromPaletteRequest(tool_id=tool_id))


def move_gross_balance_tool_to_workbench(service: ExperimentRuntimeService, experiment_id: str, target_slot_id: str):
    return MoveGrossBalanceToolToWorkbenchService(service).run(
        experiment_id,
        MoveGrossBalanceToolToWorkbenchRequest(target_slot_id=target_slot_id),
    )


def discard_gross_balance_tool(service: ExperimentRuntimeService, experiment_id: str):
    return DiscardGrossBalanceToolService(service).run(experiment_id, EmptyRequest())


def open_workbench_tool(service: ExperimentRuntimeService, experiment_id: str, slot_id: str):
    return OpenWorkbenchToolService(service).run(experiment_id, WorkbenchSlotRequest(slot_id=slot_id))


def open_gross_balance_tool(service: ExperimentRuntimeService, experiment_id: str):
    return OpenGrossBalanceToolService(service).run(experiment_id, EmptyRequest())


def close_gross_balance_tool(service: ExperimentRuntimeService, experiment_id: str):
    return CloseGrossBalanceToolService(service).run(experiment_id, EmptyRequest())


def apply_printed_lims_label_to_gross_balance_bag(service: ExperimentRuntimeService, experiment_id: str):
    return ApplyPrintedLimsLabelToGrossBalanceBagService(service).run(experiment_id, EmptyReceptionRequest())


def discard_gross_balance_produce_lot(service: ExperimentRuntimeService, experiment_id: str, produce_lot_id: str):
    return DiscardGrossBalanceProduceLotService(service).run(
        experiment_id,
        DiscardGrossBalanceProduceLotRequest(produce_lot_id=produce_lot_id),
    )


def move_object(
    service: ExperimentRuntimeService,
    experiment_id: str,
    *,
    entity_kind: str,
    entity_id: str,
    source_kind: str,
    source_id: str,
    destination_kind: str,
    destination_id: str,
):
    return DndMoveObjectService(service).run(
        experiment_id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind=entity_kind, id=entity_id),
            source=DndObjectRef(kind=source_kind, id=source_id),
            destination=DndObjectRef(kind=destination_kind, id=destination_id),
        ),
    )


def move_workspace_produce_lot_to_gross_balance(service: ExperimentRuntimeService, experiment_id: str, produce_lot_id: str):
    return move_object(
        service,
        experiment_id,
        entity_kind="produce_lot",
        entity_id=produce_lot_id,
        source_kind="basket",
        source_id="produce_basket",
        destination_kind="gross_balance",
        destination_id="gross_balance",
    )


def restore_trashed_produce_lot_to_gross_balance(service: ExperimentRuntimeService, experiment_id: str, trash_produce_lot_id: str):
    return move_object(
        service,
        experiment_id,
        entity_kind="produce_lot",
        entity_id=trash_produce_lot_id,
        source_kind="trash",
        source_id=trash_produce_lot_id,
        destination_kind="gross_balance",
        destination_id="gross_balance",
    )


def restore_trashed_tool_to_gross_balance(service: ExperimentRuntimeService, experiment_id: str, trash_tool_id: str):
    return RestoreTrashedToolToGrossBalanceService(service).run(
        experiment_id,
        RestoreTrashedToolToGrossBalanceRequest(trash_tool_id=trash_tool_id),
    )


def move_rack_tool_to_gross_balance(service: ExperimentRuntimeService, experiment_id: str, rack_slot_id: str):
    return MoveRackToolToGrossBalanceService(service).run(
        experiment_id,
        MoveRackToolToGrossBalanceRequest(rack_slot_id=rack_slot_id),
    )


def move_gross_balance_produce_lot_to_workbench(service: ExperimentRuntimeService, experiment_id: str, target_slot_id: str, produce_lot_id: str):
    return move_object(
        service,
        experiment_id,
        entity_kind="produce_lot",
        entity_id=produce_lot_id,
        source_kind="gross_balance",
        source_id="gross_balance",
        destination_kind="workbench_tool",
        destination_id=target_slot_id,
    )


def move_gross_balance_produce_lot_to_widget(service: ExperimentRuntimeService, experiment_id: str, widget_id: str, produce_lot_id: str):
    return move_object(
        service,
        experiment_id,
        entity_kind="produce_lot",
        entity_id=produce_lot_id,
        source_kind="gross_balance",
        source_id="gross_balance",
        destination_kind="workspace_widget",
        destination_id=widget_id,
    )


def _get_first_label_id(service: ExperimentRuntimeService, experiment_id: str, slot_id: str) -> str:
    experiment = service._require_experiment(experiment_id)
    slot = next((s for s in experiment.workbench.slots if s.id == slot_id), None)
    if slot is None or slot.tool is None or not slot.tool.labels:
        raise ValueError(f"No label on slot {slot_id}")
    return slot.tool.labels[0].id


def apply_command(
    service: ExperimentRuntimeService,
    experiment_id: str,
    command_type: str,
    payload: dict,
):
    handlers = {
        "add_workbench_slot": lambda: AddWorkbenchSlotService(service).run(experiment_id, EmptyWorkbenchRequest()),
        "remove_workbench_slot": lambda: RemoveWorkbenchSlotService(service).run(experiment_id, WorkbenchSlotRequest(slot_id=payload["slot_id"])),
        "place_tool_on_workbench": lambda: PlaceToolOnWorkbenchService(service).run(
            experiment_id,
            PlaceToolOnWorkbenchRequest(slot_id=payload["slot_id"], tool_id=payload["tool_id"]),
        ),
        "move_tool_between_workbench_slots": lambda: MoveToolBetweenWorkbenchSlotsService(service).run(
            experiment_id,
            MoveToolBetweenWorkbenchSlotsRequest(
                source_slot_id=payload["source_slot_id"],
                target_slot_id=payload["target_slot_id"],
            ),
        ),
        "discard_workbench_tool": lambda: DiscardWorkbenchToolService(service).run(experiment_id, WorkbenchSlotRequest(slot_id=payload["slot_id"])),
        "store_workbench_tool": lambda: StoreWorkbenchToolService(service).run(experiment_id, WorkbenchSlotRequest(slot_id=payload["slot_id"])),
        "discard_tool_from_palette": lambda: DiscardToolFromPaletteService(service).run(
            experiment_id, DiscardToolFromPaletteRequest(tool_id=payload["tool_id"])
        ),
        "discard_sample_label_from_palette": lambda: DiscardSampleLabelFromPaletteService(service).run(
            experiment_id,
            DiscardSampleLabelFromPaletteRequest(sample_label_id=payload["sample_label_id"]),
        ),
        "restore_trashed_tool_to_workbench_slot": lambda: RestoreTrashedToolToWorkbenchSlotService(service).run(
            experiment_id,
            RestoreTrashedToolToWorkbenchSlotRequest(
                trash_tool_id=payload["trash_tool_id"],
                target_slot_id=payload["target_slot_id"],
            ),
        ),
        "add_workspace_widget": lambda: AddWorkspaceWidgetService(service).run(
            experiment_id,
            WorkspaceWidgetLayoutRequest(
                widget_id=payload["widget_id"],
                anchor=payload["anchor"],
                offset_x=payload["offset_x"],
                offset_y=payload["offset_y"],
            ),
        ),
        "move_workspace_widget": lambda: MoveWorkspaceWidgetService(service).run(
            experiment_id,
            WorkspaceWidgetLayoutRequest(
                widget_id=payload["widget_id"],
                anchor=payload["anchor"],
                offset_x=payload["offset_x"],
                offset_y=payload["offset_y"],
            ),
        ),
        "store_workspace_widget": lambda: StoreWorkspaceWidgetService(service).run(
            experiment_id, WorkspaceWidgetRequest(widget_id=payload["widget_id"])
        ),
        "add_liquid_to_workspace_widget": lambda: AddLiquidToWorkspaceWidgetService(service).run(
            experiment_id,
            AddLiquidToWorkspaceWidgetRequest(
                widget_id=payload["widget_id"],
                liquid_id=payload["liquid_id"],
                volume_ml=payload.get("volume_ml"),
            ),
        ),
        "update_workspace_widget_liquid_volume": lambda: UpdateWorkspaceWidgetLiquidVolumeService(service).run(
            experiment_id,
            UpdateWorkspaceWidgetLiquidVolumeRequest(
                widget_id=payload["widget_id"],
                liquid_entry_id=payload["liquid_entry_id"],
                volume_ml=payload["volume_ml"],
            ),
        ),
        "remove_liquid_from_workspace_widget": lambda: RemoveLiquidFromWorkspaceWidgetService(service).run(
            experiment_id,
            WorkspaceWidgetLiquidRequest(
                widget_id=payload["widget_id"],
                liquid_entry_id=payload["liquid_entry_id"],
            ),
        ),
        "start_grinder_cycle": lambda: StartGrinderCycleService(service).run(experiment_id, WorkspaceWidgetRequest(widget_id=payload["widget_id"])),
        "complete_grinder_cycle": lambda: CompleteGrinderCycleService(service).run(
            experiment_id, WorkspaceWidgetRequest(widget_id=payload["widget_id"])
        ),
        "advance_workspace_cryogenics": lambda: AdvanceWorkspaceCryogenicsService(service).run(
            experiment_id, AdvanceWorkspaceCryogenicsRequest(elapsed_ms=payload["elapsed_ms"])
        ),
        "add_workspace_produce_lot_to_widget": lambda: move_object(
            service,
            experiment_id,
            entity_kind="produce_lot",
            entity_id=payload["produce_lot_id"],
            source_kind="basket",
            source_id="produce_basket",
            destination_kind="workspace_widget",
            destination_id=payload["widget_id"],
        ),
        "move_workbench_produce_lot_to_widget": lambda: move_object(
            service,
            experiment_id,
            entity_kind="produce_lot",
            entity_id=payload["produce_lot_id"],
            source_kind="workbench",
            source_id=payload["source_slot_id"],
            destination_kind="workspace_widget",
            destination_id=payload["widget_id"],
        ),
        "restore_trashed_produce_lot_to_widget": lambda: move_object(
            service,
            experiment_id,
            entity_kind="produce_lot",
            entity_id=payload["trash_produce_lot_id"],
            source_kind="trash",
            source_id=payload["trash_produce_lot_id"],
            destination_kind="workspace_widget",
            destination_id=payload["widget_id"],
        ),
        "create_produce_lot": lambda: CreateOrInitProduceLotService(service).run(
            experiment_id, CreateProduceLotRequest(produce_type=payload["produce_type"])
        ),
        "place_received_bag_on_workbench": lambda: PlaceReceivedBagOnWorkbenchService(service).run(
            experiment_id,
            PlaceReceivedBagOnWorkbenchRequest(
                target_slot_id=payload["target_slot_id"],
                tool_id=payload.get("tool_id") or service.get_experiment(experiment_id).basket_tools[0].id,
            ),
        ),
        "discard_basket_tool": lambda: DiscardBasketToolService(service).run(
            experiment_id,
            DiscardBasketToolRequest(tool_id=payload.get("tool_id") or service.get_experiment(experiment_id).basket_tools[0].id),
        ),
        "record_gross_weight": lambda: RecordGrossWeightService(service).run(
            experiment_id,
            RecordGrossWeightRequest(measured_gross_mass_g=payload.get("measured_gross_mass_g")),
        ),
        "set_gross_mass_offset": lambda: SetGrossMassOffsetService(service).run(
            experiment_id,
            SetGrossMassOffsetRequest(gross_mass_offset_g=payload["gross_mass_offset_g"]),
        ),
        "create_lims_reception": lambda: CreateLimsReceptionService(service).run(
            experiment_id,
            CreateLimsReceptionRequest(
                orchard_name=payload["orchard_name"],
                harvest_date=payload["harvest_date"],
                indicative_mass_g=payload["indicative_mass_g"],
                measured_gross_mass_g=payload.get("measured_gross_mass_g"),
                measured_sample_mass_g=payload.get("measured_sample_mass_g"),
            ),
        ),
        "print_lims_label": lambda: PrintLimsLabelService(service).run(experiment_id, PrintLimsLabelRequest()),
        "discard_printed_lims_label": lambda: DiscardPrintedLimsLabelService(service).run(experiment_id, EmptyReceptionRequest()),
        "apply_printed_lims_label": lambda: ApplyPrintedLimsLabelService(service).run(
            experiment_id, ApplyPrintedLimsLabelRequest(slot_id=payload["slot_id"])
        ),
        "apply_printed_lims_label_to_basket_bag": lambda: ApplyPrintedLimsLabelToBasketBagService(service).run(
            experiment_id, EmptyReceptionRequest()
        ),
        "create_debug_produce_lot_on_workbench": lambda: CreateDebugProduceLotOnWorkbenchService(service).run(
            experiment_id,
            CreateDebugProduceLotOnWorkbenchRequest(
                preset_id=payload["preset_id"],
                target_slot_id=payload["target_slot_id"],
                total_mass_g=payload.get("total_mass_g"),
                temperature_c=payload.get("temperature_c"),
                residual_co2_mass_g=payload.get("residual_co2_mass_g"),
            ),
        ),
        "create_debug_produce_lot_to_widget": lambda: CreateDebugProduceLotToWidgetService(service).run(
            experiment_id,
            CreateDebugProduceLotToWidgetRequest(
                preset_id=payload["preset_id"],
                widget_id=payload["widget_id"],
                total_mass_g=payload.get("total_mass_g"),
                temperature_c=payload.get("temperature_c"),
                residual_co2_mass_g=payload.get("residual_co2_mass_g"),
            ),
        ),
        "move_widget_produce_lot_to_workbench_tool": lambda: move_object(
            service,
            experiment_id,
            entity_kind="produce_lot",
            entity_id=payload["produce_lot_id"],
            source_kind="grinder",
            source_id=payload["widget_id"],
            destination_kind="workbench_tool",
            destination_id=payload["target_slot_id"],
        ),
        "place_tool_in_rack_slot": lambda: PlaceToolInRackSlotService(service).run(
            experiment_id,
            PlaceToolInRackSlotRequest(
                rack_slot_id=payload["rack_slot_id"],
                tool_id=payload["tool_id"],
            ),
        ),
        "place_workbench_tool_in_rack_slot": lambda: PlaceWorkbenchToolInRackSlotService(service).run(
            experiment_id,
            PlaceWorkbenchToolInRackSlotRequest(
                source_slot_id=payload["source_slot_id"],
                rack_slot_id=payload["rack_slot_id"],
            ),
        ),
        "move_rack_tool_between_slots": lambda: MoveRackToolBetweenSlotsService(service).run(
            experiment_id,
            MoveRackToolBetweenSlotsRequest(
                source_rack_slot_id=payload["source_rack_slot_id"],
                target_rack_slot_id=payload["target_rack_slot_id"],
            ),
        ),
        "remove_rack_tool_to_workbench_slot": lambda: RemoveRackToolToWorkbenchSlotService(service).run(
            experiment_id,
            RemoveRackToolToWorkbenchSlotRequest(
                rack_slot_id=payload["rack_slot_id"],
                target_slot_id=payload["target_slot_id"],
            ),
        ),
        "discard_rack_tool": lambda: DiscardRackToolService(service).run(experiment_id, DiscardRackToolRequest(rack_slot_id=payload["rack_slot_id"])),
        "restore_trashed_tool_to_rack_slot": lambda: RestoreTrashedToolToRackSlotService(service).run(
            experiment_id,
            RestoreTrashedToolToRackSlotRequest(
                trash_tool_id=payload["trash_tool_id"],
                rack_slot_id=payload["rack_slot_id"],
            ),
        ),
        "add_liquid_to_workbench_tool": lambda: AddLiquidToWorkbenchToolService(service).run(
            experiment_id,
            AddLiquidToWorkbenchToolRequest(
                slot_id=payload["slot_id"],
                liquid_id=payload["liquid_id"],
                volume_ml=payload.get("volume_ml"),
            ),
        ),
        "add_produce_lot_to_workbench_tool": lambda: move_object(
            service,
            experiment_id,
            entity_kind="produce_lot",
            entity_id=payload["produce_lot_id"],
            source_kind="basket",
            source_id="produce_basket",
            destination_kind="workbench_tool",
            destination_id=payload["slot_id"],
        ),
        "cut_workbench_produce_lot": lambda: CutWorkbenchProduceLotService(service).run(
            experiment_id,
            WorkbenchProduceLotRequest(
                slot_id=payload["slot_id"],
                produce_lot_id=payload["produce_lot_id"],
            ),
        ),
        "move_produce_lot_between_workbench_tools": lambda: move_object(
            service,
            experiment_id,
            entity_kind="produce_lot",
            entity_id=payload["produce_lot_id"],
            source_kind="workbench",
            source_id=payload["source_slot_id"],
            destination_kind="workbench_tool",
            destination_id=payload["target_slot_id"],
        ),
        "restore_trashed_produce_lot_to_workbench_tool": lambda: move_object(
            service,
            experiment_id,
            entity_kind="produce_lot",
            entity_id=payload["trash_produce_lot_id"],
            source_kind="trash",
            source_id=payload["trash_produce_lot_id"],
            destination_kind="workbench_tool",
            destination_id=payload["target_slot_id"],
        ),
        "remove_liquid_from_workbench_tool": lambda: RemoveLiquidFromWorkbenchToolService(service).run(
            experiment_id,
            WorkbenchLiquidRequest(
                slot_id=payload["slot_id"],
                liquid_entry_id=payload["liquid_entry_id"],
            ),
        ),
        "update_workbench_liquid_volume": lambda: UpdateWorkbenchLiquidVolumeService(service).run(
            experiment_id,
            UpdateWorkbenchLiquidVolumeRequest(
                slot_id=payload["slot_id"],
                liquid_entry_id=payload["liquid_entry_id"],
                volume_ml=payload["volume_ml"],
            ),
        ),
        "apply_sample_label_to_workbench_tool": lambda: ApplySampleLabelToWorkbenchToolService(service).run(
            experiment_id, WorkbenchSlotRequest(slot_id=payload["slot_id"])
        ),
        "update_workbench_tool_sample_label_text": lambda: UpdateWorkbenchToolSampleLabelTextService(service).run(
            experiment_id,
            UpdateWorkbenchToolSampleLabelTextRequest(
                slot_id=payload["slot_id"],
                label_id=_get_first_label_id(service, experiment_id, payload["slot_id"]),
                sample_label_text=payload["sample_label_text"],
            ),
        ),
        "close_workbench_tool": lambda: CloseWorkbenchToolService(service).run(experiment_id, WorkbenchSlotRequest(slot_id=payload["slot_id"])),
        "move_sample_label_between_workbench_tools": lambda: move_object(
            service,
            experiment_id,
            entity_kind="sample_label",
            entity_id=_get_first_label_id(service, experiment_id, payload["source_slot_id"]),
            source_kind="workbench",
            source_id=payload["source_slot_id"],
            destination_kind="workbench_tool",
            destination_id=payload["target_slot_id"],
        ),
        "discard_sample_label_from_workbench_tool": lambda: DiscardSampleLabelFromWorkbenchToolService(service).run(
            experiment_id,
            WorkbenchSampleLabelRequest(
                slot_id=payload["slot_id"],
                label_id=_get_first_label_id(service, experiment_id, payload["slot_id"]),
            ),
        ),
        "restore_trashed_sample_label_to_workbench_tool": lambda: move_object(
            service,
            experiment_id,
            entity_kind="sample_label",
            entity_id=payload["trash_sample_label_id"],
            source_kind="trash",
            source_id=payload["trash_sample_label_id"],
            destination_kind="workbench_tool",
            destination_id=payload["target_slot_id"],
        ),
    }
    return handlers[command_type]()


def test_create_experiment_starts_with_received_bag_and_empty_workbench() -> None:
    service = ExperimentRuntimeService()

    experiment = service.create_experiment()

    assert experiment.status == "preparing"
    assert [slot.id for slot in experiment.workbench.slots] == [
        "station_1",
        "station_2",
    ]
    assert [slot.id for slot in experiment.rack.slots] == [
        "rack_slot_1",
        "rack_slot_2",
        "rack_slot_3",
        "rack_slot_4",
        "rack_slot_5",
        "rack_slot_6",
        "rack_slot_7",
        "rack_slot_8",
        "rack_slot_9",
        "rack_slot_10",
        "rack_slot_11",
        "rack_slot_12",
    ]
    assert all(slot.tool is None for slot in experiment.workbench.slots)
    assert all(slot.tool is None for slot in experiment.rack.slots)
    assert experiment.trash.children == []
    assert [widget.id for widget in experiment.workspace.widgets] == [
        "lims",
        "gross_balance",
        "analytical_balance",
        "workbench",
        "trash",
        "rack",
        "instrument",
        "basket",
        "centrifuge",
        "grinder",
        "vortex",
    ]
    widgets_by_id = {widget.id: widget for widget in experiment.workspace.widgets}
    assert widgets_by_id["lims"].is_present is True
    assert widgets_by_id["gross_balance"].is_present is False
    assert widgets_by_id["analytical_balance"].is_present is False
    assert widgets_by_id["workbench"].is_present is True
    assert widgets_by_id["trash"].is_present is True
    assert widgets_by_id["rack"].is_present is False
    assert widgets_by_id["instrument"].is_present is False
    assert widgets_by_id["basket"].is_present is True
    assert widgets_by_id["grinder"].is_present is False
    assert widgets_by_id["centrifuge"].is_present is False
    assert widgets_by_id["trash"].anchor == "top-left"
    assert widgets_by_id["trash"].offset_x == 1276
    assert widgets_by_id["trash"].offset_y == 24
    assert all(widget.is_trashed is False for widget in experiment.workspace.widgets)
    assert experiment.workspace.produce_basket_lots == []
    assert len(experiment.basket_tools) == 1
    assert experiment.basket_tools[0].tool_type == "sample_bag"
    assert experiment.basket_tools[0].is_sealed is True
    assert experiment.basket_tools[0].field_label_text is not None
    match = re.match(
        r"^(?P<orchard>.+) • Harvest (?P<harvest_date>\d{4}-\d{2}-\d{2}) • Approx\. (?P<mass>\d+\.\d{2}) kg$",
        experiment.basket_tools[0].field_label_text,
    )
    assert match is not None
    harvest_date = date.fromisoformat(match.group("harvest_date"))
    assert date.today() - timedelta(days=10) <= harvest_date <= date.today() - timedelta(days=1)
    assert len(experiment.basket_tools[0].produce_lots) == 1
    assert experiment.lims_reception.status == "awaiting_reception"
    assert experiment.lims_reception.lab_sample_code is None
    assert experiment.audit_log[-1] == "Receive the grower bag, weigh it, then register it in the LIMS."


def test_workbench_commands_place_tool_merge_liquid_and_edit_volume() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "centrifuge_tube_50ml",
        },
    )
    updated = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_id": "acetonitrile_extraction",
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.label == "50 mL centrifuge tube"
    assert len(slot.tool.liquids) == 1
    assert slot.tool.liquids[0].volume_ml == 10.0

    updated = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_id": "acetonitrile_extraction",
        },
    )
    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert len(slot.tool.liquids) == 1
    assert slot.tool.liquids[0].volume_ml == 20.0

    updated = apply_command(
        service,
        experiment.id,
        "update_workbench_liquid_volume",
        {
            "slot_id": "station_1",
            "liquid_entry_id": slot.tool.liquids[0].id,
            "volume_ml": 1.5,
        },
    )
    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.liquids[0].volume_ml == 1.5
    assert updated.audit_log[-1] == "Acetonitrile adjusted to 1.5 mL in 50 mL centrifuge tube."


def test_reception_flow_moves_bag_registers_lims_and_applies_ticket() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "place_received_bag_on_workbench",
        {"target_slot_id": "station_1"},
    )

    assert updated.basket_tools == []
    assert updated.workbench.slots[0].tool is not None
    assert updated.workbench.slots[0].tool.tool_type == "sample_bag"
    expected_gross_mass_g = round(
        updated.workbench.slots[0].tool.produce_lots[0].total_mass_g + SAMPLE_BAG_TARE_MASS_G,
        1,
    )

    updated = apply_command(service, experiment.id, "record_gross_weight", {})
    assert updated.lims_reception.measured_gross_mass_g == pytest.approx(expected_gross_mass_g)

    updated = apply_command(
        service,
        experiment.id,
        "create_lims_reception",
        {
            "orchard_name": "Verger Saint-Martin",
            "harvest_date": "2026-03-29",
            "indicative_mass_g": 2500.0,
            "measured_gross_mass_g": expected_gross_mass_g,
            "measured_sample_mass_g": 10.0,
        },
    )
    assert updated.lims_reception.lab_sample_code is not None
    assert updated.lims_reception.lab_sample_code.startswith("APP-2026-")
    assert updated.lims_reception.status == "awaiting_label_application"
    assert updated.lims_reception.measured_sample_mass_g == pytest.approx(10.0)

    updated = apply_command(service, experiment.id, "print_lims_label", {})
    assert updated.lims_reception.printed_label_ticket is not None
    assert updated.lims_reception.printed_label_ticket.sample_code == updated.lims_reception.lab_sample_code
    assert updated.lims_reception.printed_label_ticket.received_date

    updated = apply_command(
        service,
        experiment.id,
        "apply_printed_lims_label",
        {"slot_id": "station_1"},
    )
    assert updated.lims_reception.printed_label_ticket is None
    assert updated.lims_reception.status == "received"
    assert updated.workbench.slots[0].tool is not None
    assert updated.workbench.slots[0].tool.sample_label_text == updated.lims_reception.lab_sample_code
    assert updated.workbench.slots[0].tool.sample_label_received_date is not None


def test_create_lims_reception_allows_manual_entry_before_gross_weight() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "create_lims_reception",
        {
            "orchard_name": "Martin Orchard",
            "harvest_date": "2026-03-29",
            "indicative_mass_g": 2500.0,
        },
    )

    assert updated.lims_reception.lab_sample_code is not None
    assert updated.lims_reception.status == "awaiting_label_application"
    assert updated.lims_reception.measured_gross_mass_g is None


def test_create_lims_reception_records_precise_sample_mass() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "create_lims_reception",
        {
            "orchard_name": "Martin Orchard",
            "harvest_date": "2026-03-29",
            "indicative_mass_g": 2500.0,
            "measured_sample_mass_g": 10.0,
        },
    )

    assert updated.lims_reception.measured_gross_mass_g is None
    assert updated.lims_reception.measured_sample_mass_g == pytest.approx(10.0)


def test_printed_lims_label_can_be_applied_to_basket_bag() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "create_lims_reception",
        {
            "orchard_name": "Martin Orchard",
            "harvest_date": "2026-03-29",
            "indicative_mass_g": 2500.0,
            "measured_gross_mass_g": None,
        },
    )
    updated = apply_command(service, experiment.id, "print_lims_label", {})
    updated = apply_command(service, experiment.id, "apply_printed_lims_label_to_basket_bag", {})

    assert updated.basket_tools
    assert updated.basket_tools[0].sample_label_text == updated.lims_reception.lab_sample_code
    assert updated.basket_tools[0].sample_label_received_date is not None
    assert updated.lims_reception.printed_label_ticket is None
    assert updated.lims_reception.status == "received"


def test_record_gross_weight_uses_explicit_measured_mass() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "record_gross_weight",
        {"measured_gross_mass_g": 36.0},
    )

    assert updated.lims_reception.measured_gross_mass_g == pytest.approx(36.0)


def test_set_gross_mass_offset_updates_reception_state() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "set_gross_mass_offset",
        {"gross_mass_offset_g": -35},
    )

    assert updated.lims_reception.gross_mass_offset_g == -35
    assert updated.audit_log[-1] == "Gross balance container offset set to -35 g."


def test_print_lims_label_requires_reception_entry() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    with pytest.raises(ValueError, match=r"Create the LIMS reception entry before printing a label."):
        apply_command(service, experiment.id, "print_lims_label", {})


def test_print_lims_label_requires_current_ticket_to_be_removed_first() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "create_lims_reception",
        {
            "orchard_name": "Martin Orchard",
            "harvest_date": "2026-03-29",
            "indicative_mass_g": 2500.0,
        },
    )
    assert updated.lims_reception.lab_sample_code is not None

    updated = apply_command(service, experiment.id, "print_lims_label", {})
    assert updated.lims_reception.printed_label_ticket is not None

    with pytest.raises(
        ValueError,
        match=r"Remove the current printed ticket from the LIMS before printing another label.",
    ):
        apply_command(service, experiment.id, "print_lims_label", {})


def test_print_lims_label_can_reprint_after_ticket_leaves_lims() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_received_bag_on_workbench",
        {"target_slot_id": "station_1"},
    )
    apply_command(
        service,
        experiment.id,
        "create_lims_reception",
        {
            "orchard_name": "Martin Orchard",
            "harvest_date": "2026-03-29",
            "indicative_mass_g": 2500.0,
        },
    )
    apply_command(service, experiment.id, "print_lims_label", {})
    updated = apply_command(
        service,
        experiment.id,
        "apply_printed_lims_label",
        {"slot_id": "station_1"},
    )
    assert updated.lims_reception.printed_label_ticket is None

    updated = apply_command(service, experiment.id, "print_lims_label", {})
    assert updated.lims_reception.printed_label_ticket is not None


def test_print_lims_label_can_reprint_after_ticket_is_discarded_from_lims() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "create_lims_reception",
        {
            "orchard_name": "Martin Orchard",
            "harvest_date": "2026-03-29",
            "indicative_mass_g": 2500.0,
        },
    )
    updated = apply_command(service, experiment.id, "print_lims_label", {})
    assert updated.lims_reception.printed_label_ticket is not None


def test_discard_printed_lims_label_moves_ticket_to_trash_sample_labels() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "create_lims_reception",
        {
            "orchard_name": "Martin Orchard",
            "harvest_date": "2026-03-29",
            "indicative_mass_g": 2500.0,
        },
    )
    apply_command(service, experiment.id, "print_lims_label", {})

    updated = apply_command(service, experiment.id, "discard_printed_lims_label", {})

    assert updated.lims_reception.printed_label_ticket is None
    assert len(updated.trash.sample_labels) == 1
    assert updated.trash.sample_labels[0].origin_label == "LIMS terminal"
    assert updated.trash.sample_labels[0].sample_label_text == "APP-2026-0001"


def test_print_lims_label_can_target_a_selected_existing_entry() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    first = apply_command(
        service,
        experiment.id,
        "create_lims_reception",
        {
            "orchard_name": "Martin Orchard",
            "harvest_date": "2026-03-29",
            "indicative_mass_g": 2500.0,
        },
    )
    second = apply_command(
        service,
        experiment.id,
        "create_lims_reception",
        {
            "orchard_name": "North Orchard",
            "harvest_date": "2026-03-30",
            "indicative_mass_g": 3000.0,
        },
    )

    first_entry_id = first.lims_entries[0].id
    assert first_entry_id is not None
    assert second.lims_reception.lab_sample_code == "APP-2026-0002"

    updated = print_lims_label(service, experiment.id, first_entry_id)

    assert updated.lims_reception.lab_sample_code == "APP-2026-0001"
    assert updated.lims_reception.printed_label_ticket is not None
    assert updated.lims_reception.printed_label_ticket.sample_code == "APP-2026-0001"


def test_discard_basket_tool_moves_received_sampling_bag_to_trash() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(service, experiment.id, "discard_basket_tool", {})

    assert updated.basket_tools == []
    assert len(updated.trash.children) == 1
    assert updated.trash.discarded_from[updated.trash.children[0].id] == "Produce basket"
    assert updated.trash.children[0].tool_type == "sample_bag"
    assert updated.audit_log[-1] == "Sealed sampling bag discarded from Produce basket."


def test_create_produce_lot_recreates_a_sealed_received_sampling_bag_when_basket_is_empty() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(service, experiment.id, "discard_basket_tool", {})
    updated = apply_command(service, experiment.id, "create_produce_lot", {"produce_type": "apple"})

    assert updated.basket_tools
    assert updated.basket_tools[0].tool_type == "sample_bag"
    assert updated.basket_tools[0].is_sealed is True


def test_workbench_liquid_can_be_added_with_an_explicit_dosed_volume() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "centrifuge_tube_50ml",
        },
    )

    first_addition = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_id": "acetonitrile_extraction",
            "volume_ml": 7.5,
        },
    )
    updated = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_id": "acetonitrile_extraction",
            "volume_ml": 1.25,
        },
    )

    first_slot = next(slot for slot in first_addition.workbench.slots if slot.id == "station_1")
    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert first_slot.tool is not None
    assert slot.tool is not None
    assert first_slot.tool.liquids[0].volume_ml == 7.5
    assert slot.tool.liquids[0].volume_ml == 8.75
    assert updated.audit_log[-1] == "Acetonitrile increased to 8.75 mL in 50 mL centrifuge tube."


def test_workbench_liquid_capacity_includes_ground_powder_volume() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "centrifuge_tube_50ml",
        },
    )

    runtime_experiment = service._require_experiment(experiment.id)
    runtime_experiment.produce_material_states = [ProduceMaterialState(id="state_powder", produce_lot_id="lot_1", material_state="ground")]
    tool = runtime_experiment.workbench.slots[0].tool
    assert tool is not None
    tool.produce_fractions = [
        ProduceFraction(
            id="produce_fraction_1",
            produce_lot_id="lot_1",
            produce_material_state_id="state_powder",
            mass_g=10.0,
            location_kind="workbench_tool",
            location_id="station_1",
            container_id=tool.id,
            container_label=tool.label,
        )
    ]

    updated = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_id": "acetonitrile_extraction",
            "volume_ml": 40.0,
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.liquids[0].volume_ml == 30.0
    assert updated.audit_log[-1] == "Acetonitrile added to 50 mL centrifuge tube at 30 mL (remaining capacity)."


def test_adding_liquid_to_powder_loaded_tool_turns_ground_produce_into_slurry() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "centrifuge_tube_50ml",
        },
    )

    runtime_experiment = service._require_experiment(experiment.id)
    tool = runtime_experiment.workbench.slots[0].tool
    assert tool is not None
    tool.produce_lots = [
        ProduceLot(
            id="lot_1",
            label="Apple powder 1",
            produce_type="apple",
            total_mass_g=10.0,
        )
    ]
    runtime_experiment.produce_material_states = [
        ProduceMaterialState(
            id="state_powder_loaded",
            produce_lot_id="lot_1",
            material_state="ground",
            grind_quality_label="powder_fine",
        )
    ]

    updated = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_id": "acetonitrile_extraction",
            "volume_ml": 15.0,
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert _material_state_name(updated, slot.tool.produce_lots[0].id) == "slurry"
    assert slot.tool.liquids[0].volume_ml == 15.0
    slurry_state_ids = {state.id for state in updated.produce_material_states if state.produce_lot_id == "lot_1" and state.material_state == "slurry"}
    assert slurry_state_ids
    assert {fraction.produce_material_state_id for fraction in slot.tool.produce_fractions} == slurry_state_ids


def test_adding_liquid_to_canonical_only_powder_turns_fraction_state_into_slurry() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "centrifuge_tube_50ml",
        },
    )

    runtime_experiment = service._require_experiment(experiment.id)
    runtime_experiment.produce_material_states = [ProduceMaterialState(id="state_powder", produce_lot_id="lot_1", material_state="ground")]
    tool = runtime_experiment.workbench.slots[0].tool
    assert tool is not None
    tool.produce_lots = []
    tool.produce_fractions = [
        ProduceFraction(
            id="produce_fraction_1",
            produce_lot_id="lot_1",
            produce_material_state_id="state_powder",
            mass_g=3.0,
            location_kind="workbench_tool",
            location_id="station_1",
            container_id=tool.id,
            container_label=tool.label,
        )
    ]

    updated = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_id": "acetonitrile_extraction",
            "volume_ml": 12.0,
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.liquids[0].volume_ml == 12.0
    assert slot.tool.produce_fractions[0].produce_material_state_id == "state_powder"
    assert any(state.id == "state_powder" and state.material_state == "slurry" for state in updated.produce_material_states)


def test_adding_liquid_to_tube_does_not_turn_source_jar_fraction_into_slurry(monkeypatch) -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="hdpe_storage_jar_2l"),
    )
    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(slot_id="station_2", tool_id="centrifuge_tube_50ml"),
    )

    runtime_experiment = service._require_experiment(experiment.id)
    runtime_experiment.produce_material_states = [
        ProduceMaterialState(
            id="state_powder",
            produce_lot_id="lot_1",
            material_state="ground",
            grind_quality_label="powder_fine",
        )
    ]
    source_tool = runtime_experiment.workbench.slots[0].tool
    target_tool = runtime_experiment.workbench.slots[1].tool
    assert source_tool is not None
    assert target_tool is not None
    source_tool.produce_lots = []
    source_tool.produce_fractions = [
        ProduceFraction(
            id="jar_fraction",
            produce_lot_id="lot_1",
            produce_material_state_id="state_powder",
            mass_g=10.0,
            location_kind="workbench_tool",
            location_id="station_1",
            container_id=source_tool.id,
            container_label=source_tool.label,
        )
    ]

    monkeypatch.setattr("app.services.domain_services.workbench.random.gauss", lambda mu, sigma: 1.0)
    LoadSpatulaFromWorkbenchToolService(service).run(experiment.id, WorkbenchSlotRequest(slot_id="station_1"))
    PourSpatulaIntoWorkbenchToolService(service).run(
        experiment.id,
        PourSpatulaIntoWorkbenchToolRequest(slot_id="station_2", delta_mass_g=2.5),
    )

    updated = AddLiquidToWorkbenchToolService(service).run(
        experiment.id,
        AddLiquidToWorkbenchToolRequest(
            slot_id="station_2",
            liquid_id="acetonitrile_extraction",
            volume_ml=10.0,
        ),
    )

    source_tool = updated.workbench.slots[0].tool
    target_tool = updated.workbench.slots[1].tool
    assert source_tool is not None
    assert target_tool is not None
    assert source_tool.produce_fractions
    assert target_tool.produce_fractions
    assert source_tool.produce_fractions[0].produce_material_state_id == "state_powder"
    assert target_tool.produce_fractions[0].produce_material_state_id != "state_powder"

    states_by_id = {state.id: state for state in updated.produce_material_states}
    assert states_by_id["state_powder"].material_state == "ground"
    assert states_by_id[target_tool.produce_fractions[0].produce_material_state_id].material_state == "slurry"


def test_debug_powder_source_jar_keeps_fraction_state_after_liquid_and_physics_tick(monkeypatch) -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="hdpe_storage_jar_2l"),
    )
    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(slot_id="station_2", tool_id="centrifuge_tube_50ml"),
    )
    OpenWorkbenchToolService(service).run(experiment.id, WorkbenchSlotRequest(slot_id="station_1"))
    CreateDebugProduceLotOnWorkbenchService(service).run(
        experiment.id,
        CreateDebugProduceLotOnWorkbenchRequest(
            preset_id="apple_powder_residual_co2",
            target_slot_id="station_1",
            total_mass_g=100.0,
        ),
    )

    monkeypatch.setattr("app.services.domain_services.workbench.random.gauss", lambda mu, sigma: 1.0)
    LoadSpatulaFromWorkbenchToolService(service).run(experiment.id, WorkbenchSlotRequest(slot_id="station_1"))
    PourSpatulaIntoWorkbenchToolService(service).run(
        experiment.id,
        PourSpatulaIntoWorkbenchToolRequest(slot_id="station_2", delta_mass_g=0.1),
    )
    AddLiquidToWorkbenchToolService(service).run(
        experiment.id,
        AddLiquidToWorkbenchToolRequest(
            slot_id="station_2",
            liquid_id="acetonitrile_extraction",
            volume_ml=10.0,
        ),
    )

    runtime_experiment = service._require_experiment(experiment.id)
    runtime_experiment.last_simulation_at = runtime_experiment.last_simulation_at - timedelta(seconds=1)
    updated = service.get_experiment(experiment.id)

    source_tool = updated.workbench.slots[0].tool
    target_tool = updated.workbench.slots[1].tool
    assert source_tool is not None
    assert target_tool is not None
    assert source_tool.produce_fractions
    assert target_tool.produce_fractions

    states_by_id = {state.id: state for state in updated.produce_material_states}
    assert states_by_id[source_tool.produce_fractions[0].produce_material_state_id].material_state == "ground"
    assert states_by_id[target_tool.produce_fractions[0].produce_material_state_id].material_state == "slurry"


def test_place_sealed_sampling_bag_on_workbench() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sealed_sampling_bag",
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.label == "Sealed sampling bag"
    assert slot.tool.tool_type == "sample_bag"
    assert slot.tool.sample_label_text is None
    assert slot.tool.produce_lots == []


def test_workbench_liquid_is_removed_when_volume_is_updated_to_zero() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "centrifuge_tube_50ml",
        },
    )
    added = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_id": "acetonitrile_extraction",
        },
    )

    assert added.workbench.slots[0].tool is not None
    liquid_id = added.workbench.slots[0].tool.liquids[0].id
    updated = apply_command(
        service,
        experiment.id,
        "update_workbench_liquid_volume",
        {
            "slot_id": "station_1",
            "liquid_entry_id": liquid_id,
            "volume_ml": 0,
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.liquids == []
    assert updated.audit_log[-1] == "Acetonitrile removed from 50 mL centrifuge tube."


def test_place_cutting_board_on_workbench() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "cutting_board_hdpe",
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.label == "Cutting board"
    assert slot.tool.tool_type == "cutting_board"


def test_grinder_accepts_workspace_produce_lot_and_dry_ice_pellets() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )

    moved = apply_command(
        service,
        experiment.id,
        "add_workspace_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "produce_lot_id": created.basket_tools[-1].produce_lots[0].id,
        },
    )
    updated = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
        },
    )

    grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")
    assert moved.workspace.produce_basket_lots == []
    assert len(grinder.produce_lots) == 1
    assert grinder.produce_lots[0].produce_type == "apple"
    assert len(grinder.liquids) == 1
    assert grinder.liquids[0].liquid_id == "dry_ice_pellets"
    assert grinder.liquids[0].volume_ml == 1000.0
    assert updated.audit_log[-1] == "Dry ice pellets added to Cryogenic grinder."


def test_grinder_dry_ice_mass_can_be_edited() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    added = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
        },
    )

    liquid_id = next(widget for widget in added.workspace.widgets if widget.id == "grinder").liquids[0].id
    updated = apply_command(
        service,
        experiment.id,
        "update_workspace_widget_liquid_volume",
        {
            "widget_id": "grinder",
            "liquid_entry_id": liquid_id,
            "volume_ml": 12.3456,
        },
    )

    grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")
    assert grinder.liquids[0].volume_ml == 12.346
    assert updated.audit_log[-1] == "Dry ice pellets adjusted to 12.346 g in Cryogenic grinder."


def test_grinder_dry_ice_is_removed_when_volume_is_updated_to_zero() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    added = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
        },
    )

    liquid_id = next(widget for widget in added.workspace.widgets if widget.id == "grinder").liquids[0].id
    updated = apply_command(
        service,
        experiment.id,
        "update_workspace_widget_liquid_volume",
        {
            "widget_id": "grinder",
            "liquid_entry_id": liquid_id,
            "volume_ml": 0,
        },
    )

    grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")
    assert grinder.liquids == []
    assert updated.audit_log[-1] == "Dry ice pellets removed from Cryogenic grinder."


def test_grinder_dry_ice_can_be_removed() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    added = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
        },
    )

    liquid_id = next(widget for widget in added.workspace.widgets if widget.id == "grinder").liquids[0].id
    updated = apply_command(
        service,
        experiment.id,
        "remove_liquid_from_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_entry_id": liquid_id,
        },
    )

    grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")
    assert grinder.liquids == []
    assert updated.audit_log[-1] == "Dry ice pellets removed from Cryogenic grinder."


def test_grinder_dry_ice_disappears_after_sublimation_reaches_zero() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
            "volume_ml": 0.01,
        },
    )

    experiment_state = service._experiments[experiment.id]
    experiment_state.last_simulation_at -= timedelta(seconds=1)

    updated = service.get_experiment(experiment.id)
    grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")
    assert grinder.liquids == []


def test_complete_grinder_cycle_transforms_loaded_lot_into_ground_result() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "cutting_board_hdpe",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "cut_workbench_produce_lot",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "move_workbench_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "source_slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
            "volume_ml": 1000,
        },
    )
    updated = apply_command(
        service,
        experiment.id,
        "complete_grinder_cycle",
        {
            "widget_id": "grinder",
        },
    )

    grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")
    assert _material_state_name(updated, grinder.produce_lots[0].id) == "ground"
    assert _lot_homogeneity_score(updated, grinder.produce_lots[0].id) is None
    assert _lot_grind_quality_label(updated, grinder.produce_lots[0].id) is None
    assert updated.produce_material_states
    matching_state = next(state for state in updated.produce_material_states if state.produce_lot_id == produce_lot_id)
    assert matching_state.material_state == "ground"
    assert updated.audit_log[-1] == "Apple lot 1 ground in Cryogenic grinder."


def test_start_grinder_cycle_marks_the_grinder_as_running() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "cutting_board_hdpe",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "cut_workbench_produce_lot",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "move_workbench_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "source_slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    cooled = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
        },
    )
    grinder_before = next(widget for widget in cooled.workspace.widgets if widget.id == "grinder")
    apply_command(
        service,
        experiment.id,
        "update_workspace_widget_liquid_volume",
        {
            "widget_id": "grinder",
            "liquid_entry_id": grinder_before.liquids[0].id,
            "volume_ml": 400,
        },
    )
    grinder_lot = service._experiments[experiment.id].workspace.widgets[-2].produce_lots[0]
    _lot_state(service._experiments[experiment.id], grinder_lot.id).temperature_c = -75.0

    started = apply_command(
        service,
        experiment.id,
        "start_grinder_cycle",
        {
            "widget_id": "grinder",
        },
    )

    grinder = next(widget for widget in started.workspace.widgets if widget.id == "grinder")
    assert grinder.grinder_run_duration_ms == 30000.0
    assert grinder.grinder_run_remaining_ms == 30000.0
    assert started.audit_log[-1] == "Apple lot 1 grinding started in Cryogenic grinder."


def test_start_grinder_cycle_rejects_produce_above_minus_twenty_c() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "cutting_board_hdpe",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "cut_workbench_produce_lot",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "move_workbench_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "source_slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    grinder_lot = service._experiments[experiment.id].workspace.widgets[-2].produce_lots[0]
    _lot_state(service._experiments[experiment.id], grinder_lot.id).temperature_c = -15.0

    with pytest.raises(ValueError, match=r"not cold enough"):
        apply_command(
            service,
            experiment.id,
            "start_grinder_cycle",
            {
                "widget_id": "grinder",
            },
        )


def test_active_grinder_cycle_warms_the_sample_and_consumes_dry_ice_until_completion() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "cutting_board_hdpe",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "cut_workbench_produce_lot",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "move_workbench_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "source_slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
            "volume_ml": 400,
        },
    )
    grinder_lot = service._experiments[experiment.id].workspace.widgets[-2].produce_lots[0]
    _lot_state(service._experiments[experiment.id], grinder_lot.id).temperature_c = -75.0

    apply_command(
        service,
        experiment.id,
        "start_grinder_cycle",
        {
            "widget_id": "grinder",
        },
    )
    service._experiments[experiment.id].last_simulation_at -= timedelta(seconds=15)
    mid_cycle = service.get_experiment(experiment.id)

    mid_grinder = next(widget for widget in mid_cycle.workspace.widgets if widget.id == "grinder")
    assert _lot_temperature_c(mid_cycle, mid_grinder.produce_lots[0].id) > -75.0
    assert _lot_temperature_c(mid_cycle, mid_grinder.produce_lots[0].id) < -69.0
    assert mid_grinder.liquids[0].volume_ml < 391.0
    assert 14990.0 < mid_grinder.grinder_run_remaining_ms <= 15000.0

    service._experiments[experiment.id].last_simulation_at -= timedelta(seconds=15)
    finished = service.get_experiment(experiment.id)

    finished_grinder = next(widget for widget in finished.workspace.widgets if widget.id == "grinder")
    assert _material_state_name(finished, finished_grinder.produce_lots[0].id) == "ground"
    assert _lot_residual_co2_mass_g(finished, finished_grinder.produce_lots[0].id) > 0
    assert -66.0 < _lot_temperature_c(finished, finished_grinder.produce_lots[0].id) < -64.0
    assert _lot_grind_quality_label(finished, finished_grinder.produce_lots[0].id) == "powder_fine"
    assert _lot_homogeneity_score(finished, finished_grinder.produce_lots[0].id) is not None
    assert _lot_homogeneity_score(finished, finished_grinder.produce_lots[0].id) > 0.9
    assert finished_grinder.liquids == []
    assert finished_grinder.grinder_run_duration_ms == 0.0
    assert finished_grinder.grinder_run_remaining_ms == 0.0
    assert finished.audit_log[-1] == "Apple lot 1 ground in Cryogenic grinder."


def test_active_grinder_cycle_scores_warmer_runs_as_coarser_results() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "cutting_board_hdpe",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "cut_workbench_produce_lot",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "move_workbench_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "source_slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
            "volume_ml": 400,
        },
    )
    grinder_lot = service._experiments[experiment.id].workspace.widgets[-2].produce_lots[0]
    _lot_state(service._experiments[experiment.id], grinder_lot.id).temperature_c = -30.0

    apply_command(
        service,
        experiment.id,
        "start_grinder_cycle",
        {
            "widget_id": "grinder",
        },
    )
    service._experiments[experiment.id].last_simulation_at -= timedelta(seconds=30)
    finished = service.get_experiment(experiment.id)

    grinder = next(widget for widget in finished.workspace.widgets if widget.id == "grinder")
    produce_lot = grinder.produce_lots[0]
    assert _material_state_name(finished, produce_lot.id) == "ground"
    assert _lot_grind_quality_label(finished, produce_lot.id) == "coarse"
    assert _lot_homogeneity_score(finished, produce_lot.id) is not None
    assert 0.25 < _lot_homogeneity_score(finished, produce_lot.id) < 0.4


def test_active_grinder_cycle_jams_if_the_sample_warms_above_minus_ten_c() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "cutting_board_hdpe",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "cut_workbench_produce_lot",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "move_workbench_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "source_slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
            "volume_ml": 10,
        },
    )
    grinder_lot = service._experiments[experiment.id].workspace.widgets[-2].produce_lots[0]
    _lot_state(service._experiments[experiment.id], grinder_lot.id).temperature_c = -20.0

    apply_command(
        service,
        experiment.id,
        "start_grinder_cycle",
        {
            "widget_id": "grinder",
        },
    )
    service._experiments[experiment.id].last_simulation_at -= timedelta(seconds=30)
    jammed = service.get_experiment(experiment.id)

    grinder = next(widget for widget in jammed.workspace.widgets if widget.id == "grinder")
    assert grinder.grinder_fault == "motor_jammed"
    assert grinder.grinder_run_duration_ms == 0.0
    assert grinder.grinder_run_remaining_ms == 0.0
    assert _material_state_name(jammed, grinder.produce_lots[0].id) == "waste"
    assert _lot_homogeneity_score(jammed, grinder.produce_lots[0].id) == 0.0
    assert _lot_grind_quality_label(jammed, grinder.produce_lots[0].id) == "waste"
    matching_state = next(state for state in jammed.produce_material_states if state.produce_lot_id == grinder.produce_lots[0].id)
    assert matching_state.material_state == "waste"
    assert matching_state.grind_quality_label == "waste"
    assert grinder.liquids == []
    assert _lot_temperature_c(jammed, grinder.produce_lots[0].id) >= -10.0
    assert jammed.trash.produce_lots == []
    assert jammed.audit_log[-1] == "Apple lot 1 jammed Cryogenic grinder motor and became waste."


def test_jammed_grinder_waste_can_be_moved_to_a_workbench_tool() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "cutting_board_hdpe",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "cut_workbench_produce_lot",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "move_workbench_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "source_slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
            "volume_ml": 10,
        },
    )
    grinder_lot = service._experiments[experiment.id].workspace.widgets[-2].produce_lots[0]
    _lot_state(service._experiments[experiment.id], grinder_lot.id).temperature_c = -20.0

    apply_command(
        service,
        experiment.id,
        "start_grinder_cycle",
        {
            "widget_id": "grinder",
        },
    )
    service._experiments[experiment.id].last_simulation_at -= timedelta(seconds=30)
    service.get_experiment(experiment.id)

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_2",
            "tool_id": "sealed_sampling_bag",
        },
    )

    moved = apply_command(
        service,
        experiment.id,
        "move_widget_produce_lot_to_workbench_tool",
        {
            "widget_id": "grinder",
            "produce_lot_id": produce_lot_id,
            "target_slot_id": "station_2",
        },
    )
    station_2 = next(slot for slot in moved.workbench.slots if slot.id == "station_2")
    assert station_2.tool is not None
    assert _material_state_name(moved, station_2.tool.produce_lots[0].id) == "waste"


def test_grinder_dry_ice_can_be_added_with_an_explicit_dosed_mass() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )

    first_addition = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
            "volume_ml": 250.0,
        },
    )
    updated = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
            "volume_ml": 125.5,
        },
    )

    first_grinder = next(widget for widget in first_addition.workspace.widgets if widget.id == "grinder")
    grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")
    assert first_grinder.liquids[0].volume_ml == 250.0
    assert grinder.liquids[0].volume_ml == 375.5
    assert updated.audit_log[-1] == "Dry ice pellets increased in Cryogenic grinder."


def test_workspace_cryogenics_cools_produce_and_consumes_dry_ice() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_workspace_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "produce_lot_id": created.basket_tools[-1].produce_lots[0].id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "advance_workspace_cryogenics",
        {
            "elapsed_ms": 1000,
        },
    )

    grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")
    assert 13.0 < _lot_temperature_c(updated, grinder.produce_lots[0].id) < 14.0
    assert 897.0 < grinder.liquids[0].volume_ml < 898.0
    assert updated.audit_log[-1] == "Dry ice pellets added to Cryogenic grinder."


def test_workspace_cryogenics_warms_produce_back_up_when_dry_ice_is_gone() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_workspace_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "produce_lot_id": created.basket_tools[-1].produce_lots[0].id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
        },
    )
    cooled = apply_command(
        service,
        experiment.id,
        "advance_workspace_cryogenics",
        {
            "elapsed_ms": 60000,
        },
    )

    grinder = next(widget for widget in cooled.workspace.widgets if widget.id == "grinder")
    cooled_temperature = _lot_temperature_c(cooled, grinder.produce_lots[0].id)
    rewarmed = apply_command(
        service,
        experiment.id,
        "advance_workspace_cryogenics",
        {
            "elapsed_ms": 60000,
        },
    )

    grinder = next(widget for widget in rewarmed.workspace.widgets if widget.id == "grinder")
    assert _lot_temperature_c(rewarmed, grinder.produce_lots[0].id) > cooled_temperature
    assert _lot_temperature_c(rewarmed, grinder.produce_lots[0].id) <= 20.0


def test_workspace_cryogenics_warms_cold_produce_after_it_leaves_grinder() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_workspace_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "produce_lot_id": created.basket_tools[-1].produce_lots[0].id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
        },
    )
    cooled = apply_command(
        service,
        experiment.id,
        "advance_workspace_cryogenics",
        {
            "elapsed_ms": 60000,
        },
    )

    grinder = next(widget for widget in cooled.workspace.widgets if widget.id == "grinder")
    cooled_temperature = _lot_temperature_c(cooled, grinder.produce_lots[0].id)
    assert cooled_temperature < 20.0

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sealed_sampling_bag",
        },
    )
    moved = apply_command(
        service,
        experiment.id,
        "move_widget_produce_lot_to_workbench_tool",
        {
            "widget_id": "grinder",
            "produce_lot_id": grinder.produce_lots[0].id,
            "target_slot_id": "station_1",
        },
    )
    advanced = apply_command(
        service,
        experiment.id,
        "advance_workspace_cryogenics",
        {
            "elapsed_ms": 60000,
        },
    )

    moved_slot = next(slot for slot in moved.workbench.slots if slot.id == "station_1")
    advanced_slot = next(slot for slot in advanced.workbench.slots if slot.id == "station_1")
    assert moved_slot.tool is not None
    assert advanced_slot.tool is not None
    assert _lot_temperature_c(moved, moved_slot.tool.produce_lots[0].id) == pytest.approx(cooled_temperature, abs=0.01)
    assert _lot_temperature_c(advanced, advanced_slot.tool.produce_lots[0].id) > _lot_temperature_c(
        moved,
        moved_slot.tool.produce_lots[0].id,
    )
    assert _lot_temperature_c(advanced, advanced_slot.tool.produce_lots[0].id) <= 20.0


def test_one_kilo_of_dry_ice_does_not_drive_apple_lot_to_dry_ice_temperature() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "grinder",
            "anchor": "top-right",
            "offset_x": 0,
            "offset_y": 420,
        },
    )
    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_workspace_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "produce_lot_id": created.basket_tools[-1].produce_lots[0].id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_liquid_to_workspace_widget",
        {
            "widget_id": "grinder",
            "liquid_id": "dry_ice_pellets",
        },
    )

    updated = None
    exhausted_temperature = None
    for _ in range(3600):
        updated = apply_command(
            service,
            experiment.id,
            "advance_workspace_cryogenics",
            {
                "elapsed_ms": 1000,
            },
        )
        grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")
        if grinder.liquids == []:
            exhausted_temperature = _lot_temperature_c(updated, grinder.produce_lots[0].id)
            break

    assert exhausted_temperature is not None
    assert exhausted_temperature > -5.0
    assert exhausted_temperature < 0.0


def test_sampling_bag_label_can_be_applied_and_edited() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sealed_sampling_bag",
        },
    )

    labeled = apply_command(
        service,
        experiment.id,
        "apply_sample_label_to_workbench_tool",
        {
            "slot_id": "station_1",
        },
    )
    updated = apply_command(
        service,
        experiment.id,
        "update_workbench_tool_sample_label_text",
        {
            "slot_id": "station_1",
            "sample_label_text": "LOT-2026-041",
        },
    )

    labeled_slot = next(slot for slot in labeled.workbench.slots if slot.id == "station_1")
    updated_slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert labeled_slot.tool is not None
    assert labeled_slot.tool.sample_label_text == ""
    assert updated_slot.tool is not None
    assert updated_slot.tool.sample_label_text == "LOT-2026-041"
    assert updated.audit_log[-1] == "Sample label updated to LOT-2026-041 on Sealed sampling bag."


def test_sampling_bag_label_can_be_discarded_to_trash_and_restored() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {"slot_id": "station_1", "tool_id": "sealed_sampling_bag"},
    )
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {"slot_id": "station_2", "tool_id": "sealed_sampling_bag"},
    )
    apply_command(
        service,
        experiment.id,
        "apply_sample_label_to_workbench_tool",
        {"slot_id": "station_1"},
    )
    apply_command(
        service,
        experiment.id,
        "update_workbench_tool_sample_label_text",
        {"slot_id": "station_1", "sample_label_text": "LOT-2026-041"},
    )

    discarded = apply_command(
        service,
        experiment.id,
        "discard_sample_label_from_workbench_tool",
        {"slot_id": "station_1"},
    )
    restored = apply_command(
        service,
        experiment.id,
        "restore_trashed_sample_label_to_workbench_tool",
        {
            "target_slot_id": "station_2",
            "trash_sample_label_id": discarded.trash.sample_labels[0].id,
        },
    )

    discarded_slot = next(slot for slot in discarded.workbench.slots if slot.id == "station_1")
    restored_slot = next(slot for slot in restored.workbench.slots if slot.id == "station_2")
    assert discarded_slot.tool is not None
    assert discarded_slot.tool.sample_label_text is None
    assert len(discarded.trash.sample_labels) == 1
    assert discarded.trash.sample_labels[0].sample_label_text == "LOT-2026-041"
    assert restored_slot.tool is not None
    assert restored_slot.tool.sample_label_text == "LOT-2026-041"
    assert restored.trash.sample_labels == []


def test_sampling_bag_label_can_be_discarded_from_palette() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "discard_sample_label_from_palette",
        {"sample_label_id": "sampling_bag_label"},
    )

    assert len(updated.trash.sample_labels) == 1
    assert updated.trash.sample_labels[0].origin_label == "Palette"
    assert updated.trash.sample_labels[0].sample_label_text == ""


def test_sampling_bag_label_can_move_between_sampling_bags() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {"slot_id": "station_1", "tool_id": "sealed_sampling_bag"},
    )
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {"slot_id": "station_2", "tool_id": "sealed_sampling_bag"},
    )
    apply_command(
        service,
        experiment.id,
        "apply_sample_label_to_workbench_tool",
        {"slot_id": "station_1"},
    )
    apply_command(
        service,
        experiment.id,
        "update_workbench_tool_sample_label_text",
        {"slot_id": "station_1", "sample_label_text": "LOT-2026-041"},
    )

    moved = apply_command(
        service,
        experiment.id,
        "move_sample_label_between_workbench_tools",
        {"source_slot_id": "station_1", "target_slot_id": "station_2"},
    )

    source_slot = next(slot for slot in moved.workbench.slots if slot.id == "station_1")
    target_slot = next(slot for slot in moved.workbench.slots if slot.id == "station_2")
    assert source_slot.tool is not None
    assert source_slot.tool.sample_label_text is None
    assert target_slot.tool is not None
    assert target_slot.tool.sample_label_text == "LOT-2026-041"


def test_add_produce_lot_to_sampling_bag_moves_it_out_of_basket() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sealed_sampling_bag",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": created.basket_tools[-1].produce_lots[0].id,
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert len(slot.tool.produce_lots) == 1
    assert slot.tool.produce_lots[0].label == "Apple lot 1"
    assert slot.tool.produce_lots[0].unit_count == 12
    assert slot.tool.produce_lots[0].total_mass_g == 2450.0
    assert updated.workspace.produce_basket_lots == []
    assert updated.audit_log[-1] == "Apple lot 1 added to Sealed sampling bag."


def test_add_produce_lot_to_cutting_board_moves_it_out_of_basket() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "cutting_board_hdpe",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": created.basket_tools[-1].produce_lots[0].id,
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert len(slot.tool.produce_lots) == 1
    assert slot.tool.produce_lots[0].label == "Apple lot 1"
    assert _fraction_is_contaminated(slot.tool.produce_fractions, slot.tool.produce_lots[0].id) is False
    assert updated.workspace.produce_basket_lots == []
    assert updated.audit_log[-1] == "Apple lot 1 added to Cutting board."


def test_add_produce_lot_directly_to_empty_station_marks_it_contaminated() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": created.basket_tools[-1].produce_lots[0].id,
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is None
    assert len(slot.surface_produce_lots) == 1
    assert slot.surface_produce_lots[0].label == "Apple lot 1"
    assert _fraction_is_contaminated(slot.surface_produce_fractions, slot.surface_produce_lots[0].id) is True
    assert updated.workspace.produce_basket_lots == []
    assert updated.audit_log[-1] == "Apple lot 1 placed directly on Station 1 and marked contaminated."


def test_add_produce_lot_requires_a_sampling_bag() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "centrifuge_tube_50ml",
        },
    )

    with pytest.raises(ValueError, match=r"50 mL centrifuge tube does not accept produce."):
        apply_command(
            service,
            experiment.id,
            "add_produce_lot_to_workbench_tool",
            {
                "slot_id": "station_1",
                "produce_lot_id": created.basket_tools[-1].produce_lots[0].id,
            },
        )


def test_sampling_bag_accepts_only_one_produce_lot() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    first_lot = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    second_lot = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sealed_sampling_bag",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": first_lot.basket_tools[-1].produce_lots[0].id,
        },
    )

    with pytest.raises(ValueError, match=r"Sealed sampling bag already contains a produce lot."):
        apply_command(
            service,
            experiment.id,
            "add_produce_lot_to_workbench_tool",
            {
                "slot_id": "station_1",
                "produce_lot_id": second_lot.basket_tools[-1].produce_lots[0].id,
            },
        )


def test_discard_produce_lot_from_sampling_bag() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sealed_sampling_bag",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": created.basket_tools[-1].produce_lots[0].id,
        },
    )

    updated = move_object(
        service,
        experiment.id,
        entity_kind="produce_lot",
        entity_id=created.basket_tools[-1].produce_lots[0].id,
        source_kind="workbench",
        source_id="station_1",
        destination_kind="trash_bin",
        destination_id="trash",
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.produce_lots == []
    assert updated.workspace.produce_basket_lots == []
    assert len(updated.trash.produce_lots) == 1
    assert updated.trash.produce_lots[0].origin_label == "Sealed sampling bag"
    assert updated.trash.produce_lots[0].produce_lot.label == "Apple lot 1"
    assert updated.audit_log[-1] == "Apple lot 1 discarded from Sealed sampling bag."


def test_discard_produce_lot_from_basket_moves_it_to_trash() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )

    updated = move_object(
        service,
        experiment.id,
        entity_kind="produce_lot",
        entity_id=created.basket_tools[-1].produce_lots[0].id,
        source_kind="basket",
        source_id="produce_basket",
        destination_kind="trash_bin",
        destination_id="trash",
    )

    assert updated.workspace.produce_basket_lots == []
    assert len(updated.trash.produce_lots) == 1
    assert updated.trash.produce_lots[0].origin_label == "Produce basket"
    assert updated.audit_log[-1] == "Apple lot 1 discarded from Produce basket."
    runtime_experiment = service._require_experiment(experiment.id)
    assert runtime_experiment.trash.produce_lots[0].produce_fraction is not None
    assert runtime_experiment.trash.produce_lots[0].produce_fraction.location_kind == "trash"
    assert runtime_experiment.trash.produce_lots[0].produce_fraction.produce_lot_id == created.basket_tools[-1].produce_lots[0].id


def test_discard_workbench_surface_produce_lot_preserves_structured_origin() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    placed_on_surface = apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": created.basket_tools[-1].produce_lots[0].id,
        },
    )
    discarded = move_object(
        service,
        experiment.id,
        entity_kind="produce_lot",
        entity_id=placed_on_surface.workbench.slots[0].surface_produce_lots[0].id,
        source_kind="workbench",
        source_id="station_1",
        destination_kind="trash_bin",
        destination_id="trash",
    )

    trashed_entry = discarded.trash.produce_lots[0]
    assert trashed_entry.origin_label == "Station 1"
    assert trashed_entry.origin is not None
    assert trashed_entry.origin.kind == "workbench_surface"
    assert trashed_entry.origin.location_id == "station_1"
    assert trashed_entry.origin.location_label == "Station 1"
    assert trashed_entry.origin.container_id is None
    assert trashed_entry.produce_fraction is not None
    assert trashed_entry.produce_fraction.location_kind == "trash"


def test_move_grinder_produce_lot_to_workbench_tool() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "add_workspace_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "produce_lot_id": produce_lot_id,
        },
    )
    grinder_lot = service._experiments[experiment.id].workspace.widgets[-2].produce_lots[0]
    _lot_state(service._experiments[experiment.id], grinder_lot.id).residual_co2_mass_g = 18.0
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sealed_sampling_bag",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "move_widget_produce_lot_to_workbench_tool",
        {
            "widget_id": "grinder",
            "target_slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )

    grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")
    station_1 = next(slot for slot in updated.workbench.slots if slot.id == "station_1")

    assert grinder.produce_lots == []
    assert station_1.tool is not None
    assert [lot.id for lot in station_1.tool.produce_lots] == [produce_lot_id]
    assert _lot_residual_co2_mass_g(updated, station_1.tool.produce_lots[0].id) == pytest.approx(18.0, abs=0.03)
    assert updated.audit_log[-1] == "Apple lot 1 moved from Cryogenic grinder to Sealed sampling bag."


def test_move_grinder_ground_produce_lot_to_open_storage_jar() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "add_workspace_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "produce_lot_id": produce_lot_id,
        },
    )
    experiment_state = service._experiments[experiment.id]
    set_material_state_name(
        experiment_state.produce_material_states,
        experiment_state.workspace.widgets[-2].produce_lots[0].id,
        "ground",
    )
    grinder_lot = experiment_state.workspace.widgets[-2].produce_lots[0]
    _lot_state(experiment_state, grinder_lot.id).residual_co2_mass_g = 18.0
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "hdpe_storage_jar_2l",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "move_widget_produce_lot_to_workbench_tool",
        {
            "widget_id": "grinder",
            "target_slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )

    grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")
    station_1 = next(slot for slot in updated.workbench.slots if slot.id == "station_1")

    assert grinder.produce_lots == []
    assert station_1.tool is not None
    assert station_1.tool.tool_id == "hdpe_storage_jar_2l"
    assert [lot.id for lot in station_1.tool.produce_lots] == [produce_lot_id]
    assert _material_state_name(updated, station_1.tool.produce_lots[0].id) == "ground"
    assert _lot_residual_co2_mass_g(updated, station_1.tool.produce_lots[0].id) == pytest.approx(18.0, abs=0.03)
    assert updated.audit_log[-1] == "Apple lot 1 moved from Cryogenic grinder to Wide-neck HDPE jar."


def test_ground_lot_continues_degassing_after_transfer_out_of_grinder() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "add_workspace_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "produce_lot_id": produce_lot_id,
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sealed_sampling_bag",
        },
    )

    experiment_state = service._experiments[experiment.id]
    grinder = experiment_state.workspace.widgets[-2]
    set_material_state_name(experiment_state.produce_material_states, grinder.produce_lots[0].id, "ground")
    _lot_state(experiment_state, grinder.produce_lots[0].id).residual_co2_mass_g = 2.0

    apply_command(
        service,
        experiment.id,
        "move_widget_produce_lot_to_workbench_tool",
        {
            "widget_id": "grinder",
            "target_slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )

    experiment_state.last_simulation_at -= timedelta(seconds=30)
    updated = service.get_experiment(experiment.id)
    station_1 = next(slot for slot in updated.workbench.slots if slot.id == "station_1")

    assert station_1.tool is not None
    assert _lot_residual_co2_mass_g(updated, station_1.tool.produce_lots[0].id) < 2.0


def test_close_storage_jar_with_residual_co2_seals_it_and_traps_pressure_state() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "hdpe_storage_jar_2l",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )

    stored_tool = service._experiments[experiment.id].workbench.slots[0].tool
    assert stored_tool is not None
    stored_lot = stored_tool.produce_lots[0]
    set_material_state_name(service._experiments[experiment.id].produce_material_states, stored_lot.id, "ground")
    _lot_state(service._experiments[experiment.id], stored_lot.id).residual_co2_mass_g = 18.0
    stored_lot.total_mass_g = 1000.0

    updated = apply_command(
        service,
        experiment.id,
        "close_workbench_tool",
        {
            "slot_id": "station_1",
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.is_sealed is True
    assert slot.tool.closure_fault is None
    assert slot.tool.internal_pressure_bar == pytest.approx(1.0, abs=0.01)
    assert slot.tool.trapped_co2_mass_g == pytest.approx(0.0, abs=0.01)
    assert slot.tool.produce_lots[0].total_mass_g == pytest.approx(1000.0, abs=0.01)
    assert _lot_residual_co2_mass_g(updated, slot.tool.produce_lots[0].id) == pytest.approx(18.0, abs=0.15)
    assert updated.audit_log[-1] == "Wide-neck HDPE jar sealed on Station 1."


def test_sealed_storage_jar_with_residual_co2_pops_during_physics_tick() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(service, experiment.id, "create_produce_lot", {"produce_type": "apple"})
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {"slot_id": "station_1", "tool_id": "hdpe_storage_jar_2l"},
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {"slot_id": "station_1", "produce_lot_id": produce_lot_id},
    )

    stored_tool = service._experiments[experiment.id].workbench.slots[0].tool
    assert stored_tool is not None
    stored_lot = stored_tool.produce_lots[0]
    set_material_state_name(service._experiments[experiment.id].produce_material_states, stored_lot.id, "ground")
    state = _lot_state(service._experiments[experiment.id], stored_lot.id)
    state.residual_co2_mass_g = 18.0
    stored_lot.total_mass_g = 1000.0
    state.homogeneity_score = 0.96

    apply_command(service, experiment.id, "close_workbench_tool", {"slot_id": "station_1"})
    service._experiments[experiment.id].last_simulation_at -= timedelta(minutes=2)
    updated = service.get_experiment(experiment.id)

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.is_sealed is False
    assert slot.tool.closure_fault == "pressure_pop"
    assert slot.tool.internal_pressure_bar == pytest.approx(1.0, abs=0.01)
    assert slot.tool.trapped_co2_mass_g == pytest.approx(0.0, abs=0.01)
    assert slot.tool.produce_lots[0].total_mass_g < 1000.0
    assert _lot_residual_co2_mass_g(updated, slot.tool.produce_lots[0].id) < 18.0
    assert _lot_homogeneity_score(updated, slot.tool.produce_lots[0].id) == pytest.approx(0.25, abs=0.001)
    assert updated.audit_log[-1].startswith("Wide-neck HDPE jar popped open on Station 1 at ")


def test_close_storage_jar_after_degassing_seals_it_safely() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "hdpe_storage_jar_2l",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": created.basket_tools[-1].produce_lots[0].id,
        },
    )

    stored_tool = service._experiments[experiment.id].workbench.slots[0].tool
    assert stored_tool is not None
    stored_lot = stored_tool.produce_lots[0]
    set_material_state_name(service._experiments[experiment.id].produce_material_states, stored_lot.id, "ground")
    _lot_state(service._experiments[experiment.id], stored_lot.id).residual_co2_mass_g = 0.0

    sealed = apply_command(
        service,
        experiment.id,
        "close_workbench_tool",
        {
            "slot_id": "station_1",
        },
    )

    sealed_slot = next(slot for slot in sealed.workbench.slots if slot.id == "station_1")
    assert sealed_slot.tool is not None
    assert sealed_slot.tool.is_sealed is True
    assert sealed_slot.tool.closure_fault is None
    assert sealed.audit_log[-1] == "Wide-neck HDPE jar sealed on Station 1."


def test_add_liquid_to_sealed_centrifuge_tube_fails() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "centrifuge_tube_50ml",
        },
    )
    apply_command(
        service,
        experiment.id,
        "close_workbench_tool",
        {
            "slot_id": "station_1",
        },
    )

    with pytest.raises(ValueError, match=r"Open 50 mL centrifuge tube before adding liquids."):
        apply_command(
            service,
            experiment.id,
            "add_liquid_to_workbench_tool",
            {
                "slot_id": "station_1",
                "liquid_id": "acetonitrile_extraction",
            },
        )


def test_add_produce_to_sealed_storage_jar_fails() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "hdpe_storage_jar_2l",
        },
    )
    apply_command(
        service,
        experiment.id,
        "close_workbench_tool",
        {
            "slot_id": "station_1",
        },
    )

    with pytest.raises(ValueError, match=r"Open Wide-neck HDPE jar before adding produce."):
        apply_command(
            service,
            experiment.id,
            "add_produce_lot_to_workbench_tool",
            {
                "slot_id": "station_1",
                "produce_lot_id": created.basket_tools[-1].produce_lots[0].id,
            },
        )


def test_create_debug_powder_preset_on_workbench() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "hdpe_storage_jar_2l",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "create_debug_produce_lot_on_workbench",
        {
            "preset_id": "apple_powder_residual_co2",
            "total_mass_g": 2450.0,
            "residual_co2_mass_g": 24.0,
            "temperature_c": -70.0,
            "target_slot_id": "station_1",
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert _material_state_name(updated, slot.tool.produce_lots[0].id) == "ground"
    assert slot.tool.produce_lots[0].total_mass_g == pytest.approx(2450.0, abs=0.01)
    assert _lot_residual_co2_mass_g(updated, slot.tool.produce_lots[0].id) == pytest.approx(24.0, abs=0.01)
    assert _lot_temperature_c(updated, slot.tool.produce_lots[0].id) == pytest.approx(-70.0, abs=0.01)
    assert updated.audit_log[-1] == "Debug preset Apple powder lot spawned on Wide-neck HDPE jar."


def test_create_debug_powder_preset_in_grinder() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "create_debug_produce_lot_to_widget",
        {
            "preset_id": "apple_powder_residual_co2",
            "widget_id": "grinder",
        },
    )

    grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")
    assert _material_state_name(updated, grinder.produce_lots[0].id) == "ground"
    assert grinder.produce_lots[0].total_mass_g == pytest.approx(2450.0, abs=0.01)
    assert _lot_residual_co2_mass_g(updated, grinder.produce_lots[0].id) == pytest.approx(18.0, abs=0.01)
    assert _lot_temperature_c(updated, grinder.produce_lots[0].id) == pytest.approx(-62.0, abs=0.01)
    assert updated.audit_log[-1] == "Debug preset Apple powder lot spawned in Cryogenic grinder."


def test_create_debug_powder_preset_on_gross_balance() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "create_debug_produce_lot_to_widget",
        {
            "preset_id": "apple_powder_residual_co2",
            "widget_id": "gross_balance",
        },
    )

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert _material_state_name(updated, gross_balance.produce_lots[0].id) == "ground"
    assert gross_balance.produce_lots[0].total_mass_g == pytest.approx(2450.0, abs=0.01)
    assert _lot_residual_co2_mass_g(updated, gross_balance.produce_lots[0].id) == pytest.approx(18.0, abs=0.01)
    assert _lot_temperature_c(updated, gross_balance.produce_lots[0].id) == pytest.approx(-62.0, abs=0.01)
    assert updated.audit_log[-1] == "Debug preset Apple powder lot spawned in Gross balance."


def test_move_basket_tool_to_gross_balance_updates_measured_mass() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    assert experiment.basket_tools
    expected_mass_g = round(
        experiment.basket_tools[0].produce_lots[0].total_mass_g + SAMPLE_BAG_TARE_MASS_G,
        1,
    )

    updated = move_basket_tool_to_gross_balance(service, experiment.id)

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert gross_balance.tool is not None
    assert gross_balance.tool.tool_type == "sample_bag"
    assert updated.basket_tools == []
    assert updated.lims_reception.measured_gross_mass_g == pytest.approx(expected_mass_g, abs=0.01)
    assert updated.audit_log[-1] == "Sealed sampling bag placed on Gross balance."


def test_place_tool_on_gross_balance_estimates_mass_for_empty_vial() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = place_tool_on_gross_balance(service, experiment.id, "sample_vial_lcms")

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert gross_balance.tool is not None
    assert gross_balance.tool.tool_type == "sample_vial"
    assert updated.lims_reception.measured_gross_mass_g == pytest.approx(1.5, abs=0.01)
    assert updated.audit_log[-1] == "Autosampler vial placed on Gross balance."


def test_move_gross_balance_tool_to_rack_rejects_non_vials() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    place_tool_on_gross_balance(service, experiment.id, "centrifuge_tube_50ml")

    with pytest.raises(ValueError, match=r"does not fit in the rack"):
        move_gross_balance_tool_to_rack(service, experiment.id, "rack_slot_1")


def test_apply_printed_lims_label_to_gross_balance_bag_consumes_ticket() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    move_basket_tool_to_gross_balance(service, experiment.id)
    created = create_lims_reception(
        service,
        experiment.id,
        orchard_name="Martin Orchard",
        harvest_date="2026-03-29",
        indicative_mass_g=2500,
        measured_gross_mass_g=None,
        measured_sample_mass_g=None,
    )
    print_lims_label(service, experiment.id, created.lims_reception.id)

    updated = apply_printed_lims_label_to_gross_balance_bag(service, experiment.id)

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert gross_balance.tool is not None
    assert len(gross_balance.tool.labels) == 1
    assert gross_balance.tool.labels[0].label_kind == "lims"
    assert gross_balance.tool.labels[0].sample_code == updated.lims_entries[0].lab_sample_code
    assert updated.lims_reception.printed_label_ticket is None
    assert updated.lims_entries[0].status == "received"
    assert updated.audit_log[-1] == f"LIMS label {updated.lims_entries[0].lab_sample_code} applied to Sealed sampling bag."


def test_discard_gross_balance_loose_produce_lot_moves_it_to_trash() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = create_debug_produce_lot_to_widget(
        service,
        experiment.id,
        "apple_powder_residual_co2",
        "gross_balance",
        total_mass_g=10.0,
    )
    produce_lot_id = next(widget for widget in created.workspace.widgets if widget.id == "gross_balance").produce_lots[0].id

    updated = discard_gross_balance_produce_lot(service, experiment.id, produce_lot_id)

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert gross_balance.produce_lots == []
    assert updated.trash.produce_lots[0].produce_lot.id == produce_lot_id
    assert updated.trash.produce_lots[0].origin_label == "Gross balance"
    assert updated.lims_reception.measured_gross_mass_g is None
    assert updated.audit_log[-1] == "Apple powder lot discarded from Gross balance."
    runtime_experiment = service._require_experiment(experiment.id)
    assert runtime_experiment.trash.produce_lots[0].produce_fraction is not None
    assert runtime_experiment.trash.produce_lots[0].produce_fraction.location_kind == "trash"


def test_discard_gross_balance_tool_produce_lot_preserves_structured_origin() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = create_produce_lot(service, experiment.id, "apple")
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    place_tool_on_gross_balance(service, experiment.id, "hdpe_storage_jar_2l")
    open_gross_balance_tool(service, experiment.id)
    move_workspace_produce_lot_to_gross_balance(service, experiment.id, produce_lot_id)

    updated = discard_gross_balance_produce_lot(service, experiment.id, produce_lot_id)

    trashed_entry = updated.trash.produce_lots[0]
    assert trashed_entry.origin_label == "Gross balance"
    assert trashed_entry.origin is not None
    assert trashed_entry.origin.kind == "gross_balance_tool"
    assert trashed_entry.origin.location_id == "gross_balance"
    assert trashed_entry.origin.container_label == "Wide-neck HDPE jar"
    assert trashed_entry.produce_fraction is not None
    assert trashed_entry.produce_fraction.location_kind == "trash"


def test_restore_trashed_produce_lot_to_gross_balance_updates_mass() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = create_debug_produce_lot_to_widget(
        service,
        experiment.id,
        "apple_powder_residual_co2",
        "gross_balance",
        total_mass_g=12.3,
    )
    produce_lot_id = next(widget for widget in created.workspace.widgets if widget.id == "gross_balance").produce_lots[0].id
    discarded = discard_gross_balance_produce_lot(service, experiment.id, produce_lot_id)
    trash_produce_lot_id = discarded.trash.produce_lots[0].id

    updated = restore_trashed_produce_lot_to_gross_balance(service, experiment.id, trash_produce_lot_id)

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert gross_balance.produce_lots[0].id == produce_lot_id
    assert updated.trash.produce_lots == []
    assert updated.lims_reception.measured_gross_mass_g == pytest.approx(12.3, abs=0.01)
    assert updated.audit_log[-1] == "Apple powder lot restored from trash to Gross balance."


def test_move_workbench_tool_to_gross_balance_moves_tool_and_clears_source_slot() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    place_tool_on_workbench(service, experiment.id, "station_1", "centrifuge_tube_50ml")

    updated = move_workbench_tool_to_gross_balance(service, experiment.id, "station_1")

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert gross_balance.tool is not None
    assert gross_balance.tool.tool_type == "centrifuge_tube"
    assert updated.workbench.slots[0].tool is None
    assert updated.lims_reception.measured_gross_mass_g == pytest.approx(12.0, abs=0.01)
    assert updated.audit_log[-1] == "50 mL centrifuge tube placed on Gross balance."


def test_move_workbench_tool_to_gross_balance_requires_tool_in_source_slot() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    with pytest.raises(ValueError, match=r"Station 1 does not contain a tool"):
        move_workbench_tool_to_gross_balance(service, experiment.id, "station_1")


def test_move_rack_tool_to_gross_balance_moves_tool_and_clears_rack_slot() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    place_tool_in_rack_slot(service, experiment.id, "rack_slot_1", "sample_vial_lcms")

    updated = move_rack_tool_to_gross_balance(service, experiment.id, "rack_slot_1")

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert gross_balance.tool is not None
    assert gross_balance.tool.tool_type == "sample_vial"
    assert updated.rack.slots[0].tool is None
    assert updated.audit_log[-1] == "Autosampler vial placed on Gross balance."


def test_restore_trashed_tool_to_gross_balance_restores_tool_and_clears_trash() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    discard_tool_from_palette(service, experiment.id, "sample_vial_lcms")
    trash_tool_id = service.get_experiment(experiment.id).trash.children[0].id

    updated = restore_trashed_tool_to_gross_balance(service, experiment.id, trash_tool_id)

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert gross_balance.tool is not None
    assert gross_balance.tool.tool_type == "sample_vial"
    assert updated.trash.children == []
    assert updated.audit_log[-1] == "Autosampler vial restored onto Gross balance."


def test_move_gross_balance_tool_to_workbench_moves_tool_to_empty_slot() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    place_tool_on_gross_balance(service, experiment.id, "sample_vial_lcms")

    updated = move_gross_balance_tool_to_workbench(service, experiment.id, "station_1")

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert gross_balance.tool is None
    assert updated.workbench.slots[0].tool is not None
    assert updated.workbench.slots[0].tool.tool_type == "sample_vial"
    assert updated.lims_reception.measured_gross_mass_g is None
    assert updated.audit_log[-1] == "Autosampler vial moved from Gross balance to Station 1."


def test_move_gross_balance_tool_to_workbench_rejects_occupied_slot() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    place_tool_on_workbench(service, experiment.id, "station_1", "sample_vial_lcms")
    place_tool_on_gross_balance(service, experiment.id, "centrifuge_tube_50ml")

    with pytest.raises(ValueError, match=r"Station 1 already contains a tool"):
        move_gross_balance_tool_to_workbench(service, experiment.id, "station_1")


def test_move_gross_balance_tool_to_rack_moves_vial_and_clears_balance() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    place_tool_on_gross_balance(service, experiment.id, "sample_vial_lcms")

    updated = move_gross_balance_tool_to_rack(service, experiment.id, "rack_slot_1")

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert gross_balance.tool is None
    assert updated.rack.slots[0].tool is not None
    assert updated.rack.slots[0].tool.tool_type == "sample_vial"
    assert updated.audit_log[-1] == "Autosampler vial moved from Gross balance to Position 1."


def test_discard_gross_balance_tool_moves_tool_to_trash() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    place_tool_on_gross_balance(service, experiment.id, "sample_vial_lcms")

    updated = discard_gross_balance_tool(service, experiment.id)

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert gross_balance.tool is None
    assert updated.trash.children[0].tool_type == "sample_vial"
    assert updated.trash.discarded_from[updated.trash.children[0].id] == "Gross balance"
    assert updated.audit_log[-1] == "Autosampler vial discarded from Gross balance."


def test_open_gross_balance_tool_rejects_non_sealable_tool() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    place_tool_on_gross_balance(service, experiment.id, "cutting_board_hdpe")

    with pytest.raises(ValueError, match=r"Cutting board does not support sealing"):
        open_gross_balance_tool(service, experiment.id)


def test_close_and_open_gross_balance_tool_toggle_seal_state() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    place_tool_on_gross_balance(service, experiment.id, "sample_vial_lcms")
    closed = close_gross_balance_tool(service, experiment.id)
    reopened = open_gross_balance_tool(service, experiment.id)

    gross_balance_closed = next(widget for widget in closed.workspace.widgets if widget.id == "gross_balance")
    gross_balance_open = next(widget for widget in reopened.workspace.widgets if widget.id == "gross_balance")
    assert gross_balance_closed.tool is not None
    assert gross_balance_closed.tool.is_sealed is True
    assert gross_balance_open.tool is not None
    assert gross_balance_open.tool.is_sealed is False
    assert reopened.audit_log[-1] == "Autosampler vial opened on Gross balance."


def test_move_workspace_produce_lot_to_gross_balance_places_loose_produce_and_updates_mass() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = create_produce_lot(service, experiment.id, "apple")
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id

    updated = move_workspace_produce_lot_to_gross_balance(service, experiment.id, produce_lot_id)

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert updated.workspace.produce_basket_lots == []
    assert gross_balance.produce_lots[0].id == produce_lot_id
    assert updated.lims_reception.measured_gross_mass_g == pytest.approx(2450.0, abs=0.01)
    assert updated.audit_log[-1] == "Apple lot 1 added to Gross balance."


def test_move_workspace_produce_lot_to_gross_balance_rejects_existing_loose_produce() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    first = create_produce_lot(service, experiment.id, "apple")
    first_id = first.basket_tools[-1].produce_lots[0].id
    move_workspace_produce_lot_to_gross_balance(service, experiment.id, first_id)
    second = create_produce_lot(service, experiment.id, "apple")
    second_id = second.basket_tools[-1].produce_lots[0].id

    with pytest.raises(ValueError, match=r"Gross balance already contains a produce lot"):
        move_workspace_produce_lot_to_gross_balance(service, experiment.id, second_id)


def test_move_workspace_produce_lot_to_gross_balance_rejects_sealed_balance_bag() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = create_produce_lot(service, experiment.id, "apple")
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    move_basket_tool_to_gross_balance(service, experiment.id)

    with pytest.raises(ValueError, match=r"Open Sealed sampling bag before adding produce"):
        move_workspace_produce_lot_to_gross_balance(service, experiment.id, produce_lot_id)


def test_move_workspace_produce_lot_to_gross_balance_rejects_tool_without_produce_capacity() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = create_produce_lot(service, experiment.id, "apple")
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    place_tool_on_gross_balance(service, experiment.id, "sample_vial_lcms")

    with pytest.raises(ValueError, match=r"Autosampler vial does not accept produce"):
        move_workspace_produce_lot_to_gross_balance(service, experiment.id, produce_lot_id)


def test_move_workspace_produce_lot_to_gross_balance_places_produce_into_open_balance_jar() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = create_produce_lot(service, experiment.id, "apple")
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    place_tool_on_gross_balance(service, experiment.id, "hdpe_storage_jar_2l")
    open_gross_balance_tool(service, experiment.id)

    updated = move_workspace_produce_lot_to_gross_balance(service, experiment.id, produce_lot_id)

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert gross_balance.tool is not None
    assert gross_balance.tool.produce_lots[0].id == produce_lot_id
    assert updated.audit_log[-1] == "Apple lot 1 added to Wide-neck HDPE jar."


def test_move_gross_balance_produce_lot_to_workbench_moves_loose_produce_to_target_slot() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = create_produce_lot(service, experiment.id, "apple")
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    move_workspace_produce_lot_to_gross_balance(service, experiment.id, produce_lot_id)
    place_tool_on_workbench(service, experiment.id, "station_1", "cutting_board_hdpe")

    updated = move_gross_balance_produce_lot_to_workbench(service, experiment.id, "station_1", produce_lot_id)

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    assert gross_balance.produce_lots == []
    assert updated.workbench.slots[0].tool is not None
    assert updated.workbench.slots[0].tool.produce_lots[0].id == produce_lot_id
    assert updated.audit_log[-1] == "Apple lot 1 moved from Gross balance to Cutting board."


def test_move_gross_balance_produce_lot_to_widget_moves_loose_produce_into_grinder() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = create_produce_lot(service, experiment.id, "apple")
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    move_workspace_produce_lot_to_gross_balance(service, experiment.id, produce_lot_id)

    updated = move_gross_balance_produce_lot_to_widget(service, experiment.id, "grinder", produce_lot_id)

    gross_balance = next(widget for widget in updated.workspace.widgets if widget.id == "gross_balance")
    grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")
    assert gross_balance.produce_lots == []
    assert grinder.produce_lots[0].id == produce_lot_id
    assert updated.audit_log[-1] == "Apple lot 1 moved from Gross balance to Cryogenic grinder."


def test_discard_gross_balance_tool_requires_tool() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    with pytest.raises(ValueError, match=r"Gross balance does not contain a tool"):
        discard_gross_balance_tool(service, experiment.id)


def test_open_workbench_tool_unseals_a_jar() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "hdpe_storage_jar_2l",
        },
    )
    apply_command(
        service,
        experiment.id,
        "close_workbench_tool",
        {
            "slot_id": "station_1",
        },
    )

    updated = open_workbench_tool(service, experiment.id, "station_1")

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.is_sealed is False
    assert slot.tool.closure_fault is None
    assert updated.audit_log[-1] == "Wide-neck HDPE jar opened on Station 1."


def test_opening_pressurized_storage_jar_vents_and_loses_some_powder() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(service, experiment.id, "create_produce_lot", {"produce_type": "apple"})
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {"slot_id": "station_1", "tool_id": "hdpe_storage_jar_2l"},
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {"slot_id": "station_1", "produce_lot_id": produce_lot_id},
    )

    stored_tool = service._experiments[experiment.id].workbench.slots[0].tool
    assert stored_tool is not None
    stored_lot = stored_tool.produce_lots[0]
    set_material_state_name(service._experiments[experiment.id].produce_material_states, stored_lot.id, "ground")
    state = _lot_state(service._experiments[experiment.id], stored_lot.id)
    state.residual_co2_mass_g = 18.0
    stored_lot.total_mass_g = 1000.0
    state.homogeneity_score = 0.96

    apply_command(service, experiment.id, "close_workbench_tool", {"slot_id": "station_1"})
    service._experiments[experiment.id].last_simulation_at -= timedelta(seconds=10)
    service.get_experiment(experiment.id)
    updated = open_workbench_tool(service, experiment.id, "station_1")

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.is_sealed is False
    assert slot.tool.closure_fault is None
    assert slot.tool.internal_pressure_bar == pytest.approx(1.0, abs=0.01)
    assert slot.tool.trapped_co2_mass_g == pytest.approx(0.0, abs=0.01)
    assert slot.tool.produce_lots[0].total_mass_g < 1000.0
    assert _lot_homogeneity_score(updated, slot.tool.produce_lots[0].id) == pytest.approx(0.55, abs=0.001)
    assert updated.audit_log[-1].startswith("Wide-neck HDPE jar vented at ")


def test_pressure_events_never_improve_existing_homogeneity_score() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(service, experiment.id, "create_produce_lot", {"produce_type": "apple"})
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {"slot_id": "station_1", "tool_id": "hdpe_storage_jar_2l"},
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {"slot_id": "station_1", "produce_lot_id": produce_lot_id},
    )

    stored_tool = service._experiments[experiment.id].workbench.slots[0].tool
    assert stored_tool is not None
    stored_lot = stored_tool.produce_lots[0]
    set_material_state_name(service._experiments[experiment.id].produce_material_states, stored_lot.id, "ground")
    state = _lot_state(service._experiments[experiment.id], stored_lot.id)
    state.residual_co2_mass_g = 18.0
    stored_lot.total_mass_g = 1000.0
    state.homogeneity_score = 0.18

    apply_command(service, experiment.id, "close_workbench_tool", {"slot_id": "station_1"})
    service._experiments[experiment.id].last_simulation_at -= timedelta(seconds=10)
    service.get_experiment(experiment.id)
    vented = open_workbench_tool(service, experiment.id, "station_1")

    slot = next(slot for slot in vented.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert _lot_homogeneity_score(vented, slot.tool.produce_lots[0].id) == pytest.approx(0.18, abs=0.001)


def test_service_can_reload_experiment_state_from_sqlite_snapshot(tmp_path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
    first_service = ExperimentRuntimeService(repository=repository)
    fixed_now = datetime(2026, 1, 1, tzinfo=UTC)
    first_service._now_fn = lambda: fixed_now

    experiment = first_service.create_experiment()
    updated = apply_command(
        first_service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "hdpe_storage_jar_2l",
        },
    )

    second_service = ExperimentRuntimeService(repository=repository)
    second_service._now_fn = lambda: fixed_now
    reloaded = second_service.get_experiment(experiment.id)

    slot = next(slot for slot in reloaded.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.tool_id == "hdpe_storage_jar_2l"
    assert reloaded.id == updated.id
    assert reloaded.snapshot_version == updated.snapshot_version


def test_service_can_reload_pressure_popped_tool_from_sqlite_snapshot(tmp_path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
    first_service = ExperimentRuntimeService(repository=repository)
    fixed_now = datetime(2026, 1, 1, tzinfo=UTC)
    first_service._now_fn = lambda: fixed_now

    experiment = first_service.create_experiment()
    created = apply_command(first_service, experiment.id, "create_produce_lot", {"produce_type": "apple"})
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        first_service,
        experiment.id,
        "place_tool_on_workbench",
        {"slot_id": "station_1", "tool_id": "hdpe_storage_jar_2l"},
    )
    apply_command(
        first_service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {"slot_id": "station_1", "produce_lot_id": produce_lot_id},
    )

    stored_tool = first_service._experiments[experiment.id].workbench.slots[0].tool
    assert stored_tool is not None
    stored_lot = stored_tool.produce_lots[0]
    set_material_state_name(first_service._experiments[experiment.id].produce_material_states, stored_lot.id, "ground")
    state = _lot_state(first_service._experiments[experiment.id], stored_lot.id)
    state.residual_co2_mass_g = 18.0
    state.homogeneity_score = 0.96
    stored_lot.total_mass_g = 1000.0

    apply_command(first_service, experiment.id, "close_workbench_tool", {"slot_id": "station_1"})
    first_service._experiments[experiment.id].last_simulation_at -= timedelta(minutes=2)
    popped = first_service.get_experiment(experiment.id)
    slot = next(slot for slot in popped.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.is_sealed is False
    assert slot.tool.closure_fault == "pressure_pop"

    second_service = ExperimentRuntimeService(repository=repository)
    second_service._now_fn = lambda: fixed_now
    reloaded = second_service.get_experiment(experiment.id)

    reloaded_slot = next(slot for slot in reloaded.workbench.slots if slot.id == "station_1")
    assert reloaded_slot.tool is not None
    assert reloaded_slot.tool.is_sealed is False
    assert reloaded_slot.tool.closure_fault == "pressure_pop"


def test_service_recovers_if_sqlite_file_is_deleted_while_running(tmp_path) -> None:
    db_path = tmp_path / "experiments.sqlite3"
    service = ExperimentRuntimeService(repository=SqliteExperimentRepository(str(db_path)))

    created_before_deletion = service.create_experiment()
    assert db_path.exists()

    Path(db_path).unlink()

    created_after_deletion = service.create_experiment()
    listed = service.list_experiments()

    assert db_path.exists()
    assert created_before_deletion.id != created_after_deletion.id
    assert [entry.id for entry in listed] == [created_after_deletion.id]


def test_experiment_can_be_renamed_and_listed_with_its_summary(tmp_path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
    service = ExperimentRuntimeService(repository=repository)
    created = service.create_experiment()

    renamed = service.rename_experiment(created.id, "  Apple extraction — repeat 2  ")
    listed = service.list_experiments()

    assert renamed.name == "Apple extraction — repeat 2"
    assert listed[0].name == "Apple extraction — repeat 2"
    assert listed[0].summary.workbench_tool_count == 0
    assert listed[0].summary.rack_tool_count == 0
    assert listed[0].summary.material_count == 1
    assert listed[0].summary.run_count == 0


def test_duplicate_experiment_copies_state_under_a_new_identity(tmp_path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
    service = ExperimentRuntimeService(repository=repository)
    source = service.create_experiment()
    service.rename_experiment(source.id, "Ready for injection")
    source_domain = service._require_experiment(source.id)
    source_domain.workbench.slots[0].tool = build_workbench_tool("sample_vial_lcms")
    saved_source = service._persist_mutation_and_to_schema(source_domain)

    duplicate = service.duplicate_experiment(source.id)

    assert duplicate.id != source.id
    assert duplicate.name == "Ready for injection (copy)"
    assert duplicate.snapshot_version == 1
    assert duplicate.workbench == saved_source.workbench
    assert duplicate.audit_log[:-1] == saved_source.audit_log
    assert duplicate.audit_log[-1] == f"Duplicated from {source.id}."
    assert service.get_experiment(source.id).name == "Ready for injection"


def test_repository_backfills_summary_metadata_for_existing_snapshots(tmp_path) -> None:
    db_path = tmp_path / "experiments.sqlite3"
    service = ExperimentRuntimeService(repository=SqliteExperimentRepository(str(db_path)))
    created = service.create_experiment("Legacy state")
    experiment = service._require_experiment(created.id)
    experiment.workbench.slots[0].tool = build_workbench_tool("sample_vial_lcms")
    service._persist_mutation_and_to_schema(experiment)
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """
            UPDATE experiments
            SET name = NULL, workbench_tool_count = NULL, rack_tool_count = NULL,
                material_count = NULL, run_count = NULL
            WHERE id = ?
            """,
            (created.id,),
        )

    migrated = SqliteExperimentRepository(str(db_path)).list()[0]

    assert migrated.name == "Legacy state"
    assert migrated.summary.workbench_tool_count == 1


@pytest.mark.parametrize("name", ["", "   ", "x" * 81])
def test_rename_experiment_rejects_invalid_names(name: str) -> None:
    service = ExperimentRuntimeService()
    created = service.create_experiment()

    with pytest.raises(ValueError, match="Experiment name"):
        service.rename_experiment(created.id, name)


def test_discard_grinder_produce_lot_moves_it_to_trash() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "add_workspace_produce_lot_to_widget",
        {
            "widget_id": "grinder",
            "produce_lot_id": produce_lot_id,
        },
    )

    updated = move_object(
        service,
        experiment.id,
        entity_kind="produce_lot",
        entity_id=produce_lot_id,
        source_kind="grinder",
        source_id="grinder",
        destination_kind="trash_bin",
        destination_id="trash",
    )

    grinder = next(widget for widget in updated.workspace.widgets if widget.id == "grinder")

    assert grinder.produce_lots == []
    assert len(updated.trash.produce_lots) == 1
    assert updated.trash.produce_lots[0].origin_label == "Cryogenic grinder"
    assert updated.audit_log[-1] == "Apple lot 1 discarded from Cryogenic grinder."
    runtime_experiment = service._require_experiment(experiment.id)
    assert runtime_experiment.trash.produce_lots[0].produce_fraction is not None
    assert runtime_experiment.trash.produce_lots[0].produce_fraction.location_kind == "trash"


def test_restore_trashed_produce_lot_to_sampling_bag() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    discarded = move_object(
        service,
        experiment.id,
        entity_kind="produce_lot",
        entity_id=created.basket_tools[-1].produce_lots[0].id,
        source_kind="basket",
        source_id="produce_basket",
        destination_kind="trash_bin",
        destination_id="trash",
    )
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sealed_sampling_bag",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "restore_trashed_produce_lot_to_workbench_tool",
        {
            "target_slot_id": "station_1",
            "trash_produce_lot_id": discarded.trash.produce_lots[0].id,
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.produce_lots[0].label == "Apple lot 1"
    assert updated.trash.produce_lots == []


def test_discard_tool_from_palette_adds_it_to_trash() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "discard_tool_from_palette",
        {
            "tool_id": "sealed_sampling_bag",
        },
    )

    assert len(updated.trash.children) == 1
    assert updated.trash.discarded_from[updated.trash.children[0].id] == "Palette"
    assert updated.trash.children[0].tool_type == "sample_bag"


def test_store_workspace_widget_from_palette_keeps_it_in_inventory() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    initial_audit_length = len(experiment.audit_log)

    updated = apply_command(
        service,
        experiment.id,
        "store_workspace_widget",
        {
            "widget_id": "rack",
        },
    )

    widget = next(widget for widget in updated.workspace.widgets if widget.id == "rack")
    assert widget.is_present is False
    assert widget.is_trashed is False
    assert len(updated.audit_log) == initial_audit_length


def test_workbench_slot_commands_add_and_remove_empty_stations() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    added = apply_command(
        service,
        experiment.id,
        "add_workbench_slot",
        {},
    )

    assert [slot.id for slot in added.workbench.slots] == [
        "station_1",
        "station_2",
        "station_3",
    ]
    assert added.audit_log[-1] == "Station 3 added to workbench."

    removed = apply_command(
        service,
        experiment.id,
        "remove_workbench_slot",
        {
            "slot_id": "station_3",
        },
    )

    assert [slot.id for slot in removed.workbench.slots] == [
        "station_1",
        "station_2",
    ]
    assert removed.audit_log[-1] == "Station 3 removed from workbench."


def test_remove_workbench_slot_requires_an_empty_station() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sample_vial_lcms",
        },
    )

    with pytest.raises(ValueError, match=r"Station 1 must be empty before it can be removed."):
        apply_command(
            service,
            experiment.id,
            "remove_workbench_slot",
            {
                "slot_id": "station_1",
            },
        )


def test_remove_liquid_from_workbench_tool_updates_tool_contents() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "centrifuge_tube_50ml",
        },
    )
    updated = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_id": "acetonitrile_extraction",
        },
    )

    assert updated.workbench.slots[0].tool is not None
    liquid_id = updated.workbench.slots[0].tool.liquids[0].id
    updated = apply_command(
        service,
        experiment.id,
        "remove_liquid_from_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_entry_id": liquid_id,
        },
    )

    assert updated.workbench.slots[0].tool is not None
    assert updated.workbench.slots[0].tool.liquids == []
    assert updated.audit_log[-1] == "Acetonitrile removed from 50 mL centrifuge tube."


def test_vortex_cycle_marks_only_the_tube_powder_fraction_as_mixed() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(
            slot_id="station_1",
            tool_id="centrifuge_tube_50ml",
        ),
    )

    runtime_experiment = service._require_experiment(experiment.id)
    tube = runtime_experiment.workbench.slots[0].tool
    assert tube is not None
    tube.produce_fractions = [
        ProduceFraction(
            id="tube_fraction",
            produce_lot_id="lot_1",
            produce_material_state_id="shared_ground_state",
            mass_g=2.5,
        )
    ]
    jar = build_workbench_tool("hdpe_storage_jar_2l")
    jar.produce_fractions = [
        ProduceFraction(
            id="jar_fraction",
            produce_lot_id="lot_1",
            produce_material_state_id="shared_ground_state",
            mass_g=100.0,
        )
    ]
    runtime_experiment.workbench.slots[1].tool = jar
    runtime_experiment.produce_material_states = [
        ProduceMaterialState(
            id="shared_ground_state",
            produce_lot_id="lot_1",
            material_state="ground",
        ),
    ]

    MoveWorkbenchToolToVortexService(service).run(
        experiment.id,
        MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"),
    )
    started = StartVortexCycleService(service).run(experiment.id, EmptyVortexRequest())
    vortex_tool = next(widget.tool for widget in started.workspace.widgets if widget.id == "vortex")
    assert vortex_tool is not None
    assert vortex_tool.produce_fractions[0].is_mixed is False
    assert started.workbench.slots[1].tool is not None
    assert started.workbench.slots[1].tool.produce_fractions[0].is_mixed is False

    finished = AdvanceWorkspaceCryogenicsService(service).run(
        experiment.id,
        AdvanceWorkspaceCryogenicsRequest(elapsed_ms=3000),
    )

    vortex_tool = next(widget.tool for widget in finished.workspace.widgets if widget.id == "vortex")
    assert vortex_tool is not None
    assert vortex_tool.produce_fractions[0].is_mixed is True
    assert finished.workbench.slots[1].tool is not None
    assert finished.workbench.slots[1].tool.produce_fractions[0].is_mixed is False
    assert not hasattr(finished.produce_material_states[0], "is_mixed")


def test_mixed_slurry_liquid_cannot_be_removed_or_edited() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "centrifuge_tube_50ml",
        },
    )

    runtime_experiment = service._require_experiment(experiment.id)
    tool = runtime_experiment.workbench.slots[0].tool
    assert tool is not None
    tool.produce_lots = [
        ProduceLot(
            id="lot_1",
            label="Apple powder 1",
            produce_type="apple",
            total_mass_g=8.0,
        )
    ]
    runtime_experiment.produce_material_states = [ProduceMaterialState(id="state_powder_tool", produce_lot_id="lot_1", material_state="ground")]

    mixed = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_id": "acetonitrile_extraction",
        },
    )
    assert mixed.workbench.slots[0].tool is not None
    liquid_id = mixed.workbench.slots[0].tool.liquids[0].id

    with pytest.raises(ValueError, match="cannot be removed after it has mixed into slurry"):
        apply_command(
            service,
            experiment.id,
            "remove_liquid_from_workbench_tool",
            {
                "slot_id": "station_1",
                "liquid_entry_id": liquid_id,
            },
        )

    with pytest.raises(ValueError, match="cannot be edited after it has mixed into slurry"):
        apply_command(
            service,
            experiment.id,
            "update_workbench_liquid_volume",
            {
                "slot_id": "station_1",
                "liquid_entry_id": liquid_id,
                "volume_ml": 2.5,
            },
        )


def test_move_tool_between_workbench_slots_updates_positions() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sample_vial_lcms",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "move_tool_between_workbench_slots",
        {
            "source_slot_id": "station_1",
            "target_slot_id": "station_2",
        },
    )

    assert updated.workbench.slots[0].tool is None
    assert updated.workbench.slots[1].tool is not None
    assert updated.workbench.slots[1].tool.label == "Autosampler vial"
    assert updated.audit_log[-1] == "Autosampler vial moved from Station 1 to Station 2."


def test_discard_workbench_tool_removes_it_from_station() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sample_vial_lcms",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "discard_workbench_tool",
        {
            "slot_id": "station_1",
        },
    )

    assert updated.workbench.slots[0].tool is None
    assert len(updated.trash.children) == 1
    assert updated.trash.discarded_from[updated.trash.children[0].id] == "Station 1"
    assert updated.trash.children[0].label == "Autosampler vial"
    assert updated.audit_log[-1] == "Autosampler vial discarded from Station 1."


def test_discard_workbench_cutting_board_is_rejected() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "cutting_board_hdpe",
        },
    )

    with pytest.raises(ValueError, match=r"Cutting board must be stored in inventory instead of discarded."):
        apply_command(
            service,
            experiment.id,
            "discard_workbench_tool",
            {
                "slot_id": "station_1",
            },
        )


def test_discard_palette_cutting_board_is_rejected() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    with pytest.raises(ValueError, match=r"Cutting board must be stored in inventory instead of discarded."):
        apply_command(
            service,
            experiment.id,
            "discard_tool_from_palette",
            {
                "tool_id": "cutting_board_hdpe",
            },
        )


def test_store_workbench_cutting_board_returns_it_to_inventory() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "cutting_board_hdpe",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "store_workbench_tool",
        {
            "slot_id": "station_1",
        },
    )

    assert updated.workbench.slots[0].tool is None
    assert updated.trash.children == []
    assert updated.audit_log[-1] == "Cutting board stored in inventory."


def test_store_workbench_cutting_board_requires_empty_board() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    created_lot = apply_command(service, experiment.id, "create_produce_lot", {"produce_type": "apple"})
    produce_lot_id = created_lot.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "cutting_board_hdpe",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "produce_lot_id": produce_lot_id,
            "slot_id": "station_1",
        },
    )

    with pytest.raises(ValueError, match=r"Empty Cutting board before storing it."):
        apply_command(
            service,
            experiment.id,
            "store_workbench_tool",
            {
                "slot_id": "station_1",
            },
        )


def test_store_workbench_tool_rejects_non_storable_tools() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sample_vial_lcms",
        },
    )

    with pytest.raises(ValueError, match=r"Autosampler vial cannot be stored."):
        apply_command(
            service,
            experiment.id,
            "store_workbench_tool",
            {
                "slot_id": "station_1",
            },
        )


def test_workspace_widget_commands_manage_presence_and_position() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    added = apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "rack",
            "anchor": "top-left",
            "offset_x": 480,
            "offset_y": 420,
        },
    )
    rack_widget = next(widget for widget in added.workspace.widgets if widget.id == "rack")
    assert rack_widget.is_present is True
    assert rack_widget.is_trashed is False
    assert rack_widget.anchor == "top-left"
    assert rack_widget.offset_x == 480
    assert rack_widget.offset_y == 420
    assert added.audit_log[-1] == "Autosampler rack added to workspace."

    moved = apply_command(
        service,
        experiment.id,
        "move_workspace_widget",
        {
            "widget_id": "rack",
            "anchor": "top-right",
            "offset_x": 120,
            "offset_y": 460,
        },
    )
    rack_widget = next(widget for widget in moved.workspace.widgets if widget.id == "rack")
    assert rack_widget.anchor == "top-right"
    assert rack_widget.offset_x == 120
    assert rack_widget.offset_y == 460
    assert moved.audit_log[-1] == "Autosampler rack moved in workspace."

    stored = apply_command(
        service,
        experiment.id,
        "store_workspace_widget",
        {
            "widget_id": "rack",
        },
    )
    rack_widget = next(widget for widget in stored.workspace.widgets if widget.id == "rack")
    assert rack_widget.is_present is False
    assert rack_widget.is_trashed is False
    assert stored.audit_log[-1] == "Autosampler rack stored in inventory."


def test_lims_widget_can_be_stored() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    stored = apply_command(
        service,
        experiment.id,
        "store_workspace_widget",
        {
            "widget_id": "lims",
        },
    )
    lims_widget = next(widget for widget in stored.workspace.widgets if widget.id == "lims")
    assert lims_widget.is_present is False
    assert lims_widget.is_trashed is False
    assert stored.audit_log[-1] == "LIMS terminal stored in inventory."


def test_non_storable_workspace_widget_cannot_be_stored() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    with pytest.raises(ValueError, match=r"Produce basket cannot be stored."):
        apply_command(
            service,
            experiment.id,
            "store_workspace_widget",
            {
                "widget_id": "basket",
            },
        )


def test_non_empty_workspace_widget_cannot_be_stored() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "gross_balance",
            "anchor": "top-left",
            "offset_x": 364,
            "offset_y": 886,
        },
    )
    apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    move_basket_tool_to_gross_balance(service, experiment.id)

    with pytest.raises(ValueError, match=r"Empty Gross balance before storing it."):
        apply_command(
            service,
            experiment.id,
            "store_workspace_widget",
            {
                "widget_id": "gross_balance",
            },
        )


def test_rack_with_loaded_vials_cannot_be_stored() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "add_workspace_widget",
        {
            "widget_id": "rack",
            "anchor": "top-left",
            "offset_x": 234,
            "offset_y": 886,
        },
    )
    loaded = place_tool_in_rack_slot(service, experiment.id, "rack_slot_1", "sample_vial_lcms")
    rack_widget = next(widget for widget in loaded.workspace.widgets if widget.id == "rack")
    assert rack_widget.is_storable is True
    assert rack_widget.can_store is False
    assert rack_widget.allowed_drop_targets == []

    with pytest.raises(ValueError, match=r"Empty Autosampler rack before storing it."):
        apply_command(
            service,
            experiment.id,
            "store_workspace_widget",
            {
                "widget_id": "rack",
            },
        )


def test_create_produce_lot_adds_apple_lot_to_basket() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )

    assert updated.basket_tools[-1].produce_lots[0].produce_type == "apple"
    assert updated.basket_tools[-1].produce_lots[0].label == "Apple lot 1"
    assert updated.basket_tools[-1].produce_lots[0].unit_count == 12
    assert updated.basket_tools[-1].produce_lots[0].total_mass_g == 2450.0
    assert _material_state_name(updated, updated.basket_tools[-1].produce_lots[0].id) == "whole"
    assert updated.audit_log[-1] == "Apple lot 1 created in Produce basket."


def test_cut_workbench_produce_lot_on_cutting_board_marks_lot_as_cut() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "cutting_board_hdpe",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "cut_workbench_produce_lot",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert _material_state_name(updated, slot.tool.produce_lots[0].id) == "cut"
    matching_state = next(state for state in updated.produce_material_states if state.produce_lot_id == produce_lot_id)
    assert matching_state.material_state == "cut"
    assert updated.audit_log[-1] == "Apple lot 1 cut on Cutting board."


def test_cut_workbench_surface_produce_lot_marks_lot_as_cut() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    created = apply_command(
        service,
        experiment.id,
        "create_produce_lot",
        {
            "produce_type": "apple",
        },
    )
    produce_lot_id = created.basket_tools[-1].produce_lots[0].id
    apply_command(
        service,
        experiment.id,
        "add_produce_lot_to_workbench_tool",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "cut_workbench_produce_lot",
        {
            "slot_id": "station_1",
            "produce_lot_id": produce_lot_id,
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert _material_state_name(updated, slot.surface_produce_lots[0].id) == "cut"
    assert _fraction_is_contaminated(slot.surface_produce_fractions, slot.surface_produce_lots[0].id) is True
    matching_state = next(state for state in updated.produce_material_states if state.produce_lot_id == produce_lot_id)
    assert matching_state.material_state == "cut"
    assert updated.audit_log[-1] == "Apple lot 1 cut on Station 1."


def test_create_produce_lot_rejects_unknown_produce_type() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    with pytest.raises(ValueError, match=r"Unsupported produce type"):
        apply_command(
            service,
            experiment.id,
            "create_produce_lot",
            {
                "produce_type": "pear",
            },
        )


def test_place_tool_in_rack_slot_creates_a_vial_directly_from_the_palette() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = apply_command(
        service,
        experiment.id,
        "place_tool_in_rack_slot",
        {
            "rack_slot_id": "rack_slot_1",
            "tool_id": "sample_vial_lcms",
        },
    )

    assert updated.rack.slots[0].tool is not None
    assert updated.rack.slots[0].tool.label == "Autosampler vial"
    assert updated.workbench.slots[0].tool is None
    assert updated.audit_log[-1] == "Autosampler vial placed in Position 1."


def test_restore_trashed_tool_to_workbench_slot_restores_saved_tool_state() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sample_vial_lcms",
        },
    )
    apply_command(
        service,
        experiment.id,
        "add_liquid_to_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_id": "acetonitrile_extraction",
        },
    )
    discarded = apply_command(
        service,
        experiment.id,
        "discard_workbench_tool",
        {
            "slot_id": "station_1",
        },
    )

    restored = apply_command(
        service,
        experiment.id,
        "restore_trashed_tool_to_workbench_slot",
        {
            "trash_tool_id": discarded.trash.children[0].id,
            "target_slot_id": "station_2",
        },
    )

    assert restored.workbench.slots[1].tool is not None
    assert restored.workbench.slots[1].tool.label == "Autosampler vial"
    assert restored.workbench.slots[1].tool.liquids[0].volume_ml == 2.0
    assert restored.trash.children == []
    assert restored.audit_log[-1] == "Autosampler vial restored from trash to Station 2."


def test_place_workbench_tool_in_rack_slot_moves_vial_into_rack() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sample_vial_lcms",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "place_workbench_tool_in_rack_slot",
        {
            "source_slot_id": "station_1",
            "rack_slot_id": "rack_slot_1",
        },
    )

    assert updated.workbench.slots[0].tool is None
    assert updated.rack.slots[0].tool is not None
    assert updated.rack.slots[0].tool.label == "Autosampler vial"
    assert updated.audit_log[-1] == "Autosampler vial moved from Station 1 to Position 1."


def test_remove_rack_tool_to_workbench_slot_moves_vial_back_to_bench() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sample_vial_lcms",
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_workbench_tool_in_rack_slot",
        {
            "source_slot_id": "station_1",
            "rack_slot_id": "rack_slot_1",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "remove_rack_tool_to_workbench_slot",
        {
            "rack_slot_id": "rack_slot_1",
            "target_slot_id": "station_2",
        },
    )

    assert updated.rack.slots[0].tool is None
    assert updated.workbench.slots[1].tool is not None
    assert updated.workbench.slots[1].tool.label == "Autosampler vial"
    assert updated.audit_log[-1] == "Autosampler vial moved from Position 1 to Station 2."


def test_move_rack_tool_between_slots_moves_vial_within_rack() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sample_vial_lcms",
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_workbench_tool_in_rack_slot",
        {
            "source_slot_id": "station_1",
            "rack_slot_id": "rack_slot_1",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "move_rack_tool_between_slots",
        {
            "source_rack_slot_id": "rack_slot_1",
            "target_rack_slot_id": "rack_slot_2",
        },
    )

    assert updated.rack.slots[0].tool is None
    assert updated.rack.slots[1].tool is not None
    assert updated.rack.slots[1].tool.label == "Autosampler vial"
    assert updated.audit_log[-1] == "Autosampler vial moved from Position 1 to Position 2."


def test_discard_rack_tool_removes_it_from_rack() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sample_vial_lcms",
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_workbench_tool_in_rack_slot",
        {
            "source_slot_id": "station_1",
            "rack_slot_id": "rack_slot_1",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "discard_rack_tool",
        {
            "rack_slot_id": "rack_slot_1",
        },
    )

    assert updated.rack.slots[0].tool is None
    assert len(updated.trash.children) == 1
    assert updated.trash.discarded_from[updated.trash.children[0].id] == "Position 1"
    assert updated.trash.children[0].label == "Autosampler vial"
    assert updated.audit_log[-1] == "Autosampler vial discarded from Position 1."


def test_restore_trashed_tool_to_rack_slot_restores_vial_to_rack() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sample_vial_lcms",
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_workbench_tool_in_rack_slot",
        {
            "source_slot_id": "station_1",
            "rack_slot_id": "rack_slot_1",
        },
    )
    discarded = apply_command(
        service,
        experiment.id,
        "discard_rack_tool",
        {
            "rack_slot_id": "rack_slot_1",
        },
    )

    restored = apply_command(
        service,
        experiment.id,
        "restore_trashed_tool_to_rack_slot",
        {
            "trash_tool_id": discarded.trash.children[0].id,
            "rack_slot_id": "rack_slot_2",
        },
    )

    assert restored.rack.slots[1].tool is not None
    assert restored.rack.slots[1].tool.label == "Autosampler vial"
    assert restored.trash.children == []
    assert restored.audit_log[-1] == "Autosampler vial restored from trash to Position 2."


def test_add_liquid_uses_remaining_capacity_for_small_tools() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sample_vial_lcms",
        },
    )

    updated = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_id": "acetonitrile_extraction",
        },
    )

    slot = next(slot for slot in updated.workbench.slots if slot.id == "station_1")
    assert slot.tool is not None
    assert slot.tool.liquids[0].volume_ml == 2.0
    assert updated.audit_log[-1] == "Acetonitrile added to Autosampler vial at 2 mL (remaining capacity)."


def test_get_experiment_raises_for_unknown_id() -> None:
    service = ExperimentRuntimeService()

    with pytest.raises(KeyError):
        service.get_experiment("missing")


def test_apply_command_raises_for_unknown_experiment() -> None:
    service = ExperimentRuntimeService()

    with pytest.raises(KeyError):
        apply_command(service, "missing", "place_tool_on_workbench", {})


def test_add_liquid_requires_a_placed_tool() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    with pytest.raises(ValueError, match=r"Place a tool on Station 1 before adding liquids."):
        apply_command(
            service,
            experiment.id,
            "add_liquid_to_workbench_tool",
            {
                "slot_id": "station_1",
                "liquid_id": "acetonitrile_extraction",
            },
        )


def test_remove_liquid_requires_a_known_tool_and_liquid() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    with pytest.raises(ValueError, match=r"Place a tool on Station 1 before editing liquids."):
        apply_command(
            service,
            experiment.id,
            "remove_liquid_from_workbench_tool",
            {
                "slot_id": "station_1",
                "liquid_entry_id": "bench_liquid_missing",
            },
        )

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "centrifuge_tube_50ml",
        },
    )

    with pytest.raises(ValueError, match=r"Unknown workbench liquid"):
        apply_command(
            service,
            experiment.id,
            "remove_liquid_from_workbench_tool",
            {
                "slot_id": "station_1",
                "liquid_entry_id": "bench_liquid_missing",
            },
        )


def test_move_tool_requires_a_source_tool_and_empty_target() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    with pytest.raises(ValueError, match=r"Place a tool on Station 1 before moving it."):
        apply_command(
            service,
            experiment.id,
            "move_tool_between_workbench_slots",
            {
                "source_slot_id": "station_1",
                "target_slot_id": "station_2",
            },
        )


def test_rack_commands_require_vials_present_and_compatible() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    with pytest.raises(ValueError, match=r"Place a tool on Station 1 before moving it into the rack."):
        apply_command(
            service,
            experiment.id,
            "place_workbench_tool_in_rack_slot",
            {
                "source_slot_id": "station_1",
                "rack_slot_id": "rack_slot_1",
            },
        )

    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "centrifuge_tube_50ml",
        },
    )
    with pytest.raises(ValueError, match=r"Only autosampler vials can be placed in the rack."):
        apply_command(
            service,
            experiment.id,
            "place_workbench_tool_in_rack_slot",
            {
                "source_slot_id": "station_1",
                "rack_slot_id": "rack_slot_1",
            },
        )

    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sample_vial_lcms",
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_workbench_tool_in_rack_slot",
        {
            "source_slot_id": "station_1",
            "rack_slot_id": "rack_slot_1",
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_2",
            "tool_id": "sample_vial_lcms",
        },
    )

    with pytest.raises(ValueError, match=r"Position 1 already contains a vial"):
        apply_command(
            service,
            experiment.id,
            "place_workbench_tool_in_rack_slot",
            {
                "source_slot_id": "station_2",
                "rack_slot_id": "rack_slot_1",
            },
        )

    with pytest.raises(ValueError, match=r"Place a vial in Position 2 before moving it back to the bench."):
        apply_command(
            service,
            experiment.id,
            "remove_rack_tool_to_workbench_slot",
            {
                "rack_slot_id": "rack_slot_2",
                "target_slot_id": "station_1",
            },
        )

    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "sample_vial_lcms",
        },
    )
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_2",
            "tool_id": "centrifuge_tube_50ml",
        },
    )

    with pytest.raises(ValueError, match=r"Station 2 already contains a tool"):
        apply_command(
            service,
            experiment.id,
            "move_tool_between_workbench_slots",
            {
                "source_slot_id": "station_1",
                "target_slot_id": "station_2",
            },
        )


def test_update_volume_rounds_float_noise_in_audit_log() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "centrifuge_tube_50ml",
        },
    )
    updated = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_id": "acetonitrile_extraction",
        },
    )

    assert updated.workbench.slots[0].tool is not None
    liquid_id = updated.workbench.slots[0].tool.liquids[0].id
    updated = apply_command(
        service,
        experiment.id,
        "update_workbench_liquid_volume",
        {
            "slot_id": "station_1",
            "liquid_entry_id": liquid_id,
            "volume_ml": 22.799999999999,
        },
    )

    assert updated.audit_log[-1] == "Acetonitrile adjusted to 22.8 mL in 50 mL centrifuge tube."


def test_add_liquid_volume_capacity_includes_ground_powder_volume() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    apply_command(
        service,
        experiment.id,
        "place_tool_on_workbench",
        {
            "slot_id": "station_1",
            "tool_id": "centrifuge_tube_50ml",
        },
    )

    runtime_experiment = service._require_experiment(experiment.id)
    runtime_experiment.produce_material_states = [ProduceMaterialState(id="state_powder", produce_lot_id="lot_1", material_state="ground")]
    tool = runtime_experiment.workbench.slots[0].tool
    assert tool is not None
    tool.produce_fractions = [
        ProduceFraction(
            id="produce_fraction_1",
            produce_lot_id="lot_1",
            produce_material_state_id="state_powder",
            mass_g=12.5,
            location_kind="workbench_tool",
            location_id="station_1",
            container_id=tool.id,
            container_label=tool.label,
        )
    ]

    updated = apply_command(
        service,
        experiment.id,
        "add_liquid_to_workbench_tool",
        {
            "slot_id": "station_1",
            "liquid_id": "acetonitrile_extraction",
            "volume_ml": 40.0,
        },
    )

    assert updated.workbench.slots[0].tool is not None
    assert updated.workbench.slots[0].tool.liquids[0].volume_ml == 25.0
    assert updated.audit_log[-1] == "Acetonitrile added to 50 mL centrifuge tube at 25 mL (remaining capacity)."
