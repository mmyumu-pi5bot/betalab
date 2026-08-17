from __future__ import annotations

from dataclasses import dataclass

from app.domain.models import (
    Experiment,
    ProduceLot,
    WorkbenchLiquid,
    WorkbenchTool,
    WorkspaceWidget,
    new_id,
)
from app.domain.pesticide_catalog import generate_pesticide_residues
from app.domain.rules import can_tool_be_sealed, can_workspace_widget_be_stored
from app.domain.workbench_catalog import get_workbench_liquid_definition
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.helpers.lookups import (
    find_workspace_widget,
    find_workspace_widget_liquid,
    format_volume,
    round_volume,
)
from app.services.helpers.produce_canonical import sync_canonical_produce_model
from app.services.helpers.produce_material_states import (
    ensure_material_state,
    get_material_state_name,
    get_temperature_c,
    set_material_state_name,
    update_material_state,
)
from app.services.physical_simulation_service import PhysicalSimulationService
from app.services.received_sample_generation import build_received_sampling_bag

physical_simulation_service = PhysicalSimulationService()


@dataclass(frozen=True, slots=True)
class WorkspaceWidgetLayoutRequest:
    widget_id: str
    anchor: str
    offset_x: int
    offset_y: int


@dataclass(frozen=True, slots=True)
class WorkspaceWidgetRequest:
    widget_id: str


@dataclass(frozen=True, slots=True)
class AddLiquidToWorkspaceWidgetRequest:
    widget_id: str
    liquid_id: str
    volume_ml: float | None = None


@dataclass(frozen=True, slots=True)
class UpdateWorkspaceWidgetLiquidVolumeRequest:
    widget_id: str
    liquid_entry_id: str
    volume_ml: float


@dataclass(frozen=True, slots=True)
class WorkspaceWidgetLiquidRequest:
    widget_id: str
    liquid_entry_id: str


@dataclass(frozen=True, slots=True)
class AdvanceWorkspaceCryogenicsRequest:
    elapsed_ms: float


@dataclass(frozen=True, slots=True)
class CreateProduceLotRequest:
    produce_type: str


@dataclass(frozen=True, slots=True)
class CreateReceivedSamplingBagRequest:
    pass


