from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.domain.dnd_rules import get_tool_allowed_drop_targets
from app.domain.models import Experiment, WorkbenchTool
from app.services.domain_services.analytical_balance import AnalyticalBalanceServiceBase
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.domain_services.gross_balance import (
    GrossBalanceProduceLotSource,
    GrossBalanceProduceLotTarget,
    GrossBalanceServiceBase,
)
from app.services.domain_services.vortex import VortexServiceBase
from app.services.helpers.lookups import (
    find_rack_slot,
    find_trash_tool,
    find_workbench_slot,
)
from app.services.helpers.produce_canonical import sync_canonical_produce_model
from app.services.helpers.workbench import build_workbench_tool
from app.services.transfer import (
    GrinderProduceLotSource,
    GrinderProduceLotTarget,
    ProduceLotRemoval,
    TransferRemoval,
    TrashProduceLotSource,
    WorkbenchProduceLotSource,
    WorkbenchProduceLotTarget,
    WorkspaceProduceLotSource,
)


@dataclass(frozen=True, slots=True)
class DndObjectRef:
    kind: str
    id: str


@dataclass(frozen=True, slots=True)
class DndMoveObjectRequest:
    entity: DndObjectRef
    source: DndObjectRef
    destination: DndObjectRef


@dataclass(frozen=True, slots=True)
class DndMovedObject:
    entity: object
    entity_ref: DndObjectRef
    source_ref: DndObjectRef
    source_label: str = ""


class MoveDestination(Protocol):
    @property
    def drop_target_label(self) -> str: ...

    @property
    def drop_target_type(self) -> str: ...

    def validate_place(self, experiment: Experiment, request: DndMoveObjectRequest) -> None: ...

    def place(self, experiment: Experiment, moved: DndMovedObject) -> None: ...

    def after_place(self, experiment: Experiment, moved: DndMovedObject) -> None: ...


class MoveSource(Protocol):
    def validate_remove(self, experiment: Experiment, request: DndMoveObjectRequest, destination: MoveDestination) -> None: ...

    def remove(self, experiment: Experiment, request: DndMoveObjectRequest) -> DndMovedObject: ...

    def after_remove(self, experiment: Experiment, moved: DndMovedObject) -> None: ...


class MoveSourceBase:
    def __init__(self, runtime: ExperimentRuntime, source: DndObjectRef) -> None:
        self._runtime = runtime
        self._source = source

    def validate_remove(self, experiment: Experiment, request: DndMoveObjectRequest, destination: MoveDestination) -> None:
        pass

    def remove(self, experiment: Experiment, request: DndMoveObjectRequest) -> DndMovedObject:
        if request.entity.kind == "tool":
            tool, source_label = self._remove_tool(experiment, request)
            return DndMovedObject(
                entity=tool,
                entity_ref=request.entity,
                source_ref=request.source,
                source_label=source_label,
            )
        if request.entity.kind == "produce_lot":
            removal = self._remove_produce_lot(experiment, request)
            return DndMovedObject(
                entity=removal,
                entity_ref=request.entity,
                source_ref=request.source,
                source_label=removal.source_label,
            )
        raise ValueError(f"{self._source.kind} cannot move {request.entity.kind}.")

    def after_remove(self, experiment: Experiment, moved: DndMovedObject) -> None:
        pass

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        raise ValueError(f"{self._source.kind} cannot move produce lots.")

    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        raise ValueError(f"{self._source.kind} cannot move tools.")


class PaletteMoveSource(MoveSourceBase):
    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        return build_workbench_tool(request.entity.id), "Palette"


class BasketMoveSource(MoveSourceBase):
    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        tool_index = next((index for index, tool in enumerate(experiment.basket_tools) if tool.id == request.source.id), None)
        if tool_index is None:
            raise ValueError("The specified bag is not in the produce basket.")
        return experiment.basket_tools.pop(tool_index), "Produce basket"

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        return WorkspaceProduceLotSource(request.entity.id).remove(experiment)


class WorkbenchMoveSource(MoveSourceBase):
    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        slot = find_workbench_slot(experiment.workbench, request.source.id)
        if slot.tool is None:
            raise ValueError(f"Place a tool on {slot.label} before moving it.")
        moved_tool = slot.tool
        slot.tool = None
        return moved_tool, slot.label

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        return WorkbenchProduceLotSource(request.source.id, request.entity.id).remove(experiment)


