from __future__ import annotations


def get_centrifuge_start_block_reason(
    *,
    widget_type: str,
    has_tool: bool,
    run_remaining_ms: float = 0.0,
) -> str | None:
    if widget_type != "centrifuge":
        return "not_centrifuge"
    if run_remaining_ms > 0:
        return "already_running"
    if not has_tool:
        return "missing_tube"
    return None
