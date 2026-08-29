from __future__ import annotations

from dataclasses import dataclass

from app.domain.journal_codes import JournalCode
from app.domain.models import (
    EntityOrigin,
    Experiment,
    ProduceLot,
    TrashProduceLotEntry,
    WorkbenchTool,
    WorkspaceWidget,
)
from app.domain.rules import can_tool_accept_produce, can_tool_be_sealed, can_tool_receive_contents
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.helpers.lookups import (
    build_manual_label,
    find_rack_slot,
    find_trash_tool,
    find_workbench_slot,
    find_workspace_widget,
)
from app.services.helpers.produce_canonical import (
    get_tool_total_produce_mass_g,
    get_widget_total_produce_mass_g,
    sync_canonical_produce_model,
)
from app.services.helpers.workbench import build_workbench_tool
from app.services.journal_refs import produce_ref, text_ref, tool_ref, widget_ref, widget_type_ref
from app.services.journal_service import record_journal
from app.services.received_sample_generation import resolve_received_bag_gross_mass_g
from app.services.transfer import (
    ProduceLotPlacement,
    ProduceLotRemoval,
)

_TARE_BY_TOOL_TYPE_G: dict[str, float] = {
    "volumetric_flask": 140,
    "amber_bottle": 95,
    "sample_vial": 1.5,
    "beaker": 68,
    "centrifuge_tube": 12,
    "cutting_board": 320,
    "sample_bag": 36,
    "storage_jar": 180,
}


@dataclass(frozen=True, slots=True)
class EmptyRequest:
    pass


@dataclass(frozen=True, slots=True)
class MoveWorkbenchToolToGrossBalanceRequest:
    source_slot_id: str


@dataclass(frozen=True, slots=True)
class PlaceToolOnGrossBalanceRequest:
    tool_id: str


@dataclass(frozen=True, slots=True)
class MoveRackToolToGrossBalanceRequest:
    rack_slot_id: str


@dataclass(frozen=True, slots=True)
class RestoreTrashedToolToGrossBalanceRequest:
    trash_tool_id: str


@dataclass(frozen=True, slots=True)
class MoveAnalyticalBalanceToolToGrossBalanceRequest:
    pass


@dataclass(frozen=True, slots=True)
class MoveGrossBalanceToolToWorkbenchRequest:
    target_slot_id: str


@dataclass(frozen=True, slots=True)
class MoveGrossBalanceToolToRackRequest:
    rack_slot_id: str


@dataclass(frozen=True, slots=True)
class DiscardGrossBalanceProduceLotRequest:
    produce_lot_id: str


