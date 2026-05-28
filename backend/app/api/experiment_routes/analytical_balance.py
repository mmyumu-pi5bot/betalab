from app.schemas.experiment import (
    ExperimentSchema,
    RackSlotReferenceSchema,
    TargetWorkbenchSlotSchema,
    WorkbenchSlotReferenceSchema,
    WorkbenchToolLiquidCreateSchema,
    WorkbenchToolPlacementSchema,
    WorkbenchToolPowderPourSchema,
    WorkbenchToolSampleLabelUpdateSchema,
)
from app.services.domain_services.analytical_balance import (
    AddLiquidToAnalyticalBalanceToolRequest,
    AddLiquidToAnalyticalBalanceToolService,
    ApplySampleLabelToAnalyticalBalanceToolService,
    CloseAnalyticalBalanceToolService,
    DiscardAnalyticalBalanceToolService,
    EmptyRequest,
    LoadSpatulaFromAnalyticalBalanceToolService,
    MoveAnalyticalBalanceToolToRackRequest,
    MoveAnalyticalBalanceToolToRackService,
    MoveAnalyticalBalanceToolToWorkbenchRequest,
    MoveAnalyticalBalanceToolToWorkbenchService,
    MoveGrossBalanceToolToAnalyticalBalanceRequest,
    MoveGrossBalanceToolToAnalyticalBalanceService,
    MoveRackToolToAnalyticalBalanceRequest,
    MoveRackToolToAnalyticalBalanceService,
    MoveWorkbenchToolToAnalyticalBalanceRequest,
    MoveWorkbenchToolToAnalyticalBalanceService,
    OpenAnalyticalBalanceToolService,
    PlaceToolOnAnalyticalBalanceRequest,
    PlaceToolOnAnalyticalBalanceService,
    PourSpatulaIntoAnalyticalBalanceToolRequest,
    PourSpatulaIntoAnalyticalBalanceToolService,
    RecordAnalyticalSampleMassService,
    RestoreTrashedToolToAnalyticalBalanceRequest,
    RestoreTrashedToolToAnalyticalBalanceService,
    TareAnalyticalBalanceService,
    UpdateAnalyticalBalanceToolSampleLabelTextRequest,
    UpdateAnalyticalBalanceToolSampleLabelTextService,
)

from .common import experiment_service, handle_service_errors, router


@router.post("/{experiment_id}/analytical-balance/place-workbench-tool", response_model=ExperimentSchema)
def move_workbench_tool_to_analytical_balance(
    experiment_id: str,
    request: WorkbenchSlotReferenceSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveWorkbenchToolToAnalyticalBalanceService(experiment_service).run(
            experiment_id,
            MoveWorkbenchToolToAnalyticalBalanceRequest(source_slot_id=request.slot_id),
        )
    )


@router.post("/{experiment_id}/analytical-balance/place-tool", response_model=ExperimentSchema)
def place_tool_on_analytical_balance(
    experiment_id: str,
    request: WorkbenchToolPlacementSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: PlaceToolOnAnalyticalBalanceService(experiment_service).run(
            experiment_id,
            PlaceToolOnAnalyticalBalanceRequest(tool_id=request.tool_id),
        )
    )


@router.post("/{experiment_id}/analytical-balance/place-rack-tool", response_model=ExperimentSchema)
def move_rack_tool_to_analytical_balance(
    experiment_id: str,
    request: RackSlotReferenceSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveRackToolToAnalyticalBalanceService(experiment_service).run(
            experiment_id,
            MoveRackToolToAnalyticalBalanceRequest(rack_slot_id=request.rack_slot_id),
        )
    )


@router.post(
    "/{experiment_id}/analytical-balance/place-gross-balance-tool",
    response_model=ExperimentSchema,
)
def move_gross_balance_tool_to_analytical_balance(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveGrossBalanceToolToAnalyticalBalanceService(experiment_service).run(
            experiment_id, MoveGrossBalanceToolToAnalyticalBalanceRequest()
        )
    )


@router.post(
    "/{experiment_id}/analytical-balance/restore-trash-tool/{trash_tool_id}",
    response_model=ExperimentSchema,
)
def restore_trashed_tool_to_analytical_balance(
    experiment_id: str,
    trash_tool_id: str,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: RestoreTrashedToolToAnalyticalBalanceService(experiment_service).run(
            experiment_id,
            RestoreTrashedToolToAnalyticalBalanceRequest(trash_tool_id=trash_tool_id),
        )
    )


