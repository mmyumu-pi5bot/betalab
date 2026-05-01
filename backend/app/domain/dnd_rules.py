from __future__ import annotations


def get_tool_allowed_drop_targets(tool_type: str) -> list[str]:
    targets = ["workbench_slot", "trash_bin", "gross_balance_widget"]

    if tool_type == "sample_vial":
        targets.insert(1, "rack_slot")
    if tool_type not in {"cutting_board", "sample_bag"}:
        targets.append("analytical_balance_widget")
    if tool_type in {"centrifuge_tube", "cleanup_tube"}:
        targets.append("vortex_widget")

    return targets


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
