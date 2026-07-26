from app.schemas.experiment import ExperimentSchema
from app.services.domain_services.centrifuge import (
    EmptyRequest,
    StartCentrifugeCycleService,
)

from .common import experiment_service, handle_service_errors, router


@router.post(
    "/{experiment_id}/centrifuge/start",
    response_model=ExperimentSchema,
)
def start_centrifuge_cycle(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: StartCentrifugeCycleService(experiment_service).run(
            experiment_id,
            EmptyRequest(),
        )
    )
