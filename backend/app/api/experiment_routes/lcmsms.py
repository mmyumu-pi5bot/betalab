from pydantic import BaseModel

from app.schemas.experiment import ExperimentSchema
from app.services.domain_services.lcmsms import (
    PourExtractToVialRequest,
    PourExtractToVialService,
    RunSequenceRequest,
    RunSequenceService,
)

from .common import experiment_service, handle_service_errors, router


class PourExtractBody(BaseModel):
    tube_tool_id: str
    vial_tool_id: str


@router.post("/{experiment_id}/lcmsms/pour-extract", response_model=ExperimentSchema)
def pour_extract_to_vial(experiment_id: str, body: PourExtractBody) -> ExperimentSchema:
    return handle_service_errors(
        lambda: PourExtractToVialService(experiment_service).run(
            experiment_id,
            PourExtractToVialRequest(
                tube_tool_id=body.tube_tool_id,
                vial_tool_id=body.vial_tool_id,
            ),
        )
    )


@router.post("/{experiment_id}/lcmsms/run-sequence", response_model=ExperimentSchema)
def run_sequence(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: RunSequenceService(experiment_service).run(
            experiment_id,
            RunSequenceRequest(),
        )
    )
