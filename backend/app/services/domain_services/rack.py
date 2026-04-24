from __future__ import annotations

from dataclasses import dataclass

from app.domain.models import Experiment
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.helpers.lookups import (
    find_rack_slot,
    find_trash_tool,
    find_workbench_slot,
)
from app.services.helpers.workbench import build_workbench_tool


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
class RestoreTrashedToolToRackSlotRequest:
    trash_tool_id: str
    rack_slot_id: str


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
        experiment.audit_log.append(f"{rack_slot.tool.label} placed in {rack_slot.label}.")


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
        experiment.audit_log.append(f"{rack_slot.tool.label} moved from {source_slot.label} to {rack_slot.label}.")


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
        experiment.audit_log.append(f"{target_slot.tool.label} moved from {source_slot.label} to {target_slot.label}.")


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
        experiment.audit_log.append(f"{target_slot.tool.label} moved from {rack_slot.label} to {target_slot.label}.")


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
        experiment.audit_log.append(f"{discarded_tool.label} discarded from {rack_slot.label}.")


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
        experiment.audit_log.append(f"{rack_slot.tool.label} restored from trash to {rack_slot.label}.")
