from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.domain.dnd_contracts import DndEntityContract, get_dnd_contract, source_kind_to_drop_target_type
from app.domain.models import ContainerLabel, Experiment, TrashProduceLotEntry, TrashSampleLabelEntry, WorkbenchTool, new_id
from app.services.domain_services.analytical_balance import AnalyticalBalanceServiceBase
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.domain_services.centrifuge import CentrifugeServiceBase
from app.services.domain_services.gross_balance import (
    GrossBalanceProduceLotSource,
    GrossBalanceProduceLotTarget,
    GrossBalanceServiceBase,
)
from app.services.domain_services.ice_bath import IceBathServiceBase
from app.services.domain_services.vortex import VortexServiceBase
from app.services.helpers.lookups import (
    find_rack_slot,
    find_trash_sample_label,
    find_trash_tool,
    find_workbench_slot,
)
from app.services.helpers.produce_canonical import mark_surface_fractions_contaminated, sync_canonical_produce_model
from app.services.helpers.workbench import build_workbench_tool, pop_tool_label, require_slot_tool
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
        if request.entity.kind == "tool":
            self._validate_tool_for_destination(experiment, request, destination)
        elif request.entity.kind == "produce_lot":
            contract = get_dnd_contract("produce_lot", "produce_lot")
            _assert_entity_can_move(contract, "Produce lot", destination)
        elif request.entity.kind == "sample_label":
            contract = get_dnd_contract("sample_label", "sample_label")
            _assert_entity_can_move(contract, "Sample label", destination)
        else:
            raise ValueError(f"Entity kind {request.entity.kind!r} is not supported by the object move command.")

    def _validate_tool_for_destination(self, experiment: Experiment, request: DndMoveObjectRequest, destination: MoveDestination) -> None:
        raise ValueError(f"{self._source.kind} cannot move tools.")

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
        if request.entity.kind == "sample_label":
            label, source_label = self._remove_sample_label(experiment, request)
            return DndMovedObject(
                entity=label,
                entity_ref=request.entity,
                source_ref=request.source,
                source_label=source_label,
            )
        raise ValueError(f"{self._source.kind} cannot move {request.entity.kind}.")

    def after_remove(self, experiment: Experiment, moved: DndMovedObject) -> None:
        pass

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        raise ValueError(f"{self._source.kind} cannot move produce lots.")

    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        raise ValueError(f"{self._source.kind} cannot move tools.")

    def _remove_sample_label(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[ContainerLabel, str]:
        raise ValueError(f"{self._source.kind} cannot move sample labels.")


class PaletteMoveSource(MoveSourceBase):
    def _validate_tool_for_destination(self, experiment: Experiment, request: DndMoveObjectRequest, destination: MoveDestination) -> None:
        tool = build_workbench_tool(request.entity.id)
        _assert_entity_can_move(get_dnd_contract("tool", tool.tool_type), tool.label, destination)

    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        return build_workbench_tool(request.entity.id), "Palette"


class BasketMoveSource(MoveSourceBase):
    def _validate_tool_for_destination(self, experiment: Experiment, request: DndMoveObjectRequest, destination: MoveDestination) -> None:
        tool = next((t for t in experiment.basket_tools if t.id == request.source.id), None)
        if tool is None:
            raise ValueError("The specified bag is not in the produce basket.")
        if request.entity.id != tool.id:
            raise ValueError("Moved tool entity does not match the source tool.")
        _assert_entity_can_move(get_dnd_contract("tool", tool.tool_type), tool.label, destination)

    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        tool_index = next((index for index, tool in enumerate(experiment.basket_tools) if tool.id == request.source.id), None)
        if tool_index is None:
            raise ValueError("The specified bag is not in the produce basket.")
        return experiment.basket_tools.pop(tool_index), "Produce basket"

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        return WorkspaceProduceLotSource(request.entity.id).remove(experiment)


class WorkbenchMoveSource(MoveSourceBase):
    def _validate_tool_for_destination(self, experiment: Experiment, request: DndMoveObjectRequest, destination: MoveDestination) -> None:
        slot = find_workbench_slot(experiment.workbench, request.source.id)
        if slot.tool is None:
            raise ValueError(f"Place a tool on {slot.label} before moving it.")
        if request.entity.id != slot.tool.id:
            raise ValueError("Moved tool entity does not match the source tool.")
        _assert_entity_can_move(get_dnd_contract("tool", slot.tool.tool_type), slot.tool.label, destination)

    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        slot = find_workbench_slot(experiment.workbench, request.source.id)
        if slot.tool is None:
            raise ValueError(f"Place a tool on {slot.label} before moving it.")
        moved_tool = slot.tool
        slot.tool = None
        return moved_tool, slot.label

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        return WorkbenchProduceLotSource(request.source.id, request.entity.id).remove(experiment)

    def _remove_sample_label(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[ContainerLabel, str]:
        slot = find_workbench_slot(experiment.workbench, request.source.id)
        tool = require_slot_tool(slot, "moving its sample label")
        return pop_tool_label(tool, request.entity.id), f"{tool.label} on {slot.label}"


class RackMoveSource(MoveSourceBase):
    def _validate_tool_for_destination(self, experiment: Experiment, request: DndMoveObjectRequest, destination: MoveDestination) -> None:
        rack_slot = find_rack_slot(experiment.rack, request.source.id)
        if rack_slot.tool is None:
            raise ValueError(f"{rack_slot.label} does not contain a tool.")
        if request.entity.id != rack_slot.tool.id:
            raise ValueError("Moved tool entity does not match the source tool.")
        _assert_entity_can_move(get_dnd_contract("tool", rack_slot.tool.tool_type), rack_slot.tool.label, destination)

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
    def _validate_tool_for_destination(self, experiment: Experiment, request: DndMoveObjectRequest, destination: MoveDestination) -> None:
        widget = next((w for w in experiment.workspace.widgets if w.id == self._source.id), None)
        if widget is None or widget.tool is None:
            raise ValueError("Place a tool on Gross balance before moving it.")
        if request.entity.id != widget.tool.id:
            raise ValueError("Moved tool entity does not match the source tool.")
        _assert_entity_can_move(get_dnd_contract("tool", widget.tool.tool_type), widget.tool.label, destination)

    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        service = _DndGrossBalanceService(self._runtime)
        return service.take_tool_from_balance(experiment), "Gross balance"

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        return GrossBalanceProduceLotSource(_DndGrossBalanceService(self._runtime), request.entity.id).remove(experiment)

    def _remove_sample_label(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[ContainerLabel, str]:
        tool = _DndGrossBalanceService(self._runtime).require_gross_balance_tool(experiment)
        return pop_tool_label(tool, request.entity.id), f"{tool.label} on Gross balance"


class AnalyticalBalanceMoveSource(MoveSourceBase):
    def _validate_tool_for_destination(self, experiment: Experiment, request: DndMoveObjectRequest, destination: MoveDestination) -> None:
        widget = next((w for w in experiment.workspace.widgets if w.id == self._source.id), None)
        if widget is None or widget.tool is None:
            raise ValueError("Place a tool on Analytical balance before moving it.")
        if request.entity.id != widget.tool.id:
            raise ValueError("Moved tool entity does not match the source tool.")
        _assert_entity_can_move(get_dnd_contract("tool", widget.tool.tool_type), widget.tool.label, destination)

    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        return _DndAnalyticalBalanceService(self._runtime).take_tool_from_balance(experiment), "Analytical balance"

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        raise ValueError("Analytical balance cannot move produce lots.")

    def _remove_sample_label(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[ContainerLabel, str]:
        tool = _DndAnalyticalBalanceService(self._runtime).require_balance_tool(experiment)
        return pop_tool_label(tool, request.entity.id), f"{tool.label} on Analytical balance"


class VortexMoveSource(MoveSourceBase):
    def _validate_tool_for_destination(self, experiment: Experiment, request: DndMoveObjectRequest, destination: MoveDestination) -> None:
        widget = next((w for w in experiment.workspace.widgets if w.id == self._source.id), None)
        if widget is None or widget.tool is None:
            raise ValueError("Place a tool on Vortex mixer before moving it.")
        if request.entity.id != widget.tool.id:
            raise ValueError("Moved tool entity does not match the source tool.")
        _assert_entity_can_move(get_dnd_contract("tool", widget.tool.tool_type), widget.tool.label, destination)

    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        return _DndVortexService(self._runtime).take_tool_from_vortex(experiment), "Vortex mixer"

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        raise ValueError("Vortex cannot move produce lots.")


class CentrifugeMoveSource(MoveSourceBase):
    def _validate_tool_for_destination(self, experiment: Experiment, request: DndMoveObjectRequest, destination: MoveDestination) -> None:
        widget = next((w for w in experiment.workspace.widgets if w.id == self._source.id), None)
        if widget is None or widget.tool is None:
            raise ValueError("Place a tube in Centrifuge before moving it.")
        if request.entity.id != widget.tool.id:
            raise ValueError("Moved tool entity does not match the source tool.")
        _assert_entity_can_move(get_dnd_contract("tool", widget.tool.tool_type), widget.tool.label, destination)

    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        return _DndCentrifugeService(self._runtime).take_tool(experiment), "Centrifuge"

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        raise ValueError("Centrifuge cannot move produce lots.")


class IceBathMoveSource(MoveSourceBase):
    def _validate_tool_for_destination(self, experiment: Experiment, request: DndMoveObjectRequest, destination: MoveDestination) -> None:
        widget = next((w for w in experiment.workspace.widgets if w.id == self._source.id), None)
        if widget is None or widget.tool is None:
            raise ValueError("Place a tube in Ice bath before moving it.")
        if request.entity.id != widget.tool.id:
            raise ValueError("Moved tool entity does not match the source tool.")
        _assert_entity_can_move(get_dnd_contract("tool", widget.tool.tool_type), widget.tool.label, destination)

    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        return _DndIceBathService(self._runtime).take_tool(experiment), "Ice bath"

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        raise ValueError("Ice bath cannot move produce lots.")


class GrinderMoveSource(MoveSourceBase):
    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        return GrinderProduceLotSource(request.source.id, request.entity.id).remove(experiment)


class TrashMoveSource(MoveSourceBase):
    def _validate_tool_for_destination(self, experiment: Experiment, request: DndMoveObjectRequest, destination: MoveDestination) -> None:
        tool = find_trash_tool(experiment.trash, request.source.id)
        _assert_entity_can_move(get_dnd_contract("tool", tool.tool_type), tool.label, destination)

    def _remove_tool(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[WorkbenchTool, str]:
        tool = find_trash_tool(experiment.trash, request.source.id)
        origin_label = experiment.trash.discarded_from.get(tool.id, "Trash")
        experiment.trash.children = [entry for entry in experiment.trash.children if entry.id != tool.id]
        experiment.trash.discarded_from.pop(tool.id, None)
        return tool, origin_label

    def _remove_produce_lot(self, experiment: Experiment, request: DndMoveObjectRequest) -> ProduceLotRemoval:
        return TrashProduceLotSource(request.source.id).remove(experiment)

    def _remove_sample_label(self, experiment: Experiment, request: DndMoveObjectRequest) -> tuple[ContainerLabel, str]:
        entry = find_trash_sample_label(experiment.trash, request.source.id)
        experiment.trash.sample_labels = [sample_label for sample_label in experiment.trash.sample_labels if sample_label.id != entry.id]
        return entry.label, entry.origin_label


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
        if moved.entity_ref.kind == "sample_label":
            self._place_sample_label(experiment, moved)
            return
        raise ValueError(f"{self._destination.kind} cannot place {moved.entity_ref.kind}.")

    def after_place(self, experiment: Experiment, moved: DndMovedObject) -> None:
        pass

    def _place_tool(self, experiment: Experiment, moved: DndMovedObject) -> None:
        raise ValueError(f"{self._destination.kind} cannot create tools.")

    def _place_produce_lot(self, experiment: Experiment, moved: DndMovedObject) -> None:
        raise ValueError(f"{self._destination.kind} cannot place produce lots.")

    def _place_sample_label(self, experiment: Experiment, moved: DndMovedObject) -> None:
        raise ValueError(f"{self._destination.kind} cannot place sample labels.")


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

    def _place_sample_label(self, experiment: Experiment, moved: DndMovedObject) -> None:
        target_slot = find_workbench_slot(experiment.workbench, self._destination.id)
        target_tool = require_slot_tool(target_slot, "adding a sample label")
        target_tool.labels.append(_require_sample_label(moved))
        _append_sample_label_move_audit(experiment, moved, f"{target_tool.label} on {target_slot.label}")


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
        _DndGrossBalanceService(self._runtime).place_tool_on_balance(
            experiment,
            _require_tool(moved),
            action_verb=_tool_action_verb(moved, restored="restored onto"),
        )

    def _place_produce_lot(self, experiment: Experiment, moved: DndMovedObject) -> None:
        _place_produce_lot(experiment, moved, self._produce_target)

    def _place_sample_label(self, experiment: Experiment, moved: DndMovedObject) -> None:
        target_tool = _DndGrossBalanceService(self._runtime).require_gross_balance_tool(experiment)
        target_tool.labels.append(_require_sample_label(moved))
        _append_sample_label_move_audit(experiment, moved, f"{target_tool.label} on Gross balance")


class AnalyticalBalanceMoveDestination(MoveDestinationBase):
    def _place_tool(self, experiment: Experiment, moved: DndMovedObject) -> None:
        _DndAnalyticalBalanceService(self._runtime).place_tool_on_balance(
            experiment,
            _require_tool(moved),
            action_verb=_tool_action_verb(moved, restored="restored to"),
        )

    def _place_sample_label(self, experiment: Experiment, moved: DndMovedObject) -> None:
        target_tool = _DndAnalyticalBalanceService(self._runtime).require_balance_tool(experiment)
        target_tool.labels.append(_require_sample_label(moved))
        _append_sample_label_move_audit(experiment, moved, f"{target_tool.label} on Analytical balance")


class VortexMoveDestination(MoveDestinationBase):
    def _place_tool(self, experiment: Experiment, moved: DndMovedObject) -> None:
        _DndVortexService(self._runtime).place_tool_on_vortex(
            experiment,
            _require_tool(moved),
            action_verb=_tool_action_verb(moved, restored="restored to"),
        )


class CentrifugeMoveDestination(MoveDestinationBase):
    def _place_tool(self, experiment: Experiment, moved: DndMovedObject) -> None:
        _DndCentrifugeService(self._runtime).place_tool(
            experiment,
            _require_tool(moved),
            action_verb=_tool_action_verb(moved, restored="restored to"),
        )


class IceBathMoveDestination(MoveDestinationBase):
    def _place_tool(self, experiment: Experiment, moved: DndMovedObject) -> None:
        _DndIceBathService(self._runtime).place_tool(
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
        experiment.trash.children.append(tool)
        experiment.trash.discarded_from[tool.id] = moved.source_label or moved.source_ref.kind
        experiment.audit_log.append(f"{tool.label} discarded from {moved.source_label or moved.source_ref.kind}.")

    def _place_produce_lot(self, experiment: Experiment, moved: DndMovedObject) -> None:
        removal = _require_produce_lot_removal(moved)
        experiment.trash.produce_lots.append(
            TrashProduceLotEntry(
                id=new_id("trash_produce_lot"),
                origin_label=removal.source_label,
                produce_lot=removal.entity,
                origin=removal.origin,
            )
        )
        sync_canonical_produce_model(experiment)
        experiment.audit_log.append(f"{removal.entity.label} discarded from {removal.source_label}.")

    def _place_sample_label(self, experiment: Experiment, moved: DndMovedObject) -> None:
        label = _require_sample_label(moved)
        experiment.trash.sample_labels.append(
            TrashSampleLabelEntry(
                id=new_id("trash_sample_label"),
                origin_label=moved.source_label,
                label=label,
            )
        )
        experiment.audit_log.append(f"Label discarded from {moved.source_label}.")


class DndMoveObjectService(WriteDomainService[DndMoveObjectRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: DndMoveObjectRequest) -> None:
        source = _resolve_source(self._runtime, request.source)
        destination = _resolve_destination(self._runtime, request.destination)
        _validate_not_same_location(request, destination)
        source.validate_remove(experiment, request, destination)
        destination.validate_place(experiment, request)
        moved = source.remove(experiment, request)
        destination.place(experiment, moved)
        source.after_remove(experiment, moved)
        destination.after_place(experiment, moved)


def place_new_tool(
    runtime: ExperimentRuntime,
    experiment: Experiment,
    tool: WorkbenchTool,
    destination_ref: DndObjectRef,
    *,
    source_label: str,
    source_kind: str = "debug_palette",
) -> None:
    destination = _resolve_destination(runtime, destination_ref)
    request = DndMoveObjectRequest(
        entity=DndObjectRef(kind="tool", id=tool.id),
        source=DndObjectRef(kind=source_kind, id=tool.tool_id),
        destination=destination_ref,
    )
    _assert_entity_can_move(get_dnd_contract("tool", tool.tool_type), tool.label, destination)
    destination.validate_place(experiment, request)
    moved = DndMovedObject(
        entity=tool,
        entity_ref=request.entity,
        source_ref=request.source,
        source_label=source_label,
    )
    destination.place(experiment, moved)
    destination.after_place(experiment, moved)


def _resolve_source(runtime: ExperimentRuntime, source: DndObjectRef) -> MoveSource:
    source_classes: dict[str, type[MoveSourceBase]] = {
        "analytical_balance": AnalyticalBalanceMoveSource,
        "basket": BasketMoveSource,
        "centrifuge": CentrifugeMoveSource,
        "gross_balance": GrossBalanceMoveSource,
        "grinder": GrinderMoveSource,
        "ice_bath": IceBathMoveSource,
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
        "centrifuge": CentrifugeMoveDestination,
        "gross_balance": GrossBalanceMoveDestination,
        "ice_bath": IceBathMoveDestination,
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
        mark_surface_fractions_contaminated(experiment, removal.entity.id)
        if moved.source_ref.kind == "basket":
            experiment.audit_log.append(f"{removal.entity.label} placed directly on {placement.target_label} and marked contaminated.")
            return
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


def _require_sample_label(moved: DndMovedObject) -> ContainerLabel:
    if isinstance(moved.entity, ContainerLabel):
        return moved.entity
    raise TypeError(f"Expected sample label, got {type(moved.entity).__name__}.")


def _get_drop_target_type(destination_kind: str) -> str:
    target_types = {
        "analytical_balance": "analytical_balance_widget",
        "centrifuge": "centrifuge_widget",
        "gross_balance": "gross_balance_widget",
        "ice_bath": "ice_bath_widget",
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
        "centrifuge": "Centrifuge",
        "gross_balance": "Gross balance",
        "ice_bath": "Ice bath",
        "rack_slot": "rack",
        "trash_bin": "trash",
        "vortex": "Vortex mixer",
        "workbench_slot": "workbench",
        "workbench_tool": "workbench tool",
        "workspace_widget": "workspace widget",
    }
    return labels.get(destination_kind, destination_kind)


def _assert_entity_can_move(contract: DndEntityContract, label: str, destination: MoveDestination) -> None:
    if not contract.supports_object_move:
        raise ValueError(f"{label} cannot be moved with the generic DnD move command.")
    if destination.drop_target_type not in contract.allowed_drop_targets:
        raise ValueError(f"{label} cannot be dropped on {destination.drop_target_label}.")


def _validate_not_same_location(request: DndMoveObjectRequest, destination: MoveDestination) -> None:
    if request.source.kind == "trash" and destination.drop_target_type == "trash_bin":
        raise ValueError("Cannot drop an entity onto its current location.")
    if source_kind_to_drop_target_type(request.source.kind) == destination.drop_target_type and request.source.id == request.destination.id:
        raise ValueError("Cannot drop an entity onto its current location.")


def _tool_action_verb(moved: DndMovedObject, *, restored: str) -> str:
    if moved.source_ref.kind in {"debug_palette", "palette", "toolbar"}:
        return "placed on"
    if moved.source_ref.kind == "trash":
        return restored
    return "moved to"


def _append_tool_move_audit(experiment: Experiment, moved: DndMovedObject, target_label: str) -> None:
    tool = _require_tool(moved)
    if moved.source_ref.kind in {"debug_palette", "palette", "toolbar"}:
        experiment.audit_log.append(f"{tool.label} placed on {target_label}.")
        return
    if moved.source_ref.kind == "trash":
        experiment.audit_log.append(f"{tool.label} restored from trash to {target_label}.")
        return
    experiment.audit_log.append(f"{tool.label} moved from {moved.source_label} to {target_label}.")


def _append_sample_label_move_audit(experiment: Experiment, moved: DndMovedObject, target_label: str) -> None:
    if moved.source_ref.kind == "trash":
        experiment.audit_log.append(f"Label restored from trash to {target_label}.")
        return
    experiment.audit_log.append(f"Label moved from {moved.source_label} to {target_label}.")


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


class _DndCentrifugeService(CentrifugeServiceBase):
    def _run(self, experiment: Experiment, arguments: object) -> None:
        raise NotImplementedError


class _DndIceBathService(IceBathServiceBase):
    def _run(self, experiment: Experiment, arguments: object) -> None:
        raise NotImplementedError
