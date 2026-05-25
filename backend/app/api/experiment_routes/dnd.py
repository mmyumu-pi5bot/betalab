from app.schemas.experiment import DndMoveObjectSchema, ExperimentSchema
from app.services.dnd_move_service import DndMoveObjectRequest, DndMoveObjectService, DndObjectRef

from .common import experiment_service, handle_service_errors, router


@router.post("/{experiment_id}/dnd/move", response_model=ExperimentSchema)
def move_object(
    experiment_id: str,
    request: DndMoveObjectSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: DndMoveObjectService(experiment_service).run(
            experiment_id,
            DndMoveObjectRequest(
                entity=DndObjectRef(kind=request.entity.kind, id=request.entity.id),
                source=DndObjectRef(kind=request.source.kind, id=request.source.id),
                destination=DndObjectRef(kind=request.destination.kind, id=request.destination.id),
            ),
        )
    )
