from app.schemas.experiment import (
    DebugProducePresetSpawnToWorkbenchSchema,
    ExperimentSchema,
    PaletteToolDiscardSchema,
    TrashSampleLabelRestoreSchema,
    WorkbenchProduceLotMoveSchema,
    WorkbenchSlotReferenceSchema,
    WorkbenchToolLiquidCreateSchema,
    WorkbenchToolLiquidUpdateSchema,
    WorkbenchToolMoveSchema,
    WorkbenchToolPlacementSchema,
    WorkbenchToolPowderPourSchema,
    WorkbenchToolProduceLotCreateSchema,
    WorkbenchToolSampleLabelMoveSchema,
    WorkbenchToolSampleLabelUpdateSchema,
)
from app.services.domain_services.debug import (
    CreateDebugProduceLotOnWorkbenchRequest,
    CreateDebugProduceLotOnWorkbenchService,
)
from app.services.domain_services.workbench import (
    AddLiquidToWorkbenchToolRequest,
    AddLiquidToWorkbenchToolService,
    AddProduceLotToWorkbenchToolRequest,
    AddProduceLotToWorkbenchToolService,
    AddWorkbenchSlotService,
    ApplySampleLabelToWorkbenchToolService,
    CloseWorkbenchToolService,
    CutWorkbenchProduceLotService,
    DiscardProduceLotFromWorkbenchToolService,
    DiscardSampleLabelFromPaletteRequest,
    DiscardSampleLabelFromPaletteService,
    DiscardSampleLabelFromWorkbenchToolService,
    DiscardSpatulaService,
    DiscardToolFromPaletteRequest,
    DiscardToolFromPaletteService,
    DiscardWorkbenchToolService,
    EmptyWorkbenchRequest,
    LoadSpatulaFromWorkbenchToolService,
    MoveProduceLotBetweenWorkbenchToolsRequest,
    MoveProduceLotBetweenWorkbenchToolsService,
    MoveSampleLabelBetweenWorkbenchToolsRequest,
    MoveSampleLabelBetweenWorkbenchToolsService,
    MoveToolBetweenWorkbenchSlotsRequest,
    MoveToolBetweenWorkbenchSlotsService,
    OpenWorkbenchToolService,
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
    PourSpatulaIntoWorkbenchToolRequest,
    PourSpatulaIntoWorkbenchToolService,
    RemoveLiquidFromWorkbenchToolService,
    RemoveWorkbenchSlotService,
    RestoreTrashedSampleLabelToWorkbenchToolRequest,
    RestoreTrashedSampleLabelToWorkbenchToolService,
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

from .common import (
    experiment_service,
    find_default_tool_label_id,
    find_tool_slot,
    handle_service_errors,
    router,
)


@router.post("/{experiment_id}/workbench/slots", response_model=ExperimentSchema)
def add_workbench_slot(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: AddWorkbenchSlotService(experiment_service).run(experiment_id, EmptyWorkbenchRequest()))


@router.delete("/{experiment_id}/workbench/slots/{slot_id}", response_model=ExperimentSchema)
def remove_workbench_slot(experiment_id: str, slot_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: RemoveWorkbenchSlotService(experiment_service).run(experiment_id, WorkbenchSlotRequest(slot_id=slot_id)))


@router.post("/{experiment_id}/workbench/slots/{slot_id}/place-tool", response_model=ExperimentSchema)
def place_tool_on_workbench(
    experiment_id: str,
    slot_id: str,
    request: WorkbenchToolPlacementSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: PlaceToolOnWorkbenchService(experiment_service).run(
            experiment_id,
            PlaceToolOnWorkbenchRequest(slot_id=slot_id, tool_id=request.tool_id),
        )
    )


@router.post("/{experiment_id}/workbench/tools/{tool_id}/move-to-slot", response_model=ExperimentSchema)
def move_tool_between_workbench_slots(
    experiment_id: str,
    tool_id: str,
    request: WorkbenchToolMoveSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveToolBetweenWorkbenchSlotsService(experiment_service).run(
            experiment_id,
            MoveToolBetweenWorkbenchSlotsRequest(
                source_slot_id=find_tool_slot(experiment_id, tool_id),
                target_slot_id=request.target_slot_id,
            ),
        )
    )


@router.post("/{experiment_id}/workbench/tools/{tool_id}/discard", response_model=ExperimentSchema)
def discard_workbench_tool(experiment_id: str, tool_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DiscardWorkbenchToolService(experiment_service).run(
            experiment_id,
            WorkbenchSlotRequest(slot_id=find_tool_slot(experiment_id, tool_id)),
        )
    )


@router.post("/{experiment_id}/workbench/tools/{tool_id}/store", response_model=ExperimentSchema)
def store_workbench_tool(experiment_id: str, tool_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: StoreWorkbenchToolService(experiment_service).run(
            experiment_id,
            WorkbenchSlotRequest(slot_id=find_tool_slot(experiment_id, tool_id)),
        )
    )


@router.post("/{experiment_id}/workbench/tools/{tool_id}/liquids", response_model=ExperimentSchema)
def add_liquid_to_workbench_tool(
    experiment_id: str,
    tool_id: str,
    request: WorkbenchToolLiquidCreateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: AddLiquidToWorkbenchToolService(experiment_service).run(
            experiment_id,
            AddLiquidToWorkbenchToolRequest(
                slot_id=find_tool_slot(experiment_id, tool_id),
                liquid_id=request.liquid_id,
                volume_ml=request.volume_ml,
            ),
        )
    )


@router.patch(
    "/{experiment_id}/workbench/tools/{tool_id}/liquids/{liquid_id}",
    response_model=ExperimentSchema,
)
def update_workbench_liquid_volume(
    experiment_id: str,
    tool_id: str,
    liquid_id: str,
    request: WorkbenchToolLiquidUpdateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: UpdateWorkbenchLiquidVolumeService(experiment_service).run(
            experiment_id,
            UpdateWorkbenchLiquidVolumeRequest(
                slot_id=find_tool_slot(experiment_id, tool_id),
                liquid_entry_id=liquid_id,
                volume_ml=request.volume_ml,
            ),
        )
    )


@router.delete(
    "/{experiment_id}/workbench/tools/{tool_id}/liquids/{liquid_id}",
    response_model=ExperimentSchema,
)
def remove_liquid_from_workbench_tool(
    experiment_id: str,
    tool_id: str,
    liquid_id: str,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: RemoveLiquidFromWorkbenchToolService(experiment_service).run(
            experiment_id,
            WorkbenchLiquidRequest(
                slot_id=find_tool_slot(experiment_id, tool_id),
                liquid_entry_id=liquid_id,
            ),
        )
    )


@router.post("/{experiment_id}/workbench/tools/{tool_id}/sample-label", response_model=ExperimentSchema)
def apply_sample_label_to_workbench_tool(experiment_id: str, tool_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: ApplySampleLabelToWorkbenchToolService(experiment_service).run(
            experiment_id,
            WorkbenchSlotRequest(slot_id=find_tool_slot(experiment_id, tool_id)),
        )
    )


@router.post("/{experiment_id}/workbench/tools/{tool_id}/close", response_model=ExperimentSchema)
def close_workbench_tool(experiment_id: str, tool_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: CloseWorkbenchToolService(experiment_service).run(
            experiment_id,
            WorkbenchSlotRequest(slot_id=find_tool_slot(experiment_id, tool_id)),
        )
    )


@router.post("/{experiment_id}/workbench/tools/{tool_id}/open", response_model=ExperimentSchema)
def open_workbench_tool(experiment_id: str, tool_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: OpenWorkbenchToolService(experiment_service).run(
            experiment_id,
            WorkbenchSlotRequest(slot_id=find_tool_slot(experiment_id, tool_id)),
        )
    )


@router.post("/{experiment_id}/spatula/discard", response_model=ExperimentSchema)
def discard_spatula(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: DiscardSpatulaService(experiment_service).run(experiment_id, None))


@router.post("/{experiment_id}/workbench/tools/{tool_id}/spatula/load", response_model=ExperimentSchema)
def load_spatula_from_workbench_tool(experiment_id: str, tool_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: LoadSpatulaFromWorkbenchToolService(experiment_service).run(
            experiment_id,
            WorkbenchSlotRequest(slot_id=find_tool_slot(experiment_id, tool_id)),
        )
    )


@router.post("/{experiment_id}/workbench/tools/{tool_id}/spatula/pour", response_model=ExperimentSchema)
def pour_spatula_into_workbench_tool(
    experiment_id: str,
    tool_id: str,
    request: WorkbenchToolPowderPourSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: PourSpatulaIntoWorkbenchToolService(experiment_service).run(
            experiment_id,
            PourSpatulaIntoWorkbenchToolRequest(
                slot_id=find_tool_slot(experiment_id, tool_id),
                delta_mass_g=request.delta_mass_g,
            ),
        )
    )


@router.patch(
    "/{experiment_id}/workbench/tools/{tool_id}/sample-labels/{label_id}",
    response_model=ExperimentSchema,
)
def update_workbench_tool_sample_label_text(
    experiment_id: str,
    tool_id: str,
    label_id: str,
    request: WorkbenchToolSampleLabelUpdateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: UpdateWorkbenchToolSampleLabelTextService(experiment_service).run(
            experiment_id,
            UpdateWorkbenchToolSampleLabelTextRequest(
                slot_id=find_tool_slot(experiment_id, tool_id),
                label_id=label_id,
                sample_label_text=request.sample_label_text,
            ),
        )
    )


@router.patch("/{experiment_id}/workbench/tools/{tool_id}/sample-label", response_model=ExperimentSchema)
def update_workbench_tool_primary_sample_label_text(
    experiment_id: str,
    tool_id: str,
    request: WorkbenchToolSampleLabelUpdateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: UpdateWorkbenchToolSampleLabelTextService(experiment_service).run(
            experiment_id,
            UpdateWorkbenchToolSampleLabelTextRequest(
                slot_id=find_tool_slot(experiment_id, tool_id),
                label_id=find_default_tool_label_id(experiment_id, tool_id),
                sample_label_text=request.sample_label_text,
            ),
        )
    )


@router.post(
    "/{experiment_id}/workbench/tools/{tool_id}/sample-labels/{label_id}/move-to-tool",
    response_model=ExperimentSchema,
)
def move_sample_label_between_workbench_tools(
    experiment_id: str,
    tool_id: str,
    label_id: str,
    request: WorkbenchToolSampleLabelMoveSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveSampleLabelBetweenWorkbenchToolsService(experiment_service).run(
            experiment_id,
            MoveSampleLabelBetweenWorkbenchToolsRequest(
                source_slot_id=find_tool_slot(experiment_id, tool_id),
                target_slot_id=find_tool_slot(experiment_id, request.target_tool_id),
                label_id=label_id,
            ),
        )
    )


@router.post(
    "/{experiment_id}/workbench/tools/{tool_id}/sample-label/move-to-tool",
    response_model=ExperimentSchema,
)
def move_primary_sample_label_between_workbench_tools(
    experiment_id: str,
    tool_id: str,
    request: WorkbenchToolSampleLabelMoveSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveSampleLabelBetweenWorkbenchToolsService(experiment_service).run(
            experiment_id,
            MoveSampleLabelBetweenWorkbenchToolsRequest(
                source_slot_id=find_tool_slot(experiment_id, tool_id),
                target_slot_id=find_tool_slot(experiment_id, request.target_tool_id),
                label_id=find_default_tool_label_id(experiment_id, tool_id),
            ),
        )
    )


@router.delete(
    "/{experiment_id}/workbench/tools/{tool_id}/sample-labels/{label_id}",
    response_model=ExperimentSchema,
)
def discard_sample_label_from_workbench_tool(
    experiment_id: str,
    tool_id: str,
    label_id: str,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DiscardSampleLabelFromWorkbenchToolService(experiment_service).run(
            experiment_id,
            WorkbenchSampleLabelRequest(
                slot_id=find_tool_slot(experiment_id, tool_id),
                label_id=label_id,
            ),
        )
    )


@router.delete("/{experiment_id}/workbench/tools/{tool_id}/sample-label", response_model=ExperimentSchema)
def discard_primary_sample_label_from_workbench_tool(
    experiment_id: str,
    tool_id: str,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DiscardSampleLabelFromWorkbenchToolService(experiment_service).run(
            experiment_id,
            WorkbenchSampleLabelRequest(
                slot_id=find_tool_slot(experiment_id, tool_id),
                label_id=find_default_tool_label_id(experiment_id, tool_id),
            ),
        )
    )


@router.post("/{experiment_id}/workbench/tools/{tool_id}/add-produce-lot", response_model=ExperimentSchema)
def add_produce_lot_to_workbench_tool(
    experiment_id: str,
    tool_id: str,
    request: WorkbenchToolProduceLotCreateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: AddProduceLotToWorkbenchToolService(experiment_service).run(
            experiment_id,
            AddProduceLotToWorkbenchToolRequest(
                slot_id=find_tool_slot(experiment_id, tool_id),
                produce_lot_id=request.produce_lot_id,
            ),
        )
    )


@router.post("/{experiment_id}/workbench/slots/{slot_id}/add-produce-lot", response_model=ExperimentSchema)
def add_produce_lot_to_workbench_slot(
    experiment_id: str,
    slot_id: str,
    request: WorkbenchToolProduceLotCreateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: AddProduceLotToWorkbenchToolService(experiment_service).run(
            experiment_id,
            AddProduceLotToWorkbenchToolRequest(
                slot_id=slot_id,
                produce_lot_id=request.produce_lot_id,
            ),
        )
    )


@router.post(
    "/{experiment_id}/debug/produce-presets/{preset_id}/spawn-on-workbench",
    response_model=ExperimentSchema,
)
def create_debug_produce_lot_on_workbench(
    experiment_id: str,
    preset_id: str,
    request: DebugProducePresetSpawnToWorkbenchSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: CreateDebugProduceLotOnWorkbenchService(experiment_service).run(
            experiment_id,
            CreateDebugProduceLotOnWorkbenchRequest(
                preset_id=preset_id,
                target_slot_id=request.target_slot_id,
                total_mass_g=request.total_mass_g,
                temperature_c=request.temperature_c,
                residual_co2_mass_g=request.residual_co2_mass_g,
            ),
        )
    )


@router.post(
    "/{experiment_id}/workbench/produce-lots/{produce_lot_id}/move-to-tool",
    response_model=ExperimentSchema,
)
def move_produce_lot_between_workbench_tools(
    experiment_id: str,
    produce_lot_id: str,
    request: WorkbenchProduceLotMoveSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveProduceLotBetweenWorkbenchToolsService(experiment_service).run(
            experiment_id,
            MoveProduceLotBetweenWorkbenchToolsRequest(
                source_slot_id=request.source_slot_id,
                target_slot_id=request.target_slot_id,
                produce_lot_id=produce_lot_id,
            ),
        )
    )


@router.post("/{experiment_id}/workbench/produce-lots/{produce_lot_id}/cut", response_model=ExperimentSchema)
def cut_workbench_produce_lot(
    experiment_id: str,
    produce_lot_id: str,
    request: WorkbenchSlotReferenceSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: CutWorkbenchProduceLotService(experiment_service).run(
            experiment_id,
            WorkbenchProduceLotRequest(slot_id=request.slot_id, produce_lot_id=produce_lot_id),
        )
    )


@router.post(
    "/{experiment_id}/workbench/produce-lots/{produce_lot_id}/discard",
    response_model=ExperimentSchema,
)
def discard_produce_lot_from_workbench_tool(
    experiment_id: str,
    produce_lot_id: str,
    request: WorkbenchSlotReferenceSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DiscardProduceLotFromWorkbenchToolService(experiment_service).run(
            experiment_id,
            WorkbenchProduceLotRequest(slot_id=request.slot_id, produce_lot_id=produce_lot_id),
        )
    )


@router.post("/{experiment_id}/palette/tools/discard", response_model=ExperimentSchema)
def discard_tool_from_palette(
    experiment_id: str,
    request: PaletteToolDiscardSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DiscardToolFromPaletteService(experiment_service).run(
            experiment_id,
            DiscardToolFromPaletteRequest(tool_id=request.tool_id),
        )
    )


@router.post("/{experiment_id}/palette/sample-labels/discard", response_model=ExperimentSchema)
def discard_sample_label_from_palette(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DiscardSampleLabelFromPaletteService(experiment_service).run(
            experiment_id,
            DiscardSampleLabelFromPaletteRequest(sample_label_id="sampling_bag_label"),
        )
    )


@router.post(
    "/{experiment_id}/trash/sample-labels/{entry_id}/restore-to-workbench-tool",
    response_model=ExperimentSchema,
)
def restore_trashed_sample_label_to_workbench_tool(
    experiment_id: str,
    entry_id: str,
    request: TrashSampleLabelRestoreSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: RestoreTrashedSampleLabelToWorkbenchToolService(experiment_service).run(
            experiment_id,
            RestoreTrashedSampleLabelToWorkbenchToolRequest(
                trash_sample_label_id=entry_id,
                target_slot_id=find_tool_slot(experiment_id, request.target_tool_id),
            ),
        )
    )
