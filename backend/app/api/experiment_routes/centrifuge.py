from app.schemas.experiment import ExperimentSchema
from app.services.domain_services.centrifuge import (
    CloseCentrifugeToolService,
    EmptyRequest,
    OpenCentrifugeToolService,
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


@router.post(
    "/{experiment_id}/centrifuge/tool/close",
    response_model=ExperimentSchema,
)
def close_centrifuge_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: CloseCentrifugeToolService(experiment_service).run(
            experiment_id,
            EmptyRequest(),
        )
    )


@router.post(
    "/{experiment_id}/centrifuge/tool/open",
    response_model=ExperimentSchema,
)
def open_centrifuge_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: OpenCentrifugeToolService(experiment_service).run(
            experiment_id,
            EmptyRequest(),
        )
    )
