from app.schemas.experiment import (
    DebugProducePresetSpawnToWorkbenchSchema,
    DebugToolPresetSpawnSchema,
    ExperimentSchema,
    WorkbenchSlotReferenceSchema,
)
from app.services.domain_services.debug import (
    CreateDebugProduceLotOnWorkbenchRequest,
    CreateDebugProduceLotOnWorkbenchService,
    CreateDebugToolPresetRequest,
    CreateDebugToolPresetService,
)
from app.services.domain_services.workbench import (
    CutWorkbenchProduceLotService,
    WorkbenchProduceLotRequest,
)

from .common import (
    experiment_service,
    handle_service_errors,
    router,
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
    "/{experiment_id}/debug/tool-presets/{preset_id}/spawn",
    response_model=ExperimentSchema,
)
def create_debug_tool_preset(
    experiment_id: str,
    preset_id: str,
    request: DebugToolPresetSpawnSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: CreateDebugToolPresetService(experiment_service).run(
            experiment_id,
            CreateDebugToolPresetRequest(
                preset_id=preset_id,
                destination_kind=request.destination_kind,
                destination_id=request.destination_id,
                produce_mass_g=request.produce_mass_g,
                temperature_c=request.temperature_c,
                level_ng_per_ml=request.level_ng_per_ml,
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
