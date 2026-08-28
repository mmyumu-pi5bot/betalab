from __future__ import annotations

from dataclasses import dataclass

from app.domain.centrifuge_rules import get_centrifuge_start_block_reason
from app.domain.models import Experiment, WorkbenchTool, WorkspaceWidget
from app.domain.rules import can_tool_be_sealed
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.helpers.lookups import find_workspace_widget, format_volume
from app.services.physical_simulation_service import PhysicalSimulationService
from app.domain.journal_codes import JournalCode
from app.services.journal_refs import tool_ref, widget_ref
from app.services.journal_service import record_journal

CENTRIFUGE_CYCLE_DURATION_MS = 10_000.0
CENTRIFUGE_SPEED_RPM = 4_000

physical_simulation_service = PhysicalSimulationService()


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
        journal_code: JournalCode = JournalCode.TOOL_PLACED_IN_EQUIPMENT,
    ) -> None:
        if tool.tool_type != "centrifuge_tube":
            raise ValueError(f"{tool.label} cannot be centrifuged (only centrifuge tubes).")
        widget = self.find_widget(experiment)
        if widget.centrifuge_run_remaining_ms > 0:
            raise ValueError(f"{widget.label} is running.")
        if widget.tool is not None:
            raise ValueError(f"{widget.label} already contains a tube.")
        widget.tool = tool
        record_journal(experiment, journal_code, tool=tool_ref(tool), widget=widget_ref(widget))

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
        tool = widget.tool
        block_reason = get_centrifuge_start_block_reason(
            widget_type=widget.widget_type,
            has_tool=tool is not None,
            run_remaining_ms=widget.centrifuge_run_remaining_ms,
        )
        if block_reason == "missing_tube":
            raise ValueError(f"Place a tube in {widget.label} before starting it.")
        if block_reason == "already_running":
            raise ValueError(f"{widget.label} is already running.")
        if tool is None:
            raise ValueError(f"Place a tube in {widget.label} before starting it.")
        if block_reason is not None:
            raise ValueError(f"{tool.label} cannot be centrifuged.")

        state = tool.quechers_state
        if state.phase not in {"mixed", "separated"}:
            if "centrifuged_without_valid_extraction" not in state.faults:
                state.faults.append("centrifuged_without_valid_extraction")
            tool.quechers_extraction_result = None
        elif not tool.is_sealed and tool.liquids:
            # Spinning an open tube sprays most of the extract out — the run still
            # completes, but analyte recovery is catastrophic (see get_start_block_reason:
            # an unsealed tube no longer blocks the cycle, it just ruins the result).
            if "centrifuged_open" not in state.faults:
                state.faults.append("centrifuged_open")
            tool.quechers_extraction_result = physical_simulation_service.generate_spilled_extraction_result(tool)
            record_journal(experiment, JournalCode.CENTRIFUGED_UNSEALED, tool=tool_ref(tool))
        state.phase = "separating"
        state.separation_progress = 0.0
        widget.centrifuge_run_duration_ms = CENTRIFUGE_CYCLE_DURATION_MS
        widget.centrifuge_run_remaining_ms = CENTRIFUGE_CYCLE_DURATION_MS
        widget.centrifuge_speed_rpm = CENTRIFUGE_SPEED_RPM
        record_journal(
            experiment,
            JournalCode.CENTRIFUGE_STARTED,
            widget=widget_ref(widget),
            tool=tool_ref(tool),
            rpm=CENTRIFUGE_SPEED_RPM,
        )


class CloseCentrifugeToolService(CentrifugeServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        widget = self.find_widget(experiment)
        if widget.centrifuge_run_remaining_ms > 0:
            raise ValueError(f"{widget.label} is running.")
        tool = widget.tool
        if tool is None:
            raise ValueError(f"{widget.label} does not contain a tube.")
        if not can_tool_be_sealed(tool.tool_type):
            raise ValueError(f"{tool.label} cannot be sealed.")

        tool.is_sealed = True
        tool.closure_fault = None
        tool.internal_pressure_bar = max(tool.internal_pressure_bar, 1.0)
        record_journal(
            experiment,
            JournalCode.TOOL_SEALED_IN,
            tool=tool_ref(tool),
            location=widget_ref(widget),
        )


class OpenCentrifugeToolService(CentrifugeServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        widget = self.find_widget(experiment)
        if widget.centrifuge_run_remaining_ms > 0:
            raise ValueError(f"{widget.label} is running.")
        tool = widget.tool
        if tool is None:
            raise ValueError(f"{widget.label} does not contain a tube.")
        if not can_tool_be_sealed(tool.tool_type):
            raise ValueError(f"{tool.label} cannot be opened.")

        vent_event = physical_simulation_service.vent_opened_tool(
            tool,
            material_states=experiment.produce_material_states,
        )
        tool.is_sealed = False
        tool.closure_fault = None
        if vent_event is not None and vent_event.lost_mass_g > 0:
            record_journal(
                experiment,
                JournalCode.TOOL_VENTED_IN,
                tool=tool_ref(tool),
                pressure=format_volume(vent_event.pressure_bar),
                location=widget_ref(widget),
                lost_mass=format_volume(vent_event.lost_mass_g),
            )
            return

        record_journal(
            experiment,
            JournalCode.TOOL_OPENED_IN,
            tool=tool_ref(tool),
            location=widget_ref(widget),
        )
