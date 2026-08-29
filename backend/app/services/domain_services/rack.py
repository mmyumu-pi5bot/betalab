from __future__ import annotations

from dataclasses import dataclass

from app.domain.journal_codes import JournalCode
from app.domain.models import Experiment
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.helpers.lookups import (
    find_rack_slot,
    find_trash_tool,
    find_workbench_slot,
)
from app.services.helpers.tool_sealing import open_tool_in_slot, seal_tool_in_slot
from app.services.helpers.workbench import build_workbench_tool
from app.services.journal_refs import slot_ref, tool_ref
from app.services.journal_service import record_journal


@dataclass(frozen=True, slots=True)
class PlaceToolInRackSlotRequest:
    rack_slot_id: str
    tool_id: str


@dataclass(frozen=True, slots=True)
class PlaceWorkbenchToolInRackSlotRequest:
    source_slot_id: str
    rack_slot_id: str


@dataclass(frozen=True, slots=True)
class MoveRackToolBetweenSlotsRequest:
    source_rack_slot_id: str
    target_rack_slot_id: str


@dataclass(frozen=True, slots=True)
class RemoveRackToolToWorkbenchSlotRequest:
    rack_slot_id: str
    target_slot_id: str


@dataclass(frozen=True, slots=True)
class DiscardRackToolRequest:
    rack_slot_id: str


@dataclass(frozen=True, slots=True)
class CloseRackToolRequest:
    rack_slot_id: str


@dataclass(frozen=True, slots=True)
class OpenRackToolRequest:
    rack_slot_id: str


@dataclass(frozen=True, slots=True)
class RestoreTrashedToolToRackSlotRequest:
    trash_tool_id: str
    rack_slot_id: str


def _reachable_rack_vial(experiment: Experiment, rack_slot_id: str):
    """The vial in ``rack_slot_id``, provided a hand can still reach it.

    A rack sitting in the autosampler is behind the instrument door, so its caps
    are out of reach until it is unloaded.
    """
    if experiment.rack.state != "available":
        raise ValueError("The autosampler rack is loaded into the LC-MS/MS.")

    rack_slot = find_rack_slot(experiment.rack, rack_slot_id)
    if rack_slot.tool is None:
        raise ValueError(f"Place a vial in {rack_slot.label} first.")

    return rack_slot, rack_slot.tool


