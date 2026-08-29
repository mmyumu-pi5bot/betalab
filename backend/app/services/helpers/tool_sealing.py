"""Capping and uncapping a container, wherever it happens to sit.

A vial is the same object on a bench slot or in an autosampler rack, so the
sealing rules and the journal entries live here rather than in one location's
service.
"""

from __future__ import annotations

from app.domain.journal_codes import JournalCode
from app.domain.models import Experiment, RackSlot, WorkbenchSlot, WorkbenchTool
from app.domain.rules import can_tool_be_sealed
from app.services.helpers.lookups import format_volume
from app.services.journal_refs import slot_ref, tool_ref
from app.services.journal_service import record_journal
from app.services.physical_simulation_service import PhysicalSimulationService

physical_simulation_service = PhysicalSimulationService()


def seal_tool_in_slot(
    experiment: Experiment,
    tool: WorkbenchTool,
    slot: WorkbenchSlot | RackSlot,
) -> None:
    if not can_tool_be_sealed(tool.tool_type):
        raise ValueError(f"{tool.label} cannot be sealed.")

    tool.is_sealed = True
    tool.closure_fault = None
    tool.internal_pressure_bar = max(tool.internal_pressure_bar, 1.0)
    record_journal(
        experiment,
        JournalCode.TOOL_SEALED,
        tool=tool_ref(tool),
        location=slot_ref(slot),
    )


def open_tool_in_slot(
    experiment: Experiment,
    tool: WorkbenchTool,
    slot: WorkbenchSlot | RackSlot,
) -> None:
    if not can_tool_be_sealed(tool.tool_type):
        raise ValueError(f"{tool.label} cannot be opened.")

    vent_event = physical_simulation_service.vent_opened_tool(
        tool,
        material_states=experiment.produce_material_states,
    )
    tool.is_sealed = False
    tool.closure_fault = None
    if vent_event is not None and vent_event.lost_mass_g > 0:
        record_journal(
            experiment,
            JournalCode.TOOL_VENTED,
            tool=tool_ref(tool),
            pressure=format_volume(vent_event.pressure_bar),
            location=slot_ref(slot),
            lost_mass=format_volume(vent_event.lost_mass_g),
        )
        return

    record_journal(
        experiment,
        JournalCode.TOOL_OPENED,
        tool=tool_ref(tool),
        location=slot_ref(slot),
    )
