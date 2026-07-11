from pydantic import BaseModel

from app.schemas.experiment import ExperimentSchema
from app.services.domain_services.pipette import (
    AspiratePipetteRequest,
    AspiratePipetteService,
    DispensePipetteRequest,
    DispensePipetteService,
)

from .common import experiment_service, handle_service_errors, router


class PipetteVolumeBody(BaseModel):
    tool_id: str
    delta_volume_ml: float


@router.post("/{experiment_id}/pipette/aspirate", response_model=ExperimentSchema)
def aspirate_pipette(experiment_id: str, body: PipetteVolumeBody) -> ExperimentSchema:
    return handle_service_errors(
        lambda: AspiratePipetteService(experiment_service).run(
            experiment_id,
            AspiratePipetteRequest(source_tool_id=body.tool_id, delta_volume_ml=body.delta_volume_ml),
        )
    )


@router.post("/{experiment_id}/pipette/dispense", response_model=ExperimentSchema)
def dispense_pipette(experiment_id: str, body: PipetteVolumeBody) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DispensePipetteService(experiment_service).run(
            experiment_id,
            DispensePipetteRequest(target_tool_id=body.tool_id, delta_volume_ml=body.delta_volume_ml),
        )
    )
