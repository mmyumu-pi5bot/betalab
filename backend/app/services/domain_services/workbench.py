from __future__ import annotations

import random
from dataclasses import dataclass

from app.domain.dnd_rules import can_tool_be_discarded, can_tool_be_stored
from app.domain.models import (
    Experiment,
    ProduceMaterialState,
    TrashSampleLabelEntry,
    WorkbenchSlot,
    WorkbenchTool,
    new_id,
)
from app.domain.rules import can_tool_be_sealed
from app.domain.spatula_rules import can_spatula_load_from_tool, can_spatula_pour_into_tool
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.helpers.lookups import (
    build_manual_label,
    find_tool_label,
    find_trash_tool,
    find_workbench_slot,
    format_volume,
    round_volume,
)
from app.services.helpers.produce_canonical import (
    GROUND_POWDER_APPARENT_DENSITY_G_PER_ML,
    get_spatula_total_produce_mass_g,
    get_tool_remaining_fill_capacity_ml,
    get_tool_total_powder_mass_g,
    pour_spatula_into_tool,
    split_tool_powder_into_spatula,
    sync_canonical_produce_model,
)
from app.services.helpers.produce_material_states import (
    get_material_state_name,
    set_material_state_name,
)
from app.services.helpers.tool_liquids import (
    add_liquid_to_tool,
    raise_if_quechers_unusable,
    remove_liquid_from_tool,
)
from app.services.helpers.workbench import (
    build_workbench_tool,
    find_produce_lot_in_slot,
    find_tool_liquid,
    get_next_workbench_slot_index,
    pop_tool_label,
    require_slot_tool,
)
from app.services.physical_simulation_service import PhysicalSimulationService

physical_simulation_service = PhysicalSimulationService()
SPATULA_CAPACITY_G = 5.0


@dataclass(frozen=True, slots=True)
class EmptyWorkbenchRequest:
    pass


@dataclass(frozen=True, slots=True)
class WorkbenchSlotRequest:
    slot_id: str


@dataclass(frozen=True, slots=True)
class PlaceToolOnWorkbenchRequest:
    slot_id: str
    tool_id: str


@dataclass(frozen=True, slots=True)
class MoveToolBetweenWorkbenchSlotsRequest:
    source_slot_id: str
    target_slot_id: str


@dataclass(frozen=True, slots=True)
class RestoreTrashedToolToWorkbenchSlotRequest:
    trash_tool_id: str
    target_slot_id: str


@dataclass(frozen=True, slots=True)
class DiscardToolFromPaletteRequest:
    tool_id: str


@dataclass(frozen=True, slots=True)
class DiscardSampleLabelFromPaletteRequest:
    sample_label_id: str


@dataclass(frozen=True, slots=True)
class AddLiquidToWorkbenchToolRequest:
    slot_id: str
    liquid_id: str
    volume_ml: float | None = None


@dataclass(frozen=True, slots=True)
class WorkbenchLiquidRequest:
    slot_id: str
    liquid_entry_id: str


@dataclass(frozen=True, slots=True)
class UpdateWorkbenchLiquidVolumeRequest:
    slot_id: str
    liquid_entry_id: str
    volume_ml: float


@dataclass(frozen=True, slots=True)
class WorkbenchProduceLotRequest:
    slot_id: str
    produce_lot_id: str


@dataclass(frozen=True, slots=True)
class UpdateWorkbenchToolSampleLabelTextRequest:
    slot_id: str
    label_id: str
    sample_label_text: str


@dataclass(frozen=True, slots=True)
class WorkbenchSampleLabelRequest:
    slot_id: str
    label_id: str


@dataclass(frozen=True, slots=True)
class PourSpatulaIntoWorkbenchToolRequest:
    slot_id: str
    delta_mass_g: float


