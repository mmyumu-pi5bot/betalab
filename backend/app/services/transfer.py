from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, Protocol, TypeAlias, TypeVar

from app.domain.models import EntityOrigin, Experiment, ProduceLot
from app.domain.rules import can_tool_accept_produce, can_tool_receive_contents
from app.services.helpers.lookups import (
    find_trash_produce_lot,
    find_workbench_slot,
    find_workspace_widget,
)
from app.services.helpers.produce_canonical import mark_surface_fractions_contaminated, sync_canonical_produce_model

EntityT = TypeVar("EntityT")
SourceEntityT = TypeVar("SourceEntityT")
TargetEntityT = TypeVar("TargetEntityT", contravariant=True)


@dataclass(frozen=True, slots=True)
class TransferRemoval(Generic[EntityT]):
    entity: EntityT
    source_label: str
    origin: EntityOrigin


@dataclass(frozen=True, slots=True)
class TransferPlacement:
    target_label: str
    location_label: str
    contamination_applied: bool = False
    contaminated_lot_id: str | None = None


@dataclass(frozen=True, slots=True)
class TransferResult(Generic[EntityT]):
    entity: EntityT
    source_label: str
    target_label: str
    location_label: str
    contamination_applied: bool = False
    origin: EntityOrigin | None = None


class TransferSource(Protocol[SourceEntityT]):
    def remove(self, experiment: Experiment) -> TransferRemoval[SourceEntityT]: ...


class TransferTarget(Protocol[TargetEntityT]):
    def validate(self, experiment: Experiment) -> None: ...

    def place(self, experiment: Experiment, entity: TargetEntityT) -> TransferPlacement: ...


class TransferService(Generic[EntityT]):
    def transfer(
        self,
        experiment: Experiment,
        source: TransferSource[EntityT],
        target: TransferTarget[EntityT],
    ) -> TransferResult[EntityT]:
        target.validate(experiment)
        removal = source.remove(experiment)
        placement = target.place(experiment, removal.entity)
        sync_canonical_produce_model(experiment)
        if placement.contaminated_lot_id is not None:
            mark_surface_fractions_contaminated(experiment, placement.contaminated_lot_id)
        return TransferResult(
            entity=removal.entity,
            source_label=removal.source_label,
            target_label=placement.target_label,
            location_label=placement.location_label,
            contamination_applied=placement.contamination_applied,
            origin=removal.origin,
        )


ProduceLotRemoval: TypeAlias = TransferRemoval[ProduceLot]
ProduceLotPlacement: TypeAlias = TransferPlacement
ProduceLotTransferResult: TypeAlias = TransferResult[ProduceLot]
ProduceLotSource: TypeAlias = TransferSource[ProduceLot]
ProduceLotTarget: TypeAlias = TransferTarget[ProduceLot]


class ProduceLotTransferService(TransferService[ProduceLot]):
    pass


@dataclass(frozen=True, slots=True)
class WorkspaceProduceLotSource:
    produce_lot_id: str

    def remove(self, experiment: Experiment) -> ProduceLotRemoval:
        # First look in standalone basket lots
        standalone = next(
            (lot for lot in experiment.workspace.produce_basket_lots if lot.id == self.produce_lot_id),
            None,
        )
        if standalone is not None:
            experiment.workspace.produce_basket_lots = [lot for lot in experiment.workspace.produce_basket_lots if lot.id != standalone.id]
            return TransferRemoval(
                entity=standalone,
                source_label="Produce basket",
                origin=EntityOrigin(kind="produce_basket", location_label="Produce basket"),
            )

        # Then look inside basket tools (bags)
        for bag in experiment.basket_tools:
            lot = next((lot for lot in bag.produce_lots if lot.id == self.produce_lot_id), None)
            if lot is not None:
                bag.produce_lots = [kept for kept in bag.produce_lots if kept.id != lot.id]
                return TransferRemoval(
                    entity=lot,
                    source_label="Produce basket",
                    origin=EntityOrigin(kind="produce_basket", location_label="Produce basket"),
                )

        raise ValueError(f"Produce lot {self.produce_lot_id} not found in produce basket.")


