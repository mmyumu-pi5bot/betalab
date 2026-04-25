from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from app.domain.models import Experiment
from app.services.domain_services.analytical_balance import (
    PlaceToolOnAnalyticalBalanceRequest,
    PlaceToolOnAnalyticalBalanceService,
)
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.domain_services.gross_balance import (
    GrossBalanceProduceLotSource,
    GrossBalanceProduceLotTarget,
    PlaceToolOnGrossBalanceRequest,
    PlaceToolOnGrossBalanceService,
)
from app.services.domain_services.gross_balance import (
    GrossBalanceServiceBase as _GrossBalanceServiceBase,
)
from app.services.domain_services.rack import (
    PlaceToolInRackSlotRequest,
    PlaceToolInRackSlotService,
)
from app.services.domain_services.vortex import (
    PlaceToolOnVortexRequest,
    PlaceToolOnVortexService,
)
from app.services.domain_services.workbench import (
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
)
from app.services.helpers.produce_canonical import sync_canonical_produce_model
from app.services.tool_move_service import MoveToolRequest, MoveToolService
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


class DndMoveDestination(Protocol):
    def before_run(self, experiment: Experiment, request: DndMoveObjectRequest) -> None: ...

    def add(self, experiment: Experiment, moved: DndMovedObject) -> None: ...

    def after_run(self, experiment: Experiment, moved: DndMovedObject) -> None: ...


class DndMoveSource(Protocol):
    def before_run(self, experiment: Experiment, request: DndMoveObjectRequest, destination: DndMoveDestination) -> None: ...

    def remove(self, experiment: Experiment, request: DndMoveObjectRequest) -> DndMovedObject: ...

    def after_run(self, experiment: Experiment, moved: DndMovedObject) -> None: ...


class NoopSourceHooks:
    def before_run(self, experiment: Experiment, request: DndMoveObjectRequest, destination: DndMoveDestination) -> None:
        pass

    def after_run(self, experiment: Experiment, moved: DndMovedObject) -> None:
        pass


class NoopDestinationHooks:
    def before_run(self, experiment: Experiment, request: DndMoveObjectRequest) -> None:
        pass

    def after_run(self, experiment: Experiment, moved: DndMovedObject) -> None:
        pass


class ToolMoveSource(NoopSourceHooks):
    def remove(self, experiment: Experiment, request: DndMoveObjectRequest) -> DndMovedObject:
        return DndMovedObject(
            entity=request.entity,
            entity_ref=request.entity,
            source_ref=request.source,
        )


class ToolMoveDestination(NoopDestinationHooks):
    def __init__(self, runtime: ExperimentRuntime, destination: DndObjectRef) -> None:
        self._runtime = runtime
        self._destination = destination

    def add(self, experiment: Experiment, moved: DndMovedObject) -> None:
        if moved.source_ref.kind in {"palette", "toolbar"}:
            self._place_from_factory(experiment, moved)
            return

        self._delegate(
            MoveToolService,
            experiment,
            MoveToolRequest(
                source_kind=moved.source_ref.kind,
                source_id=moved.source_ref.id,
                destination_kind=self._destination.kind,
                destination_id=self._destination.id,
            ),
        )

    def _place_from_factory(self, experiment: Experiment, moved: DndMovedObject) -> None:
        if self._destination.kind == "workbench_slot":
            self._delegate(
                PlaceToolOnWorkbenchService,
                experiment,
                PlaceToolOnWorkbenchRequest(slot_id=self._destination.id, tool_id=moved.entity_ref.id),
            )
            return
        if self._destination.kind == "rack_slot":
            self._delegate(
                PlaceToolInRackSlotService,
                experiment,
                PlaceToolInRackSlotRequest(rack_slot_id=self._destination.id, tool_id=moved.entity_ref.id),
            )
            return
        if self._destination.kind == "gross_balance":
            self._delegate(
                PlaceToolOnGrossBalanceService,
                experiment,
                PlaceToolOnGrossBalanceRequest(tool_id=moved.entity_ref.id),
            )
            return
        if self._destination.kind == "analytical_balance":
            self._delegate(
                PlaceToolOnAnalyticalBalanceService,
                experiment,
                PlaceToolOnAnalyticalBalanceRequest(tool_id=moved.entity_ref.id),
            )
            return
        if self._destination.kind == "vortex":
            self._delegate(
                PlaceToolOnVortexService,
                experiment,
                PlaceToolOnVortexRequest(tool_id=moved.entity_ref.id),
            )
            return
        raise ValueError(f"Unsupported tool factory destination: {self._destination.kind}.")

    def _delegate(self, service_cls: type[Any], experiment: Experiment, request: object) -> None:
        service = service_cls(self._runtime)
        service._run(experiment, request)


