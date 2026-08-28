from __future__ import annotations

from dataclasses import asdict, is_dataclass
from datetime import datetime

from app.domain.journal_codes import (
    JournalCode,
    JournalRef,
    journal_category,
    journal_severity,
)
from app.domain.models import (
    Experiment,
    JournalEvent,
    JournalEventCategory,
    JournalEventSeverity,
    new_id,
)
from app.services.journal_messages import render_journal_message

_LAYOUT_MARKERS = (
    "moved in workspace",
    "repositioned in workspace",
)
_SIMULATION_MARKERS = (
    "acquisition",
    "centrifug",
    "cooled",
    "cooling",
    "cycle",
    "ground in",
    "grinding",
    "heated",
    "pressure",
    "run sequence",
    "separated",
    "vortex",
)
_WARNING_MARKERS = (
    "blocked",
    "contaminated",
    "failed",
    "fault",
    "jammed",
    "lost",
    "popped open",
    "unusable",
    "vented",
    "warning",
)
_ERROR_MARKERS = (
    "error",
    "failed",
)


def classify_journal_message(
    message: str,
) -> tuple[JournalEventCategory, JournalEventSeverity]:
    """Guess a category and severity from the wording alone.

    Only used for audit entries recorded without a code — chiefly experiments
    restored from a snapshot written before the journal carried structured
    events.
    """
    normalized = message.casefold()
    if any(marker in normalized for marker in _LAYOUT_MARKERS):
        category = JournalEventCategory.LAYOUT
    elif message.startswith("Experiment ") or message.startswith("Receive the grower bag"):
        category = JournalEventCategory.SYSTEM
    elif any(marker in normalized for marker in _SIMULATION_MARKERS):
        category = JournalEventCategory.SIMULATION
    else:
        category = JournalEventCategory.MANIPULATION

    if any(marker in normalized for marker in _ERROR_MARKERS):
        severity = JournalEventSeverity.ERROR
    elif any(marker in normalized for marker in _WARNING_MARKERS):
        severity = JournalEventSeverity.WARNING
    else:
        severity = JournalEventSeverity.INFO
    return category, severity


def build_journal_event(message: str, *, occurred_at: datetime) -> JournalEvent:
    category, severity = classify_journal_message(message)
    return JournalEvent(
        id=new_id("journal"),
        occurred_at=occurred_at,
        category=category,
        severity=severity,
        message=message,
    )


def _serialize_param(value: object) -> object:
    if isinstance(value, JournalRef):
        return asdict(value)
    if is_dataclass(value) and not isinstance(value, type):
        return asdict(value)
    return value


def record_journal(experiment: Experiment, code: JournalCode, **params: object) -> None:
    """Record one journal event.

    Appends the English wording to the audit log — which stays the plain-text
    history of the run — and queues the code and its parameters so the journal
    entry can be rendered in any language.
    """
    experiment.audit_log.append(render_journal_message(code, params))
    experiment.pending_journal_records.append(
        (
            len(experiment.audit_log) - 1,
            str(code),
            {name: _serialize_param(value) for name, value in params.items()},
        )
    )


def synchronize_journal_entries(experiment: Experiment, *, occurred_at: datetime) -> None:
    """Mirror newly appended audit messages into the structured journal.

    Entries recorded through `record_journal` carry their code and parameters
    across; anything appended to the audit log directly is classified from its
    wording instead.
    """
    first_new_index = len(experiment.journal_entries)
    records = {index: (code, params) for index, code, params in experiment.pending_journal_records}
    for index in range(first_new_index, len(experiment.audit_log)):
        message = experiment.audit_log[index]
        record = records.get(index)
        if record is None:
            experiment.journal_entries.append(
                build_journal_event(message, occurred_at=occurred_at)
            )
            continue
        code, params = record
        experiment.journal_entries.append(
            JournalEvent(
                id=new_id("journal"),
                occurred_at=occurred_at,
                category=journal_category(JournalCode(code)),
                severity=journal_severity(JournalCode(code)),
                message=message,
                code=code,
                params=params,
            )
        )
    experiment.pending_journal_records.clear()
