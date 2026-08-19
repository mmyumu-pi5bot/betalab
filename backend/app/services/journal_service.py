from __future__ import annotations

from datetime import datetime

from app.domain.models import (
    Experiment,
    JournalEvent,
    JournalEventCategory,
    JournalEventSeverity,
    new_id,
)

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


def synchronize_journal_entries(experiment: Experiment, *, occurred_at: datetime) -> None:
    """Mirror newly appended legacy audit messages into the structured journal.

    The one-to-one mirror keeps the migration additive while existing command
    handlers are progressively moved away from free-form audit strings.
    """
    missing_messages = experiment.audit_log[len(experiment.journal_entries) :]
    experiment.journal_entries.extend(build_journal_event(message, occurred_at=occurred_at) for message in missing_messages)
