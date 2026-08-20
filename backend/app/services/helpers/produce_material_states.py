from __future__ import annotations

from app.domain.models import ProduceMaterialState, new_id

DEFAULT_MATERIAL_STATE = "whole"
PARTICULATE_MATERIAL_STATES = {"ground", "slurry"}


def find_material_state(
    material_states: list[ProduceMaterialState],
    produce_lot_id: str,
) -> ProduceMaterialState | None:
    return next((state for state in material_states if state.produce_lot_id == produce_lot_id), None)


def ensure_material_state(
    material_states: list[ProduceMaterialState],
    produce_lot_id: str,
    *,
    material_state: str | None = None,
) -> ProduceMaterialState:
    existing_state = find_material_state(material_states, produce_lot_id)
    if existing_state is None:
        existing_state = ProduceMaterialState(
            id=new_id("produce_material_state"),
            produce_lot_id=produce_lot_id,
        )
        material_states.append(existing_state)
    if material_state is not None:
        existing_state.material_state = material_state
    return existing_state


def get_material_state_name(
    material_states: list[ProduceMaterialState],
    produce_lot_id: str,
    *,
    default: str = DEFAULT_MATERIAL_STATE,
) -> str:
    state = find_material_state(material_states, produce_lot_id)
    return state.material_state if state is not None else default


def set_material_state_name(
    material_states: list[ProduceMaterialState],
    produce_lot_id: str,
    material_state: str,
) -> ProduceMaterialState:
    return ensure_material_state(
        material_states,
        produce_lot_id,
        material_state=material_state,
    )


def update_material_state(
    material_states: list[ProduceMaterialState],
    produce_lot_id: str,
    **fields: object,
) -> ProduceMaterialState:
    state = ensure_material_state(material_states, produce_lot_id)
    for field_name, field_value in fields.items():
        setattr(state, field_name, field_value)
    return state

