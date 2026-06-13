from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

DndEntityKind = Literal["tool", "produce_lot", "liquid", "sample_label", "lims_label_ticket", "workspace_widget"]
DndDropTargetType = Literal[
    "analytical_balance_widget",
    "grinder_widget",
    "gross_balance_widget",
    "rack_slot",
    "trash_bin",
    "vortex_widget",
    "workbench_slot",
    "workspace_canvas",
]


@dataclass(frozen=True, slots=True)
class DndEntityContract:
    entity_kind: DndEntityKind
    allowed_drop_targets: tuple[DndDropTargetType, ...]
    is_draggable: bool = True
    is_discardable: bool = False
    is_storable: bool = False
    supports_object_move: bool = False
    can_receive_liquids: bool = False
    can_receive_produce: bool = False
    can_seal: bool = False


_TOOL_CONTRACTS: dict[str, DndEntityContract] = {
    "beaker": DndEntityContract(
        entity_kind="tool",
        allowed_drop_targets=(
            "workbench_slot",
            "trash_bin",
            "gross_balance_widget",
            "analytical_balance_widget",
        ),
        is_discardable=True,
        supports_object_move=True,
        can_receive_liquids=True,
    ),
    "centrifuge_tube": DndEntityContract(
        entity_kind="tool",
        allowed_drop_targets=(
            "workbench_slot",
            "trash_bin",
            "gross_balance_widget",
            "analytical_balance_widget",
            "vortex_widget",
        ),
        is_discardable=True,
        supports_object_move=True,
        can_receive_liquids=True,
        can_seal=True,
    ),
    "cleanup_tube": DndEntityContract(
        entity_kind="tool",
        allowed_drop_targets=(
            "workbench_slot",
            "trash_bin",
            "gross_balance_widget",
            "analytical_balance_widget",
            "vortex_widget",
        ),
        is_discardable=True,
        supports_object_move=True,
        can_receive_liquids=True,
        can_seal=True,
    ),
    "cutting_board": DndEntityContract(
        entity_kind="tool",
        allowed_drop_targets=("workbench_slot", "gross_balance_widget"),
        is_discardable=False,
        is_storable=True,
        supports_object_move=True,
        can_receive_produce=True,
    ),
    "sample_bag": DndEntityContract(
        entity_kind="tool",
        allowed_drop_targets=("workbench_slot", "trash_bin", "gross_balance_widget"),
        is_discardable=True,
        supports_object_move=True,
        can_receive_produce=True,
        can_seal=True,
    ),
    "sample_vial": DndEntityContract(
        entity_kind="tool",
        allowed_drop_targets=(
            "workbench_slot",
            "rack_slot",
            "trash_bin",
            "gross_balance_widget",
            "analytical_balance_widget",
        ),
        is_discardable=True,
        supports_object_move=True,
        can_receive_liquids=True,
        can_seal=True,
    ),
    "storage_jar": DndEntityContract(
        entity_kind="tool",
        allowed_drop_targets=(
            "workbench_slot",
            "trash_bin",
            "gross_balance_widget",
            "analytical_balance_widget",
        ),
        is_discardable=True,
        supports_object_move=True,
        can_receive_produce=True,
        can_seal=True,
    ),
}


def get_dnd_contract(entity_kind: DndEntityKind, entity_type: str) -> DndEntityContract:
    if entity_kind == "tool":
        try:
            return _TOOL_CONTRACTS[entity_type]
        except KeyError as exc:
            raise ValueError(f"Unknown tool DnD contract: {entity_type}") from exc
    if entity_kind == "produce_lot":
        return DndEntityContract(
            entity_kind="produce_lot",
            allowed_drop_targets=("workbench_slot", "grinder_widget", "trash_bin", "gross_balance_widget"),
            is_discardable=True,
            supports_object_move=True,
        )
    if entity_kind == "sample_label":
        return DndEntityContract(
            entity_kind=entity_kind,
            allowed_drop_targets=("workbench_slot", "gross_balance_widget", "analytical_balance_widget", "trash_bin"),
            is_discardable=True,
            supports_object_move=True,
        )
    if entity_kind == "lims_label_ticket":
        return DndEntityContract(
            entity_kind=entity_kind,
            allowed_drop_targets=("workbench_slot", "gross_balance_widget", "analytical_balance_widget", "trash_bin"),
            is_discardable=True,
        )
    if entity_kind == "liquid":
        if entity_type == "quechers_salts":
            return DndEntityContract(
                entity_kind="liquid",
                allowed_drop_targets=("workbench_slot", "analytical_balance_widget", "vortex_widget"),
            )
        return DndEntityContract(
            entity_kind="liquid",
            allowed_drop_targets=("grinder_widget",) if entity_type == "dry_ice_pellets" else ("workbench_slot", "analytical_balance_widget"),
        )
    if entity_kind == "workspace_widget":
        return DndEntityContract(
            entity_kind="workspace_widget",
            allowed_drop_targets=("workspace_canvas",),
            is_storable=True,
        )
    raise ValueError(f"Unsupported DnD entity kind: {entity_kind}")


def get_tool_dnd_contract(tool_type: str) -> DndEntityContract:
    return get_dnd_contract("tool", tool_type)


# Maps a move-source kind to the equivalent DndDropTargetType used in same-location checks.
_SOURCE_KIND_TO_DROP_TARGET_TYPE: dict[str, str] = {
    "analytical_balance": "analytical_balance_widget",
    "gross_balance": "gross_balance_widget",
    "rack": "rack_slot",
    "trash": "trash_bin",
    "vortex": "vortex_widget",
    "workbench": "workbench_slot",
}


def source_kind_to_drop_target_type(source_kind: str) -> str:
    return _SOURCE_KIND_TO_DROP_TARGET_TYPE.get(source_kind, source_kind)
