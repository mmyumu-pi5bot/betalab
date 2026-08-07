from pydantic import BaseModel

from app.schemas.experiment import ExperimentSchema
from app.services.domain_services.lcmsms import (
    AcquisitionSequenceLineRequest,
    AddCalibrationToVialRequest,
    AddCalibrationToVialService,
    LoadRackIntoInstrumentRequest,
    LoadRackIntoInstrumentService,
    PourExtractToVialRequest,
    PourExtractToVialService,
    RunSequenceRequest,
    RunSequenceService,
    SkipAcquisitionRequest,
    SkipAcquisitionService,
    UnloadRackFromInstrumentRequest,
    UnloadRackFromInstrumentService,
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


class AddCalibrationBody(BaseModel):
    vial_tool_id: str
    level_ng_per_ml: float


class AcquisitionSequenceLineBody(BaseModel):
    rack_slot_id: str
    sample_name: str
    injection_volume_ul: float
    repetitions: int
    output_filename: str


class RunSequenceBody(BaseModel):
    method_id: str
    injections: list[AcquisitionSequenceLineBody]


@router.post("/{experiment_id}/lcmsms/load-rack", response_model=ExperimentSchema)
def load_rack_into_instrument(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: LoadRackIntoInstrumentService(experiment_service).run(
            experiment_id,
            LoadRackIntoInstrumentRequest(),
        )
    )


@router.post("/{experiment_id}/lcmsms/unload-rack", response_model=ExperimentSchema)
def unload_rack_from_instrument(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: UnloadRackFromInstrumentService(experiment_service).run(
            experiment_id,
            UnloadRackFromInstrumentRequest(),
        )
    )


@router.post("/{experiment_id}/lcmsms/add-calibration", response_model=ExperimentSchema)
def add_calibration_to_vial(experiment_id: str, body: AddCalibrationBody) -> ExperimentSchema:
    return handle_service_errors(
        lambda: AddCalibrationToVialService(experiment_service).run(
            experiment_id,
            AddCalibrationToVialRequest(
                vial_tool_id=body.vial_tool_id,
                level_ng_per_ml=body.level_ng_per_ml,
            ),
        )
    )


@router.post("/{experiment_id}/lcmsms/skip-acquisition", response_model=ExperimentSchema)
def skip_acquisition(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(
        lambda: SkipAcquisitionService(experiment_service).run(
            experiment_id,
            SkipAcquisitionRequest(),
        )
    )


@router.post("/{experiment_id}/lcmsms/run-sequence", response_model=ExperimentSchema)
def run_sequence(experiment_id: str, body: RunSequenceBody) -> ExperimentSchema:
    return handle_service_errors(
        lambda: RunSequenceService(experiment_service).run(
            experiment_id,
            RunSequenceRequest(
                method_id=body.method_id,
                injections=[
                    AcquisitionSequenceLineRequest(
                        rack_slot_id=line.rack_slot_id,
                        sample_name=line.sample_name,
                        injection_volume_ul=line.injection_volume_ul,
                        repetitions=line.repetitions,
                        output_filename=line.output_filename,
                    )
                    for line in body.injections
                ],
            ),
        )
    )
