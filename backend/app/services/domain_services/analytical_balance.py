from __future__ import annotations

import random
from dataclasses import dataclass

from app.domain.dnd_rules import get_tool_allowed_drop_targets
from app.domain.models import Experiment, WorkbenchTool, WorkspaceWidget
from app.domain.rules import can_tool_be_sealed
from app.domain.spatula_rules import can_spatula_load_from_tool, can_spatula_pour_into_tool
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.helpers.lookups import (
    build_manual_label,
    find_rack_slot,
    find_tool_label,
    find_trash_tool,
    find_workbench_slot,
    find_workspace_widget,
)
from app.services.helpers.produce_canonical import (
    GROUND_POWDER_APPARENT_DENSITY_G_PER_ML,
    get_spatula_total_produce_mass_g,
    get_tool_remaining_fill_capacity_ml,
    get_tool_total_powder_mass_g,
    get_tool_total_produce_mass_g,
    pour_spatula_into_tool,
    split_tool_powder_into_spatula,
)
from app.services.helpers.tool_liquids import add_liquid_to_tool
from app.services.helpers.workbench import build_workbench_tool
from app.services.physical_simulation_service import PhysicalSimulationService

_ANALYTICAL_BALANCE_MAX_G = 220.0
_ANALYTICAL_BALANCE_TARGET_MIN_G = 9.8
_ANALYTICAL_BALANCE_TARGET_MAX_G = 10.2
physical_simulation_service = PhysicalSimulationService()
_TARE_BY_TOOL_TYPE_G: dict[str, float] = {
    "volumetric_flask": 140.0,
    "amber_bottle": 95.0,
    "sample_vial": 1.5,
    "beaker": 68.0,
    "centrifuge_tube": 12.0,
    "cleanup_tube": 7.0,
    "cutting_board": 320.0,
    "sample_bag": 36.0,
    "storage_jar": 180.0,
}


@dataclass(frozen=True, slots=True)
class EmptyRequest:
    pass


@dataclass(frozen=True, slots=True)
class MoveWorkbenchToolToAnalyticalBalanceRequest:
    source_slot_id: str


@dataclass(frozen=True, slots=True)
class PlaceToolOnAnalyticalBalanceRequest:
    tool_id: str


@dataclass(frozen=True, slots=True)
class MoveRackToolToAnalyticalBalanceRequest:
    rack_slot_id: str


@dataclass(frozen=True, slots=True)
class RestoreTrashedToolToAnalyticalBalanceRequest:
    trash_tool_id: str


@dataclass(frozen=True, slots=True)
class MoveGrossBalanceToolToAnalyticalBalanceRequest:
    pass


@dataclass(frozen=True, slots=True)
class MoveAnalyticalBalanceToolToWorkbenchRequest:
    target_slot_id: str


@dataclass(frozen=True, slots=True)
class MoveAnalyticalBalanceToolToRackRequest:
    rack_slot_id: str


@dataclass(frozen=True, slots=True)
class UpdateAnalyticalBalanceToolSampleLabelTextRequest:
    label_id: str
    sample_label_text: str


@dataclass(frozen=True, slots=True)
class AddLiquidToAnalyticalBalanceToolRequest:
    liquid_id: str
    volume_ml: float | None = None


@dataclass(frozen=True, slots=True)
class PourSpatulaIntoAnalyticalBalanceToolRequest:
    delta_mass_g: float


