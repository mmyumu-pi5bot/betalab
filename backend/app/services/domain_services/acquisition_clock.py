"""Advance a running LC-MS/MS sequence on the simulation clock.

A real sequence takes as long as its chromatography: the gradient decides the
run duration, and every injection pays it in full. Twelve minutes per vial is
faithful but unplayable, so Betalab runs the same schedule at
``ACQUISITION_TIME_ACCELERATION`` times normal speed. Nothing else is
compressed — the instrument seconds recorded in the traces stay real, only the
wall clock spent watching them shrinks.

The factor is a playability setting, not a physical one: it is the whole answer
to "the wait is too long", and *Skip to end* stays there for the learner who
does not want to watch at all rather than as the way through.

The traces themselves are produced in full when the sequence starts. This
module only moves ``SequenceRun.elapsed_s`` forward, which is what readers use
to reveal each chromatogram as it is recorded.
"""

from __future__ import annotations

from app.domain.journal_codes import JournalCode
from app.domain.models import Experiment, SequenceRun
from app.services.journal_service import record_journal

#: Instrument seconds elapsed per wall-clock second. A 12-minute run therefore
#: takes about 8 seconds to watch, and the tutorial's two injections about 16.
#: That is long enough to see each chromatogram drawn — which is the point of
#: watching at all — and short enough not to be an interruption.
ACQUISITION_TIME_ACCELERATION = 90.0


def is_sequence_complete(run: SequenceRun) -> bool:
    return run.elapsed_s >= run.total_duration_s


def advance_sequence_runs(experiment: Experiment, elapsed_ms: float) -> None:
    """Record ``elapsed_ms`` of wall time against every unfinished sequence."""
    if elapsed_ms <= 0:
        return

    instrument = next(
        (widget for widget in experiment.workspace.widgets if widget.id == "instrument"),
        None,
    )
    if instrument is None:
        return

    instrument_seconds = elapsed_ms / 1000.0 * ACQUISITION_TIME_ACCELERATION
    for run in instrument.sequence_runs:
        if is_sequence_complete(run):
            continue
        run.elapsed_s = min(run.total_duration_s, run.elapsed_s + instrument_seconds)
        if is_sequence_complete(run):
            _complete_sequence(experiment, run)


def skip_to_end_of_sequence(experiment: Experiment, run: SequenceRun) -> None:
    """Jump a running sequence to its end, keeping the data it would have made."""
    if is_sequence_complete(run):
        return
    run.elapsed_s = run.total_duration_s
    _complete_sequence(experiment, run)


def _complete_sequence(experiment: Experiment, run: SequenceRun) -> None:
    # The rack is released only once the last injection is recorded; until then
    # it stays locked in the autosampler, exactly as it would physically.
    if experiment.rack.state == "locked":
        experiment.rack.state = "completed"
    ready = sum(1 for injection in run.injections if injection.status == "ok")
    record_journal(
        experiment,
        JournalCode.SEQUENCE_COMPLETED,
        run_id=run.id,
        injection_count=len(run.injections),
        ready_count=ready,
    )
