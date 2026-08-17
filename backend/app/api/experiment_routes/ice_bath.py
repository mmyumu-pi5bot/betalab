from app.schemas.experiment import ExperimentSchema
from app.services.domain_services.ice_bath import (
    CloseIceBathToolService,
    EmptyRequest,
    OpenIceBathToolService,
)

from .common import experiment_service, handle_service_errors, router


@router.post(
    "/{experiment_id}/ice-bath/tool/close",
    response_model=ExperimentSchema,
)
def close_ice_bath_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: CloseIceBathToolService(experiment_service).run(
            experiment_id,
            EmptyRequest(),
        )
    )


@router.post(
    "/{experiment_id}/ice-bath/tool/open",
    response_model=ExperimentSchema,
)
def open_ice_bath_tool(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: OpenIceBathToolService(experiment_service).run(
            experiment_id,
            EmptyRequest(),
        )
    )