class AnalyticalBalanceServiceBase(WriteDomainService[object]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _find_analytical_balance_widget(self, experiment: Experiment) -> WorkspaceWidget:
        widget = find_workspace_widget(experiment.workspace, "analytical_balance")
        if widget.widget_type != "analytical_balance":
            raise ValueError(f"{widget.label} is not an analytical balance.")
        return widget

    def _validate_balance_empty(self, widget: WorkspaceWidget) -> None:
        if widget.tool is not None:
            raise ValueError(f"{widget.label} already contains a tool.")

    def require_balance_tool(self, experiment: Experiment) -> WorkbenchTool:
        widget = self._find_analytical_balance_widget(experiment)
        if widget.tool is None:
            raise ValueError(f"{widget.label} does not contain a tube.")
        return widget.tool

    def _validate_supported_tool(self, tool: WorkbenchTool) -> None:
        if "analytical_balance_widget" not in get_tool_allowed_drop_targets(tool.tool_type):
            raise ValueError(f"The analytical balance cannot accept {tool.label.lower()}.")

    def _calculate_tool_mass_g(self, tool: WorkbenchTool) -> float:
        produce_mass_g = get_tool_total_produce_mass_g(tool)
        liquid_mass_g = sum(liquid.volume_ml for liquid in tool.liquids)
        return round(
            _TARE_BY_TOOL_TYPE_G.get(tool.tool_type, 0.0) + produce_mass_g + liquid_mass_g,
            3,
        )

    def place_tool_on_balance(
        self,
        experiment: Experiment,
        tool: WorkbenchTool,
        *,
        action_verb: str = "placed on",
    ) -> None:
        self._validate_supported_tool(tool)
        widget = self._find_analytical_balance_widget(experiment)
        self._validate_balance_empty(widget)
        widget.tool = tool
        experiment.audit_log.append(f"{tool.label} {action_verb} {widget.label}.")

    def take_tool_from_balance(self, experiment: Experiment) -> WorkbenchTool:
        widget = self._find_analytical_balance_widget(experiment)
        if widget.tool is None:
            raise ValueError(f"{widget.label} does not contain a tube.")
        removed_tool = widget.tool
        widget.tool = None
        return removed_tool


class MoveWorkbenchToolToAnalyticalBalanceService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: MoveWorkbenchToolToAnalyticalBalanceRequest) -> None:
        source_slot = find_workbench_slot(experiment.workbench, request.source_slot_id)
        if source_slot.tool is None:
            raise ValueError(f"Place a tool on {source_slot.label} before moving it.")
        moved_tool = source_slot.tool
        source_slot.tool = None
        self.place_tool_on_balance(experiment, moved_tool, action_verb="moved to")


class PlaceToolOnAnalyticalBalanceService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: PlaceToolOnAnalyticalBalanceRequest) -> None:
        tool = build_workbench_tool(request.tool_id)
        self.place_tool_on_balance(experiment, tool)


class MoveRackToolToAnalyticalBalanceService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: MoveRackToolToAnalyticalBalanceRequest) -> None:
        rack_slot = find_rack_slot(experiment.rack, request.rack_slot_id)
        if rack_slot.tool is None:
            raise ValueError(f"{rack_slot.label} does not contain a tool.")
        moved_tool = rack_slot.tool
        rack_slot.tool = None
        self.place_tool_on_balance(experiment, moved_tool, action_verb="moved to")


class RestoreTrashedToolToAnalyticalBalanceService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: RestoreTrashedToolToAnalyticalBalanceRequest) -> None:
        tool = find_trash_tool(experiment.trash, request.trash_tool_id)
        experiment.trash.children = [t for t in experiment.trash.children if t.id != tool.id]
        experiment.trash.discarded_from.pop(tool.id, None)
        self.place_tool_on_balance(experiment, tool, action_verb="restored to")


class MoveGrossBalanceToolToAnalyticalBalanceService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: MoveGrossBalanceToolToAnalyticalBalanceRequest) -> None:
        gross_balance = find_workspace_widget(experiment.workspace, "gross_balance")
        if gross_balance.tool is None:
            raise ValueError("Gross balance does not contain a tool.")
        moved_tool = gross_balance.tool
        gross_balance.tool = None
        experiment.lims_reception.measured_gross_mass_g = None
        self.place_tool_on_balance(experiment, moved_tool, action_verb="moved to")


class MoveAnalyticalBalanceToolToWorkbenchService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: MoveAnalyticalBalanceToolToWorkbenchRequest) -> None:
        target_slot = find_workbench_slot(experiment.workbench, request.target_slot_id)
        if target_slot.tool is not None or target_slot.surface_produce_lots:
            raise ValueError(f"{target_slot.label} already contains a tool")
        moved_tool = self.take_tool_from_balance(experiment)
        target_slot.tool = moved_tool
        experiment.audit_log.append(f"{moved_tool.label} moved from Analytical balance to {target_slot.label}.")