class AddWorkspaceWidgetService(WriteDomainService[WorkspaceWidgetLayoutRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkspaceWidgetLayoutRequest) -> None:
        widget = find_workspace_widget(experiment.workspace, request.widget_id)
        _apply_widget_layout_request(widget, request)
        widget.is_trashed = False

        if not widget.is_present:
            widget.is_present = True
            experiment.audit_log.append(f"{widget.label} added to workspace.")
            return

        experiment.audit_log.append(f"{widget.label} repositioned in workspace.")


class MoveWorkspaceWidgetService(WriteDomainService[WorkspaceWidgetLayoutRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkspaceWidgetLayoutRequest) -> None:
        widget = find_workspace_widget(experiment.workspace, request.widget_id)
        if not widget.is_present:
            raise ValueError(f"{widget.label} must be added to the workspace before moving it.")

        _apply_widget_layout_request(widget, request)
        experiment.audit_log.append(f"{widget.label} moved in workspace.")


class StoreWorkspaceWidgetService(WriteDomainService[WorkspaceWidgetRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkspaceWidgetRequest) -> None:
        widget = find_workspace_widget(experiment.workspace, request.widget_id)
        if not can_workspace_widget_be_stored(widget.id):
            raise ValueError(f"{widget.label} cannot be stored.")
        if widget.id == "rack" and any(slot.tool is not None for slot in experiment.rack.slots):
            raise ValueError(f"Empty {widget.label} before storing it.")
        if widget.is_present and not _is_workspace_widget_empty(widget):
            raise ValueError(f"Empty {widget.label} before storing it.")
        if not widget.is_present and not widget.is_trashed:
            return

        if not widget.is_present and widget.is_trashed:
            widget.is_trashed = False
            experiment.audit_log.append(f"{widget.label} moved from trash to inventory.")
            return

        widget.is_present = False
        widget.is_trashed = False
        experiment.audit_log.append(f"{widget.label} stored in inventory.")


def _is_workspace_widget_empty(widget: WorkspaceWidget) -> bool:
    return widget.tool is None and not widget.produce_lots and not widget.liquids


class CreateReceivedSamplingBagService(WriteDomainService[CreateReceivedSamplingBagRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: CreateReceivedSamplingBagRequest) -> None:
        new_bag = build_received_sampling_bag(label="Received sampling bag")
        experiment.basket_tools.append(new_bag)
        experiment.audit_log.append(f"{new_bag.produce_lots[0].label} created in a received sampling bag.")


class CreateProduceLotService(WriteDomainService[CreateProduceLotRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: CreateProduceLotRequest) -> None:
        produce_type = request.produce_type
        if produce_type != "apple":
            raise ValueError("Unsupported produce type")

        apple_lot_count = sum(1 for lot in experiment.workspace.produce_basket_lots if lot.produce_type == produce_type)

        produce_lot = ProduceLot(
            id=new_id("produce"),
            label=f"Apple lot {apple_lot_count + 1}",
            produce_type=produce_type,
            unit_count=12,
            total_mass_g=2450.0,
            pesticide_residues=generate_pesticide_residues(produce_type),
        )

        experiment.workspace.produce_basket_lots.append(produce_lot)
        update_material_state(
            experiment.produce_material_states,
            produce_lot.id,
            pesticide_degradation_factors={cid: 1.0 for cid in produce_lot.pesticide_residues},
        )
        experiment.audit_log.append(f"{produce_lot.label} created in Produce basket.")


class CreateOrInitProduceLotService(WriteDomainService[CreateProduceLotRequest]):
    """Creates a new produce lot inside a received sampling bag in the basket."""

    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: CreateProduceLotRequest) -> None:
        produce_type = request.produce_type
        if produce_type != "apple":
            raise ValueError("Unsupported produce type")

        all_lots = [lot for bag in experiment.basket_tools for lot in bag.produce_lots]
        apple_lot_count = sum(1 for lot in all_lots if lot.produce_type == produce_type and lot.label.startswith("Apple lot"))

        produce_lot = ProduceLot(
            id=new_id("produce"),
            label=f"Apple lot {apple_lot_count + 1}",
            produce_type=produce_type,
            unit_count=12,
            total_mass_g=2450.0,
            pesticide_residues=generate_pesticide_residues(produce_type),
        )

        update_material_state(
            experiment.produce_material_states,
            produce_lot.id,
            pesticide_degradation_factors={cid: 1.0 for cid in produce_lot.pesticide_residues},
        )

        new_bag = build_received_sampling_bag(label="Received sampling bag")
        new_bag.produce_lots.clear()
        new_bag.produce_lots.append(produce_lot)
        experiment.basket_tools.append(new_bag)
        experiment.audit_log.append(f"{produce_lot.label} created in Produce basket.")


class AddLiquidToWorkspaceWidgetService(WriteDomainService[AddLiquidToWorkspaceWidgetRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: AddLiquidToWorkspaceWidgetRequest) -> None:
        widget = _find_grinder_widget(experiment, request.widget_id)
        liquid_definition = get_workbench_liquid_definition(request.liquid_id)

        if liquid_definition.id != "dry_ice_pellets":
            raise ValueError(f"{widget.label} only accepts dry ice pellets.")

        added_mass_g = round_volume(max(float(request.volume_ml or liquid_definition.transfer_volume_ml), 0.0))

        existing_liquid = next(
            (liquid for liquid in widget.liquids if liquid.liquid_id == liquid_definition.id),
            None,
        )
        if existing_liquid is None:
            widget.liquids.append(
                WorkbenchLiquid(
                    id=new_id("workspace_liquid"),
                    liquid_id=liquid_definition.id,
                    name=liquid_definition.name,
                    volume_ml=added_mass_g,
                    accent=liquid_definition.accent,
                )
            )
            experiment.audit_log.append(f"{liquid_definition.name} added to {widget.label}.")
            return

        existing_liquid.volume_ml = round_volume(existing_liquid.volume_ml + added_mass_g)
        experiment.audit_log.append(f"{liquid_definition.name} increased in {widget.label}.")


class UpdateWorkspaceWidgetLiquidVolumeService(WriteDomainService[UpdateWorkspaceWidgetLiquidVolumeRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: UpdateWorkspaceWidgetLiquidVolumeRequest) -> None:
        widget = _find_grinder_widget(experiment, request.widget_id)
        liquid_entry = find_workspace_widget_liquid(widget, request.liquid_entry_id)

        liquid_entry.volume_ml = round_volume(max(float(request.volume_ml), 0.0))
        if liquid_entry.volume_ml <= 0:
            widget.liquids = [liquid for liquid in widget.liquids if liquid.id != request.liquid_entry_id]
            experiment.audit_log.append(f"{liquid_entry.name} removed from {widget.label}.")
            return

        experiment.audit_log.append(f"{liquid_entry.name} adjusted to {format_volume(liquid_entry.volume_ml)} g in {widget.label}.")


class RemoveLiquidFromWorkspaceWidgetService(WriteDomainService[WorkspaceWidgetLiquidRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkspaceWidgetLiquidRequest) -> None:
        widget = _find_grinder_widget(experiment, request.widget_id)
        liquid_entry = find_workspace_widget_liquid(widget, request.liquid_entry_id)
        widget.liquids = [liquid for liquid in widget.liquids if liquid.id != liquid_entry.id]
        experiment.audit_log.append(f"{liquid_entry.name} removed from {widget.label}.")


class StartGrinderCycleService(WriteDomainService[WorkspaceWidgetRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkspaceWidgetRequest) -> None:
        widget = _find_grinder_widget(experiment, request.widget_id)
        if not widget.produce_lots:
            raise ValueError(f"{widget.label} does not contain a produce lot.")

        produce_lot = widget.produce_lots[0]
        material_state = get_material_state_name(experiment.produce_material_states, produce_lot.id)
        if material_state == "whole":
            raise ValueError(f"{produce_lot.label} must be cut before grinding.")
        if material_state == "ground":
            raise ValueError(f"{produce_lot.label} is already ground.")
        if get_temperature_c(experiment.produce_material_states, produce_lot.id) > physical_simulation_service.grinder_start_threshold_c:
            raise ValueError(f"{produce_lot.label} is not cold enough for cryogenic grinding.")
        if widget.grinder_run_remaining_ms > 0:
            return

        update_material_state(
            experiment.produce_material_states,
            produce_lot.id,
            grind_quality_label=None,
            homogeneity_score=None,
            grinding_elapsed_seconds=0.0,
            grinding_temperature_integral=0.0,
        )
        cycle_duration_ms = physical_simulation_service.grinder_cycle_duration_seconds * 1000.0
        widget.grinder_run_duration_ms = cycle_duration_ms
        widget.grinder_run_remaining_ms = cycle_duration_ms
        widget.grinder_fault = None
        experiment.audit_log.append(f"{produce_lot.label} grinding started in {widget.label}.")


class CompleteGrinderCycleService(WriteDomainService[WorkspaceWidgetRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkspaceWidgetRequest) -> None:
        complete_grinder_cycle(experiment, request.widget_id)


class AdvanceWorkspaceCryogenicsService(WriteDomainService[AdvanceWorkspaceCryogenicsRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: AdvanceWorkspaceCryogenicsRequest) -> None:
        advance_workspace_cryogenics_state(experiment, request.elapsed_ms)


def advance_workspace_cryogenics_state(experiment: Experiment, elapsed_ms: float) -> None:
    elapsed_ms = min(max(float(elapsed_ms), 0.0), 5000.0)
    if elapsed_ms <= 0:
        return

    elapsed_seconds = elapsed_ms / 1000.0
    quechers_tools: dict[str, WorkbenchTool] = {}
    for slot in experiment.workbench.slots:
        if slot.tool is not None:
            quechers_tools[slot.tool.id] = slot.tool
    for slot in experiment.rack.slots:
        if slot.tool is not None:
            quechers_tools[slot.tool.id] = slot.tool
    for tool in experiment.trash.children:
        quechers_tools[tool.id] = tool
    for tool in experiment.basket_tools:
        quechers_tools[tool.id] = tool
    for widget in experiment.workspace.widgets:
        if widget.tool is not None:
            quechers_tools[widget.tool.id] = widget.tool
    for tool in quechers_tools.values():
        physical_simulation_service.advance_tool_contents_temperature(
            tool, elapsed_seconds, experiment.produce_material_states
        )
        physical_simulation_service.advance_quechers_tool(
            tool, elapsed_seconds, material_states=experiment.produce_material_states
        )
        physical_simulation_service.advance_quechers_pesticide_degradation(
            tool, elapsed_seconds, experiment.produce_material_states
        )

    for widget in experiment.workspace.widgets:
        remaining_seconds = elapsed_seconds
        if widget.grinder_run_remaining_ms > 0:
            grinding_seconds = min(remaining_seconds, widget.grinder_run_remaining_ms / 1000.0)
            physical_simulation_service.advance_grinding_widget(
                widget,
                grinding_seconds,
                material_states=experiment.produce_material_states,
            )
            widget.grinder_run_remaining_ms = round_volume(max(widget.grinder_run_remaining_ms - (grinding_seconds * 1000.0), 0.0))
            remaining_seconds -= grinding_seconds

            loaded_lot = widget.produce_lots[0] if widget.produce_lots else None
            if (
                loaded_lot is not None
                and get_temperature_c(experiment.produce_material_states, loaded_lot.id) >= physical_simulation_service.grinder_jam_threshold_c
            ):
                widget.grinder_run_duration_ms = 0.0
                widget.grinder_run_remaining_ms = 0.0
                widget.grinder_fault = "motor_jammed"
                _discard_jammed_grinder_contents(experiment, widget, loaded_lot)
                continue

            if (
                loaded_lot is not None
                and get_temperature_c(experiment.produce_material_states, loaded_lot.id) >= physical_simulation_service.grinder_start_threshold_c
            ):
                widget.grinder_fault = "high_torque"
            elif widget.grinder_fault == "high_torque":
                widget.grinder_fault = None

            if widget.grinder_run_remaining_ms <= 0:
                complete_grinder_cycle(experiment, widget.id)

        if widget.vortex_run_remaining_ms > 0:
            vortex_elapsed_ms = min(elapsed_ms, widget.vortex_run_remaining_ms)
            if widget.tool is not None and widget.tool.quechers_state.phase != "contaminated":
                physical_simulation_service.advance_vortex_mixing(
                    widget.tool,
                    vortex_elapsed_ms / 1000.0,
                )
            widget.vortex_run_remaining_ms = round_volume(max(widget.vortex_run_remaining_ms - vortex_elapsed_ms, 0.0))
            if widget.vortex_run_remaining_ms <= 0:
                _complete_vortex_cycle(experiment, widget)

        if widget.centrifuge_run_remaining_ms > 0:
            centrifuge_elapsed_ms = min(elapsed_ms, widget.centrifuge_run_remaining_ms)
            widget.centrifuge_run_remaining_ms = round_volume(
                max(widget.centrifuge_run_remaining_ms - centrifuge_elapsed_ms, 0.0)
            )
            if widget.tool is not None:
                duration_ms = max(widget.centrifuge_run_duration_ms, 1.0)
                widget.tool.quechers_state.separation_progress = round_volume(
                    min(
                        1.0 - (widget.centrifuge_run_remaining_ms / duration_ms),
                        1.0,
                    )
                )
            if widget.centrifuge_run_remaining_ms <= 0:
                _complete_centrifuge_cycle(experiment, widget)

        if remaining_seconds > 0:
            physical_simulation_service.advance_widget(
                widget,
                remaining_seconds,
                material_states=experiment.produce_material_states,
            )

    for slot in experiment.workbench.slots:
        if slot.tool is not None:
            if slot.tool.is_sealed and can_tool_be_sealed(slot.tool.tool_type):
                pressure_event = physical_simulation_service.advance_sealed_tool(
                    slot.tool,
                    elapsed_seconds,
                    material_states=experiment.produce_material_states,
                )
                if pressure_event is not None and pressure_event.fault == "pressure_pop":
                    first_lot_label = slot.tool.produce_lots[0].label if slot.tool.produce_lots else "the sample"
                    experiment.audit_log.append(
                        f"{slot.tool.label} popped open on {slot.label} at {format_volume(pressure_event.pressure_bar)} bar; {format_volume(pressure_event.lost_mass_g)} g of {first_lot_label} was lost."
                    )
            else:
                physical_simulation_service.warm_produce_lots(
                    slot.tool.produce_lots,
                    elapsed_seconds,
                    material_states=experiment.produce_material_states,
                )
        physical_simulation_service.warm_produce_lots(
            slot.surface_produce_lots,
            elapsed_seconds,
            material_states=experiment.produce_material_states,
        )


def complete_grinder_cycle(experiment: Experiment, widget_id: str) -> None:
    widget = _find_grinder_widget(experiment, widget_id)
    if not widget.produce_lots:
        raise ValueError(f"{widget.label} does not contain a produce lot.")

    produce_lot = widget.produce_lots[0]
    material_state = get_material_state_name(experiment.produce_material_states, produce_lot.id)
    if material_state == "whole":
        raise ValueError(f"{produce_lot.label} must be cut before grinding.")
    if material_state == "ground":
        return

    homogeneity_score, grind_quality_label = physical_simulation_service.score_grind_result(
        ensure_material_state(experiment.produce_material_states, produce_lot.id)
    )
    residual_dry_ice_mass_g = sum(liquid.volume_ml for liquid in widget.liquids if liquid.liquid_id == "dry_ice_pellets")
    set_material_state_name(experiment.produce_material_states, produce_lot.id, "ground")
    update_material_state(
        experiment.produce_material_states,
        produce_lot.id,
        homogeneity_score=homogeneity_score,
        grind_quality_label=grind_quality_label,
        residual_co2_mass_g=round_volume(max(residual_dry_ice_mass_g, 0.0)),
    )
    widget.grinder_run_duration_ms = 0.0
    widget.grinder_run_remaining_ms = 0.0
    widget.grinder_fault = None
    widget.liquids = [liquid for liquid in widget.liquids if liquid.liquid_id != "dry_ice_pellets"]
    sync_canonical_produce_model(experiment)
    experiment.audit_log.append(f"{produce_lot.label} ground in {widget.label}.")


def _apply_widget_layout_request(widget: WorkspaceWidget, request: WorkspaceWidgetLayoutRequest) -> None:
    widget.anchor = request.anchor
    widget.offset_x = request.offset_x
    widget.offset_y = request.offset_y


def _find_grinder_widget(experiment: Experiment, widget_id: str) -> WorkspaceWidget:
    widget = find_workspace_widget(experiment.workspace, widget_id)
    if widget.id != "grinder" or widget.widget_type != "cryogenic_grinder":
        raise ValueError(f"{widget.label} does not accept grinder contents.")
    return widget


def _discard_jammed_grinder_contents(
    experiment: Experiment,
    widget: WorkspaceWidget,
    produce_lot: ProduceLot,
) -> None:
    set_material_state_name(experiment.produce_material_states, produce_lot.id, "waste")
    update_material_state(
        experiment.produce_material_states,
        produce_lot.id,
        grind_quality_label="waste",
        homogeneity_score=0.0,
    )
    widget.liquids = []
    sync_canonical_produce_model(experiment)
    experiment.audit_log.append(f"{produce_lot.label} jammed {widget.label} motor and became waste.")


def _complete_vortex_cycle(experiment: Experiment, widget: WorkspaceWidget) -> None:
    widget.vortex_run_duration_ms = 0.0
    widget.vortex_run_remaining_ms = 0.0
    if widget.tool is None:
        return
    if widget.tool.quechers_state.phase == "contaminated":
        return
    if widget.tool.quechers_state.phase == "mixing":
        widget.tool.quechers_state.phase = "mixed"
        physical_simulation_service.complete_quechers_extraction(widget.tool)
    is_mixed = widget.tool.contents_homogeneity >= 0.9
    for fraction in widget.tool.produce_fractions:
        fraction.is_mixed = is_mixed
    experiment.audit_log.append(f"{widget.tool.label} successfully vortexed on {widget.label}.")


def _complete_centrifuge_cycle(experiment: Experiment, widget: WorkspaceWidget) -> None:
    widget.centrifuge_run_remaining_ms = 0.0
    widget.centrifuge_speed_rpm = 0
    if widget.tool is None:
        return
    widget.tool.quechers_state.phase = "separated"
    widget.tool.quechers_state.separation_progress = 1.0
    experiment.audit_log.append(f"{widget.tool.label} separated in {widget.label}.")


def _remove_widget_produce_lot(widget: WorkspaceWidget, produce_lot_id: str) -> ProduceLot:
    produce_lot = next((lot for lot in widget.produce_lots if lot.id == produce_lot_id), None)
    if produce_lot is None:
        raise ValueError("Unknown produce lot")

    widget.produce_lots = [lot for lot in widget.produce_lots if lot.id != produce_lot.id]
    return produce_lot
