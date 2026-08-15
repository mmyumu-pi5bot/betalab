from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from app.domain.models import (
    Experiment,
    LimsReception,
    PrintedLabelTicket,
    TrashSampleLabelEntry,
    WorkbenchTool,
    new_id,
)
from app.services.domain_services.base import ExperimentRuntime, WriteDomainService
from app.services.helpers.lookups import (
    build_lims_label,
    find_workbench_slot,
    find_workspace_widget,
)
from app.services.received_sample_generation import resolve_received_bag_gross_mass_g


@dataclass(frozen=True, slots=True)
class PlaceReceivedBagOnWorkbenchRequest:
    target_slot_id: str
    tool_id: str


@dataclass(frozen=True, slots=True)
class RecordGrossWeightRequest:
    measured_gross_mass_g: float | None = None


@dataclass(frozen=True, slots=True)
class SetGrossMassOffsetRequest:
    gross_mass_offset_g: int


@dataclass(frozen=True, slots=True)
class CreateLimsReceptionRequest:
    orchard_name: str
    harvest_date: str
    indicative_mass_g: float
    measured_gross_mass_g: float | None
    measured_sample_mass_g: float | None = None
    entry_id: str | None = None


@dataclass(frozen=True, slots=True)
class PrintLimsLabelRequest:
    entry_id: str | None = None


@dataclass(frozen=True, slots=True)
class ApplyPrintedLimsLabelRequest:
    slot_id: str


@dataclass(frozen=True, slots=True)
class EmptyReceptionRequest:
    pass