class MoveAnalyticalBalanceToolToRackService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: MoveAnalyticalBalanceToolToRackRequest) -> None:
        target_slot = find_rack_slot(experiment.rack, request.rack_slot_id)
        if target_slot.tool is not None:
            raise ValueError(f"{target_slot.label} already contains a tool")
        moved_tool = self.take_tool_from_balance(experiment)
        target_slot.tool = moved_tool
        experiment.audit_log.append(f"{moved_tool.label} moved from Analytical balance to {target_slot.label}.")


class DiscardAnalyticalBalanceToolService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        discarded_tool = self.take_tool_from_balance(experiment)
        experiment.trash.children.append(discarded_tool)
        experiment.trash.discarded_from[discarded_tool.id] = "Analytical balance"
        experiment.audit_log.append(f"{discarded_tool.label} discarded from Analytical balance.")


class TareAnalyticalBalanceService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        widget = self._find_analytical_balance_widget(experiment)
        measured_mass_g = self._calculate_tool_mass_g(widget.tool) if widget.tool is not None else 0.0
        experiment.analytical_balance.tare_mass_g = measured_mass_g
        experiment.audit_log.append(f"Analytical balance tared at {measured_mass_g:.3f} g.")


class OpenAnalyticalBalanceToolService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        tool = self.require_balance_tool(experiment)
        if not can_tool_be_sealed(tool.tool_type):
            raise ValueError(f"{tool.label} does not support sealing.")

        vent_event = physical_simulation_service.vent_opened_tool(
            tool,
            material_states=experiment.produce_material_states,
        )
        tool.is_sealed = False
        tool.closure_fault = None
        if vent_event is not None and vent_event.lost_mass_g > 0:
            experiment.audit_log.append(
                f"{tool.label} vented at {vent_event.pressure_bar:.3f} bar on Analytical balance; {vent_event.lost_mass_g:.3f} g of powder was lost."
            )
            return

        experiment.audit_log.append(f"{tool.label} opened on Analytical balance.")


class CloseAnalyticalBalanceToolService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        tool = self.require_balance_tool(experiment)
        if not can_tool_be_sealed(tool.tool_type):
            raise ValueError(f"{tool.label} does not support sealing.")

        tool.is_sealed = True
        tool.closure_fault = None
        tool.internal_pressure_bar = max(tool.internal_pressure_bar, 1.0)
        experiment.audit_log.append(f"{tool.label} sealed on Analytical balance.")


class AddLiquidToAnalyticalBalanceToolService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: AddLiquidToAnalyticalBalanceToolRequest) -> None:
        tool = self.require_balance_tool(experiment)
        add_liquid_to_tool(
            experiment,
            tool,
            liquid_id=request.liquid_id,
            volume_ml=request.volume_ml,
        )


class ApplySampleLabelToAnalyticalBalanceToolService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        tool = self.require_balance_tool(experiment)
        tool.labels.append(build_manual_label())
        experiment.audit_log.append(f"Manual label applied to {tool.label} on Analytical balance.")


class UpdateAnalyticalBalanceToolSampleLabelTextService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: UpdateAnalyticalBalanceToolSampleLabelTextRequest) -> None:
        tool = self.require_balance_tool(experiment)
        label = find_tool_label(tool, request.label_id)
        if label.label_kind != "manual":
            raise ValueError("Only manual labels can be edited.")

        next_text = request.sample_label_text.strip()
        label.text = next_text
        if next_text:
            experiment.audit_log.append(f"Sample label updated to {next_text} on {tool.label} on Analytical balance.")
            return

        experiment.audit_log.append(f"Sample label cleared on {tool.label} on Analytical balance.")


