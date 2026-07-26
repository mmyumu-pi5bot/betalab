from __future__ import annotations

from dataclasses import dataclass

from app.domain.models import Experiment, WorkbenchTool, WorkspaceWidget
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.helpers.lookups import find_workspace_widget

CENTRIFUGE_CYCLE_DURATION_MS = 10_000.0
CENTRIFUGE_SPEED_RPM = 4_000


@dataclass(frozen=True, slots=True)
class EmptyRequest:
    pass


class CentrifugeServiceBase(WriteDomainService[object]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def find_widget(self, experiment: Experiment) -> WorkspaceWidget:
        widget = find_workspace_widget(experiment.workspace, "centrifuge")
        if widget.widget_type != "centrifuge":
            raise ValueError(f"{widget.label} is not a centrifuge.")
        return widget

    def place_tool(
        self,
        experiment: Experiment,
        tool: WorkbenchTool,
        *,
        action_verb: str = "placed in",
    ) -> None:
        if tool.tool_type != "centrifuge_tube":
            raise ValueError(f"{tool.label} cannot be centrifuged (only centrifuge tubes).")
        widget = self.find_widget(experiment)
        if widget.centrifuge_run_remaining_ms > 0:
            raise ValueError(f"{widget.label} is running.")
        if widget.tool is not None:
            raise ValueError(f"{widget.label} already contains a tube.")
        widget.tool = tool
        experiment.audit_log.append(f"{tool.label} {action_verb} {widget.label}.")

    def take_tool(self, experiment: Experiment) -> WorkbenchTool:
        widget = self.find_widget(experiment)
        if widget.centrifuge_run_remaining_ms > 0:
            raise ValueError(f"{widget.label} is running.")
        if widget.tool is None:
            raise ValueError(f"{widget.label} does not contain a tube.")
        tool = widget.tool
        widget.tool = None
        widget.centrifuge_run_duration_ms = 0.0
        widget.centrifuge_run_remaining_ms = 0.0
        widget.centrifuge_speed_rpm = 0
        return tool


class StartCentrifugeCycleService(CentrifugeServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        widget = self.find_widget(experiment)
        if widget.tool is None:
            raise ValueError(f"Place a tube in {widget.label} before starting it.")
        if widget.centrifuge_run_remaining_ms > 0:
            raise ValueError(f"{widget.label} is already running.")
        if not widget.tool.is_sealed:
            raise ValueError(f"{widget.tool.label} must be sealed before centrifugation.")
        state = widget.tool.quechers_state
        if state.phase not in {"mixed", "separated"}:
            raise ValueError(f"{widget.tool.label} must be mixed before centrifugation.")

        state.phase = "separating"
        state.separation_progress = 0.0
        widget.centrifuge_run_duration_ms = CENTRIFUGE_CYCLE_DURATION_MS
        widget.centrifuge_run_remaining_ms = CENTRIFUGE_CYCLE_DURATION_MS
        widget.centrifuge_speed_rpm = CENTRIFUGE_SPEED_RPM
        experiment.audit_log.append(
            f"{widget.label} started with {widget.tool.label} at {CENTRIFUGE_SPEED_RPM} rpm."
        )
