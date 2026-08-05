"""MRM signal generation: turn a vial's physical content into raw chromatograms.

The generator answers one question per declared transition: *what does the
detector record on this channel during this run?* It produces a time/intensity
trace and nothing else — no peak integration, no calibration curve, no
concentration. Those belong to the downstream analysis application.

The decisive rule is that instrumental matching is **numeric**. A method
transition sees a compound only when its ``(q1_mz, q3_mz)`` pair lands within
``MZ_MATCH_TOLERANCE`` of a channel in :mod:`app.domain.mrm_reference`. The
``compound_id`` written in the method is a label for humans; the quadrupoles
never read it. Watching the right masses under the wrong name still yields a
peak, and watching the wrong masses under the right name still yields baseline.
"""
from __future__ import annotations

import random
from math import exp

from app.domain.acquisition_methods import AcquisitionMethod, MrmTransition
from app.domain.models import TraceAcquisitionMetadata, TransitionTrace
from app.domain.mrm_reference import ReferenceTransition, find_reference_transition

#: Points recorded per trace. A real MRM run samples far denser; this is a
#: deliberate pedagogical resolution that keeps a full sequence small enough to
#: serialize into the experiment snapshot on every command.
TRACE_POINT_COUNT = 240

#: Detector counts produced per unit of extract concentration.
RESPONSE_COUNTS_PER_CONCENTRATION_UNIT = 1.0e4

#: Chromatographic peak half-width. With the default grid this leaves roughly
#: seven points across the full width at half maximum.
PEAK_SIGMA_S = 9.0

#: A qualifier channel is intentionally weaker than its quantifier. The constant
#: ratio is what makes the qualifier/quantifier ion ratio a usable identity check.
QUALIFIER_RESPONSE_RATIO = 0.35

BASELINE_COUNTS = 120.0
BASELINE_NOISE_SIGMA = 35.0
#: Shot-like noise proportional to the peak, so tall peaks are noisier in absolute terms.
PEAK_NOISE_RELATIVE_SIGMA = 0.02
#: Run-to-run drift of the elution time.
RETENTION_JITTER_SIGMA_S = 1.5


def _role_scale(reference: ReferenceTransition) -> float:
    return 1.0 if reference.role == "quantifier" else QUALIFIER_RESPONSE_RATIO


def _is_within_retention_window(
    declared: MrmTransition,
    reference: ReferenceTransition,
) -> bool:
    """Is the channel actually being watched when the compound elutes?

    A method declares an acquisition window around the retention time it expects.
    If the compound truly elutes outside that window the detector is busy on
    another channel and records nothing — a mis-declared RT costs the peak even
    though the masses are right.
    """
    half_width = declared.retention_window_s / 2.0
    return abs(reference.expected_retention_time_s - declared.expected_retention_time_s) <= half_width


def _build_time_grid(runtime_s: float, point_count: int) -> tuple[list[float], float]:
    if point_count < 2:
        return [0.0], runtime_s
    interval = runtime_s / (point_count - 1)
    return [round(index * interval, 4) for index in range(point_count)], interval


def generate_transition_traces(
    injection_id: str,
    method: AcquisitionMethod,
    compound_responses: dict[str, float],
    rng: random.Random,
) -> list[TransitionTrace]:
    """Record one trace per transition declared by ``method``.

    Args:
        injection_id: Injection these traces belong to.
        method: The frozen method snapshot driving the acquisition.
        compound_responses: Extract concentration per compound id, as produced by
            the vial's physics. A compound absent from this mapping is simply not
            in the vial.
        rng: Seeded generator, so a test can reproduce a run exactly.
    """
    times_s, interval_s = _build_time_grid(method.runtime_s, TRACE_POINT_COUNT)

    traces: list[TransitionTrace] = []
    for transition in method.transitions:
        reference = find_reference_transition(transition.q1_mz, transition.q3_mz)
        in_window = reference is not None and _is_within_retention_window(transition, reference)
        response = (
            compound_responses.get(reference.compound_id, 0.0) if reference is not None else 0.0
        )
        peak_height = (
            response * _role_scale(reference) * RESPONSE_COUNTS_PER_CONCENTRATION_UNIT
            if reference is not None and in_window
            else 0.0
        )
        # Even a perfectly configured channel records nothing when the vial does
        # not contain the compound; the difference between "wrong masses" and
        # "compound absent" lives in the metadata, not in the signal.
        centre_s = (
            reference.expected_retention_time_s + rng.gauss(0.0, RETENTION_JITTER_SIGMA_S)
            if reference is not None
            else 0.0
        )

        intensities: list[float] = []
        for time_s in times_s:
            intensity = BASELINE_COUNTS + rng.gauss(0.0, BASELINE_NOISE_SIGMA)
            if peak_height > 0.0:
                offset = time_s - centre_s
                gaussian = exp(-(offset * offset) / (2.0 * PEAK_SIGMA_S * PEAK_SIGMA_S))
                peak = peak_height * gaussian
                if peak > 0.0:
                    peak += rng.gauss(0.0, peak * PEAK_NOISE_RELATIVE_SIGMA)
                intensity += peak
            intensities.append(round(max(intensity, 0.0), 3))

        traces.append(
            TransitionTrace(
                injection_id=injection_id,
                transition=transition,
                times_s=times_s,
                intensities=intensities,
                acquisition=TraceAcquisitionMetadata(
                    run_duration_s=method.runtime_s,
                    point_count=len(times_s),
                    sampling_interval_s=round(interval_s, 4),
                    dwell_time_ms=transition.dwell_time_ms,
                    polarity=transition.polarity,
                    matched_reference_transition=reference is not None,
                    acquired_in_retention_window=in_window,
                ),
            )
        )
    return traces
