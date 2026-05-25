from __future__ import annotations

from app.domain.dnd_contracts import get_dnd_contract, get_tool_dnd_contract


def get_tool_allowed_drop_targets(tool_type: str) -> list[str]:
    return list(get_tool_dnd_contract(tool_type).allowed_drop_targets)


def can_tool_be_discarded(tool_type: str) -> bool:
    return get_tool_dnd_contract(tool_type).is_discardable


def can_tool_be_stored(tool_type: str) -> bool:
    return get_tool_dnd_contract(tool_type).is_storable


def can_tool_move_as_object(tool_type: str) -> bool:
    return get_tool_dnd_contract(tool_type).supports_object_move


def can_tool_receive_liquids(tool_type: str) -> bool:
    return get_tool_dnd_contract(tool_type).can_receive_liquids


def can_tool_receive_produce(tool_type: str) -> bool:
    return get_tool_dnd_contract(tool_type).can_receive_produce


def can_tool_seal(tool_type: str) -> bool:
    return get_tool_dnd_contract(tool_type).can_seal


def can_tool_receive_contents(tool_type: str, is_sealed: bool = False) -> bool:
    return not can_tool_seal(tool_type) or not is_sealed


def get_sample_label_allowed_drop_targets() -> list[str]:
    return list(get_dnd_contract("sample_label", "sample_label").allowed_drop_targets)


def get_lims_label_ticket_allowed_drop_targets() -> list[str]:
    return list(get_dnd_contract("lims_label_ticket", "lims_label_ticket").allowed_drop_targets)


def get_produce_lot_allowed_drop_targets() -> list[str]:
    return list(get_dnd_contract("produce_lot", "produce_lot").allowed_drop_targets)


def get_liquid_allowed_drop_targets(liquid_type: str) -> list[str]:
    return list(get_dnd_contract("liquid", liquid_type).allowed_drop_targets)
