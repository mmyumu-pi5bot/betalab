from fastapi import HTTPException, Response
from pydantic import BaseModel

from app.schemas.experiment import ExperimentSchema
from app.services.domain_services.lcmsms import (
    AcquisitionSequenceLineRequest,
    LoadRackIntoInstrumentRequest,
    LoadRackIntoInstrumentService,
    PlaceCalibrationStandardVialRequest,
    PlaceCalibrationStandardVialService,
    PourExtractToVialRequest,
    PourExtractToVialService,
    RunSequenceRequest,
    RunSequenceService,
    SkipAcquisitionRequest,
    SkipAcquisitionService,
    UnloadRackFromInstrumentRequest,
    UnloadRackFromInstrumentService,
)
from app.services.experiment_service import (
    ExperimentNotFoundError,
    SequenceRunNotFoundError,
)
from app.services.exports.run_bundle import build_run_bundle, run_bundle_filename

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


class PlaceCalibrationStandardVialBody(BaseModel):
    level_ng_per_ml: float
    destination_kind: str
    destination_id: str


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


@router.post("/{experiment_id}/lcmsms/place-calibration-vial", response_model=ExperimentSchema)
def place_calibration_standard_vial(
    experiment_id: str, body: PlaceCalibrationStandardVialBody
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: PlaceCalibrationStandardVialService(experiment_service).run(
            experiment_id,
            PlaceCalibrationStandardVialRequest(
                level_ng_per_ml=body.level_ng_per_ml,
                destination_kind=body.destination_kind,
                destination_id=body.destination_id,
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


@router.get("/{experiment_id}/lcmsms/runs/{run_id}/results")
def download_sequence_results(experiment_id: str, run_id: str) -> Response:
    """Serve the run's result archive: the method file plus one file per injection.

    A pure read. It packs what the instrument has already recorded — an
    injection still running has no file yet — and never advances the clock to
    make more of it exist.
    """
    try:
        run = experiment_service.get_sequence_run(experiment_id, run_id)
    except ExperimentNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Experiment not found") from exc
    except SequenceRunNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Sequence run not found") from exc

    return Response(
        content=build_run_bundle(run),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{run_bundle_filename(run)}"'
        },
    )
