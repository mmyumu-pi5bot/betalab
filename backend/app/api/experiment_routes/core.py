import asyncio

from fastapi import HTTPException, WebSocket, WebSocketDisconnect

from app.domain.workbench_catalog import get_toolbar_categories
from app.schemas.experiment import (
    CreateExperimentSchema,
    ExperimentListEntrySchema,
    ExperimentSchema,
    RenameExperimentSchema,
    ToolbarCategorySchema,
)
from app.services.experiment_service import ExperimentNotFoundError

from .common import (
    experiment_service,
    experiment_stream_interval_seconds,
    handle_service_errors,
    router,
)


@router.post("", response_model=ExperimentSchema)
def create_experiment(payload: CreateExperimentSchema | None = None) -> ExperimentSchema:
    name = payload.name if payload is not None else "Untitled experiment"
    return handle_service_errors(lambda: experiment_service.create_experiment(name))


@router.get("", response_model=list[ExperimentListEntrySchema])
def list_experiments() -> list[ExperimentListEntrySchema]:
    return experiment_service.list_experiments()


@router.patch("/{experiment_id}", response_model=ExperimentSchema)
def rename_experiment(experiment_id: str, payload: RenameExperimentSchema) -> ExperimentSchema:
    return handle_service_errors(lambda: experiment_service.rename_experiment(experiment_id, payload.name))


@router.post("/{experiment_id}/duplicate", response_model=ExperimentSchema)
def duplicate_experiment(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: experiment_service.duplicate_experiment(experiment_id))


@router.delete("/{experiment_id}", status_code=204)
def delete_experiment(experiment_id: str) -> None:
    try:
        experiment_service.delete_experiment(experiment_id)
    except ExperimentNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Experiment not found") from exc


@router.get("/catalog/toolbar", response_model=list[ToolbarCategorySchema], response_model_exclude_none=True)
def get_toolbar_catalog() -> list[dict[str, object]]:
    return get_toolbar_categories()


@router.get("/{experiment_id}", response_model=ExperimentSchema)
def get_experiment(experiment_id: str) -> ExperimentSchema:
    return handle_service_errors(lambda: experiment_service.get_experiment(experiment_id))


@router.websocket("/{experiment_id}/stream")
async def stream_experiment(experiment_id: str, websocket: WebSocket) -> None:
    await websocket.accept()

    try:
        while True:
            experiment = experiment_service.get_experiment(experiment_id)
            await websocket.send_json(experiment.model_dump(mode="json"))
            await asyncio.sleep(experiment_stream_interval_seconds)
    except ExperimentNotFoundError:
        await websocket.close(code=4404, reason="Experiment not found")
    except WebSocketDisconnect:
        return
