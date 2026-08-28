from __future__ import annotations

from dataclasses import dataclass

from app.domain.models import Experiment, WorkbenchTool, WorkspaceWidget
from app.domain.rules import can_tool_be_sealed
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.helpers.lookups import find_workspace_widget, format_volume
from app.services.physical_simulation_service import PhysicalSimulationService
from app.domain.journal_codes import JournalCode
from app.services.journal_refs import tool_ref, widget_ref
from app.services.journal_service import record_journal

physical_simulation_service = PhysicalSimulationService()


@dataclass(frozen=True, slots=True)
class EmptyRequest:
    pass


class IceBathServiceBase(WriteDomainService[object]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def find_widget(self, experiment: Experiment) -> WorkspaceWidget:
        widget = find_workspace_widget(experiment.workspace, "ice_bath")
        if widget.widget_type != "ice_bath":
            raise ValueError(f"{widget.label} is not an ice bath.")
        return widget

    def place_tool(
        self,
        experiment: Experiment,
        tool: WorkbenchTool,
        *,
        journal_code: JournalCode = JournalCode.TOOL_PLACED_IN_EQUIPMENT,
    ) -> None:
        if tool.tool_type != "centrifuge_tube":
            raise ValueError(f"{tool.label} cannot be chilled here (only centrifuge tubes).")
        widget = self.find_widget(experiment)
        if widget.tool is not None:
            raise ValueError(f"{widget.label} already contains a tube.")
        widget.tool = tool
        record_journal(experiment, journal_code, tool=tool_ref(tool), widget=widget_ref(widget))

    def take_tool(self, experiment: Experiment) -> WorkbenchTool:
        widget = self.find_widget(experiment)
        if widget.tool is None:
            raise ValueError(f"{widget.label} does not contain a tube.")
        tool = widget.tool
        widget.tool = None
        return tool


class CloseIceBathToolService(IceBathServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        widget = self.find_widget(experiment)
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


class OpenIceBathToolService(IceBathServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        widget = self.find_widget(experiment)
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
