from __future__ import annotations

from dataclasses import dataclass

from app.domain.models import Experiment
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.domain_services.workbench import add_liquid_to_existing_tool
from app.services.helpers.lookups import find_experiment_tool


@dataclass(frozen=True, slots=True)
class AddLiquidToToolRequest:
    tool_id: str
    liquid_id: str
    volume_ml: float | None = None


class AddLiquidToToolService(WriteDomainService[AddLiquidToToolRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: AddLiquidToToolRequest) -> None:
        add_liquid_to_existing_tool(
            experiment,
            find_experiment_tool(experiment, request.tool_id),
            liquid_id=request.liquid_id,
            volume_ml=request.volume_ml,
        )
