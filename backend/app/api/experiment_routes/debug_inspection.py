from fastapi import HTTPException

from app.core.config import settings
from app.services.experiment_service import ExperimentNotFoundError

from .common import experiment_service, router


@router.get("/{experiment_id}/debug/inspect/{entity_kind}/{entity_id}")
def inspect_debug_entity(
    experiment_id: str,
    entity_kind: str,
    entity_id: str,
) -> dict[str, object]:
    if not settings.debug_inspector_enabled:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        return experiment_service.get_debug_inspection(
            experiment_id,
            entity_kind,
            entity_id,
        )
    except ExperimentNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Experiment not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
