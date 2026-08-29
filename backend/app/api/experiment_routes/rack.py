from app.schemas.experiment import (
    ExperimentSchema,
    RackToolMoveSchema,
    RackToolMoveToWorkbenchSchema,
    RackToolPlacementSchema,
    RackWorkbenchPlacementSchema,
    TrashToolRestoreToRackSchema,
    TrashToolRestoreToWorkbenchSchema,
)
from app.services.domain_services.rack import (
    CloseRackToolRequest,
    CloseRackToolService,
    DiscardRackToolRequest,
    DiscardRackToolService,
    MoveRackToolBetweenSlotsRequest,
    MoveRackToolBetweenSlotsService,
    OpenRackToolRequest,
    OpenRackToolService,
    PlaceToolInRackSlotRequest,
    PlaceToolInRackSlotService,
    PlaceWorkbenchToolInRackSlotRequest,
    PlaceWorkbenchToolInRackSlotService,
    RemoveRackToolToWorkbenchSlotRequest,
    RemoveRackToolToWorkbenchSlotService,
    RestoreTrashedToolToRackSlotRequest,
    RestoreTrashedToolToRackSlotService,
)
from app.services.domain_services.workbench import (
    RestoreTrashedToolToWorkbenchSlotRequest,
    RestoreTrashedToolToWorkbenchSlotService,
)

from .common import (
    experiment_service,
    find_rack_tool_slot,
    handle_service_errors,
    router,
)


@router.post(
    "/{experiment_id}/rack/slots/{rack_slot_id}/place-tool-from-palette",
    response_model=ExperimentSchema,
)
def place_tool_in_rack_slot(
    experiment_id: str,
    rack_slot_id: str,
    request: RackToolPlacementSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: PlaceToolInRackSlotService(experiment_service).run(
            experiment_id,
            PlaceToolInRackSlotRequest(rack_slot_id=rack_slot_id, tool_id=request.tool_id),
        )
    )


@router.post(
    "/{experiment_id}/rack/slots/{rack_slot_id}/place-tool-from-workbench",
    response_model=ExperimentSchema,
)
def place_workbench_tool_in_rack_slot(
    experiment_id: str,
    rack_slot_id: str,
    request: RackWorkbenchPlacementSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: PlaceWorkbenchToolInRackSlotService(experiment_service).run(
            experiment_id,
            PlaceWorkbenchToolInRackSlotRequest(
                source_slot_id=request.source_slot_id,
                rack_slot_id=rack_slot_id,
            ),
        )
    )


@router.post("/{experiment_id}/rack/tools/{tool_id}/move-to-slot", response_model=ExperimentSchema)
def move_rack_tool_between_slots(
    experiment_id: str,
    tool_id: str,
    request: RackToolMoveSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveRackToolBetweenSlotsService(experiment_service).run(
            experiment_id,
            MoveRackToolBetweenSlotsRequest(
                source_rack_slot_id=find_rack_tool_slot(experiment_id, tool_id),
                target_rack_slot_id=request.target_rack_slot_id,
            ),
        )
    )


@router.post(
    "/{experiment_id}/rack/tools/{tool_id}/move-to-workbench-slot",
    response_model=ExperimentSchema,
)
def remove_rack_tool_to_workbench_slot(
    experiment_id: str,
    tool_id: str,
    request: RackToolMoveToWorkbenchSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: RemoveRackToolToWorkbenchSlotService(experiment_service).run(
            experiment_id,
            RemoveRackToolToWorkbenchSlotRequest(
                rack_slot_id=find_rack_tool_slot(experiment_id, tool_id),
                target_slot_id=request.target_slot_id,
            ),
        )
    )


@router.post("/{experiment_id}/rack/tools/{tool_id}/close", response_model=ExperimentSchema)
def close_rack_tool(experiment_id: str, tool_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: CloseRackToolService(experiment_service).run(
            experiment_id,
            CloseRackToolRequest(rack_slot_id=find_rack_tool_slot(experiment_id, tool_id)),
        )
    )


@router.post("/{experiment_id}/rack/tools/{tool_id}/open", response_model=ExperimentSchema)
def open_rack_tool(experiment_id: str, tool_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: OpenRackToolService(experiment_service).run(
            experiment_id,
            OpenRackToolRequest(rack_slot_id=find_rack_tool_slot(experiment_id, tool_id)),
        )
    )


@router.post("/{experiment_id}/rack/tools/{tool_id}/discard", response_model=ExperimentSchema)
def discard_rack_tool(experiment_id: str, tool_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DiscardRackToolService(experiment_service).run(
            experiment_id,
            DiscardRackToolRequest(rack_slot_id=find_rack_tool_slot(experiment_id, tool_id)),
        )
    )


@router.post(
    "/{experiment_id}/trash/tools/{entry_id}/restore-to-workbench",
    response_model=ExperimentSchema,
)
def restore_trashed_tool_to_workbench_slot(
    experiment_id: str,
    entry_id: str,
    request: TrashToolRestoreToWorkbenchSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: RestoreTrashedToolToWorkbenchSlotService(experiment_service).run(
            experiment_id,
            RestoreTrashedToolToWorkbenchSlotRequest(
                trash_tool_id=entry_id,
                target_slot_id=request.target_slot_id,
            ),
        )
    )


@router.post("/{experiment_id}/trash/tools/{entry_id}/restore-to-rack", response_model=ExperimentSchema)
def restore_trashed_tool_to_rack_slot(
    experiment_id: str,
    entry_id: str,
    request: TrashToolRestoreToRackSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: RestoreTrashedToolToRackSlotService(experiment_service).run(
            experiment_id,
            RestoreTrashedToolToRackSlotRequest(
                trash_tool_id=entry_id,
                rack_slot_id=request.rack_slot_id,
            ),
        )
    )