class GrossBalanceServiceBase(WriteDomainService[object]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _find_gross_balance_widget(self, experiment: Experiment) -> WorkspaceWidget:
        widget = find_workspace_widget(experiment.workspace, "gross_balance")
        if widget.widget_type != "gross_balance":
            raise ValueError(f"{widget.label} is not a gross balance.")
        return widget

    def _validate_balance_empty(self, widget: WorkspaceWidget) -> None:
        if widget.tool is not None or widget.produce_lots:
            raise ValueError(f"{widget.label} already contains an item.")

    def require_gross_balance_tool(self, experiment: Experiment) -> WorkbenchTool:
        widget = self._find_gross_balance_widget(experiment)
        if widget.tool is None:
            raise ValueError(f"{widget.label} does not contain a tool.")
        return widget.tool

    def place_tool_on_balance(
        self,
        experiment: Experiment,
        tool: WorkbenchTool,
        *,
        journal_code: JournalCode = JournalCode.TOOL_PLACED_ON_EQUIPMENT,
    ) -> None:
        widget = self._find_gross_balance_widget(experiment)
        self._validate_balance_empty(widget)
        widget.tool = tool
        self._update_balance_measured_mass(experiment)
        record_journal(experiment, journal_code, tool=tool_ref(tool), widget=widget_ref(widget))

    def take_tool_from_balance(self, experiment: Experiment) -> WorkbenchTool:
        widget = self._find_gross_balance_widget(experiment)
        if widget.tool is None:
            raise ValueError(f"{widget.label} does not contain a tool.")
        removed_tool = widget.tool
        widget.tool = None
        self._update_balance_measured_mass(experiment)
        return removed_tool

    def _append_tool_moved_from_balance_audit(
        self,
        experiment: Experiment,
        tool_label: str,
        target_label: str,
    ) -> None:
        widget = self._find_gross_balance_widget(experiment)
        record_journal(
            experiment,
            JournalCode.TOOL_MOVED,
            tool=text_ref(tool_label),
            source=widget_ref(widget),
            target=text_ref(target_label),
        )

    def _update_balance_measured_mass(self, experiment: Experiment) -> None:
        widget = self._find_gross_balance_widget(experiment)
        if widget.tool is not None:
            measured_mass_g = resolve_received_bag_gross_mass_g(widget.tool)
            if measured_mass_g is None:
                measured_mass_g = self._estimate_tool_mass(widget.tool)
        elif widget.produce_lots or widget.produce_fractions:
            measured_mass_g = round(get_widget_total_produce_mass_g(widget), 1)
        else:
            measured_mass_g = None
        experiment.lims_reception.measured_gross_mass_g = measured_mass_g

    def _estimate_tool_mass(self, tool: WorkbenchTool) -> float:
        produce_mass_g = get_tool_total_produce_mass_g(tool)
        liquid_mass_g = sum(liquid.volume_ml for liquid in tool.liquids)
        return round(
            _TARE_BY_TOOL_TYPE_G.get(tool.tool_type, 0) + produce_mass_g + liquid_mass_g,
            1,
        )

    def _remove_gross_balance_produce_lot(self, experiment: Experiment, produce_lot_id: str) -> tuple[ProduceLot, str, EntityOrigin]:
        widget = self._find_gross_balance_widget(experiment)
        if widget.tool is not None:
            produce_lot = next((lot for lot in widget.tool.produce_lots if lot.id == produce_lot_id), None)
            if produce_lot is not None:
                widget.tool.produce_lots = [lot for lot in widget.tool.produce_lots if lot.id != produce_lot_id]
                widget.tool.produce_fractions = [fraction for fraction in widget.tool.produce_fractions if fraction.produce_lot_id != produce_lot_id]
                self._update_balance_measured_mass(experiment)
                return (
                    produce_lot,
                    widget.label,
                    EntityOrigin(
                        kind="gross_balance_tool",
                        location_id=widget.id,
                        location_label=widget.label,
                        container_id=widget.tool.id,
                        container_label=widget.tool.label,
                    ),
                )

        produce_lot = next((lot for lot in widget.produce_lots if lot.id == produce_lot_id), None)
        if produce_lot is None:
            raise ValueError(f"{widget.label} does not contain produce lot {produce_lot_id}.")
        widget.produce_lots = [lot for lot in widget.produce_lots if lot.id != produce_lot_id]
        widget.produce_fractions = [fraction for fraction in widget.produce_fractions if fraction.produce_lot_id != produce_lot_id]
        self._update_balance_measured_mass(experiment)
        return (
            produce_lot,
            widget.label,
            EntityOrigin(
                kind="gross_balance_surface",
                location_id=widget.id,
                location_label=widget.label,
            ),
        )


class GrossBalanceProduceLotTarget:
    def __init__(self, service: GrossBalanceServiceBase | None = None) -> None:
        self._service = service

    def validate(self, experiment: Experiment) -> None:
        widget = (
            self._service._find_gross_balance_widget(experiment)
            if self._service is not None
            else find_workspace_widget(experiment.workspace, "gross_balance")
        )
        if widget.widget_type != "gross_balance":
            raise ValueError(f"{widget.label} is not a gross balance.")
        if widget.tool is not None:
            if not can_tool_accept_produce(widget.tool.tool_type):
                raise ValueError(f"{widget.tool.label} does not accept produce.")
            if not can_tool_receive_contents(widget.tool.tool_type, widget.tool.is_sealed):
                raise ValueError(f"Open {widget.tool.label} before adding produce.")
            if widget.tool.produce_lots:
                raise ValueError(f"{widget.tool.label} already contains a produce lot.")
            return
        if widget.produce_lots:
            raise ValueError(f"{widget.label} already contains a produce lot.")

    def place(self, experiment: Experiment, entity: ProduceLot) -> ProduceLotPlacement:
        widget = (
            self._service._find_gross_balance_widget(experiment)
            if self._service is not None
            else find_workspace_widget(experiment.workspace, "gross_balance")
        )
        if widget.widget_type != "gross_balance":
            raise ValueError(f"{widget.label} is not a gross balance.")
        if widget.tool is not None:
            widget.tool.produce_lots.append(entity)
            if self._service is not None:
                self._service._update_balance_measured_mass(experiment)
            else:
                measured_mass_g = resolve_received_bag_gross_mass_g(widget.tool)
                if measured_mass_g is None:
                    produce_mass_g = sum(lot.total_mass_g for lot in widget.tool.produce_lots)
                    liquid_mass_g = sum(liquid.volume_ml for liquid in widget.tool.liquids)
                    measured_mass_g = round(
                        _TARE_BY_TOOL_TYPE_G.get(widget.tool.tool_type, 0) + produce_mass_g + liquid_mass_g,
                        1,
                    )
                experiment.lims_reception.measured_gross_mass_g = measured_mass_g
            return ProduceLotPlacement(
                target_label=widget.tool.label,
                location_label=f"{widget.tool.label} on {widget.label}",
            )
        widget.produce_lots.append(entity)
        if self._service is not None:
            self._service._update_balance_measured_mass(experiment)
        else:
            experiment.lims_reception.measured_gross_mass_g = round(widget.produce_lots[0].total_mass_g, 1)
        return ProduceLotPlacement(target_label=widget.label, location_label=widget.label)


class GrossBalanceProduceLotSource:
    def __init__(self, service: GrossBalanceServiceBase, produce_lot_id: str):
        self._service = service
        self._produce_lot_id = produce_lot_id

    def remove(self, experiment: Experiment) -> ProduceLotRemoval:
        produce_lot, source_label, origin = self._service._remove_gross_balance_produce_lot(
            experiment,
            self._produce_lot_id,
        )
        return ProduceLotRemoval(entity=produce_lot, source_label=source_label, origin=origin)


class MoveWorkbenchToolToGrossBalanceService(GrossBalanceServiceBase):
    def _run(
        self,
        experiment: Experiment,
        request: MoveWorkbenchToolToGrossBalanceRequest,
    ) -> None:
        source_slot = find_workbench_slot(experiment.workbench, request.source_slot_id)
        if source_slot.tool is None:
            raise ValueError(f"{source_slot.label} does not contain a tool.")
        moved_tool = source_slot.tool
        source_slot.tool = None
        self.place_tool_on_balance(experiment, moved_tool)


@dataclass(frozen=True, slots=True)
class MoveBasketToolToGrossBalanceRequest:
    tool_id: str


class MoveBasketToolToGrossBalanceService(GrossBalanceServiceBase):
    def _run(self, experiment: Experiment, request: MoveBasketToolToGrossBalanceRequest) -> None:
        tool_index = next(
            (i for i, t in enumerate(experiment.basket_tools) if t.id == request.tool_id),
            None,
        )
        if tool_index is None:
            raise ValueError("The specified bag is not in the produce basket.")
        moved_tool = experiment.basket_tools.pop(tool_index)
        self.place_tool_on_balance(experiment, moved_tool)


class PlaceToolOnGrossBalanceService(GrossBalanceServiceBase):
    def _run(
        self,
        experiment: Experiment,
        request: PlaceToolOnGrossBalanceRequest,
    ) -> None:
        self.place_tool_on_balance(experiment, build_workbench_tool(request.tool_id))


class MoveRackToolToGrossBalanceService(GrossBalanceServiceBase):
    def _run(
        self,
        experiment: Experiment,
        request: MoveRackToolToGrossBalanceRequest,
    ) -> None:
        rack_slot = find_rack_slot(experiment.rack, request.rack_slot_id)
        if rack_slot.tool is None:
            raise ValueError(f"{rack_slot.label} does not contain a tool.")
        moved_tool = rack_slot.tool
        rack_slot.tool = None
        self.place_tool_on_balance(experiment, moved_tool)


class RestoreTrashedToolToGrossBalanceService(GrossBalanceServiceBase):
    def _run(
        self,
        experiment: Experiment,
        request: RestoreTrashedToolToGrossBalanceRequest,
    ) -> None:
        tool = find_trash_tool(experiment.trash, request.trash_tool_id)
        experiment.trash.children = [t for t in experiment.trash.children if t.id != tool.id]
        experiment.trash.discarded_from.pop(tool.id, None)
        self.place_tool_on_balance(
            experiment,
            tool,
            journal_code=JournalCode.TOOL_RESTORED_ONTO_EQUIPMENT,
        )


class MoveAnalyticalBalanceToolToGrossBalanceService(GrossBalanceServiceBase):
    def _run(
        self,
        experiment: Experiment,
        request: MoveAnalyticalBalanceToolToGrossBalanceRequest,
    ) -> None:
        analytical_balance = find_workspace_widget(experiment.workspace, "analytical_balance")
        if analytical_balance.tool is None:
            raise ValueError("Analytical balance does not contain a tool.")
        moved_tool = analytical_balance.tool
        analytical_balance.tool = None
        self.place_tool_on_balance(
            experiment,
            moved_tool,
            journal_code=JournalCode.TOOL_MOVED_TO_EQUIPMENT,
        )


class MoveGrossBalanceToolToWorkbenchService(GrossBalanceServiceBase):
    def _run(
        self,
        experiment: Experiment,
        request: MoveGrossBalanceToolToWorkbenchRequest,
    ) -> None:
        target_slot = find_workbench_slot(experiment.workbench, request.target_slot_id)
        if target_slot.tool is not None or target_slot.surface_produce_lots:
            raise ValueError(f"{target_slot.label} already contains a tool")
        moved_tool = self.take_tool_from_balance(experiment)
        target_slot.tool = moved_tool
        self._append_tool_moved_from_balance_audit(experiment, moved_tool.label, target_slot.label)


class MoveGrossBalanceToolToRackService(GrossBalanceServiceBase):
    def _run(
        self,
        experiment: Experiment,
        request: MoveGrossBalanceToolToRackRequest,
    ) -> None:
        rack_slot = find_rack_slot(experiment.rack, request.rack_slot_id)
        moved_tool = self.require_gross_balance_tool(experiment)
        if moved_tool.tool_type != "sample_vial":
            raise ValueError(f"{moved_tool.label} does not fit in the rack.")
        if rack_slot.tool is not None:
            raise ValueError(f"{rack_slot.label} already contains a tool.")
        rack_slot.tool = self.take_tool_from_balance(experiment)
        self._append_tool_moved_from_balance_audit(experiment, rack_slot.tool.label, rack_slot.label)


class DiscardGrossBalanceToolService(GrossBalanceServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        widget = self._find_gross_balance_widget(experiment)
        removed_tool = self.take_tool_from_balance(experiment)
        experiment.trash.children.append(removed_tool)
        experiment.trash.discarded_from[removed_tool.id] = widget.label
        record_journal(
            experiment,
            JournalCode.TOOL_DISCARDED,
            tool=tool_ref(removed_tool),
            source=widget_ref(widget),
        )


class OpenGrossBalanceToolService(GrossBalanceServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        tool = self.require_gross_balance_tool(experiment)
        if not can_tool_be_sealed(tool.tool_type):
            raise ValueError(f"{tool.label} does not support sealing.")
        tool.is_sealed = False
        record_journal(
            experiment,
            JournalCode.TOOL_OPENED,
            tool=tool_ref(tool),
            location=widget_type_ref("gross_balance", "Gross balance"),
        )


class CloseGrossBalanceToolService(GrossBalanceServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        tool = self.require_gross_balance_tool(experiment)
        if not can_tool_be_sealed(tool.tool_type):
            raise ValueError(f"{tool.label} does not support sealing.")
        tool.is_sealed = True
        record_journal(
            experiment,
            JournalCode.TOOL_SEALED,
            tool=tool_ref(tool),
            location=widget_type_ref("gross_balance", "Gross balance"),
        )


class ApplySampleLabelToGrossBalanceToolService(GrossBalanceServiceBase):
    def _run(self, experiment: Experiment, request: EmptyRequest) -> None:
        tool = self.require_gross_balance_tool(experiment)
        tool.labels.append(build_manual_label())
        record_journal(
            experiment,
            JournalCode.MANUAL_LABEL_APPLIED,
            tool=tool_ref(tool),
            location=widget_type_ref("gross_balance", "Gross balance"),
        )


class DiscardGrossBalanceProduceLotService(GrossBalanceServiceBase):
    def _run(
        self,
        experiment: Experiment,
        request: DiscardGrossBalanceProduceLotRequest,
    ) -> None:
        produce_lot, source_label, origin = self._remove_gross_balance_produce_lot(
            experiment,
            request.produce_lot_id,
        )
        experiment.trash.produce_lots.append(
            TrashProduceLotEntry(
                id=f"trash_produce_{produce_lot.id}",
                origin_label=source_label,
                produce_lot=produce_lot,
                origin=origin,
            )
        )
        sync_canonical_produce_model(experiment)
        record_journal(
            experiment,
            JournalCode.PRODUCE_DISCARDED,
            produce=produce_ref(produce_lot),
            source=text_ref(source_label),
        )