class AddWorkbenchSlotService(WriteDomainService[EmptyWorkbenchRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: EmptyWorkbenchRequest) -> None:
        next_index = get_next_workbench_slot_index(experiment.workbench.slots)
        experiment.workbench.slots.append(
            WorkbenchSlot(
                id=f"station_{next_index}",
                label=f"Station {next_index}",
            )
        )
        experiment.audit_log.append(f"Station {next_index} added to workbench.")


class RemoveWorkbenchSlotService(WriteDomainService[WorkbenchSlotRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkbenchSlotRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        if slot.tool is not None or slot.surface_produce_lots:
            raise ValueError(f"{slot.label} must be empty before it can be removed.")

        experiment.workbench.slots = [existing_slot for existing_slot in experiment.workbench.slots if existing_slot.id != slot.id]
        experiment.audit_log.append(f"{slot.label} removed from workbench.")


class PlaceToolOnWorkbenchService(WriteDomainService[PlaceToolOnWorkbenchRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: PlaceToolOnWorkbenchRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        if slot.tool is not None or slot.surface_produce_lots:
            raise ValueError(f"{slot.label} already contains a tool")

        slot.tool = build_workbench_tool(request.tool_id)
        experiment.audit_log.append(f"{slot.tool.label} placed on {slot.label}.")


class MoveToolBetweenWorkbenchSlotsService(WriteDomainService[MoveToolBetweenWorkbenchSlotsRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: MoveToolBetweenWorkbenchSlotsRequest) -> None:
        source_slot = find_workbench_slot(experiment.workbench, request.source_slot_id)
        target_slot = find_workbench_slot(experiment.workbench, request.target_slot_id)

        if source_slot.id == target_slot.id:
            return
        if source_slot.tool is None:
            raise ValueError(f"Place a tool on {source_slot.label} before moving it.")
        if target_slot.tool is not None or target_slot.surface_produce_lots:
            raise ValueError(f"{target_slot.label} already contains a tool")

        moved_tool = source_slot.tool
        source_slot.tool = None
        target_slot.tool = moved_tool
        experiment.audit_log.append(f"{moved_tool.label} moved from {source_slot.label} to {target_slot.label}.")


class DiscardWorkbenchToolService(WriteDomainService[WorkbenchSlotRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkbenchSlotRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        if slot.tool is None:
            raise ValueError(f"Place a tool on {slot.label} before discarding it.")
        if not can_tool_be_discarded(slot.tool.tool_type):
            raise ValueError(f"{slot.tool.label} must be stored in inventory instead of discarded.")

        discarded_tool = slot.tool
        slot.tool = None
        experiment.trash.children.append(discarded_tool)
        experiment.trash.discarded_from[discarded_tool.id] = slot.label
        experiment.audit_log.append(f"{discarded_tool.label} discarded from {slot.label}.")


class StoreWorkbenchToolService(WriteDomainService[WorkbenchSlotRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkbenchSlotRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        if slot.tool is None:
            raise ValueError(f"Place a tool on {slot.label} before storing it.")
        if not can_tool_be_stored(slot.tool.tool_type):
            raise ValueError(f"{slot.tool.label} cannot be stored.")
        if slot.tool.produce_lots or slot.tool.produce_fractions or slot.tool.liquids or slot.tool.labels:
            raise ValueError(f"Empty {slot.tool.label} before storing it.")

        stored_tool = slot.tool
        slot.tool = None
        experiment.audit_log.append(f"{stored_tool.label} stored in inventory.")


class DiscardToolFromPaletteService(WriteDomainService[DiscardToolFromPaletteRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: DiscardToolFromPaletteRequest) -> None:
        discarded_tool = build_workbench_tool(request.tool_id)
        if not can_tool_be_discarded(discarded_tool.tool_type):
            raise ValueError(f"{discarded_tool.label} must be stored in inventory instead of discarded.")
        experiment.trash.children.append(discarded_tool)
        experiment.trash.discarded_from[discarded_tool.id] = "Palette"
        experiment.audit_log.append(f"{discarded_tool.label} discarded from Palette.")


class DiscardSampleLabelFromPaletteService(WriteDomainService[DiscardSampleLabelFromPaletteRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: DiscardSampleLabelFromPaletteRequest) -> None:
        experiment.trash.sample_labels.append(
            TrashSampleLabelEntry(
                id=new_id("trash_sample_label"),
                origin_label="Palette",
                label=build_manual_label(text=""),
            )
        )
        experiment.audit_log.append("Manual label discarded from Palette.")


class RestoreTrashedToolToWorkbenchSlotService(WriteDomainService[RestoreTrashedToolToWorkbenchSlotRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: RestoreTrashedToolToWorkbenchSlotRequest) -> None:
        tool = find_trash_tool(experiment.trash, request.trash_tool_id)
        target_slot = find_workbench_slot(experiment.workbench, request.target_slot_id)

        if target_slot.tool is not None or target_slot.surface_produce_lots:
            raise ValueError(f"{target_slot.label} already contains a tool")

        target_slot.tool = tool
        experiment.trash.children = [t for t in experiment.trash.children if t.id != tool.id]
        experiment.trash.discarded_from.pop(tool.id, None)
        experiment.audit_log.append(f"{target_slot.tool.label} restored from trash to {target_slot.label}.")


class AddLiquidToWorkbenchToolService(WriteDomainService[AddLiquidToWorkbenchToolRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: AddLiquidToWorkbenchToolRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        tool = require_slot_tool(slot, "adding liquids")
        add_liquid_to_existing_tool(
            experiment,
            tool,
            liquid_id=request.liquid_id,
            volume_ml=request.volume_ml,
        )


def add_liquid_to_existing_tool(
    experiment: Experiment,
    tool: WorkbenchTool,
    *,
    liquid_id: str,
    volume_ml: float | None,
) -> None:
    powder_present_before_addition = get_tool_total_powder_mass_g(
        tool,
        material_states=experiment.produce_material_states,
    ) > 0 or any(
        get_material_state_name(experiment.produce_material_states, produce_lot.id) == "ground"
        for produce_lot in tool.produce_lots
    )
    add_liquid_to_tool(
        experiment,
        tool,
        liquid_id=liquid_id,
        volume_ml=volume_ml,
    )
    if powder_present_before_addition:
        _convert_ground_produce_to_slurry(experiment, tool)


class RemoveLiquidFromWorkbenchToolService(WriteDomainService[WorkbenchLiquidRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkbenchLiquidRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        tool = require_slot_tool(slot, "editing liquids")
        raise_if_quechers_unusable(tool)
        _raise_if_tool_contains_slurry(
            experiment,
            tool,
            action="removed",
        )
        liquid_entry = find_tool_liquid(tool, request.liquid_entry_id)
        remove_liquid_from_tool(tool, liquid_entry)
        experiment.audit_log.append(f"{liquid_entry.name} removed from {tool.label}.")


class UpdateWorkbenchLiquidVolumeService(WriteDomainService[UpdateWorkbenchLiquidVolumeRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: UpdateWorkbenchLiquidVolumeRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        tool = require_slot_tool(slot, "editing liquids")
        raise_if_quechers_unusable(tool)
        _raise_if_tool_contains_slurry(
            experiment,
            tool,
            action="edited",
        )
        liquid_entry = find_tool_liquid(tool, request.liquid_entry_id)
        previous_nominal_volume = liquid_entry.volume_ml
        previous_true_volume = liquid_entry.true_volume_ml or previous_nominal_volume

        requested_volume = round_volume(max(float(request.volume_ml), 0.0))
        max_allowed_volume = round_volume(
            get_tool_remaining_fill_capacity_ml(
                tool,
                material_states=experiment.produce_material_states,
                excluded_liquid_id=liquid_entry.id,
            )
        )
        liquid_entry.volume_ml = round_volume(min(requested_volume, max_allowed_volume))
        if liquid_entry.volume_ml <= 0:
            remove_liquid_from_tool(tool, liquid_entry)
            experiment.audit_log.append(f"{liquid_entry.name} removed from {tool.label}.")
            return

        error_factor = (
            previous_true_volume / previous_nominal_volume
            if previous_nominal_volume > 0
            else 1.0
        )
        liquid_entry.true_volume_ml = round(liquid_entry.volume_ml * error_factor, 6)

        experiment.audit_log.append(f"{liquid_entry.name} adjusted to {format_volume(liquid_entry.volume_ml)} mL in {tool.label}.")


def _tool_contains_slurry(experiment: Experiment, tool: WorkbenchTool) -> bool:
    if any(get_material_state_name(experiment.produce_material_states, produce_lot.id) == "slurry" for produce_lot in tool.produce_lots):
        return True
    state_ids = {fraction.produce_material_state_id for fraction in tool.produce_fractions}
    return any(state.id in state_ids and state.material_state == "slurry" for state in experiment.produce_material_states)


def _raise_if_tool_contains_slurry(
    experiment: Experiment,
    tool: WorkbenchTool,
    *,
    action: str,
) -> None:
    if _tool_contains_slurry(experiment, tool):
        raise ValueError(f"Liquid in {tool.label} cannot be {action} after it has mixed into slurry.")


def _convert_ground_produce_to_slurry(experiment: Experiment, tool: WorkbenchTool) -> None:
    converted_any = False
    cloned_state_ids_by_original_id: dict[str, str] = {}
    tool_fraction_object_ids = {id(fraction) for fraction in tool.produce_fractions}
    states_by_id = {state.id: state for state in experiment.produce_material_states}

    def state_is_shared_outside_tool(state_id: str) -> bool:
        return any(
            fraction.produce_material_state_id == state_id and id(fraction) not in tool_fraction_object_ids
            for fraction in _iter_experiment_produce_fractions(experiment)
        )

    for produce_lot in tool.produce_lots:
        if any(fraction.produce_lot_id == produce_lot.id for fraction in tool.produce_fractions):
            continue
        if get_material_state_name(experiment.produce_material_states, produce_lot.id) != "ground":
            continue
        set_material_state_name(experiment.produce_material_states, produce_lot.id, "slurry")
        converted_any = True

    for fraction in tool.produce_fractions:
        state = states_by_id.get(fraction.produce_material_state_id)
        if state is None or state.material_state != "ground":
            continue
        cloned_state_id = cloned_state_ids_by_original_id.get(state.id)
        if cloned_state_id is not None:
            fraction.produce_material_state_id = cloned_state_id
            state = states_by_id[cloned_state_id]
        elif state_is_shared_outside_tool(state.id):
            cloned_state = _clone_material_state(state)
            experiment.produce_material_states.append(cloned_state)
            states_by_id[cloned_state.id] = cloned_state
            cloned_state_ids_by_original_id[state.id] = cloned_state.id
            fraction.produce_material_state_id = cloned_state.id
            state = cloned_state
        state.material_state = "slurry"
        fraction.is_mixed = False
        converted_any = True
    if not converted_any:
        return
    tool.contents_homogeneity = 0.0
    sync_canonical_produce_model(experiment)


def _clone_material_state(state: ProduceMaterialState) -> ProduceMaterialState:
    return ProduceMaterialState(
        id=new_id("produce_material_state"),
        produce_lot_id=state.produce_lot_id,
        material_state=state.material_state,
        temperature_c=state.temperature_c,
        grind_quality_label=state.grind_quality_label,
        homogeneity_score=state.homogeneity_score,
        residual_co2_mass_g=state.residual_co2_mass_g,
        grinding_elapsed_seconds=state.grinding_elapsed_seconds,
        grinding_temperature_integral=state.grinding_temperature_integral,
        # Same physical material, split in two only so the untouched stock can
        # stay "ground": the clone inherits the degradation already booked
        # against it. Copied, not shared — the two halves degrade separately
        # from here on.
        pesticide_degradation_factors=dict(state.pesticide_degradation_factors),
    )


def _iter_experiment_produce_fractions(experiment: Experiment):
    for basket_tool in experiment.basket_tools:
        yield from basket_tool.produce_fractions
    yield from experiment.spatula.produce_fractions
    yield from experiment.workspace.produce_basket_fractions
    for slot in experiment.workbench.slots:
        yield from slot.surface_produce_fractions
        if slot.tool is not None:
            yield from slot.tool.produce_fractions
    for slot in experiment.rack.slots:
        if slot.tool is not None:
            yield from slot.tool.produce_fractions
    for widget in experiment.workspace.widgets:
        yield from widget.produce_fractions
        if widget.tool is not None:
            yield from widget.tool.produce_fractions
    for entry in experiment.trash.produce_lots:
        if entry.produce_fraction is not None:
            yield entry.produce_fraction


class CutWorkbenchProduceLotService(WriteDomainService[WorkbenchProduceLotRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkbenchProduceLotRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        produce_lot, origin_label = find_produce_lot_in_slot(slot, request.produce_lot_id)

        if slot.tool is not None and slot.tool.tool_type != "cutting_board":
            raise ValueError(f"{slot.tool.label} does not support cutting.")
        if get_material_state_name(experiment.produce_material_states, produce_lot.id) != "whole":
            return

        set_material_state_name(experiment.produce_material_states, produce_lot.id, "cut")
        sync_canonical_produce_model(experiment)
        experiment.audit_log.append(f"{produce_lot.label} cut on {origin_label}.")


class ApplySampleLabelToWorkbenchToolService(WriteDomainService[WorkbenchSlotRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkbenchSlotRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        tool = require_slot_tool(slot, "adding a sample label")
        tool.labels.append(build_manual_label())
        experiment.audit_log.append(f"Manual label applied to {tool.label} on {slot.label}.")


class UpdateWorkbenchToolSampleLabelTextService(WriteDomainService[UpdateWorkbenchToolSampleLabelTextRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: UpdateWorkbenchToolSampleLabelTextRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        tool = require_slot_tool(slot, "editing its sample label")
        label = find_tool_label(tool, request.label_id)
        if label.label_kind != "manual":
            raise ValueError("Only manual labels can be edited.")

        next_text = request.sample_label_text.strip()
        label.text = next_text
        if next_text:
            experiment.audit_log.append(f"Sample label updated to {next_text} on {tool.label}.")
            return

        experiment.audit_log.append(f"Sample label cleared on {tool.label}.")


class DiscardSampleLabelFromWorkbenchToolService(WriteDomainService[WorkbenchSampleLabelRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkbenchSampleLabelRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        tool = require_slot_tool(slot, "removing its sample label")
        label = pop_tool_label(tool, request.label_id)
        experiment.trash.sample_labels.append(
            TrashSampleLabelEntry(
                id=new_id("trash_sample_label"),
                origin_label=tool.label,
                label=label,
            )
        )
        experiment.audit_log.append(f"Label discarded from {tool.label}.")


class CloseWorkbenchToolService(WriteDomainService[WorkbenchSlotRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkbenchSlotRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        tool = require_slot_tool(slot, "sealing it")
        if not can_tool_be_sealed(tool.tool_type):
            raise ValueError(f"{tool.label} cannot be sealed.")

        tool.is_sealed = True
        tool.closure_fault = None
        tool.internal_pressure_bar = max(tool.internal_pressure_bar, 1.0)
        experiment.audit_log.append(f"{tool.label} sealed on {slot.label}.")


class OpenWorkbenchToolService(WriteDomainService[WorkbenchSlotRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkbenchSlotRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        tool = require_slot_tool(slot, "opening it")
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
                f"{tool.label} vented at {format_volume(vent_event.pressure_bar)} bar on {slot.label}; {format_volume(vent_event.lost_mass_g)} g of powder was lost."
            )
            return

        experiment.audit_log.append(f"{tool.label} opened on {slot.label}.")


class LoadSpatulaFromWorkbenchToolService(WriteDomainService[WorkbenchSlotRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: WorkbenchSlotRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        tool = require_slot_tool(slot, "loading the spatula")
        if not can_spatula_load_from_tool(tool.tool_type):
            raise ValueError("The spatula cannot be loaded from this container.")
        if tool.is_sealed:
            raise ValueError(f"Open {tool.label} before loading the spatula.")
        if experiment.spatula.is_loaded and get_spatula_total_produce_mass_g(experiment.spatula) > 0:
            raise ValueError("Empty the spatula before loading it again.")

        total_powder_g = get_tool_total_powder_mass_g(tool, material_states=experiment.produce_material_states)
        if total_powder_g <= 0:
            raise ValueError(f"{tool.label} is empty.")

        # Normal distribution around 67.5% of capacity (stddev = 15%), clamped to [30%, 100%]
        fill_ratio = random.gauss(mu=0.675, sigma=0.15)
        fill_ratio = max(0.30, min(1.0, fill_ratio))
        loaded_mass_g = min(
            SPATULA_CAPACITY_G,
            total_powder_g,
            round(SPATULA_CAPACITY_G * fill_ratio, 3),
        )
        if loaded_mass_g <= 0:
            raise ValueError(f"{tool.label} is empty.")

        split_tool_powder_into_spatula(
            tool,
            experiment.spatula,
            loaded_mass_g=loaded_mass_g,
            material_states=experiment.produce_material_states,
        )
        experiment.audit_log.append(f"Spatula loaded from {tool.label}.")


class PourSpatulaIntoWorkbenchToolService(WriteDomainService[PourSpatulaIntoWorkbenchToolRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: PourSpatulaIntoWorkbenchToolRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        tool = require_slot_tool(slot, "receiving powder")
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
            location_kind="workbench_tool",
            location_id=slot.id,
        )

        experiment.audit_log.append(f"Powder transferred into {tool.label}.")


class DiscardSpatulaService(WriteDomainService[None]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: None) -> None:
        total_loaded_g = get_spatula_total_produce_mass_g(experiment.spatula)
        if not experiment.spatula.is_loaded or total_loaded_g <= 0:
            raise ValueError("The spatula is already empty.")

        experiment.spatula.is_loaded = False
        experiment.spatula.produce_fractions = []
        experiment.spatula.source_tool_id = None
        experiment.audit_log.append(f"Spatula discarded ({round(total_loaded_g, 3)} g).")
