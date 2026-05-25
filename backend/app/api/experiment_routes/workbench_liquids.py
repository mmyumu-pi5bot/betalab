from app.schemas.experiment import (
    ExperimentSchema,
    WorkbenchToolLiquidCreateSchema,
    WorkbenchToolLiquidUpdateSchema,
)
from app.services.domain_services.workbench import (
    AddLiquidToWorkbenchToolRequest,
    AddLiquidToWorkbenchToolService,
    RemoveLiquidFromWorkbenchToolService,
    UpdateWorkbenchLiquidVolumeRequest,
    UpdateWorkbenchLiquidVolumeService,
    WorkbenchLiquidRequest,
)

from .common import (
    experiment_service,
    find_tool_slot,
    handle_service_errors,
    router,
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
