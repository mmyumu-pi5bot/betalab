from app.services.physical_simulation_service import PhysicalSimulationService

GRINDER_AMBIENT_TEMPERATURE_C = PhysicalSimulationService.ambient_temperature_c
GRINDER_START_THRESHOLD_C = PhysicalSimulationService.grinder_start_threshold_c


def get_grinder_start_block_reason(
    produce_lot_ids: list[str],
    material_states: dict[str, str],
    temperatures: dict[str, float],
    grinder_run_remaining_ms: float,
) -> str | None:
    if grinder_run_remaining_ms > 0:
        return "running"
    if not produce_lot_ids:
        return "empty"
    lot_id = produce_lot_ids[0]
    state = material_states.get(lot_id, "whole")
    if state == "whole":
        return "must_be_cut"
    if state == "ground":
        return "already_ground"
    if state == "waste":
        return "waste"
    if temperatures.get(lot_id, GRINDER_AMBIENT_TEMPERATURE_C) > GRINDER_START_THRESHOLD_C:
        return "not_cold_enough"
    return None


def get_grinder_display_mode(
    produce_lot_ids: list[str],
    material_states: dict[str, str],
    temperatures: dict[str, float],
    grinder_run_remaining_ms: float,
    grinder_fault: str | None,
    grinder_can_start: bool,
    grinder_start_block_reason: str | None,
) -> str | None:
    if produce_lot_ids:
        material_state = material_states.get(produce_lot_ids[0], "whole")
        temperature_c = temperatures.get(produce_lot_ids[0], GRINDER_AMBIENT_TEMPERATURE_C)
    else:
        material_state = "whole"
        temperature_c = GRINDER_AMBIENT_TEMPERATURE_C
    if material_state == "ground":
        return "complete"
    if grinder_fault == "motor_jammed" or grinder_start_block_reason == "not_cold_enough":
        return "jammed"
    if grinder_run_remaining_ms > 0 and temperature_c > GRINDER_START_THRESHOLD_C:
        return "warning"
    if grinder_run_remaining_ms > 0:
        return "running"
    if grinder_can_start:
        return "ready"
    if grinder_start_block_reason == "must_be_cut":
        return "overload"
    return "idle"