class RackMoveSource(MoveSourceBase):
    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        rack_slot = find_rack_slot(experiment.rack, request.source.id)
        if rack_slot.tool is None:
            raise ValueError(f"{rack_slot.label} does not contain a tool.")
        moved_tool = rack_slot.tool
        rack_slot.tool = None
        return moved_tool, rack_slot.label

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        raise ValueError("Rack slots cannot move produce lots.")


class GrossBalanceMoveSource(MoveSourceBase):
    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        service = _DndGrossBalanceService(self._runtime)
        return service._take_tool_from_balance(experiment), "Gross balance"

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        return GrossBalanceProduceLotSource(_DndGrossBalanceService(self._runtime), request.entity.id).remove(experiment)


class AnalyticalBalanceMoveSource(MoveSourceBase):
    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        return _DndAnalyticalBalanceService(self._runtime)._take_tool_from_balance(experiment), "Analytical balance"

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        raise ValueError("Analytical balance cannot move produce lots.")


class VortexMoveSource(MoveSourceBase):
    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        return _DndVortexService(self._runtime)._take_tool_from_vortex(experiment), "Vortex mixer"

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        raise ValueError("Vortex cannot move produce lots.")


class GrinderMoveSource(MoveSourceBase):
    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        return GrinderProduceLotSource(request.source.id, request.entity.id).remove(experiment)


class TrashMoveSource(MoveSourceBase):
    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        tool = find_trash_tool(experiment.trash, request.source.id)
        origin_label = experiment.trash.discarded_from.get(tool.id, "Trash")
        experiment.trash.children = [entry for entry in experiment.trash.children if entry.id != tool.id]
        experiment.trash.discarded_from.pop(tool.id, None)
        return tool, origin_label

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        return TrashProduceLotSource(request.source.id).remove(experiment)


class MoveDestinationBase:
    def __init__(self, runtime: ExperimentRuntime, destination: DndObjectRef) -> None:
        self._runtime = runtime
        self._destination = destination

    @property
    def drop_target_label(self) -> str:
        return _get_drop_target_label(self._destination.kind)

    @property
    def drop_target_type(self) -> str:
        return _get_drop_target_type(self._destination.kind)

    def validate_place(self, experiment: Experiment, request: DndMoveObjectRequest) -> None:
        pass

    def place(self, experiment: Experiment, moved: DndMovedObject) -> None:
        if moved.entity_ref.kind == "tool":
            self._place_tool(experiment, moved)
            return
        if moved.entity_ref.kind == "produce_lot":
            self._place_produce_lot(experiment, moved)
            return
        raise ValueError(f"{self._destination.kind} cannot place {moved.entity_ref.kind}.")

    def after_place(self, experiment: Experiment, moved: DndMovedObject) -> None:
        pass

    def _place_tool(self, experiment: Experiment, moved: DndMovedObject) -> None:
        raise ValueError(f"{self._destination.kind} cannot create tools.")

    def _place_produce_lot(self, experiment: Experiment, moved: DndMovedObject) -> None:
        raise ValueError(f"{self._destination.kind} cannot place produce lots.")


class WorkbenchSlotMoveDestination(MoveDestinationBase):
    def _place_tool(self, experiment: Experiment, moved: DndMovedObject) -> None:
        target_slot = find_workbench_slot(experiment.workbench, self._destination.id)
        if target_slot.tool is not None or target_slot.surface_produce_lots:
            raise ValueError(f"{target_slot.label} already contains a tool")
        target_slot.tool = _require_tool(moved)
        _append_tool_move_audit(experiment, moved, target_slot.label)


class WorkbenchToolMoveDestination(MoveDestinationBase):
    def __init__(self, runtime: ExperimentRuntime, destination: DndObjectRef) -> None:
        super().__init__(runtime, destination)
        self._produce_target = WorkbenchProduceLotTarget(destination.id)

    def validate_place(self, experiment: Experiment, request: DndMoveObjectRequest) -> None:
        if request.entity.kind == "produce_lot":
            self._produce_target.validate(experiment)

    def _place_tool(self, experiment: Experiment, moved: DndMovedObject) -> None:
        raise ValueError("Use workbench_slot when moving tools to the workbench.")

    def _place_produce_lot(self, experiment: Experiment, moved: DndMovedObject) -> None:
        _place_produce_lot(experiment, moved, self._produce_target)


