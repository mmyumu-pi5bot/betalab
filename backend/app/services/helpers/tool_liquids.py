from __future__ import annotations

from app.domain.models import Experiment, WorkbenchLiquid, WorkbenchTool, new_id
from app.domain.rules import can_tool_accept_liquids, can_tool_receive_contents
from app.domain.workbench_catalog import get_workbench_liquid_definition
from app.services.helpers.lookups import format_volume, round_volume
from app.services.helpers.produce_canonical import get_tool_remaining_fill_capacity_ml
from app.services.physical_simulation_service import PhysicalSimulationService

QUECHERS_SALTS_ID = "quechers_salts"
ISTD_SOLUTION_ID = "istd_solution"
ACETONITRILE_ID = "acetonitrile_extraction"
CALIBRATION_SOLUTION_ID = "calibration_solution"


def _tool_has_wet_contents(tool: WorkbenchTool) -> bool:
    return bool(tool.liquids or tool.produce_lots or tool.produce_fractions)


def raise_if_quechers_unusable(tool: WorkbenchTool) -> None:
    if not tool.quechers_state.is_usable:
        raise ValueError(f"{tool.label} is contaminated and cannot be used for further preparation.")


def merge_liquid_portion(
    liquids: list[WorkbenchLiquid],
    source: WorkbenchLiquid,
    volume_ml: float,
    true_volume_ml: float,
    *,
    id_prefix: str,
) -> None:
    existing = next((liquid for liquid in liquids if liquid.liquid_id == source.liquid_id), None)
    if existing is None:
        liquids.append(
            WorkbenchLiquid(
                id=new_id(id_prefix),
                liquid_id=source.liquid_id,
                name=source.name,
                volume_ml=round(volume_ml, 6),
                true_volume_ml=round(true_volume_ml, 6),
                accent=source.accent,
            )
        )
    else:
        existing.volume_ml = round(existing.volume_ml + volume_ml, 6)
        existing.true_volume_ml = round((existing.true_volume_ml or 0.0) + true_volume_ml, 6)


def transfer_liquid_portion(
    source_liquids: list[WorkbenchLiquid],
    target_liquids: list[WorkbenchLiquid],
    entry: WorkbenchLiquid,
    volume_ml: float,
    *,
    target_id_prefix: str,
    true_volume_ml: float | None = None,
) -> float:
    """Move up to volume_ml of one liquid entry between containers, keeping the
    hidden true volume proportional on both sides. Returns the volume actually moved.
    Empty entries are pruned from the source so no zero-volume liquid survives a transfer."""
    if entry.volume_ml <= 0:
        source_liquids.remove(entry)
        return 0.0
    moved_ml = round(min(volume_ml, entry.volume_ml), 6)
    if moved_ml <= 0:
        return 0.0
    source_true_ml = entry.true_volume_ml if entry.true_volume_ml is not None else entry.volume_ml
    if true_volume_ml is None:
        true_ratio = source_true_ml / entry.volume_ml
        moved_true_ml = round(moved_ml * true_ratio, 6)
    else:
        moved_true_ml = round(min(max(true_volume_ml, 0.0), source_true_ml), 6)
    merge_liquid_portion(target_liquids, entry, moved_ml, moved_true_ml, id_prefix=target_id_prefix)
    entry.volume_ml = round(entry.volume_ml - moved_ml, 6)
    entry.true_volume_ml = round(max(source_true_ml - moved_true_ml, 0.0), 6)
    if entry.volume_ml <= 0 and entry.true_volume_ml <= 0:
        source_liquids.remove(entry)
    return moved_ml


def remove_liquid_from_tool(tool: WorkbenchTool, liquid: WorkbenchLiquid) -> None:
    tool.liquids = [entry for entry in tool.liquids if entry.id != liquid.id]
    if liquid.liquid_id == CALIBRATION_SOLUTION_ID:
        tool.calibration_context = None


