from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ToolDndSpec:
    allowed_drop_targets: tuple[str, ...]
    is_discardable: bool = True
    is_storable: bool = False


_DEFAULT_TOOL_DND_SPEC = ToolDndSpec(
    allowed_drop_targets=(
        "workbench_slot",
        "trash_bin",
        "gross_balance_widget",
        "analytical_balance_widget",
    )
)

_TOOL_DND_SPECS: dict[str, ToolDndSpec] = {
    "centrifuge_tube": ToolDndSpec(
        allowed_drop_targets=(
            "workbench_slot",
            "trash_bin",
            "gross_balance_widget",
            "analytical_balance_widget",
            "vortex_widget",
        )
    ),
    "cleanup_tube": ToolDndSpec(
        allowed_drop_targets=(
            "workbench_slot",
            "trash_bin",
            "gross_balance_widget",
            "analytical_balance_widget",
            "vortex_widget",
        )
    ),
    "cutting_board": ToolDndSpec(
        allowed_drop_targets=("workbench_slot", "gross_balance_widget"),
        is_discardable=False,
        is_storable=True,
    ),
    "sample_bag": ToolDndSpec(
        allowed_drop_targets=("workbench_slot", "trash_bin", "gross_balance_widget")
    ),
    "sample_vial": ToolDndSpec(
        allowed_drop_targets=(
            "workbench_slot",
            "rack_slot",
            "trash_bin",
            "gross_balance_widget",
            "analytical_balance_widget",
        )
    ),
}


def get_tool_dnd_spec(tool_type: str) -> ToolDndSpec:
    return _TOOL_DND_SPECS.get(tool_type, _DEFAULT_TOOL_DND_SPEC)


def get_tool_allowed_drop_targets(tool_type: str) -> list[str]:
    return list(get_tool_dnd_spec(tool_type).allowed_drop_targets)


def can_tool_be_discarded(tool_type: str) -> bool:
    return get_tool_dnd_spec(tool_type).is_discardable


def can_tool_be_stored(tool_type: str) -> bool:
    return get_tool_dnd_spec(tool_type).is_storable


def can_tool_receive_liquids(tool_type: str) -> bool:
    return tool_type not in {"sample_bag", "cutting_board", "storage_jar"}


def can_tool_receive_produce(tool_type: str) -> bool:
    return tool_type in {"sample_bag", "cutting_board", "storage_jar"}


def can_tool_seal(tool_type: str) -> bool:
    return tool_type in {
        "sample_bag",
        "storage_jar",
        "centrifuge_tube",
        "cleanup_tube",
        "sample_vial",
    }


def can_tool_receive_contents(tool_type: str, is_sealed: bool = False) -> bool:
    return not can_tool_seal(tool_type) or not is_sealed


def get_sample_label_allowed_drop_targets() -> list[str]:
    return ["workbench_slot", "gross_balance_widget", "analytical_balance_widget", "trash_bin"]


def get_lims_label_ticket_allowed_drop_targets() -> list[str]:
    return get_sample_label_allowed_drop_targets()


def get_produce_lot_allowed_drop_targets() -> list[str]:
    return ["workbench_slot", "grinder_widget", "trash_bin", "gross_balance_widget"]


def get_liquid_allowed_drop_targets(liquid_type: str) -> list[str]:
    if liquid_type == "dry_ice_pellets":
        return ["grinder_widget"]
    return ["workbench_slot", "analytical_balance_widget"]