@router.post("/{experiment_id}/analytical-balance/move-tool-to-workbench", response_model=ExperimentSchema)
def move_analytical_balance_tool_to_workbench(
    experiment_id: str,
    request: TargetWorkbenchSlotSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveAnalyticalBalanceToolToWorkbenchService(experiment_service).run(
            experiment_id,
            MoveAnalyticalBalanceToolToWorkbenchRequest(target_slot_id=request.target_slot_id),
        )
    )


@router.post("/{experiment_id}/analytical-balance/move-tool-to-rack", response_model=ExperimentSchema)
def move_analytical_balance_tool_to_rack(
    experiment_id: str,
    request: RackSlotReferenceSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveAnalyticalBalanceToolToRackService(experiment_service).run(
            experiment_id,
            MoveAnalyticalBalanceToolToRackRequest(rack_slot_id=request.rack_slot_id),
        )
    )


@router.post("/{experiment_id}/analytical-balance/discard-tool", response_model=ExperimentSchema)
def discard_analytical_balance_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: DiscardAnalyticalBalanceToolService(experiment_service).run(experiment_id, EmptyRequest()))


@router.post("/{experiment_id}/analytical-balance/open-tool", response_model=ExperimentSchema)
def open_analytical_balance_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: OpenAnalyticalBalanceToolService(experiment_service).run(experiment_id, EmptyRequest()))


@router.post("/{experiment_id}/analytical-balance/close-tool", response_model=ExperimentSchema)
def close_analytical_balance_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: CloseAnalyticalBalanceToolService(experiment_service).run(experiment_id, EmptyRequest()))


@router.post("/{experiment_id}/analytical-balance/liquids", response_model=ExperimentSchema)
def add_liquid_to_analytical_balance_tool(
    experiment_id: str,
    request: WorkbenchToolLiquidCreateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: AddLiquidToAnalyticalBalanceToolService(experiment_service).run(
            experiment_id,
            AddLiquidToAnalyticalBalanceToolRequest(
                liquid_id=request.liquid_id,
                volume_ml=request.volume_ml,
            ),
        )
    )


@router.post("/{experiment_id}/analytical-balance/sample-label", response_model=ExperimentSchema)
def apply_sample_label_to_analytical_balance_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: ApplySampleLabelToAnalyticalBalanceToolService(experiment_service).run(
            experiment_id,
            EmptyRequest(),
        )
    )


@router.patch(
    "/{experiment_id}/analytical-balance/sample-labels/{label_id}",
    response_model=ExperimentSchema,
)
def update_analytical_balance_tool_sample_label_text(
    experiment_id: str,
    label_id: str,
    request: WorkbenchToolSampleLabelUpdateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: UpdateAnalyticalBalanceToolSampleLabelTextService(experiment_service).run(
            experiment_id,
            UpdateAnalyticalBalanceToolSampleLabelTextRequest(
                label_id=label_id,
                sample_label_text=request.sample_label_text,
            ),
        )
    )


@router.post("/{experiment_id}/analytical-balance/tare", response_model=ExperimentSchema)
def tare_analytical_balance(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: TareAnalyticalBalanceService(experiment_service).run(experiment_id, EmptyRequest()))


@router.post("/{experiment_id}/analytical-balance/spatula/load", response_model=ExperimentSchema)
def load_spatula_from_analytical_balance_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: LoadSpatulaFromAnalyticalBalanceToolService(experiment_service).run(experiment_id, EmptyRequest()))


@router.post("/{experiment_id}/analytical-balance/spatula/pour", response_model=ExperimentSchema)
def pour_spatula_into_analytical_balance_tool(
    experiment_id: str,
    request: WorkbenchToolPowderPourSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: PourSpatulaIntoAnalyticalBalanceToolService(experiment_service).run(
            experiment_id,
            PourSpatulaIntoAnalyticalBalanceToolRequest(delta_mass_g=request.delta_mass_g),
        )
    )


@router.post("/{experiment_id}/analytical-balance/record-sample-mass", response_model=ExperimentSchema)
def record_analytical_sample_mass(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: RecordAnalyticalSampleMassService(experiment_service).run(experiment_id, EmptyRequest()))
