from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.domain.models import Experiment
from app.services.domain_services.analytical_balance import (
    DiscardAnalyticalBalanceToolService,
    MoveAnalyticalBalanceToolToRackRequest,
    MoveAnalyticalBalanceToolToRackService,
    MoveAnalyticalBalanceToolToWorkbenchRequest,
    MoveAnalyticalBalanceToolToWorkbenchService,
    MoveGrossBalanceToolToAnalyticalBalanceRequest,
    MoveGrossBalanceToolToAnalyticalBalanceService,
    MoveRackToolToAnalyticalBalanceRequest,
    MoveRackToolToAnalyticalBalanceService,
    MoveWorkbenchToolToAnalyticalBalanceRequest,
    MoveWorkbenchToolToAnalyticalBalanceService,
    RestoreTrashedToolToAnalyticalBalanceRequest,
    RestoreTrashedToolToAnalyticalBalanceService,
)
from app.services.domain_services.analytical_balance import (
    EmptyRequest as EmptyAnalyticalBalanceRequest,
)
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.domain_services.gross_balance import (
    DiscardGrossBalanceToolService,
    MoveAnalyticalBalanceToolToGrossBalanceRequest,
    MoveAnalyticalBalanceToolToGrossBalanceService,
    MoveBasketToolToGrossBalanceRequest,
    MoveBasketToolToGrossBalanceService,
    MoveGrossBalanceToolToRackRequest,
    MoveGrossBalanceToolToRackService,
    MoveGrossBalanceToolToWorkbenchRequest,
    MoveGrossBalanceToolToWorkbenchService,
    MoveRackToolToGrossBalanceRequest,
    MoveRackToolToGrossBalanceService,
    MoveWorkbenchToolToGrossBalanceRequest,
    MoveWorkbenchToolToGrossBalanceService,
    RestoreTrashedToolToGrossBalanceRequest,
    RestoreTrashedToolToGrossBalanceService,
)
from app.services.domain_services.gross_balance import (
    EmptyRequest as EmptyGrossBalanceRequest,
)
from app.services.domain_services.rack import (
    DiscardRackToolRequest,
    DiscardRackToolService,
    MoveRackToolBetweenSlotsRequest,
    MoveRackToolBetweenSlotsService,
    PlaceWorkbenchToolInRackSlotRequest,
    PlaceWorkbenchToolInRackSlotService,
    RemoveRackToolToWorkbenchSlotRequest,
    RemoveRackToolToWorkbenchSlotService,
    RestoreTrashedToolToRackSlotRequest,
    RestoreTrashedToolToRackSlotService,
)
from app.services.domain_services.reception import (
    PlaceReceivedBagOnWorkbenchRequest,
    PlaceReceivedBagOnWorkbenchService,
)
from app.services.domain_services.trash import (
    DiscardBasketToolRequest,
    DiscardBasketToolService,
)
from app.services.domain_services.vortex import (
    DiscardVortexToolService,
    MoveAnalyticalBalanceToolToVortexRequest,
    MoveAnalyticalBalanceToolToVortexService,
    MoveGrossBalanceToolToVortexRequest,
    MoveGrossBalanceToolToVortexService,
    MoveRackToolToVortexRequest,
    MoveRackToolToVortexService,
    MoveVortexToolToAnalyticalBalanceRequest,
    MoveVortexToolToAnalyticalBalanceService,
    MoveVortexToolToGrossBalanceRequest,
    MoveVortexToolToGrossBalanceService,
    MoveVortexToolToWorkbenchRequest,
    MoveVortexToolToWorkbenchService,
    MoveWorkbenchToolToVortexRequest,
    MoveWorkbenchToolToVortexService,
    RestoreTrashedToolToVortexRequest,
    RestoreTrashedToolToVortexService,
)
from app.services.domain_services.vortex import (
    EmptyRequest as EmptyVortexRequest,
)
from app.services.domain_services.workbench import (
    DiscardWorkbenchToolService,
    MoveToolBetweenWorkbenchSlotsRequest,
    MoveToolBetweenWorkbenchSlotsService,
    RestoreTrashedToolToWorkbenchSlotRequest,
    RestoreTrashedToolToWorkbenchSlotService,
    WorkbenchSlotRequest,
)


@dataclass(frozen=True, slots=True)
class MoveToolRequest:
    source_kind: str
    source_id: str
    destination_kind: str
    destination_id: str