class PourSpatulaIntoAnalyticalBalanceToolService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: PourSpatulaIntoAnalyticalBalanceToolRequest) -> None:
        widget = self._find_analytical_balance_widget(experiment)
        tool = self.require_balance_tool(experiment)
        if not can_spatula_pour_into_tool(tool.tool_type):
            raise ValueError("The spatula can only pour into an autosampler vial or centrifuge tube.")
        if tool.is_sealed:
            raise ValueError(f"Open {tool.label} before adding powder.")
        total_loaded_g = get_spatula_total_produce_mass_g(experiment.spatula)
        if not experiment.spatula.is_loaded or total_loaded_g <= 0:
            raise ValueError("Load the spatula before pouring.")

        requested_mass_g = max(float(request.delta_mass_g), 0.0)
        if requested_mass_g <= 0:
            return

        remaining_capacity_ml = get_tool_remaining_fill_capacity_ml(
            tool,
            material_states=experiment.produce_material_states,
        )
        if remaining_capacity_ml <= 0:
            raise ValueError(f"{tool.label} is already full.")

        max_transferable_mass_g = round(remaining_capacity_ml * GROUND_POWDER_APPARENT_DENSITY_G_PER_ML, 3)
        transferred_mass_g = min(requested_mass_g, total_loaded_g, max_transferable_mass_g)
        if transferred_mass_g <= 0:
            raise ValueError(f"{tool.label} is already full.")
        pour_spatula_into_tool(
            experiment.spatula,
            tool,
            transferred_mass_g=transferred_mass_g,
            material_states=experiment.produce_material_states,
            location_kind="workspace_widget_tool",
            location_id=widget.id,
        )

        experiment.audit_log.append(f"Powder transferred into {tool.label} on Analytical balance.")


class LoadSpatulaFromAnalyticalBalanceToolService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        from app.services.domain_services.workbench import SPATULA_CAPACITY_G

        tool = self.require_balance_tool(experiment)
        if not can_spatula_load_from_tool(tool.tool_type):
            raise ValueError("The spatula cannot be loaded from this container.")
        if tool.is_sealed:
            raise ValueError(f"Open {tool.label} before loading the spatula.")
        if experiment.spatula.is_loaded and get_spatula_total_produce_mass_g(experiment.spatula) > 0:
            raise ValueError("Empty the spatula before loading it again.")

        total_powder_g = get_tool_total_powder_mass_g(tool, material_states=experiment.produce_material_states)
        if total_powder_g <= 0:
            raise ValueError(f"{tool.label} is empty.")

        fill_ratio = random.gauss(mu=0.675, sigma=0.15)
        fill_ratio = max(0.30, min(1.0, fill_ratio))
        loaded_mass_g = min(SPATULA_CAPACITY_G, total_powder_g, round(SPATULA_CAPACITY_G * fill_ratio, 3))
        if loaded_mass_g <= 0:
            raise ValueError(f"{tool.label} is empty.")

        split_tool_powder_into_spatula(
            tool,
            experiment.spatula,
            loaded_mass_g=loaded_mass_g,
            material_states=experiment.produce_material_states,
        )
        experiment.audit_log.append(f"Spatula loaded from {tool.label} on Analytical balance.")


class RecordAnalyticalSampleMassService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        tool = self.require_balance_tool(experiment)
        measured_mass_g = self._calculate_tool_mass_g(tool)
        if measured_mass_g > _ANALYTICAL_BALANCE_MAX_G:
            raise ValueError("ERR_OVER: OVERLOAD : Retirez l'objet immediatement du plateau.")

        tare_mass_g = experiment.analytical_balance.tare_mass_g
        if tare_mass_g is None:
            raise ValueError("ERR_TARE: Erreur de tare : le contenant semble trop lourd ou non remis a zero.")

        net_mass_g = round(measured_mass_g - tare_mass_g, 3)
        if net_mass_g < _ANALYTICAL_BALANCE_TARGET_MIN_G or net_mass_g > _ANALYTICAL_BALANCE_TARGET_MAX_G:
            raise ValueError("ERR_RANGE: Masse hors specifications. Ajustez la quantite de poudre.")

        experiment.lims_reception.measured_sample_mass_g = net_mass_g
        experiment.audit_log.append(f"Analytical sample mass recorded at {net_mass_g:.3f} g.")