class RackSlotMoveDestination(MoveDestinationBase):
    def _place_tool(self, experiment: Experiment, moved: DndMovedObject) -> None:
        tool = _require_tool(moved)
        rack_slot = find_rack_slot(experiment.rack, self._destination.id)
        if tool.tool_type != "sample_vial":
            raise ValueError("Only autosampler vials can be placed in the rack.")
        if rack_slot.tool is not None:
            raise ValueError(f"{rack_slot.label} already contains a vial")
        rack_slot.tool = tool
        _append_tool_move_audit(experiment, moved, rack_slot.label)


class GrossBalanceMoveDestination(MoveDestinationBase):
    def __init__(self, runtime: ExperimentRuntime, destination: DndObjectRef) -> None:
        super().__init__(runtime, destination)
        self._produce_target = GrossBalanceProduceLotTarget(_DndGrossBalanceService(runtime))

    def validate_place(self, experiment: Experiment, request: DndMoveObjectRequest) -> None:
        if request.entity.kind == "produce_lot":
            self._produce_target.validate(experiment)

    def _place_tool(self, experiment: Experiment, moved: DndMovedObject) -> None:
        _DndGrossBalanceService(self._runtime)._place_tool_on_balance(
            experiment,
            _require_tool(moved),
            action_verb=_tool_action_verb(moved, restored="restored onto"),
        )

    def _place_produce_lot(self, experiment: Experiment, moved: DndMovedObject) -> None:
        _place_produce_lot(experiment, moved, self._produce_target)


class AnalyticalBalanceMoveDestination(MoveDestinationBase):
    def _place_tool(self, experiment: Experiment, moved: DndMovedObject) -> None:
        _DndAnalyticalBalanceService(self._runtime)._place_tool_on_balance(
            experiment,
            _require_tool(moved),
            action_verb=_tool_action_verb(moved, restored="restored to"),
        )


class VortexMoveDestination(MoveDestinationBase):
    def _place_tool(self, experiment: Experiment, moved: DndMovedObject) -> None:
        _DndVortexService(self._runtime)._place_tool_on_vortex(
            experiment,
            _require_tool(moved),
            action_verb=_tool_action_verb(moved, restored="restored to"),
        )


class GrinderMoveDestination(MoveDestinationBase):
    def __init__(self, runtime: ExperimentRuntime, destination: DndObjectRef) -> None:
        super().__init__(runtime, destination)
        self._produce_target = GrinderProduceLotTarget(destination.id)

    def validate_place(self, experiment: Experiment, request: DndMoveObjectRequest) -> None:
        if request.entity.kind == "produce_lot":
            self._produce_target.validate(experiment)

    def _place_tool(self, experiment: Experiment, moved: DndMovedObject) -> None:
        raise ValueError("Grinder cannot receive tools through object move.")

    def _place_produce_lot(self, experiment: Experiment, moved: DndMovedObject) -> None:
        _place_produce_lot(experiment, moved, self._produce_target)


class TrashBinMoveDestination(MoveDestinationBase):
    def _place_tool(self, experiment: Experiment, moved: DndMovedObject) -> None:
        tool = _require_tool(moved)
        _raise_if_tool_cannot_drop_on_destination(tool, self)
        experiment.trash.children.append(tool)
        experiment.trash.discarded_from[tool.id] = moved.source_label or moved.source_ref.kind
        experiment.audit_log.append(f"{tool.label} discarded from {moved.source_label or moved.source_ref.kind}.")

    def _place_produce_lot(self, experiment: Experiment, moved: DndMovedObject) -> None:
        raise ValueError("Produce lot trash moves use discard commands.")


