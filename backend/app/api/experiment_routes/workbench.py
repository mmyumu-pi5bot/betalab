from app.schemas.experiment import (
    ExperimentSchema,
    PaletteToolDiscardSchema,
    WorkbenchToolMoveSchema,
    WorkbenchToolPlacementSchema,
)
from app.services.domain_services.workbench import (
    AddWorkbenchSlotService,
    CloseWorkbenchToolService,
    DiscardToolFromPaletteRequest,
    DiscardToolFromPaletteService,
    DiscardWorkbenchToolService,
    EmptyWorkbenchRequest,
    MoveToolBetweenWorkbenchSlotsRequest,
    MoveToolBetweenWorkbenchSlotsService,
    OpenWorkbenchToolService,
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
    RemoveWorkbenchSlotService,
    StoreWorkbenchToolService,
    WorkbenchSlotRequest,
)

from .common import (
    experiment_service,
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
