from app.schemas.experiment import ExperimentSchema
from app.services.domain_services.vortex import (
    CloseVortexToolService,
    DiscardVortexToolService,
    EmptyRequest,
    MoveAnalyticalBalanceToolToVortexRequest,
    MoveAnalyticalBalanceToolToVortexService,
    MoveGrossBalanceToolToVortexRequest,
    MoveGrossBalanceToolToVortexService,
    MoveRackToolToVortexRequest,
    MoveRackToolToVortexService,
    MoveVortexToolToAnalyticalBalanceRequest,
    MoveVortexToolToAnalyticalBalanceService,
    MoveVortexToolToGrossBalanceRequest,
    MoveVortexToolToGrossBalanceService,
    MoveVortexToolToWorkbenchRequest,
    MoveVortexToolToWorkbenchService,
    MoveWorkbenchToolToVortexRequest,
    MoveWorkbenchToolToVortexService,
    OpenVortexToolService,
    PlaceToolOnVortexRequest,
    PlaceToolOnVortexService,
    RestoreTrashedToolToVortexRequest,
    RestoreTrashedToolToVortexService,
    StartVortexCycleService,
)

from .common import experiment_service, handle_service_errors, router


@router.post(
    "/{experiment_id}/vortex/tool/place",
    response_model=ExperimentSchema,
)
def place_tool_on_vortex(
    experiment_id: str,
    tool_id: str,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: PlaceToolOnVortexService(experiment_service).run(
            experiment_id,
            PlaceToolOnVortexRequest(tool_id=tool_id),
        )
    )


@router.post(
    "/{experiment_id}/vortex/tool/workbench",
    response_model=ExperimentSchema,
)
def move_workbench_tool_to_vortex(
    experiment_id: str,
    source_slot_id: str,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveWorkbenchToolToVortexService(experiment_service).run(
            experiment_id,
            MoveWorkbenchToolToVortexRequest(source_slot_id=source_slot_id),
        )
    )


@router.post(
    "/{experiment_id}/vortex/tool/rack",
    response_model=ExperimentSchema,
)
def move_rack_tool_to_vortex(
    experiment_id: str,
    rack_slot_id: str,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveRackToolToVortexService(experiment_service).run(
            experiment_id,
            MoveRackToolToVortexRequest(rack_slot_id=rack_slot_id),
        )
    )


@router.post(
    "/{experiment_id}/vortex/tool/trash",
    response_model=ExperimentSchema,
)
def restore_trashed_tool_to_vortex(
    experiment_id: str,
    trash_tool_id: str,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: RestoreTrashedToolToVortexService(experiment_service).run(
            experiment_id,
            RestoreTrashedToolToVortexRequest(trash_tool_id=trash_tool_id),
        )
    )


@router.post(
    "/{experiment_id}/vortex/tool/analytical-balance",
    response_model=ExperimentSchema,
)
def move_analytical_balance_tool_to_vortex(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveAnalyticalBalanceToolToVortexService(experiment_service).run(
            experiment_id,
            MoveAnalyticalBalanceToolToVortexRequest(),
        )
    )


@router.post(
    "/{experiment_id}/vortex/tool/gross-balance",
    response_model=ExperimentSchema,
)
def move_gross_balance_tool_to_vortex(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveGrossBalanceToolToVortexService(experiment_service).run(
            experiment_id,
            MoveGrossBalanceToolToVortexRequest(),
        )
    )


@router.post(
    "/{experiment_id}/vortex/tool/move-to-analytical-balance",
    response_model=ExperimentSchema,
)
def move_vortex_tool_to_analytical_balance(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveVortexToolToAnalyticalBalanceService(experiment_service).run(
            experiment_id,
            MoveVortexToolToAnalyticalBalanceRequest(),
        )
    )


@router.post(
    "/{experiment_id}/vortex/tool/move-to-gross-balance",
    response_model=ExperimentSchema,
)
def move_vortex_tool_to_gross_balance(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveVortexToolToGrossBalanceService(experiment_service).run(
            experiment_id,
            MoveVortexToolToGrossBalanceRequest(),
        )
    )


@router.post(
    "/{experiment_id}/vortex/tool/move-to-workbench",
    response_model=ExperimentSchema,
)
def move_vortex_tool_to_workbench(
    experiment_id: str,
    target_slot_id: str,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveVortexToolToWorkbenchService(experiment_service).run(
            experiment_id,
            MoveVortexToolToWorkbenchRequest(target_slot_id=target_slot_id),
        )
    )


@router.post(
    "/{experiment_id}/vortex/tool/discard",
    response_model=ExperimentSchema,
)
def discard_vortex_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DiscardVortexToolService(experiment_service).run(
            experiment_id,
            EmptyRequest(),
        )
    )


@router.post(
    "/{experiment_id}/vortex/tool/close",
    response_model=ExperimentSchema,
)
def close_vortex_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: CloseVortexToolService(experiment_service).run(
            experiment_id,
            EmptyRequest(),
        )
    )


@router.post(
    "/{experiment_id}/vortex/tool/open",
    response_model=ExperimentSchema,
)
def open_vortex_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: OpenVortexToolService(experiment_service).run(
            experiment_id,
            EmptyRequest(),
        )
    )


@router.post(
    "/{experiment_id}/vortex/start",
    response_model=ExperimentSchema,
)
def start_vortex_cycle(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: StartVortexCycleService(experiment_service).run(
            experiment_id,
            EmptyRequest(),
        )
    )