class PlaceReceivedBagOnWorkbenchService(WriteDomainService[PlaceReceivedBagOnWorkbenchRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: PlaceReceivedBagOnWorkbenchRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.target_slot_id)
        tool_index = next(
            (i for i, t in enumerate(experiment.basket_tools) if t.id == request.tool_id),
            None,
        )
        if tool_index is None:
            raise ValueError("The specified bag is not in the produce basket.")
        if slot.tool is not None or slot.surface_produce_lots:
            raise ValueError(f"{slot.label} already contains a tool")

        bag = experiment.basket_tools.pop(tool_index)
        slot.tool = bag
        experiment.audit_log.append(f"Received sampling bag moved from basket to {slot.label}.")


class RecordGrossWeightService(WriteDomainService[RecordGrossWeightRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: RecordGrossWeightRequest) -> None:
        measured_mass_g = _resolve_received_sampling_bag_gross_mass(experiment, request.measured_gross_mass_g)
        if measured_mass_g is None:
            measured_mass_g = _find_first_present_received_bag_gross_mass(experiment)
        if measured_mass_g is None:
            raise ValueError("Place the received sampling bag before recording its gross mass.")
        if measured_mass_g <= 0:
            raise ValueError("Gross balance mass must be greater than zero.")

        experiment.lims_reception.measured_gross_mass_g = measured_mass_g
        experiment.audit_log.append(f"Gross reception weight recorded at {measured_mass_g:.1f} g.")


class SetGrossMassOffsetService(WriteDomainService[SetGrossMassOffsetRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: SetGrossMassOffsetRequest) -> None:
        if request.gross_mass_offset_g < -100 or request.gross_mass_offset_g > 0:
            raise ValueError("Gross balance offset must stay between -100 g and 0 g.")

        experiment.lims_reception.gross_mass_offset_g = int(request.gross_mass_offset_g)
        experiment.audit_log.append(f"Gross balance container offset set to {request.gross_mass_offset_g:+d} g.")


class CreateLimsReceptionService(WriteDomainService[CreateLimsReceptionRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: CreateLimsReceptionRequest) -> None:
        if request.measured_gross_mass_g is not None and request.measured_gross_mass_g <= 0:
            raise ValueError("Gross reception mass must be greater than zero.")
        if request.measured_sample_mass_g is not None and request.measured_sample_mass_g <= 0:
            raise ValueError("Sample mass must be greater than zero.")

        existing_entry = (
            _find_lims_entry(experiment, request.entry_id) if request.entry_id is not None else None
        )
        measured_gross_mass_g = _resolve_measured_gross_mass_g(
            experiment, request.measured_gross_mass_g, entry=existing_entry
        )
        if existing_entry is None:
            entry = _build_lims_reception_entry(
                experiment,
                request,
                measured_gross_mass_g=measured_gross_mass_g,
                entry_id=new_id("lims_entry"),
                lab_sample_code=_build_sample_code(experiment),
                printed_label_ticket=None,
                status="awaiting_label_application",
            )
            experiment.lims_entries.append(entry)
            experiment.audit_log.append(f"LIMS reception created for {entry.lab_sample_code}.")
        else:
            entry = existing_entry
            _update_lims_reception_entry(
                entry,
                experiment,
                request,
                measured_gross_mass_g=measured_gross_mass_g,
            )
            experiment.audit_log.append(f"LIMS reception updated for {entry.lab_sample_code}.")

        experiment.lims_reception = _clone_lims_entry(entry, printed_label_ticket=entry.printed_label_ticket)


class PrintLimsLabelService(WriteDomainService[PrintLimsLabelRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: PrintLimsLabelRequest) -> None:
        entry = _resolve_lims_entry_for_print(experiment, request.entry_id)
        sample_code = entry.lab_sample_code
        if sample_code is None:
            raise ValueError("Create the LIMS reception entry before printing a label.")
        if experiment.lims_reception.printed_label_ticket is not None:
            raise ValueError("Remove the current printed ticket from the LIMS before printing another label.")

        ticket = PrintedLabelTicket(
            id=new_id("lims_ticket"),
            sample_code=sample_code,
            label_text=sample_code,
            received_date=datetime.now(UTC).date().isoformat(),
        )
        entry.printed_label_ticket = ticket
        experiment.lims_reception = _clone_lims_entry(entry, printed_label_ticket=ticket)
        experiment.audit_log.append(f"LIMS label printed for {sample_code}.")


class DiscardPrintedLimsLabelService(WriteDomainService[EmptyReceptionRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: EmptyReceptionRequest) -> None:
        ticket = experiment.lims_reception.printed_label_ticket
        if ticket is None:
            raise ValueError("There is no printed LIMS ticket to discard.")

        _clear_printed_ticket_for_sample_code(experiment, ticket.sample_code)
        experiment.lims_reception.printed_label_ticket = None
        experiment.trash.sample_labels.append(
            TrashSampleLabelEntry(
                id=new_id("trash_sample_label"),
                origin_label="LIMS terminal",
                label=build_lims_label(
                    sample_code=ticket.sample_code,
                    text=ticket.label_text,
                    received_date=ticket.received_date,
                ),
            )
        )
        experiment.audit_log.append(f"LIMS label {ticket.sample_code} discarded from terminal.")


class ApplyPrintedLimsLabelService(WriteDomainService[ApplyPrintedLimsLabelRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: ApplyPrintedLimsLabelRequest) -> None:
        slot = find_workbench_slot(experiment.workbench, request.slot_id)
        if slot.tool is None:
            raise ValueError(f"{slot.label} does not contain a tool.")

        ticket = _require_printed_lims_ticket(experiment)
        _apply_ticket_to_tool(slot.tool, ticket)
        _consume_printed_lims_ticket(experiment, ticket)
        experiment.audit_log.append(f"LIMS label {ticket.sample_code} applied to {slot.tool.label}.")


class ApplyPrintedLimsLabelToBasketBagService(WriteDomainService[EmptyReceptionRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: EmptyReceptionRequest) -> None:
        if not experiment.basket_tools:
            raise ValueError("The produce basket does not contain the received sampling bag.")
        basket_tool = _require_received_sampling_bag(
            experiment.basket_tools[0],
            "The produce basket does not contain the received sampling bag.",
        )
        ticket = _require_printed_lims_ticket(experiment)
        _apply_ticket_to_tool(basket_tool, ticket)
        _consume_printed_lims_ticket(experiment, ticket)
        experiment.audit_log.append(f"LIMS label {ticket.sample_code} applied to {basket_tool.label}.")


class ApplyPrintedLimsLabelToGrossBalanceBagService(WriteDomainService[EmptyReceptionRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: EmptyReceptionRequest) -> None:
        balance_widget = find_workspace_widget(experiment.workspace, "gross_balance")
        balance_tool = balance_widget.tool
        if balance_tool is None:
            raise ValueError("The gross balance does not contain a tool.")
        ticket = _require_printed_lims_ticket(experiment)
        _apply_ticket_to_tool(balance_tool, ticket)
        _consume_printed_lims_ticket(experiment, ticket)
        experiment.audit_log.append(f"LIMS label {ticket.sample_code} applied to {balance_tool.label}.")


class ApplyPrintedLimsLabelToAnalyticalBalanceToolService(WriteDomainService[EmptyReceptionRequest]):
    def __init__(self, runtime: ExperimentRuntime) -> None:
        super().__init__(runtime)

    def _run(self, experiment: Experiment, request: EmptyReceptionRequest) -> None:
        balance_widget = find_workspace_widget(experiment.workspace, "analytical_balance")
        balance_tool = balance_widget.tool
        if balance_tool is None:
            raise ValueError("The analytical balance does not contain a tool.")
        ticket = _require_printed_lims_ticket(experiment)
        _apply_ticket_to_tool(balance_tool, ticket)
        _consume_printed_lims_ticket(experiment, ticket)
        experiment.audit_log.append(f"LIMS label {ticket.sample_code} applied to {balance_tool.label}.")


def _build_sample_code(experiment: Experiment) -> str:
    existing_suffixes = [
        int(entry.lab_sample_code.rsplit("-", 1)[-1])
        for entry in experiment.lims_entries
        if entry.lab_sample_code is not None and entry.lab_sample_code.rsplit("-", 1)[-1].isdigit()
    ]
    next_sequence = max(existing_suffixes, default=0) + 1
    return f"APP-2026-{next_sequence:04d}"


def _resolve_measured_gross_mass_g(
    experiment: Experiment,
    measured_gross_mass_g: float | None,
    *,
    entry: LimsReception | None = None,
) -> float | None:
    """Gross mass to record, when the request does not carry one.

    ``experiment.lims_reception`` is the reception desk's scratchpad: the gross
    balance writes the reading there, and it is cleared again as soon as the bag
    is moved off. That makes it a fallback for a brand-new entry only — an entry
    already registered keeps its own reading, otherwise re-editing it after the
    bag left the balance would silently erase the weighing.
    """
    if measured_gross_mass_g is not None:
        return float(measured_gross_mass_g)
    if entry is not None and entry.measured_gross_mass_g is not None:
        return float(entry.measured_gross_mass_g)
    if experiment.lims_reception.measured_gross_mass_g is not None:
        return float(experiment.lims_reception.measured_gross_mass_g)
    return None


def _resolve_received_sampling_bag_gross_mass(
    experiment: Experiment,
    measured_gross_mass_g: float | None,
) -> float | None:
    if measured_gross_mass_g is not None:
        return float(measured_gross_mass_g)
    return resolve_received_bag_gross_mass_g(experiment.basket_tools[0] if experiment.basket_tools else None)


def _find_first_present_received_bag_gross_mass(experiment: Experiment) -> float | None:
    for slot in experiment.workbench.slots:
        gross_mass_g = resolve_received_bag_gross_mass_g(slot.tool)
        if gross_mass_g is not None:
            return gross_mass_g
    return None


def _find_lims_entry(experiment: Experiment, entry_id: str) -> LimsReception:
    for entry in experiment.lims_entries:
        if entry.id == entry_id:
            return entry
    raise ValueError("The selected LIMS entry does not exist.")


def _resolve_lims_entry_for_print(experiment: Experiment, entry_id: str | None) -> LimsReception:
    if entry_id is not None:
        return _find_lims_entry(experiment, entry_id)
    if experiment.lims_reception.id is not None:
        return _find_lims_entry(experiment, experiment.lims_reception.id)
    raise ValueError("Create the LIMS reception entry before printing a label.")


def _clone_lims_entry(
    entry: LimsReception,
    *,
    printed_label_ticket: PrintedLabelTicket | None,
) -> LimsReception:
    return LimsReception(
        id=entry.id,
        orchard_name=entry.orchard_name,
        harvest_date=entry.harvest_date,
        indicative_mass_g=entry.indicative_mass_g,
        measured_gross_mass_g=entry.measured_gross_mass_g,
        packaging_tare_mass_g=entry.packaging_tare_mass_g,
        gross_mass_offset_g=entry.gross_mass_offset_g,
        measured_sample_mass_g=entry.measured_sample_mass_g,
        lab_sample_code=entry.lab_sample_code,
        status=entry.status,
        printed_label_ticket=printed_label_ticket,
    )


def _build_lims_reception_entry(
    experiment: Experiment,
    request: CreateLimsReceptionRequest,
    *,
    measured_gross_mass_g: float | None,
    entry_id: str,
    lab_sample_code: str,
    printed_label_ticket: PrintedLabelTicket | None,
    status: str,
) -> LimsReception:
    return LimsReception(
        id=entry_id,
        orchard_name=request.orchard_name.strip(),
        harvest_date=request.harvest_date.strip(),
        indicative_mass_g=float(request.indicative_mass_g),
        measured_gross_mass_g=measured_gross_mass_g,
        packaging_tare_mass_g=experiment.lims_reception.packaging_tare_mass_g,
        gross_mass_offset_g=experiment.lims_reception.gross_mass_offset_g,
        measured_sample_mass_g=(float(request.measured_sample_mass_g) if request.measured_sample_mass_g is not None else None),
        lab_sample_code=lab_sample_code,
        status=status,
        printed_label_ticket=printed_label_ticket,
    )


def _update_lims_reception_entry(
    entry: LimsReception,
    experiment: Experiment,
    request: CreateLimsReceptionRequest,
    *,
    measured_gross_mass_g: float | None,
) -> None:
    entry.orchard_name = request.orchard_name.strip()
    entry.harvest_date = request.harvest_date.strip()
    entry.indicative_mass_g = float(request.indicative_mass_g)
    entry.measured_gross_mass_g = measured_gross_mass_g
    entry.packaging_tare_mass_g = experiment.lims_reception.packaging_tare_mass_g
    entry.gross_mass_offset_g = experiment.lims_reception.gross_mass_offset_g
    entry.measured_sample_mass_g = float(request.measured_sample_mass_g) if request.measured_sample_mass_g is not None else None


def _require_printed_lims_ticket(experiment: Experiment) -> PrintedLabelTicket:
    ticket = experiment.lims_reception.printed_label_ticket
    if ticket is None:
        raise ValueError("Print the LIMS label before applying it to the bag.")
    return ticket


def _require_received_sampling_bag(
    tool: WorkbenchTool | None,
    missing_message: str,
) -> WorkbenchTool:
    if tool is None or tool.tool_type != "sample_bag":
        raise ValueError(missing_message)
    return tool


def _apply_ticket_to_tool(tool: WorkbenchTool, ticket: PrintedLabelTicket) -> None:
    tool.labels.append(
        build_lims_label(
            sample_code=ticket.sample_code,
            text=ticket.label_text,
            received_date=ticket.received_date,
        )
    )


def _consume_printed_lims_ticket(experiment: Experiment, ticket: PrintedLabelTicket) -> None:
    _clear_printed_ticket_for_sample_code(experiment, ticket.sample_code)
    experiment.lims_reception.printed_label_ticket = None
    for entry in experiment.lims_entries:
        if entry.lab_sample_code == ticket.sample_code:
            entry.status = "received"
            experiment.lims_reception = _clone_lims_entry(entry, printed_label_ticket=None)
            return
    experiment.lims_reception.status = "received"


def _clear_printed_ticket_for_sample_code(experiment: Experiment, sample_code: str) -> None:
    for entry in experiment.lims_entries:
        if entry.lab_sample_code == sample_code:
            entry.printed_label_ticket = None
            return
