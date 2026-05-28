from app.schemas.experiment import (
    BasketToolReferenceSchema,
    ExperimentSchema,
    ProduceLotReferenceSchema,
    RackSlotReferenceSchema,
    TargetWorkbenchSlotSchema,
    WorkbenchSlotReferenceSchema,
    WorkbenchToolPlacementSchema,
)
from app.services.domain_services.gross_balance import (
    ApplySampleLabelToGrossBalanceToolService,
    CloseGrossBalanceToolService,
    DiscardGrossBalanceProduceLotRequest,
    DiscardGrossBalanceProduceLotService,
    DiscardGrossBalanceToolService,
    EmptyRequest,
    MoveAnalyticalBalanceToolToGrossBalanceRequest,
    MoveAnalyticalBalanceToolToGrossBalanceService,
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

from .common import experiment_service, handle_service_errors, router


@router.post("/{experiment_id}/gross-balance/place-workbench-tool", response_model=ExperimentSchema)
def move_workbench_tool_to_gross_balance(
    experiment_id: str,
    request: WorkbenchSlotReferenceSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveWorkbenchToolToGrossBalanceService(experiment_service).run(
            experiment_id,
            MoveWorkbenchToolToGrossBalanceRequest(source_slot_id=request.slot_id),
        )
    )


@router.post("/{experiment_id}/gross-balance/place-basket-tool", response_model=ExperimentSchema)
def move_basket_tool_to_gross_balance(experiment_id: str, request: BasketToolReferenceSchema) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveBasketToolToGrossBalanceService(experiment_service).run(
            experiment_id, MoveBasketToolToGrossBalanceRequest(tool_id=request.tool_id)
        )
    )


@router.post("/{experiment_id}/gross-balance/place-tool", response_model=ExperimentSchema)
def place_tool_on_gross_balance(
    experiment_id: str,
    request: WorkbenchToolPlacementSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: PlaceToolOnGrossBalanceService(experiment_service).run(
            experiment_id,
            PlaceToolOnGrossBalanceRequest(tool_id=request.tool_id),
        )
    )


@router.post("/{experiment_id}/gross-balance/place-rack-tool", response_model=ExperimentSchema)
def move_rack_tool_to_gross_balance(
    experiment_id: str,
    request: RackSlotReferenceSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveRackToolToGrossBalanceService(experiment_service).run(
            experiment_id,
            MoveRackToolToGrossBalanceRequest(rack_slot_id=request.rack_slot_id),
        )
    )


@router.post("/{experiment_id}/gross-balance/place-analytical-balance-tool", response_model=ExperimentSchema)
def move_analytical_balance_tool_to_gross_balance(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveAnalyticalBalanceToolToGrossBalanceService(experiment_service).run(
            experiment_id, MoveAnalyticalBalanceToolToGrossBalanceRequest()
        )
    )


@router.post(
    "/{experiment_id}/gross-balance/restore-trash-tool/{trash_tool_id}",
    response_model=ExperimentSchema,
)
def restore_trashed_tool_to_gross_balance(
    experiment_id: str,
    trash_tool_id: str,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: RestoreTrashedToolToGrossBalanceService(experiment_service).run(
            experiment_id,
            RestoreTrashedToolToGrossBalanceRequest(trash_tool_id=trash_tool_id),
        )
    )


@router.post("/{experiment_id}/gross-balance/move-tool-to-workbench", response_model=ExperimentSchema)
def move_gross_balance_tool_to_workbench(
    experiment_id: str,
    request: TargetWorkbenchSlotSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveGrossBalanceToolToWorkbenchService(experiment_service).run(
            experiment_id,
            MoveGrossBalanceToolToWorkbenchRequest(target_slot_id=request.target_slot_id),
        )
    )


@router.post("/{experiment_id}/gross-balance/move-tool-to-rack", response_model=ExperimentSchema)
def move_gross_balance_tool_to_rack(
    experiment_id: str,
    request: RackSlotReferenceSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveGrossBalanceToolToRackService(experiment_service).run(
            experiment_id,
            MoveGrossBalanceToolToRackRequest(rack_slot_id=request.rack_slot_id),
        )
    )


@router.post("/{experiment_id}/gross-balance/discard-tool", response_model=ExperimentSchema)
def discard_gross_balance_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: DiscardGrossBalanceToolService(experiment_service).run(experiment_id, EmptyRequest()))


@router.post("/{experiment_id}/gross-balance/open-tool", response_model=ExperimentSchema)
def open_gross_balance_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: OpenGrossBalanceToolService(experiment_service).run(experiment_id, EmptyRequest()))


@router.post("/{experiment_id}/gross-balance/close-tool", response_model=ExperimentSchema)
def close_gross_balance_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: CloseGrossBalanceToolService(experiment_service).run(experiment_id, EmptyRequest()))


@router.post("/{experiment_id}/gross-balance/sample-label", response_model=ExperimentSchema)
def apply_sample_label_to_gross_balance_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: ApplySampleLabelToGrossBalanceToolService(experiment_service).run(
            experiment_id,
            EmptyRequest(),
        )
    )


@router.post("/{experiment_id}/gross-balance/discard-produce-lot", response_model=ExperimentSchema)
def discard_gross_balance_produce_lot(
    experiment_id: str,
    request: ProduceLotReferenceSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DiscardGrossBalanceProduceLotService(experiment_service).run(
            experiment_id,
            DiscardGrossBalanceProduceLotRequest(produce_lot_id=request.produce_lot_id),
        )
    )
