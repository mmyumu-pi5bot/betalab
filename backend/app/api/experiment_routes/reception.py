from app.schemas.experiment import (
    BasketToolReferenceSchema,
    ExperimentSchema,
    GrossMassOffsetUpdateSchema,
    GrossWeightRecordSchema,
    LimsLabelPrintSchema,
    LimsMassCheckAcknowledgementSchema,
    LimsReceptionCreateSchema,
    ReceivedBagPlacementSchema,
    WorkbenchSlotReferenceSchema,
)
from app.services.domain_services.reception import (
    AcknowledgeReceptionMassCheckRequest,
    AcknowledgeReceptionMassCheckService,
    ApplyPrintedLimsLabelRequest,
    ApplyPrintedLimsLabelService,
    ApplyPrintedLimsLabelToAnalyticalBalanceToolService,
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

from .common import experiment_service, handle_service_errors, router


@router.post("/{experiment_id}/reception/bag/place-on-workbench", response_model=ExperimentSchema)
def place_received_bag_on_workbench(
    experiment_id: str,
    request: ReceivedBagPlacementSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: PlaceReceivedBagOnWorkbenchService(experiment_service).run(
            experiment_id,
            PlaceReceivedBagOnWorkbenchRequest(
                target_slot_id=request.target_slot_id,
                tool_id=request.tool_id,
            ),
        )
    )


@router.post("/{experiment_id}/reception/bag/discard", response_model=ExperimentSchema)
def discard_received_bag(experiment_id: str, request: BasketToolReferenceSchema) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DiscardBasketToolService(experiment_service).run(experiment_id, DiscardBasketToolRequest(tool_id=request.tool_id))
    )


@router.post("/{experiment_id}/reception/gross-weight/record", response_model=ExperimentSchema)
def record_gross_weight(
    experiment_id: str,
    request: GrossWeightRecordSchema | None = None,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: RecordGrossWeightService(experiment_service).run(
            experiment_id,
            RecordGrossWeightRequest(measured_gross_mass_g=request.measured_gross_mass_g if request is not None else None),
        )
    )


@router.post("/{experiment_id}/gross-balance/container-offset", response_model=ExperimentSchema)
def set_gross_balance_container_offset(
    experiment_id: str,
    request: GrossMassOffsetUpdateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: SetGrossMassOffsetService(experiment_service).run(
            experiment_id,
            SetGrossMassOffsetRequest(gross_mass_offset_g=request.gross_mass_offset_g),
        )
    )


@router.post("/{experiment_id}/lims/reception", response_model=ExperimentSchema)
def create_lims_reception(
    experiment_id: str,
    request: LimsReceptionCreateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: CreateLimsReceptionService(experiment_service).run(
            experiment_id,
            CreateLimsReceptionRequest(
                orchard_name=request.orchard_name,
                harvest_date=request.harvest_date,
                indicative_mass_g=request.indicative_mass_g,
                measured_gross_mass_g=request.measured_gross_mass_g,
                measured_sample_mass_g=request.measured_sample_mass_g,
                entry_id=request.entry_id,
            ),
        )
    )


@router.post("/{experiment_id}/lims/acknowledge-mass-check", response_model=ExperimentSchema)
def acknowledge_reception_mass_check(
    experiment_id: str,
    request: LimsMassCheckAcknowledgementSchema | None = None,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: AcknowledgeReceptionMassCheckService(experiment_service).run(
            experiment_id,
            AcknowledgeReceptionMassCheckRequest(entry_id=request.entry_id if request is not None else None),
        )
    )


@router.post("/{experiment_id}/lims/print-label", response_model=ExperimentSchema)
def print_lims_label(
    experiment_id: str,
    request: LimsLabelPrintSchema | None = None,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: PrintLimsLabelService(experiment_service).run(
            experiment_id,
            PrintLimsLabelRequest(entry_id=request.entry_id if request is not None else None),
        )
    )


@router.delete("/{experiment_id}/lims/printed-label", response_model=ExperimentSchema)
def discard_printed_lims_label(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: DiscardPrintedLimsLabelService(experiment_service).run(experiment_id, EmptyReceptionRequest()))


@router.post("/{experiment_id}/lims/apply-label-to-workbench-bag", response_model=ExperimentSchema)
def apply_printed_lims_label(
    experiment_id: str,
    request: WorkbenchSlotReferenceSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: ApplyPrintedLimsLabelService(experiment_service).run(
            experiment_id,
            ApplyPrintedLimsLabelRequest(slot_id=request.slot_id),
        )
    )


@router.post("/{experiment_id}/lims/apply-label-to-basket-bag", response_model=ExperimentSchema)
def apply_printed_lims_label_to_basket_bag(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: ApplyPrintedLimsLabelToBasketBagService(experiment_service).run(experiment_id, EmptyReceptionRequest()))


@router.post(
    "/{experiment_id}/lims/apply-label-to-gross-balance-bag",
    response_model=ExperimentSchema,
)
def apply_printed_lims_label_to_gross_balance_bag(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: ApplyPrintedLimsLabelToGrossBalanceBagService(experiment_service).run(experiment_id, EmptyReceptionRequest())
    )


@router.post(
    "/{experiment_id}/lims/apply-label-to-analytical-balance-tool",
    response_model=ExperimentSchema,
)
def apply_printed_lims_label_to_analytical_balance_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: ApplyPrintedLimsLabelToAnalyticalBalanceToolService(experiment_service).run(experiment_id, EmptyReceptionRequest())
    )
