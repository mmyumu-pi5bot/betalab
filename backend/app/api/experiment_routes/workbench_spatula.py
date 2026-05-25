from app.schemas.experiment import (
    ExperimentSchema,
    WorkbenchToolPowderPourSchema,
)
from app.services.domain_services.workbench import (
    DiscardSpatulaService,
    LoadSpatulaFromWorkbenchToolService,
    PourSpatulaIntoWorkbenchToolRequest,
    PourSpatulaIntoWorkbenchToolService,
    WorkbenchSlotRequest,
)

from .common import (
    experiment_service,
    find_tool_slot,
    handle_service_errors,
    router,
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
