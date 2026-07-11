from app.api.experiment_routes import (
    analytical_balance,
    core,
    dnd,
    gross_balance,
    lcmsms,
    pipette,
    rack,
    reception,
    vortex,
    workbench,
    workbench_labels,
    workbench_liquids,
    workbench_produce,
    workbench_spatula,
    workspace,
)
from app.api.experiment_routes.common import experiment_service as shared_experiment_service
from app.api.experiment_routes.common import router
from app.services.experiment_service import ExperimentRuntimeService

_route_modules = (
    analytical_balance,
    core,
    dnd,
    gross_balance,
    lcmsms,
    pipette,
    rack,
    reception,
    vortex,
    workbench,
    workbench_labels,
    workbench_liquids,
    workbench_produce,
    workbench_spatula,
    workspace,
)
experiment_service: ExperimentRuntimeService = shared_experiment_service

__all__ = ["experiment_service", "router"]
