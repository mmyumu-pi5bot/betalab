from app.schemas.experiment import (
    DebugProducePresetSpawnToWorkbenchSchema,
    ExperimentSchema,
    WorkbenchProduceLotMoveSchema,
    WorkbenchSlotReferenceSchema,
    WorkbenchToolProduceLotCreateSchema,
)
from app.services.domain_services.debug import (
    CreateDebugProduceLotOnWorkbenchRequest,
    CreateDebugProduceLotOnWorkbenchService,
)
from app.services.domain_services.workbench import (
    AddProduceLotToWorkbenchToolRequest,
    AddProduceLotToWorkbenchToolService,
    CutWorkbenchProduceLotService,
    DiscardProduceLotFromWorkbenchToolService,
    MoveProduceLotBetweenWorkbenchToolsRequest,
    MoveProduceLotBetweenWorkbenchToolsService,
    WorkbenchProduceLotRequest,
)

from .common import (
    experiment_service,
    find_tool_slot,
    handle_service_errors,
    router,
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