@dataclass(frozen=True, slots=True)
class WorkbenchProduceLotSource:
    slot_id: str
    produce_lot_id: str

    def remove(self, experiment: Experiment) -> ProduceLotRemoval:
        slot = find_workbench_slot(experiment.workbench, self.slot_id)
        produce_lot = None
        source_label = slot.label

        if slot.tool is not None:
            produce_lot = next((lot for lot in slot.tool.produce_lots if lot.id == self.produce_lot_id), None)
            if produce_lot is not None:
                slot.tool.produce_lots = [lot for lot in slot.tool.produce_lots if lot.id != produce_lot.id]
                slot.tool.produce_fractions = [f for f in slot.tool.produce_fractions if f.produce_lot_id != produce_lot.id]
                source_label = slot.tool.label

        if produce_lot is None:
            produce_lot = next((lot for lot in slot.surface_produce_lots if lot.id == self.produce_lot_id), None)
            if produce_lot is None:
                raise ValueError("Unknown produce lot")
            slot.surface_produce_lots = [lot for lot in slot.surface_produce_lots if lot.id != produce_lot.id]

        return TransferRemoval(
            entity=produce_lot,
            source_label=source_label,
            origin=EntityOrigin(
                kind="workbench_tool" if slot.tool is not None and source_label == slot.tool.label else "workbench_surface",
                location_id=slot.id,
                location_label=slot.label,
                container_id=slot.tool.id if slot.tool is not None and source_label == slot.tool.label else None,
                container_label=slot.tool.label if slot.tool is not None and source_label == slot.tool.label else None,
            ),
        )


@dataclass(frozen=True, slots=True)
class GrinderProduceLotSource:
    widget_id: str
    produce_lot_id: str

    def remove(self, experiment: Experiment) -> ProduceLotRemoval:
        widget = _find_grinder_widget(experiment, self.widget_id)
        produce_lot = next((lot for lot in widget.produce_lots if lot.id == self.produce_lot_id), None)
        if produce_lot is None:
            raise ValueError("Unknown produce lot")

        widget.produce_lots = [lot for lot in widget.produce_lots if lot.id != produce_lot.id]
        return TransferRemoval(
            entity=produce_lot,
            source_label=widget.label,
            origin=EntityOrigin(
                kind="workspace_widget",
                location_id=widget.id,
                location_label=widget.label,
            ),
        )


@dataclass(frozen=True, slots=True)
class TrashProduceLotSource:
    trash_produce_lot_id: str

    def remove(self, experiment: Experiment) -> ProduceLotRemoval:
        trashed_produce_lot = find_trash_produce_lot(experiment.trash, self.trash_produce_lot_id)
        experiment.trash.produce_lots = [entry for entry in experiment.trash.produce_lots if entry.id != trashed_produce_lot.id]
        return TransferRemoval(
            entity=trashed_produce_lot.produce_lot,
            source_label=trashed_produce_lot.origin_label,
            origin=trashed_produce_lot.origin
            or EntityOrigin(
                kind="trash",
                location_id=trashed_produce_lot.id,
                location_label=trashed_produce_lot.origin_label,
            ),
        )


@dataclass(frozen=True, slots=True)
class GrinderProduceLotTarget:
    widget_id: str

    def validate(self, experiment: Experiment) -> None:
        widget = _find_grinder_widget(experiment, self.widget_id)
        if widget.produce_lots:
            raise ValueError(f"{widget.label} already contains a produce lot.")

    def place(self, experiment: Experiment, entity: ProduceLot) -> ProduceLotPlacement:
        widget = _find_grinder_widget(experiment, self.widget_id)
        widget.produce_lots.append(entity)
        return TransferPlacement(target_label=widget.label, location_label=widget.label)


@dataclass(frozen=True, slots=True)
class WorkbenchProduceLotTarget:
    slot_id: str
    allowed_tool_types: frozenset[str] | None = None

    def validate(self, experiment: Experiment) -> None:
        slot = find_workbench_slot(experiment.workbench, self.slot_id)
        if slot.tool is None:
            if slot.surface_produce_lots:
                raise ValueError(f"{slot.label} already contains a produce lot.")
            return

        if self.allowed_tool_types is None:
            if not can_tool_accept_produce(slot.tool.tool_type):
                raise ValueError(f"{slot.tool.label} does not accept produce.")
        elif slot.tool.tool_type not in self.allowed_tool_types:
            raise ValueError(f"{slot.tool.label} does not accept produce.")

        if not can_tool_receive_contents(slot.tool.tool_type, slot.tool.is_sealed):
            raise ValueError(f"Open {slot.tool.label} before adding produce.")

        if slot.tool.produce_lots:
            raise ValueError(f"{slot.tool.label} already contains a produce lot.")

    def place(self, experiment: Experiment, entity: ProduceLot) -> ProduceLotPlacement:
        slot = find_workbench_slot(experiment.workbench, self.slot_id)
        if slot.tool is None:
            slot.surface_produce_lots.append(entity)
            return TransferPlacement(
                target_label=slot.label,
                location_label=slot.label,
                contamination_applied=True,
                contaminated_lot_id=entity.id,
            )

        slot.tool.produce_lots.append(entity)
        return TransferPlacement(
            target_label=slot.tool.label,
            location_label=f"{slot.tool.label} on {slot.label}",
        )


def _find_grinder_widget(experiment: Experiment, widget_id: str):
    widget = find_workspace_widget(experiment.workspace, widget_id)
    if widget.id != "grinder" or widget.widget_type != "cryogenic_grinder":
        raise ValueError(f"{widget.label} does not accept grinder contents.")
    return widget
