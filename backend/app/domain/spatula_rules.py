from __future__ import annotations

SPATULA_LOAD_SOURCE_TOOL_TYPES = ("storage_jar", "centrifuge_tube", "beaker", "sample_bag")
SPATULA_POUR_TARGET_TOOL_TYPES = ("sample_vial", "centrifuge_tube")

SPATULA_CLICK_INCREMENT_MU_G = 0.05
SPATULA_CLICK_INCREMENT_SIGMA_G = 0.007
SPATULA_HOLD_THRESHOLD_MS = 200
SPATULA_HOLD_INTERVAL_MS = 100
SPATULA_HOLD_INITIAL_RATE_G = 0.08
SPATULA_HOLD_MAX_RATE_G = 0.28
SPATULA_HOLD_LIFT_RATE_G_PER_PX = 0.0022


def can_spatula_load_from_tool(tool_type: str) -> bool:
    return tool_type in SPATULA_LOAD_SOURCE_TOOL_TYPES


def can_spatula_pour_into_tool(tool_type: str) -> bool:
    return tool_type in SPATULA_POUR_TARGET_TOOL_TYPES
