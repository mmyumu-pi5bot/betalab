from app.schemas.experiment import DndMoveToolSchema, ExperimentSchema
from app.services.tool_move_service import MoveToolRequest, MoveToolService

from .common import experiment_service, handle_service_errors, router


@router.post("/{experiment_id}/dnd/tool", response_model=ExperimentSchema)
def move_tool(
    experiment_id: str,
    request: DndMoveToolSchema,
) -> ExperimentSchema:
    return handle_service_errors(
        lambda: MoveToolService(experiment_service).run(
            experiment_id,
            MoveToolRequest(
                source_kind=request.source_kind,
                source_id=request.source_id,
                destination_kind=request.destination_kind,
                destination_id=request.destination_id,
            ),
        )
    )
