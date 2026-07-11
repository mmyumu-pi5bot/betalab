from __future__ import annotations

from dataclasses import dataclass

from app.domain.models import Experiment, WorkbenchTool, WorkspaceWidget
from app.domain.rules import can_tool_be_sealed
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.helpers.lookups import (
    find_rack_slot,
    find_trash_tool,
    find_workbench_slot,
    find_workspace_widget,
    format_volume,
)
from app.services.helpers.produce_material_states import get_material_state_name
from app.services.helpers.workbench import build_workbench_tool
from app.services.physical_simulation_service import PhysicalSimulationService

_VORTEX_CYCLE_DURATION_MS = 3000.0
physical_simulation_service = PhysicalSimulationService()


@dataclass(frozen=True, slots=True)
class EmptyRequest:
    pass


@dataclass(frozen=True, slots=True)
class PlaceToolOnVortexRequest:
    tool_id: str


@dataclass(frozen=True, slots=True)
class MoveWorkbenchToolToVortexRequest:
    source_slot_id: str


@dataclass(frozen=True, slots=True)
class MoveVortexToolToWorkbenchRequest:
    target_slot_id: str


@dataclass(frozen=True, slots=True)
class MoveRackToolToVortexRequest:
    rack_slot_id: str


@dataclass(frozen=True, slots=True)
class RestoreTrashedToolToVortexRequest:
    trash_tool_id: str


@dataclass(frozen=True, slots=True)
class MoveAnalyticalBalanceToolToVortexRequest:
    pass


@dataclass(frozen=True, slots=True)
class MoveGrossBalanceToolToVortexRequest:
    pass


@dataclass(frozen=True, slots=True)
class MoveVortexToolToAnalyticalBalanceRequest:
    pass


@dataclass(frozen=True, slots=True)
class MoveVortexToolToGrossBalanceRequest:
    pass