class DndMoveObjectService(WriteDomainService[DndMoveObjectRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: DndMoveObjectRequest) -> None:
        source = _resolve_source(self._runtime, request.source)
        destination = _resolve_destination(self._runtime, request.destination)

        _validate_entity_can_drop_on_destination(experiment, request, destination)
        source.validate_remove(experiment, request, destination)
        destination.validate_place(experiment, request)
        moved = source.remove(experiment, request)
        destination.place(experiment, moved)
        source.after_remove(experiment, moved)
        destination.after_place(experiment, moved)


def _resolve_source(runtime: ExperimentRuntime, source: DndObjectRef) -> MoveSource:
    source_classes: dict[str, type[MoveSourceBase]] = {
        "analytical_balance": AnalyticalBalanceMoveSource,
        "basket": BasketMoveSource,
        "gross_balance": GrossBalanceMoveSource,
        "grinder": GrinderMoveSource,
        "palette": PaletteMoveSource,
        "rack": RackMoveSource,
        "toolbar": PaletteMoveSource,
        "trash": TrashMoveSource,
        "vortex": VortexMoveSource,
        "workbench": WorkbenchMoveSource,
    }
    source_cls = source_classes.get(source.kind)
    if source_cls is None:
        raise ValueError(f"Unsupported move source: {source.kind}.")
    return source_cls(runtime, source)


def _resolve_destination(runtime: ExperimentRuntime, destination: DndObjectRef) -> MoveDestination:
    destination_classes: dict[str, type[MoveDestinationBase]] = {
        "analytical_balance": AnalyticalBalanceMoveDestination,
        "gross_balance": GrossBalanceMoveDestination,
        "rack_slot": RackSlotMoveDestination,
        "trash_bin": TrashBinMoveDestination,
        "vortex": VortexMoveDestination,
        "workbench_slot": WorkbenchSlotMoveDestination,
        "workbench_tool": WorkbenchToolMoveDestination,
        "workspace_widget": GrinderMoveDestination,
    }
    destination_cls = destination_classes.get(destination.kind)
    if destination_cls is None:
        raise ValueError(f"Unsupported move destination: {destination.kind}.")
    return destination_cls(runtime, destination)


def _place_produce_lot(
    experiment: Experiment,
    moved: DndMovedObject,
    target: WorkbenchProduceLotTarget | GrinderProduceLotTarget | GrossBalanceProduceLotTarget,
) -> None:
    removal = _require_produce_lot_removal(moved)
    placement = target.place(experiment, removal.entity)
    sync_canonical_produce_model(experiment)

    verb = "added" if moved.source_ref.kind == "basket" else "moved"
    if moved.source_ref.kind == "trash":
        verb = "restored from trash"

    if placement.contamination_applied:
        experiment.audit_log.append(f"{removal.entity.label} {verb} from {removal.source_label} to {placement.target_label} and marked contaminated.")
        return
    if moved.source_ref.kind == "basket":
        experiment.audit_log.append(f"{removal.entity.label} added to {placement.target_label}.")
        return
    if moved.source_ref.kind == "trash":
        experiment.audit_log.append(f"{removal.entity.label} restored from trash to {placement.location_label}.")
        return
    experiment.audit_log.append(f"{removal.entity.label} moved from {removal.source_label} to {placement.target_label}.")


def _require_tool(moved: DndMovedObject) -> WorkbenchTool:
    if isinstance(moved.entity, WorkbenchTool):
        return moved.entity
    raise TypeError(f"Expected workbench tool, got {type(moved.entity).__name__}.")


def _get_drop_target_type(destination_kind: str) -> str:
    target_types = {
        "analytical_balance": "analytical_balance_widget",
        "gross_balance": "gross_balance_widget",
        "rack_slot": "rack_slot",
        "trash_bin": "trash_bin",
        "vortex": "vortex_widget",
        "workbench_slot": "workbench_slot",
        "workbench_tool": "workbench_slot",
        "workspace_widget": "grinder_widget",
    }
    target_type = target_types.get(destination_kind)
    if target_type is None:
        raise ValueError(f"Unsupported move destination: {destination_kind}.")
    return target_type


def _get_drop_target_label(destination_kind: str) -> str:
    labels = {
        "analytical_balance": "Analytical balance",
        "gross_balance": "Gross balance",
        "rack_slot": "rack",
        "trash_bin": "trash",
        "vortex": "Vortex mixer",
        "workbench_slot": "workbench",
        "workbench_tool": "workbench tool",
        "workspace_widget": "workspace widget",
    }
    return labels.get(destination_kind, destination_kind)


def _raise_if_tool_cannot_drop_on_destination(tool: WorkbenchTool, destination: MoveDestination) -> None:
    if destination.drop_target_type not in get_tool_allowed_drop_targets(tool.tool_type):
        raise ValueError(f"{tool.label} cannot be dropped on {destination.drop_target_label}.")


def _validate_entity_can_drop_on_destination(
    experiment: Experiment,
    request: DndMoveObjectRequest,
    destination: MoveDestination,
) -> None:
    if request.entity.kind == "tool":
        _raise_if_tool_cannot_drop_on_destination(_resolve_tool_for_move(experiment, request), destination)


def _resolve_tool_for_move(experiment: Experiment, request: DndMoveObjectRequest) -> WorkbenchTool:
    if request.source.kind in {"palette", "toolbar"}:
        return build_workbench_tool(request.entity.id)
    if request.source.kind == "basket":
        tool = next((candidate for candidate in experiment.basket_tools if candidate.id == request.source.id), None)
        if tool is None:
            raise ValueError("The specified bag is not in the produce basket.")
        return tool
    if request.source.kind == "workbench":
        slot = find_workbench_slot(experiment.workbench, request.source.id)
        if slot.tool is None:
            raise ValueError(f"Place a tool on {slot.label} before moving it.")
        return slot.tool
    if request.source.kind == "rack":
        rack_slot = find_rack_slot(experiment.rack, request.source.id)
        if rack_slot.tool is None:
            raise ValueError(f"{rack_slot.label} does not contain a tool.")
        return rack_slot.tool
    if request.source.kind == "gross_balance":
        widget = next(widget for widget in experiment.workspace.widgets if widget.id == "gross_balance")
        if widget.tool is None:
            raise ValueError("Place a tool on Gross balance before moving it.")
        return widget.tool
    if request.source.kind == "analytical_balance":
        widget = next(widget for widget in experiment.workspace.widgets if widget.id == "analytical_balance")
        if widget.tool is None:
            raise ValueError("Place a tool on Analytical balance before moving it.")
        return widget.tool
    if request.source.kind == "vortex":
        widget = next(widget for widget in experiment.workspace.widgets if widget.id == "vortex")
        if widget.tool is None:
            raise ValueError("Place a tool on Vortex mixer before moving it.")
        return widget.tool
    if request.source.kind == "trash":
        return find_trash_tool(experiment.trash, request.source.id)
    raise ValueError(f"{request.source.kind} cannot move tools.")


def _tool_action_verb(moved: DndMovedObject, *, restored: str) -> str:
    if moved.source_ref.kind in {"palette", "toolbar"}:
        return "placed on"
    if moved.source_ref.kind == "trash":
        return restored
    return "moved to"


def _append_tool_move_audit(experiment: Experiment, moved: DndMovedObject, target_label: str) -> None:
    tool = _require_tool(moved)
    if moved.source_ref.kind in {"palette", "toolbar"}:
        experiment.audit_log.append(f"{tool.label} placed on {target_label}.")
        return
    if moved.source_ref.kind == "trash":
        experiment.audit_log.append(f"{tool.label} restored from trash to {target_label}.")
        return
    experiment.audit_log.append(f"{tool.label} moved from {moved.source_label} to {target_label}.")


def _require_produce_lot_removal(moved: DndMovedObject) -> ProduceLotRemoval:
    if isinstance(moved.entity, TransferRemoval):
        return moved.entity
    raise TypeError(f"Expected produce lot removal, got {type(moved.entity).__name__}.")


class _DndGrossBalanceService(GrossBalanceServiceBase):
    def _run(self, experiment: Experiment, arguments: object) -> None:
        raise NotImplementedError


class _DndAnalyticalBalanceService(AnalyticalBalanceServiceBase):
    def _run(self, experiment: Experiment, arguments: object) -> None:
        raise NotImplementedError


class _DndVortexService(VortexServiceBase):
    def _run(self, experiment: Experiment, arguments: object) -> None:
        raise NotImplementedError
