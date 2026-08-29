from __future__ import annotations

from dataclasses import dataclass

from app.domain.journal_codes import JournalCode
from app.domain.models import Experiment
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.journal_refs import tool_ref, widget_type_ref
from app.services.journal_service import record_journal


@dataclass(frozen=True, slots=True)
class EmptyTrashRequest:
    pass


@dataclass(frozen=True, slots=True)
class DiscardBasketToolRequest:
    tool_id: str


class DiscardBasketToolService(WriteDomainService[DiscardBasketToolRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: DiscardBasketToolRequest) -> None:
        tool_index = next(
            (i for i, t in enumerate(experiment.basket_tools) if t.id == request.tool_id),
            None,
        )
        if tool_index is None:
            raise ValueError("The specified bag is not in the produce basket.")

        discarded_tool = experiment.basket_tools.pop(tool_index)
        experiment.trash.children.append(discarded_tool)
        experiment.trash.discarded_from[discarded_tool.id] = "Produce basket"
        record_journal(
            experiment,
            JournalCode.TOOL_DISCARDED,
            tool=tool_ref(discarded_tool),
            source=widget_type_ref("produce_basket", "Produce basket"),
        )
