from app.schemas.experiment import (
    DebugProducePresetSpawnToWidgetSchema,
    ExperimentSchema,
    WorkspaceProduceLotCreateSchema,
    WorkspaceWidgetCreateSchema,
    WorkspaceWidgetLiquidCreateSchema,
    WorkspaceWidgetLiquidUpdateSchema,
    WorkspaceWidgetMoveSchema,
)
from app.services.domain_services.debug import (
    CreateDebugProduceLotToWidgetRequest,
    CreateDebugProduceLotToWidgetService,
)
from app.services.domain_services.workspace import (
    AddLiquidToWorkspaceWidgetRequest,
    AddLiquidToWorkspaceWidgetService,
    AddWorkspaceWidgetService,
    CompleteGrinderCycleService,
    CreateOrInitProduceLotService,
    CreateProduceLotRequest,
    MoveWorkspaceWidgetService,
    RemoveLiquidFromWorkspaceWidgetService,
    StartGrinderCycleService,
    StoreWorkspaceWidgetService,
    UpdateWorkspaceWidgetLiquidVolumeRequest,
    UpdateWorkspaceWidgetLiquidVolumeService,
    WorkspaceWidgetLayoutRequest,
    WorkspaceWidgetLiquidRequest,
    WorkspaceWidgetRequest,
)

from .common import experiment_service, handle_service_errors, router


@router.post("/{experiment_id}/workspace/widgets", response_model=ExperimentSchema)
def add_workspace_widget(
    experiment_id: str,
    request: WorkspaceWidgetCreateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: AddWorkspaceWidgetService(experiment_service).run(
            experiment_id,
            WorkspaceWidgetLayoutRequest(
                widget_id=request.widget_id,
                anchor=request.anchor,
                offset_x=request.offset_x,
                offset_y=request.offset_y,
            ),
        )
    )


@router.post("/{experiment_id}/workspace/widgets/{widget_id}/move", response_model=ExperimentSchema)
def move_workspace_widget(
    experiment_id: str,
    widget_id: str,
    request: WorkspaceWidgetMoveSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveWorkspaceWidgetService(experiment_service).run(
            experiment_id,
            WorkspaceWidgetLayoutRequest(
                widget_id=widget_id,
                anchor=request.anchor,
                offset_x=request.offset_x,
                offset_y=request.offset_y,
            ),
        )
    )


@router.post("/{experiment_id}/workspace/widgets/{widget_id}/store", response_model=ExperimentSchema)
def store_workspace_widget(experiment_id: str, widget_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: StoreWorkspaceWidgetService(experiment_service).run(
            experiment_id,
            WorkspaceWidgetRequest(widget_id=widget_id),
        )
    )


@router.post("/{experiment_id}/workspace/widgets/{widget_id}/liquids", response_model=ExperimentSchema)
def add_liquid_to_workspace_widget(
    experiment_id: str,
    widget_id: str,
    request: WorkspaceWidgetLiquidCreateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: AddLiquidToWorkspaceWidgetService(experiment_service).run(
            experiment_id,
            AddLiquidToWorkspaceWidgetRequest(
                widget_id=widget_id,
                liquid_id=request.liquid_id,
                volume_ml=request.volume_ml,
            ),
        )
    )


@router.patch(
    "/{experiment_id}/workspace/widgets/{widget_id}/liquids/{liquid_id}",
    response_model=ExperimentSchema,
)
def update_workspace_widget_liquid_volume(
    experiment_id: str,
    widget_id: str,
    liquid_id: str,
    request: WorkspaceWidgetLiquidUpdateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: UpdateWorkspaceWidgetLiquidVolumeService(experiment_service).run(
            experiment_id,
            UpdateWorkspaceWidgetLiquidVolumeRequest(
                widget_id=widget_id,
                liquid_entry_id=liquid_id,
                volume_ml=request.volume_ml,
            ),
        )
    )


@router.delete(
    "/{experiment_id}/workspace/widgets/{widget_id}/liquids/{liquid_id}",
    response_model=ExperimentSchema,
)
def remove_liquid_from_workspace_widget(
    experiment_id: str,
    widget_id: str,
    liquid_id: str,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: RemoveLiquidFromWorkspaceWidgetService(experiment_service).run(
            experiment_id,
            WorkspaceWidgetLiquidRequest(widget_id=widget_id, liquid_entry_id=liquid_id),
        )
    )


@router.post(
    "/{experiment_id}/workspace/widgets/{widget_id}/complete-grinder-cycle",
    response_model=ExperimentSchema,
)
def complete_grinder_cycle(experiment_id: str, widget_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: CompleteGrinderCycleService(experiment_service).run(
            experiment_id,
            WorkspaceWidgetRequest(widget_id=widget_id),
        )
    )


@router.post(
    "/{experiment_id}/workspace/widgets/{widget_id}/start-grinder-cycle",
    response_model=ExperimentSchema,
)
def start_grinder_cycle(experiment_id: str, widget_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: StartGrinderCycleService(experiment_service).run(
            experiment_id,
            WorkspaceWidgetRequest(widget_id=widget_id),
        )
    )


@router.post("/{experiment_id}/workspace/produce-lots", response_model=ExperimentSchema)
def create_produce_lot(
    experiment_id: str,
    request: WorkspaceProduceLotCreateSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: CreateOrInitProduceLotService(experiment_service).run(
            experiment_id,
            CreateProduceLotRequest(produce_type=request.produce_type),
        )
    )


@router.post(
    "/{experiment_id}/debug/produce-presets/{preset_id}/spawn-on-widget",
    response_model=ExperimentSchema,
)
def create_debug_produce_lot_to_widget(
    experiment_id: str,
    preset_id: str,
    request: DebugProducePresetSpawnToWidgetSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: CreateDebugProduceLotToWidgetService(experiment_service).run(
            experiment_id,
            CreateDebugProduceLotToWidgetRequest(
                preset_id=preset_id,
                widget_id=request.widget_id,
                total_mass_g=request.total_mass_g,
                temperature_c=request.temperature_c,
                residual_co2_mass_g=request.residual_co2_mass_g,
            ),
        )
    )
