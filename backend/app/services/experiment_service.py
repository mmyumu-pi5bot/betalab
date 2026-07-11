from __future__ import annotations

from collections.abc import Callable
from dataclasses import asdict
from datetime import UTC, datetime

from app.domain.models import Experiment
from app.schemas.experiment import ExperimentListEntrySchema, ExperimentSchema
from app.services.domain_services.workspace import advance_workspace_cryogenics_state
from app.services.experiment_factory import build_experiment
from app.services.experiment_repository import ExperimentRepository, InMemoryExperimentRepository
from app.services.helpers.produce_canonical import sync_canonical_produce_model, sync_pesticide_material_states


class ExperimentNotFoundError(KeyError):
    pass


class ExperimentRuntimeService:
    def __init__(self, repository: ExperimentRepository | None = None) -> None:
        self._experiments: dict[str, Experiment] = {}
        self._repository = repository or InMemoryExperimentRepository()
        self._now_fn: Callable[[], datetime] = lambda: datetime.now(UTC)

    def create_experiment(self) -> ExperimentSchema:
        experiment = build_experiment()
        experiment.last_simulation_at = self._now_fn()
        self._experiments[experiment.id] = experiment
        return self._persist_mutation_and_to_schema(experiment)

    def list_experiments(self) -> list[ExperimentListEntrySchema]:
        return self._repository.list()

    def delete_experiment(self, experiment_id: str) -> None:
        self._experiments.pop(experiment_id, None)
        deleted = self._repository.delete(experiment_id)
        if not deleted:
            raise ExperimentNotFoundError(experiment_id)

    def get_experiment(self, experiment_id: str) -> ExperimentSchema:
        experiment = self._require_experiment(experiment_id)
        did_advance = self._advance_experiment_to_now(experiment)
        if did_advance:
            return self._persist_mutation_and_to_schema(experiment)
        return self._to_schema(experiment)

    def _require_experiment(self, experiment_id: str) -> Experiment:
        experiment = self._experiments.get(experiment_id)
        if experiment is None:
            experiment = self._repository.load(experiment_id)
            if experiment is not None:
                self._experiments[experiment_id] = experiment
        if experiment is None:
            raise ExperimentNotFoundError(experiment_id)
        return experiment

    def _advance_experiment_to_now(self, experiment: Experiment) -> bool:
        now = self._now_fn()
        if now.tzinfo is None:
            now = now.replace(tzinfo=UTC)

        elapsed_ms = (now - experiment.last_simulation_at).total_seconds() * 1000.0
        if elapsed_ms <= 0:
            return False

        remaining_ms = elapsed_ms
        while remaining_ms > 0:
            step_ms = min(remaining_ms, 5000.0)
            advance_workspace_cryogenics_state(experiment, step_ms)
            remaining_ms -= step_ms

        experiment.last_simulation_at = now
        return True

    def _to_schema(self, experiment: Experiment) -> ExperimentSchema:
        sync_canonical_produce_model(experiment)
        sync_pesticide_material_states(experiment)
        workspace = asdict(experiment.workspace)
        rack_has_tools = any(slot.tool is not None for slot in experiment.rack.slots)
        produce_material_states = [asdict(state) for state in experiment.produce_material_states]
        for widget_obj, widget_dict in zip(experiment.workspace.widgets, workspace["widgets"], strict=False):
            widget_dict["store_allowed_override"] = widget_obj.can_store(rack_has_tools)
            widget_dict["produce_material_states"] = produce_material_states
        return ExperimentSchema.model_validate(
            {
                "id": experiment.id,
                "status": experiment.status.value,
                "last_simulation_at": experiment.last_simulation_at,
                "snapshot_version": experiment.snapshot_version,
                "workbench": asdict(experiment.workbench),
                "rack": asdict(experiment.rack),
                "trash": asdict(experiment.trash),
                "workspace": workspace,
                "lims_reception": asdict(experiment.lims_reception),
                "lims_entries": [asdict(entry) for entry in experiment.lims_entries],
                "basket_tools": [asdict(t) for t in experiment.basket_tools],
                "produce_material_states": produce_material_states,
                "spatula": asdict(experiment.spatula),
                "pipette": asdict(experiment.pipette),
                "analytical_balance": asdict(experiment.analytical_balance),
                "audit_log": experiment.audit_log,
            }
        )

    def _persist_mutation_and_to_schema(self, experiment: Experiment) -> ExperimentSchema:
        experiment.snapshot_version += 1
        self._repository.save(experiment)
        return self._to_schema(experiment)
