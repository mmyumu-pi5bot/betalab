from __future__ import annotations


def can_tool_accept_liquids(tool_type: str) -> bool:
    return tool_type not in {"sample_bag", "cutting_board", "storage_jar"}


def can_tool_accept_produce(tool_type: str) -> bool:
    return tool_type in {"sample_bag", "cutting_board", "storage_jar"}


def can_tool_be_sealed(tool_type: str) -> bool:
    return tool_type in {
        "sample_bag",
        "storage_jar",
        "centrifuge_tube",
        "cleanup_tube",
        "sample_vial",
    }


def can_tool_receive_contents(tool_type: str, is_sealed: bool) -> bool:
    return not can_tool_be_sealed(tool_type) or not is_sealed


def can_workspace_widget_be_stored(widget_id: str) -> bool:
    return widget_id in {"lims", "rack", "instrument", "grinder", "gross_balance", "analytical_balance", "vortex"}


def can_workspace_widget_store_now(
    widget_id: str,
    *,
    is_trashed: bool,
    has_tool: bool,
    has_produce: bool,
    has_liquids: bool,
) -> bool:
    if not can_workspace_widget_be_stored(widget_id):
        return False
    if is_trashed:
        return True
    return not has_tool and not has_produce and not has_liquids