class ProduceLotMoveSource(NoopSourceHooks):
    def __init__(self, source: WorkspaceProduceLotSource | WorkbenchProduceLotSource | GrinderProduceLotSource | TrashProduceLotSource | GrossBalanceProduceLotSource) -> None:
        self._source = source

    def remove(self, experiment: Experiment, request: DndMoveObjectRequest) -> DndMovedObject:
        removal = self._source.remove(experiment)
        return DndMovedObject(
            entity=removal,
            entity_ref=request.entity,
            source_ref=request.source,
            source_label=removal.source_label,
        )


class ProduceLotMoveDestination(NoopDestinationHooks):
    def __init__(self, target: WorkbenchProduceLotTarget | GrinderProduceLotTarget | GrossBalanceProduceLotTarget) -> None:
        self._target = target

    def before_run(self, experiment: Experiment, request: DndMoveObjectRequest) -> None:
        self._target.validate(experiment)

    def add(self, experiment: Experiment, moved: DndMovedObject) -> None:
        removal = _require_produce_lot_removal(moved)
        placement = self._target.place(experiment, removal.entity)
        sync_canonical_produce_model(experiment)

        verb = "added" if moved.source_ref.kind == "basket" else "moved"
        if moved.source_ref.kind == "trash":
            verb = "restored from trash"

        if placement.contamination_applied:
            experiment.audit_log.append(
                f"{removal.entity.label} {verb} from {removal.source_label} to {placement.target_label} and marked contaminated."
            )
            return
        if moved.source_ref.kind == "basket":
            experiment.audit_log.append(f"{removal.entity.label} added to {placement.target_label}.")
            return
        if moved.source_ref.kind == "trash":
            experiment.audit_log.append(f"{removal.entity.label} restored from trash to {placement.location_label}.")
            return
        experiment.audit_log.append(f"{removal.entity.label} moved from {removal.source_label} to {placement.target_label}.")


class DndMoveObjectService(WriteDomainService[DndMoveObjectRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: DndMoveObjectRequest) -> None:
        source = self._resolve_source(request)
        destination = self._resolve_destination(request)

        source.before_run(experiment, request, destination)
        destination.before_run(experiment, request)
        moved = source.remove(experiment, request)
        destination.add(experiment, moved)
        source.after_run(experiment, moved)
        destination.after_run(experiment, moved)

    def _resolve_source(self, request: DndMoveObjectRequest) -> DndMoveSource:
        if request.entity.kind == "tool":
            return ToolMoveSource()
        if request.entity.kind == "produce_lot":
            return ProduceLotMoveSource(_resolve_produce_lot_source(request, self._runtime))
        raise ValueError(f"Unsupported DnD entity kind: {request.entity.kind}.")

    def _resolve_destination(self, request: DndMoveObjectRequest) -> DndMoveDestination:
        if request.entity.kind == "tool":
            return ToolMoveDestination(self._runtime, request.destination)
        if request.entity.kind == "produce_lot":
            return ProduceLotMoveDestination(_resolve_produce_lot_target(request, self._runtime))
        raise ValueError(f"Unsupported DnD entity kind: {request.entity.kind}.")


def _resolve_produce_lot_source(
    request: DndMoveObjectRequest,
    runtime: ExperimentRuntime,
) -> WorkspaceProduceLotSource | WorkbenchProduceLotSource | GrinderProduceLotSource | TrashProduceLotSource | GrossBalanceProduceLotSource:
    if request.source.kind == "basket":
        return WorkspaceProduceLotSource(request.entity.id)
    if request.source.kind == "workbench":
        return WorkbenchProduceLotSource(request.source.id, request.entity.id)
    if request.source.kind == "grinder":
        return GrinderProduceLotSource(request.source.id, request.entity.id)
    if request.source.kind == "trash":
        return TrashProduceLotSource(request.source.id)
    if request.source.kind == "gross_balance":
        return GrossBalanceProduceLotSource(_DndGrossBalanceService(runtime), request.entity.id)
    raise ValueError(f"Unsupported produce lot source: {request.source.kind}.")


def _resolve_produce_lot_target(
    request: DndMoveObjectRequest,
    runtime: ExperimentRuntime,
) -> WorkbenchProduceLotTarget | GrinderProduceLotTarget | GrossBalanceProduceLotTarget:
    if request.destination.kind == "workbench_tool":
        return WorkbenchProduceLotTarget(request.destination.id)
    if request.destination.kind == "workspace_widget" and request.destination.id == "grinder":
        return GrinderProduceLotTarget(request.destination.id)
    if request.destination.kind == "gross_balance":
        return GrossBalanceProduceLotTarget(_DndGrossBalanceService(runtime))
    raise ValueError(f"Unsupported produce lot destination: {request.destination.kind}.")


def _require_produce_lot_removal(moved: DndMovedObject) -> ProduceLotRemoval:
    if isinstance(moved.entity, TransferRemoval):
        return moved.entity
    raise TypeError(f"Expected produce lot removal, got {type(moved.entity).__name__}.")


class _DndGrossBalanceService(_GrossBalanceServiceBase):
    def _run(self, experiment: Experiment, arguments: object) -> None:
        raise NotImplementedError