class VortexServiceBase(WriteDomainService[object]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _find_vortex_widget(self, experiment: Experiment) -> WorkspaceWidget:
        widget = find_workspace_widget(experiment.workspace, "vortex")
        if widget.widget_type != "vortex_mixer":
            raise ValueError(f"{widget.label} is not a vortex mixer.")
        return widget

    def _validate_vortex_empty(self, widget: WorkspaceWidget) -> None:
        if widget.tool is not None:
            raise ValueError(f"{widget.label} already contains a tool.")

    def _require_vortex_tool(self, experiment: Experiment) -> WorkbenchTool:
        widget = self._find_vortex_widget(experiment)
        if widget.tool is None:
            raise ValueError(f"{widget.label} does not contain a tube.")
        return widget.tool

    def _validate_compatible_tool(self, tool: WorkbenchTool) -> None:
        if tool.tool_type != "centrifuge_tube":
            raise ValueError(f"{tool.label} cannot be vortexed (only centrifuge tubes).")

    def place_tool_on_vortex(
        self,
        experiment: Experiment,
        tool: WorkbenchTool,
        *,
        action_verb: str = "placed on",
    ) -> None:
        self._validate_compatible_tool(tool)
        widget = self._find_vortex_widget(experiment)
        self._validate_vortex_empty(widget)
        widget.tool = tool
        experiment.audit_log.append(f"{tool.label} {action_verb} {widget.label}.")

    def take_tool_from_vortex(self, experiment: Experiment) -> WorkbenchTool:
        widget = self._find_vortex_widget(experiment)
        if widget.tool is None:
            raise ValueError(f"{widget.label} does not contain a tube.")
        removed_tool = widget.tool
        widget.tool = None
        widget.vortex_run_duration_ms = 0.0
        widget.vortex_run_remaining_ms = 0.0
        return removed_tool


class PlaceToolOnVortexService(VortexServiceBase):
    def _run(self, experiment: Experiment, request: PlaceToolOnVortexRequest) -> None:
        new_tool = build_workbench_tool(request.tool_id)
        self.place_tool_on_vortex(experiment, new_tool, action_verb="placed on")


class MoveWorkbenchToolToVortexService(VortexServiceBase):
    def _run(self, experiment: Experiment, request: MoveWorkbenchToolToVortexRequest) -> None:
        source_slot = find_workbench_slot(experiment.workbench, request.source_slot_id)
        if source_slot.tool is None:
            raise ValueError(f"Place a tool on {source_slot.label} before moving it.")
        moved_tool = source_slot.tool
        source_slot.tool = None
        self.place_tool_on_vortex(experiment, moved_tool, action_verb="moved to")


class MoveRackToolToVortexService(VortexServiceBase):
    def _run(self, experiment: Experiment, request: MoveRackToolToVortexRequest) -> None:
        rack_slot = find_rack_slot(experiment.rack, request.rack_slot_id)
        if rack_slot.tool is None:
            raise ValueError(f"{rack_slot.label} does not contain a tool.")
        moved_tool = rack_slot.tool
        rack_slot.tool = None
        self.place_tool_on_vortex(experiment, moved_tool, action_verb="moved to")


class RestoreTrashedToolToVortexService(VortexServiceBase):
    def _run(self, experiment: Experiment, request: RestoreTrashedToolToVortexRequest) -> None:
        tool = find_trash_tool(experiment.trash, request.trash_tool_id)
        self.place_tool_on_vortex(experiment, tool, action_verb="restored to")
        experiment.trash.children = [t for t in experiment.trash.children if t.id != tool.id]
        experiment.trash.discarded_from.pop(tool.id, None)


class MoveVortexToolToWorkbenchService(VortexServiceBase):
    def _run(self, experiment: Experiment, request: MoveVortexToolToWorkbenchRequest) -> None:
        target_slot = find_workbench_slot(experiment.workbench, request.target_slot_id)
        if target_slot.tool is not None or target_slot.surface_produce_lots:
            raise ValueError(f"{target_slot.label} already contains a tool.")
        moved_tool = self.take_tool_from_vortex(experiment)
        target_slot.tool = moved_tool
        experiment.audit_log.append(f"{moved_tool.label} moved from Vortex mixer to {target_slot.label}.")


class DiscardVortexToolService(VortexServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        discarded_tool = self.take_tool_from_vortex(experiment)
        experiment.trash.children.append(discarded_tool)
        experiment.trash.discarded_from[discarded_tool.id] = "Vortex mixer"
        experiment.audit_log.append(f"{discarded_tool.label} discarded from Vortex mixer.")


class CloseVortexToolService(VortexServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        widget = self._find_vortex_widget(experiment)
        tool = self._require_vortex_tool(experiment)
        if not can_tool_be_sealed(tool.tool_type):
            raise ValueError(f"{tool.label} cannot be sealed.")

        tool.is_sealed = True
        tool.closure_fault = None
        tool.internal_pressure_bar = max(tool.internal_pressure_bar, 1.0)
        experiment.audit_log.append(f"{tool.label} sealed on {widget.label}.")


class OpenVortexToolService(VortexServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        widget = self._find_vortex_widget(experiment)
        tool = self._require_vortex_tool(experiment)
        if not can_tool_be_sealed(tool.tool_type):
            raise ValueError(f"{tool.label} cannot be opened.")

        vent_event = physical_simulation_service.vent_opened_tool(
            tool,
            material_states=experiment.produce_material_states,
        )
        tool.is_sealed = False
        tool.closure_fault = None
        if vent_event is not None and vent_event.lost_mass_g > 0:
            experiment.audit_log.append(
                f"{tool.label} vented at {format_volume(vent_event.pressure_bar)} bar on {widget.label}; "
                f"{format_volume(vent_event.lost_mass_g)} g of powder was lost."
            )
            return

        experiment.audit_log.append(f"{tool.label} opened on {widget.label}.")


class MoveAnalyticalBalanceToolToVortexService(VortexServiceBase):
    def _run(self, experiment: Experiment, request: MoveAnalyticalBalanceToolToVortexRequest) -> None:
        analytical_balance = find_workspace_widget(experiment.workspace, "analytical_balance")
        if analytical_balance.tool is None:
            raise ValueError("Analytical balance does not contain a tool.")
        moved_tool = analytical_balance.tool
        analytical_balance.tool = None
        self.place_tool_on_vortex(experiment, moved_tool, action_verb="moved to")


class MoveGrossBalanceToolToVortexService(VortexServiceBase):
    def _run(self, experiment: Experiment, request: MoveGrossBalanceToolToVortexRequest) -> None:
        gross_balance = find_workspace_widget(experiment.workspace, "gross_balance")
        if gross_balance.tool is None:
            raise ValueError("Gross balance does not contain a tool.")
        moved_tool = gross_balance.tool
        gross_balance.tool = None
        self.place_tool_on_vortex(experiment, moved_tool, action_verb="moved to")


class MoveVortexToolToAnalyticalBalanceService(VortexServiceBase):
    def _run(self, experiment: Experiment, request: MoveVortexToolToAnalyticalBalanceRequest) -> None:
        analytical_balance = find_workspace_widget(experiment.workspace, "analytical_balance")
        if analytical_balance.tool is not None:
            raise ValueError("Analytical balance already contains a tool.")
        moved_tool = self.take_tool_from_vortex(experiment)
        analytical_balance.tool = moved_tool
        experiment.audit_log.append(f"{moved_tool.label} moved from Vortex mixer to Analytical balance.")


class MoveVortexToolToGrossBalanceService(VortexServiceBase):
    def _run(self, experiment: Experiment, request: MoveVortexToolToGrossBalanceRequest) -> None:
        gross_balance = find_workspace_widget(experiment.workspace, "gross_balance")
        if gross_balance.tool is not None:
            raise ValueError("Gross balance already contains a tool.")
        moved_tool = self.take_tool_from_vortex(experiment)
        gross_balance.tool = moved_tool
        experiment.audit_log.append(f"{moved_tool.label} moved from Vortex mixer to Gross balance.")


class StartVortexCycleService(VortexServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        widget = self._find_vortex_widget(experiment)
        if widget.tool is None:
            raise ValueError(f"Place a tube on {widget.label} before starting it.")
        if widget.vortex_run_remaining_ms > 0:
            raise ValueError(f"{widget.label} is already running.")
        state = widget.tool.quechers_state
        if not state.is_usable:
            raise ValueError(f"{widget.tool.label} is contaminated and cannot be vortexed.")
        produce_state_ids = {fraction.produce_material_state_id for fraction in widget.tool.produce_fractions}
        has_slurry = any(
            state.id in produce_state_ids and state.material_state == "slurry"
            for state in experiment.produce_material_states
        ) or any(
            get_material_state_name(experiment.produce_material_states, lot.id) == "slurry"
            for lot in widget.tool.produce_lots
        )
        has_wet_contents = bool(widget.tool.liquids or has_slurry)
        faults: list[str] = []
        if has_wet_contents and not widget.tool.is_sealed:
            faults.append("vortexed_open")
        if has_wet_contents and not state.salts_added:
            faults.append("vortexed_without_salts")
        if faults:
            state.phase = "contaminated"
            state.faults = faults
            if "vortexed_open" in faults:
                experiment.audit_log.append(
                    f"{widget.tool.label} was vortexed without being sealed; its contents spilled and it is unusable."
                )
            elif "vortexed_without_salts" in faults:
                experiment.audit_log.append(
                    f"{widget.tool.label} was vortexed without QuEChERS salts; its walls are contaminated and it is unusable."
                )
        elif state.phase == "reacting":
            state.phase = "mixing"
        widget.vortex_run_duration_ms = _VORTEX_CYCLE_DURATION_MS
        widget.vortex_run_remaining_ms = _VORTEX_CYCLE_DURATION_MS
        experiment.audit_log.append(f"Vortex mixer started with {widget.tool.label}.")