def add_liquid_to_tool(
    experiment: Experiment,
    tool: WorkbenchTool,
    *,
    liquid_id: str,
    volume_ml: float | None,
) -> None:
    raise_if_quechers_unusable(tool)
    if not can_tool_accept_liquids(tool.tool_type):
        raise ValueError(f"{tool.label} does not accept liquids.")
    if not can_tool_receive_contents(tool.tool_type, tool.is_sealed):
        raise ValueError(f"Open {tool.label} before adding liquids.")

    liquid_definition = get_workbench_liquid_definition(liquid_id)
    had_contents = bool(tool.liquids or tool.produce_fractions)
    if liquid_id == QUECHERS_SALTS_ID:
        if tool.quechers_state.salts_added:
            raise ValueError(f"{tool.label} already contains a QuEChERS salts packet.")
        tool.quechers_state.salts_added = True
        # The heat is released now, so the temperature that matters is the one
        # the mixture has now -- powder straight from the cryomill lands the
        # whole exotherm far lower than powder left to warm on the bench.
        tool.quechers_state.start_temperature_c = PhysicalSimulationService.mixture_temperature_c(
            tool, experiment.produce_material_states
        )
        tool.quechers_state.phase = "reacting" if _tool_has_wet_contents(tool) else "armed"
        tool.contents_homogeneity = 0.0 if had_contents else 1.0
        experiment.audit_log.append(f"{liquid_definition.name} added to {tool.label}.")
        return

    if liquid_id == ISTD_SOLUTION_ID and tool.istd_phase_added is None:
        has_acetonitrile = any(liq.liquid_id == ACETONITRILE_ID for liq in tool.liquids)
        if tool.quechers_state.phase == "idle" and not has_acetonitrile:
            tool.istd_phase_added = "pre_solvent"
        elif tool.quechers_state.phase == "idle":
            tool.istd_phase_added = "pre_salts"
        else:
            tool.istd_phase_added = "post_salts"

    salts_were_armed = tool.quechers_state.phase == "armed"
    remaining_capacity = round_volume(get_tool_remaining_fill_capacity_ml(tool, material_states=experiment.produce_material_states))
    if remaining_capacity <= 0:
        raise ValueError(f"{tool.label} is already full.")

    requested_volume = round_volume(max(float(volume_ml or liquid_definition.transfer_volume_ml), 0.0))
    volume_to_add = round_volume(min(requested_volume, remaining_capacity))
    existing_liquid = next(
        (liquid for liquid in tool.liquids if liquid.liquid_id == liquid_definition.id),
        None,
    )

    true_volume_to_add = PhysicalSimulationService.draw_dispensed_volume(volume_to_add)

    if existing_liquid is None:
        tool.liquids.append(
            WorkbenchLiquid(
                id=new_id("bench_liquid"),
                liquid_id=liquid_definition.id,
                name=liquid_definition.name,
                volume_ml=round_volume(volume_to_add),
                true_volume_ml=round(true_volume_to_add, 6),
                accent=liquid_definition.accent,
            )
        )
        updated_volume = round_volume(volume_to_add)
        existing_liquid_was_present = False
    else:
        existing_liquid.volume_ml = round_volume(existing_liquid.volume_ml + volume_to_add)
        existing_liquid.true_volume_ml = round(
            (existing_liquid.true_volume_ml if existing_liquid.true_volume_ml is not None else existing_liquid.volume_ml)
            + true_volume_to_add,
            6,
        )
        updated_volume = existing_liquid.volume_ml
        existing_liquid_was_present = True

    has_other_components = bool(
        tool.produce_fractions
        or any(liquid.liquid_id != liquid_definition.id for liquid in tool.liquids)
    )
    if volume_to_add > 0:
        if not had_contents:
            tool.contents_homogeneity = 1.0
        elif has_other_components:
            tool.contents_homogeneity = 0.0

    if salts_were_armed and volume_to_add > 0:
        tool.quechers_state.phase = "cemented"
        tool.quechers_state.faults = ["dry_salts_wetted"]
        tool.quechers_state.cementation_progress = 1.0
        experiment.audit_log.append(
            f"Dry QuEChERS salts in {tool.label} cemented instantly when wetted; the container is unusable."
        )

    if volume_to_add < requested_volume:
        if existing_liquid_was_present:
            experiment.audit_log.append(
                f"{liquid_definition.name} increased to {format_volume(updated_volume)} mL in {tool.label} (remaining capacity)."
            )
        else:
            experiment.audit_log.append(f"{liquid_definition.name} added to {tool.label} at {format_volume(updated_volume)} mL (remaining capacity).")
        return

    if existing_liquid_was_present:
        experiment.audit_log.append(f"{liquid_definition.name} increased to {format_volume(updated_volume)} mL in {tool.label}.")
        return

    experiment.audit_log.append(f"{liquid_definition.name} added to {tool.label}.")