class CloseRackToolService(WriteDomainService[CloseRackToolRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: CloseRackToolRequest) -> None:
        rack_slot, tool = _reachable_rack_vial(experiment, request.rack_slot_id)
        seal_tool_in_slot(experiment, tool, rack_slot)


class OpenRackToolService(WriteDomainService[OpenRackToolRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: OpenRackToolRequest) -> None:
        rack_slot, tool = _reachable_rack_vial(experiment, request.rack_slot_id)
        open_tool_in_slot(experiment, tool, rack_slot)


class PlaceToolInRackSlotService(WriteDomainService[PlaceToolInRackSlotRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: PlaceToolInRackSlotRequest) -> None:
        rack_slot = find_rack_slot(experiment.rack, request.rack_slot_id)
        if rack_slot.tool is not None:
            raise ValueError(f"{rack_slot.label} already contains a vial")

        tool = build_workbench_tool(request.tool_id)
        if tool.tool_type != "sample_vial":
            raise ValueError("Only autosampler vials can be placed in the rack.")

        rack_slot.tool = tool
        record_journal(
            experiment,
            JournalCode.TOOL_PLACED_IN_SLOT,
            tool=tool_ref(rack_slot.tool),
            target=slot_ref(rack_slot),
        )


class PlaceWorkbenchToolInRackSlotService(WriteDomainService[PlaceWorkbenchToolInRackSlotRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: PlaceWorkbenchToolInRackSlotRequest) -> None:
        source_slot = find_workbench_slot(experiment.workbench, request.source_slot_id)
        rack_slot = find_rack_slot(experiment.rack, request.rack_slot_id)

        if source_slot.tool is None:
            raise ValueError(f"Place a tool on {source_slot.label} before moving it into the rack.")
        if source_slot.tool.tool_type != "sample_vial":
            raise ValueError("Only autosampler vials can be placed in the rack.")
        if rack_slot.tool is not None:
            raise ValueError(f"{rack_slot.label} already contains a vial")

        rack_slot.tool = source_slot.tool
        source_slot.tool = None
        record_journal(
            experiment,
            JournalCode.TOOL_MOVED,
            tool=tool_ref(rack_slot.tool),
            source=slot_ref(source_slot),
            target=slot_ref(rack_slot),
        )


class MoveRackToolBetweenSlotsService(WriteDomainService[MoveRackToolBetweenSlotsRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: MoveRackToolBetweenSlotsRequest) -> None:
        source_slot = find_rack_slot(experiment.rack, request.source_rack_slot_id)
        target_slot = find_rack_slot(experiment.rack, request.target_rack_slot_id)

        if source_slot.tool is None:
            raise ValueError(f"Place a vial in {source_slot.label} before moving it.")
        if target_slot.tool is not None:
            raise ValueError(f"{target_slot.label} already contains a vial")

        target_slot.tool = source_slot.tool
        source_slot.tool = None
        record_journal(
            experiment,
            JournalCode.TOOL_MOVED,
            tool=tool_ref(target_slot.tool),
            source=slot_ref(source_slot),
            target=slot_ref(target_slot),
        )


class RemoveRackToolToWorkbenchSlotService(WriteDomainService[RemoveRackToolToWorkbenchSlotRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: RemoveRackToolToWorkbenchSlotRequest) -> None:
        rack_slot = find_rack_slot(experiment.rack, request.rack_slot_id)
        target_slot = find_workbench_slot(experiment.workbench, request.target_slot_id)

        if rack_slot.tool is None:
            raise ValueError(f"Place a vial in {rack_slot.label} before moving it back to the bench.")
        if target_slot.tool is not None:
            raise ValueError(f"{target_slot.label} already contains a tool")

        target_slot.tool = rack_slot.tool
        rack_slot.tool = None
        record_journal(
            experiment,
            JournalCode.TOOL_MOVED,
            tool=tool_ref(target_slot.tool),
            source=slot_ref(rack_slot),
            target=slot_ref(target_slot),
        )


class DiscardRackToolService(WriteDomainService[DiscardRackToolRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: DiscardRackToolRequest) -> None:
        rack_slot = find_rack_slot(experiment.rack, request.rack_slot_id)
        if rack_slot.tool is None:
            raise ValueError(f"Place a vial in {rack_slot.label} before discarding it.")

        discarded_tool = rack_slot.tool
        rack_slot.tool = None
        experiment.trash.children.append(discarded_tool)
        experiment.trash.discarded_from[discarded_tool.id] = rack_slot.label
        record_journal(
            experiment,
            JournalCode.TOOL_DISCARDED,
            tool=tool_ref(discarded_tool),
            source=slot_ref(rack_slot),
        )


class RestoreTrashedToolToRackSlotService(WriteDomainService[RestoreTrashedToolToRackSlotRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: RestoreTrashedToolToRackSlotRequest) -> None:
        tool = find_trash_tool(experiment.trash, request.trash_tool_id)
        rack_slot = find_rack_slot(experiment.rack, request.rack_slot_id)

        if tool.tool_type != "sample_vial":
            raise ValueError("Only autosampler vials can be restored into the rack.")
        if rack_slot.tool is not None:
            raise ValueError(f"{rack_slot.label} already contains a vial")

        rack_slot.tool = tool
        experiment.trash.children = [t for t in experiment.trash.children if t.id != tool.id]
        experiment.trash.discarded_from.pop(tool.id, None)
        record_journal(
            experiment,
            JournalCode.TOOL_RESTORED_FROM_TRASH,
            tool=tool_ref(rack_slot.tool),
            target=slot_ref(rack_slot),
        )