class MoveToolService(WriteDomainService[MoveToolRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _delegate(self, service_cls: type[Any], experiment: Experiment, request: object) -> None:
        service = service_cls(self._runtime)
        service._run(experiment, request)

    def _run(self, experiment: Experiment, request: MoveToolRequest) -> None:
        if request.destination_kind == "trash_bin":
            self._move_to_trash(experiment, request)
            return

        if request.source_kind == "trash":
            self._restore_from_trash(experiment, request)
            return

        if request.source_kind == "workbench":
            self._move_from_workbench(experiment, request)
            return

        if request.source_kind == "rack":
            self._move_from_rack(experiment, request)
            return

        if request.source_kind == "gross_balance":
            self._move_from_gross_balance(experiment, request)
            return

        if request.source_kind == "analytical_balance":
            self._move_from_analytical_balance(experiment, request)
            return

        if request.source_kind == "vortex":
            self._move_from_vortex(experiment, request)
            return

        if request.source_kind == "basket":
            self._move_from_basket(experiment, request)
            return

        raise ValueError(f"Unsupported tool source: {request.source_kind}.")

    def _move_to_trash(self, experiment: Experiment, request: MoveToolRequest) -> None:
        if request.source_kind == "workbench":
            self._delegate(
                DiscardWorkbenchToolService,
                experiment,
                WorkbenchSlotRequest(slot_id=request.source_id),
            )
            return
        if request.source_kind == "rack":
            self._delegate(
                DiscardRackToolService,
                experiment,
                DiscardRackToolRequest(rack_slot_id=request.source_id),
            )
            return
        if request.source_kind == "gross_balance":
            self._delegate(DiscardGrossBalanceToolService, experiment, EmptyGrossBalanceRequest())
            return
        if request.source_kind == "analytical_balance":
            self._delegate(DiscardAnalyticalBalanceToolService, experiment, EmptyAnalyticalBalanceRequest())
            return
        if request.source_kind == "vortex":
            self._delegate(DiscardVortexToolService, experiment, EmptyVortexRequest())
            return
        if request.source_kind == "basket":
            self._delegate(
                DiscardBasketToolService,
                experiment,
                DiscardBasketToolRequest(tool_id=request.source_id),
            )
            return
        raise ValueError(f"Unsupported tool move from {request.source_kind} to trash.")

    def _restore_from_trash(self, experiment: Experiment, request: MoveToolRequest) -> None:
        if request.destination_kind == "workbench_slot":
            self._delegate(
                RestoreTrashedToolToWorkbenchSlotService,
                experiment,
                RestoreTrashedToolToWorkbenchSlotRequest(
                    trash_tool_id=request.source_id,
                    target_slot_id=request.destination_id,
                ),
            )
            return
        if request.destination_kind == "rack_slot":
            self._delegate(
                RestoreTrashedToolToRackSlotService,
                experiment,
                RestoreTrashedToolToRackSlotRequest(
                    trash_tool_id=request.source_id,
                    rack_slot_id=request.destination_id,
                ),
            )
            return
        if request.destination_kind == "gross_balance":
            self._delegate(
                RestoreTrashedToolToGrossBalanceService,
                experiment,
                RestoreTrashedToolToGrossBalanceRequest(trash_tool_id=request.source_id),
            )
            return
        if request.destination_kind == "analytical_balance":
            self._delegate(
                RestoreTrashedToolToAnalyticalBalanceService,
                experiment,
                RestoreTrashedToolToAnalyticalBalanceRequest(trash_tool_id=request.source_id),
            )
            return
        if request.destination_kind == "vortex":
            self._delegate(
                RestoreTrashedToolToVortexService,
                experiment,
                RestoreTrashedToolToVortexRequest(trash_tool_id=request.source_id),
            )
            return
        raise ValueError(f"Unsupported trash restore destination: {request.destination_kind}.")

    def _move_from_workbench(self, experiment: Experiment, request: MoveToolRequest) -> None:
        if request.destination_kind == "workbench_slot":
            self._delegate(
                MoveToolBetweenWorkbenchSlotsService,
                experiment,
                MoveToolBetweenWorkbenchSlotsRequest(
                    source_slot_id=request.source_id,
                    target_slot_id=request.destination_id,
                ),
            )
            return
        if request.destination_kind == "rack_slot":
            self._delegate(
                PlaceWorkbenchToolInRackSlotService,
                experiment,
                PlaceWorkbenchToolInRackSlotRequest(
                    source_slot_id=request.source_id,
                    rack_slot_id=request.destination_id,
                ),
            )
            return
        if request.destination_kind == "gross_balance":
            self._delegate(
                MoveWorkbenchToolToGrossBalanceService,
                experiment,
                MoveWorkbenchToolToGrossBalanceRequest(source_slot_id=request.source_id),
            )
            return
        if request.destination_kind == "analytical_balance":
            self._delegate(
                MoveWorkbenchToolToAnalyticalBalanceService,
                experiment,
                MoveWorkbenchToolToAnalyticalBalanceRequest(source_slot_id=request.source_id),
            )
            return
        if request.destination_kind == "vortex":
            self._delegate(
                MoveWorkbenchToolToVortexService,
                experiment,
                MoveWorkbenchToolToVortexRequest(source_slot_id=request.source_id),
            )
            return
        raise ValueError(f"Unsupported workbench tool destination: {request.destination_kind}.")

    def _move_from_rack(self, experiment: Experiment, request: MoveToolRequest) -> None:
        if request.destination_kind == "workbench_slot":
            self._delegate(
                RemoveRackToolToWorkbenchSlotService,
                experiment,
                RemoveRackToolToWorkbenchSlotRequest(
                    rack_slot_id=request.source_id,
                    target_slot_id=request.destination_id,
                ),
            )
            return
        if request.destination_kind == "rack_slot":
            self._delegate(
                MoveRackToolBetweenSlotsService,
                experiment,
                MoveRackToolBetweenSlotsRequest(
                    source_rack_slot_id=request.source_id,
                    target_rack_slot_id=request.destination_id,
                ),
            )
            return
        if request.destination_kind == "gross_balance":
            self._delegate(
                MoveRackToolToGrossBalanceService,
                experiment,
                MoveRackToolToGrossBalanceRequest(rack_slot_id=request.source_id),
            )
            return
        if request.destination_kind == "analytical_balance":
            self._delegate(
                MoveRackToolToAnalyticalBalanceService,
                experiment,
                MoveRackToolToAnalyticalBalanceRequest(rack_slot_id=request.source_id),
            )
            return
        if request.destination_kind == "vortex":
            self._delegate(
                MoveRackToolToVortexService,
                experiment,
                MoveRackToolToVortexRequest(rack_slot_id=request.source_id),
            )
            return
        raise ValueError(f"Unsupported rack tool destination: {request.destination_kind}.")

    def _move_from_gross_balance(self, experiment: Experiment, request: MoveToolRequest) -> None:
        if request.destination_kind == "workbench_slot":
            self._delegate(
                MoveGrossBalanceToolToWorkbenchService,
                experiment,
                MoveGrossBalanceToolToWorkbenchRequest(target_slot_id=request.destination_id),
            )
            return
        if request.destination_kind == "rack_slot":
            self._delegate(
                MoveGrossBalanceToolToRackService,
                experiment,
                MoveGrossBalanceToolToRackRequest(rack_slot_id=request.destination_id),
            )
            return
        if request.destination_kind == "analytical_balance":
            self._delegate(
                MoveGrossBalanceToolToAnalyticalBalanceService,
                experiment,
                MoveGrossBalanceToolToAnalyticalBalanceRequest(),
            )
            return
        if request.destination_kind == "vortex":
            self._delegate(
                MoveGrossBalanceToolToVortexService,
                experiment,
                MoveGrossBalanceToolToVortexRequest(),
            )
            return
        raise ValueError(f"Unsupported gross balance tool destination: {request.destination_kind}.")

    def _move_from_analytical_balance(self, experiment: Experiment, request: MoveToolRequest) -> None:
        if request.destination_kind == "workbench_slot":
            self._delegate(
                MoveAnalyticalBalanceToolToWorkbenchService,
                experiment,
                MoveAnalyticalBalanceToolToWorkbenchRequest(target_slot_id=request.destination_id),
            )
            return
        if request.destination_kind == "rack_slot":
            self._delegate(
                MoveAnalyticalBalanceToolToRackService,
                experiment,
                MoveAnalyticalBalanceToolToRackRequest(rack_slot_id=request.destination_id),
            )
            return
        if request.destination_kind == "gross_balance":
            self._delegate(
                MoveAnalyticalBalanceToolToGrossBalanceService,
                experiment,
                MoveAnalyticalBalanceToolToGrossBalanceRequest(),
            )
            return
        if request.destination_kind == "vortex":
            self._delegate(
                MoveAnalyticalBalanceToolToVortexService,
                experiment,
                MoveAnalyticalBalanceToolToVortexRequest(),
            )
            return
        raise ValueError(f"Unsupported analytical balance tool destination: {request.destination_kind}.")

    def _move_from_vortex(self, experiment: Experiment, request: MoveToolRequest) -> None:
        if request.destination_kind == "workbench_slot":
            self._delegate(
                MoveVortexToolToWorkbenchService,
                experiment,
                MoveVortexToolToWorkbenchRequest(target_slot_id=request.destination_id),
            )
            return
        if request.destination_kind == "gross_balance":
            self._delegate(
                MoveVortexToolToGrossBalanceService,
                experiment,
                MoveVortexToolToGrossBalanceRequest(),
            )
            return
        if request.destination_kind == "analytical_balance":
            self._delegate(
                MoveVortexToolToAnalyticalBalanceService,
                experiment,
                MoveVortexToolToAnalyticalBalanceRequest(),
            )
            return
        raise ValueError(f"Unsupported vortex tool destination: {request.destination_kind}.")

    def _move_from_basket(self, experiment: Experiment, request: MoveToolRequest) -> None:
        if request.destination_kind == "workbench_slot":
            self._delegate(
                PlaceReceivedBagOnWorkbenchService,
                experiment,
                PlaceReceivedBagOnWorkbenchRequest(
                    target_slot_id=request.destination_id,
                    tool_id=request.source_id,
                ),
            )
            return
        if request.destination_kind == "gross_balance":
            self._delegate(
                MoveBasketToolToGrossBalanceService,
                experiment,
                MoveBasketToolToGrossBalanceRequest(tool_id=request.source_id),
            )
            return
        raise ValueError(f"Unsupported basket tool destination: {request.destination_kind}.")
