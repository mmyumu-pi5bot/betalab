"""MRM signal generation: turn a vial's physical content into raw chromatograms.

The generator answers one question per declared transition: *what does the
detector record on this channel during this run?* It produces a time/intensity
trace and nothing else — no peak integration, no calibration curve, no
concentration. Those belong to the downstream analysis application.

Three rules decide what a channel sees, and every editable method parameter
feeds exactly one of them:

1. **Addressing is numeric.** A transition sees a compound only when its
   ``(q1_mz, q3_mz, polarity)`` triple lands within ``MZ_MATCH_TOLERANCE`` of a
   channel in :mod:`app.domain.mrm_reference`. The ``compound_id`` written in
   the method is a label for humans; the quadrupoles never read it. Watching
   the right masses under the wrong name still yields a peak, and watching the
   wrong masses under the right name still yields baseline.
2. **Collision energy decides how much fragment exists.** Response follows a
   bell curve centred on the energy at which the reference channel was tuned.
   Too low and the precursor does not break; too high and the chosen fragment
   is destroyed in turn.
3. **Time is a budget.** The instrument watches one channel at a time, so the
   declared retention windows schedule the run and the dwell times divide it.
   More channels open at once, or longer dwells, mean fewer points across each
   peak — the trade-off that makes method design a real skill.
"""
from __future__ import annotations

import random
from math import ceil, cos, exp, pi

from app.domain.acquisition_methods import AcquisitionMethod, MrmTransition
from app.domain.models import TraceAcquisitionMetadata, TransitionTrace
from app.domain.mrm_reference import (
    MZ_MATCH_TOLERANCE,
    ReferenceTransition,
    find_reference_transition,
)
from app.services.physical_simulation_service import PhysicalSimulationService

#: Detector counts produced per unit of extract concentration.
RESPONSE_COUNTS_PER_CONCENTRATION_UNIT = 1.0e4

#: Chromatographic peak half-width.
PEAK_SIGMA_S = 9.0

#: A qualifier channel is intentionally weaker than its quantifier. The constant
#: ratio is what makes the qualifier/quantifier ion ratio a usable identity check.
QUALIFIER_RESPONSE_RATIO = 0.35

#: How far the collision energy may drift from the tuned value before the
#: fragment yield collapses. At one sigma the channel keeps ~61 % of its
#: response, at three sigma ~1 %.
FRAGMENTATION_CE_SIGMA_V = 8.0

#: Half-width of the flat top of a quadrupole mass peak. Within it the filter
#: passes everything, which is why MRM survives routine at all: instrument mass
#: calibration wanders by about this much from day to day, and a method
#: transferred between instruments must still quantify.
MZ_PLATEAU_DA = 0.15

#: Dead time between two channels while the quadrupoles settle on new masses.
#: Real instruments pay a few milliseconds; it is what makes a method crowded
#: with transitions lose points even when every dwell is short.
INTERSCAN_DELAY_MS = 5.0

BASELINE_COUNTS = 120.0
BASELINE_NOISE_SIGMA = 35.0
#: Shot-like noise proportional to the peak, so tall peaks are noisier in absolute terms.
PEAK_NOISE_RELATIVE_SIGMA = 0.02
#: Run-to-run drift of the elution time.
RETENTION_JITTER_SIGMA_S = 1.5

#: Serialization budget, not physics. The whole experiment is re-encoded to JSON
#: on every command and pushed over the stream several times a second, so a
#: method with a very short dwell must not be allowed to record a million
#: points. The budget is spent across the whole injection and every channel is
#: thinned by the same factor, so the *relative* densities the method earned are
#: preserved exactly — only the absolute resolution drops.
MAX_POINTS_PER_INJECTION = 8_000

#: Last-resort guard on the schedule walk. Reaching it means a method asked for
#: something the walk cannot express; the trace simply stops there.
MAX_ACQUISITION_CYCLES = 200_000


def _role_scale(reference: ReferenceTransition) -> float:
    return 1.0 if reference.role == "quantifier" else QUALIFIER_RESPONSE_RATIO


def _fragmentation_yield(declared: MrmTransition, reference: ReferenceTransition) -> float:
    """Fraction of the precursor converted into the product ion at this energy.

    Fragmentation efficiency peaks at the tuned collision energy and falls away
    on both sides: below it the precursor survives intact, above it the chosen
    fragment breaks down further. A gaussian is a crude but honest stand-in for
    a real breakdown curve, and it keeps the built-in method at full response
    since that method copies the reference energy verbatim.
    """
    drift = declared.collision_energy_v - reference.collision_energy_v
    return exp(-(drift * drift) / (2.0 * FRAGMENTATION_CE_SIGMA_V * FRAGMENTATION_CE_SIGMA_V))


def _filter_transmission(offset_da: float) -> float:
    """Fraction of an ion beam one quadrupole passes when set ``offset_da`` off.

    A quadrupole is not a sieve with a threshold: it passes ions in a band around
    the mass it is set to. At unit resolution that band is flat-topped rather
    than pointed, so a small mis-set costs nothing, and the shoulder then falls
    steeply to nothing by ``MZ_MATCH_TOLERANCE`` — where the addressing gate
    gives up too, so the two can never disagree.
    """
    drift = abs(offset_da)
    if drift <= MZ_PLATEAU_DA:
        return 1.0
    if drift >= MZ_MATCH_TOLERANCE:
        return 0.0
    shoulder = (drift - MZ_PLATEAU_DA) / (MZ_MATCH_TOLERANCE - MZ_PLATEAU_DA)
    return 0.5 * (1.0 + cos(pi * shoulder))


def _mass_transmission(declared: MrmTransition, reference: ReferenceTransition) -> float:
    """Both quadrupoles filter in series, so their transmissions multiply."""
    return _filter_transmission(
        declared.q1_mz - reference.q1_mz
    ) * _filter_transmission(declared.q3_mz - reference.q3_mz)


def _is_within_retention_window(
    declared: MrmTransition,
    reference: ReferenceTransition,
) -> bool:
    """Does the declared window cover the moment the compound truly elutes?

    This is reported in the trace metadata as a diagnosis. It does not gate the
    signal: the schedule below already decides that, by only ever sampling a
    channel inside its own window.
    """
    half_width = declared.retention_window_s / 2.0
    return abs(reference.expected_retention_time_s - declared.expected_retention_time_s) <= half_width


def _window_bounds(transition: MrmTransition) -> tuple[float, float]:
    half_width = transition.retention_window_s / 2.0
    return (
        transition.expected_retention_time_s - half_width,
        transition.expected_retention_time_s + half_width,
    )


def _fit_to_budget(schedule: dict[str, list[float]]) -> dict[str, list[float]]:
    """Thin every channel by the same factor until the injection fits the budget.

    Thinning uniformly matters: halving one channel and not another would
    fabricate a density difference the method never asked for.
    """
    total = sum(len(samples) for samples in schedule.values())
    if total <= MAX_POINTS_PER_INJECTION:
        return schedule
    step = ceil(total / MAX_POINTS_PER_INJECTION)
    return {
        transition_id: samples[::step] for transition_id, samples in schedule.items()
    }


def acquisition_schedule(method: AcquisitionMethod) -> dict[str, list[float]]:
    """Return the instants at which each declared channel is actually measured.

    A triple quadrupole watches one transition at a time. Walking the run cycle
    by cycle, the channels whose retention window is open at that moment share
    the instrument: each is measured in turn for its dwell time, plus the
    settling delay. The next cycle therefore starts one full pass later, which
    is why crowding a window with transitions costs points on every peak.

    A channel is never sampled outside its own window — exactly what *scheduled
    MRM* does on a real instrument, and the reason a misplaced window produces
    a trace that sits beside the peak instead of on it.
    """
    transitions = method.transitions
    if not transitions or method.runtime_s <= 0:
        return {transition.id: [] for transition in transitions}

    bounds = {transition.id: _window_bounds(transition) for transition in transitions}
    times: dict[str, list[float]] = {transition.id: [] for transition in transitions}
    # Every cycle pays at least one settling delay, whatever the dwell. This is
    # physics, and it also keeps a near-zero dwell from stalling the walk.
    min_cycle_s = INTERSCAN_DELAY_MS / 1000.0

    clock = 0.0
    for _ in range(MAX_ACQUISITION_CYCLES):
        if clock >= method.runtime_s:
            break
        active = [t for t in transitions if bounds[t.id][0] <= clock <= bounds[t.id][1]]
        if not active:
            upcoming = [
                start
                for start, _ in bounds.values()
                if clock < start < method.runtime_s
            ]
            if not upcoming:
                break
            clock = min(upcoming)
            continue

        offset = 0.0
        for transition in active:
            sample_at = clock + offset
            if sample_at > method.runtime_s:
                break
            times[transition.id].append(round(sample_at, 4))
            offset += (transition.dwell_time_ms + INTERSCAN_DELAY_MS) / 1000.0
        clock += max(offset, min_cycle_s)

    return _fit_to_budget(times)


def _mean_interval_s(times_s: list[float]) -> float:
    if len(times_s) < 2:
        return 0.0
    return round((times_s[-1] - times_s[0]) / (len(times_s) - 1), 4)


def generate_transition_traces(
    injection_id: str,
    method: AcquisitionMethod,
    compound_responses: dict[str, float],
    rng: random.Random,
    foreign_matter_mass_mg: float = 0.0,
) -> list[TransitionTrace]:
    """Record one trace per transition declared by ``method``.

    Args:
        injection_id: Injection these traces belong to.
        method: The frozen method snapshot driving the acquisition.
        compound_responses: Extract concentration per compound id, as produced by
            the vial's physics. A compound absent from this mapping is simply not
            in the vial.
        rng: Seeded generator, so a test can reproduce a run exactly.
        foreign_matter_mass_mg: Grime injected along with the extract. It raises
            the background where the matrix elutes, so a dirty preparation costs
            signal-to-noise rather than response.
    """
    schedule = acquisition_schedule(method)

    traces: list[TransitionTrace] = []
    for transition in method.transitions:
        times_s = schedule[transition.id]
        reference = find_reference_transition(
            transition.q1_mz, transition.q3_mz, transition.polarity
        )
        response = (
            compound_responses.get(reference.compound_id, 0.0) if reference is not None else 0.0
        )
        peak_height = (
            response
            * _role_scale(reference)
            * _fragmentation_yield(transition, reference)
            * _mass_transmission(transition, reference)
            * RESPONSE_COUNTS_PER_CONCENTRATION_UNIT
            if reference is not None
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
            # Background follows the matrix: a dirty extract lifts the trace near
            # the void and again among the waxes, and takes its noise with it.
            dirt = PhysicalSimulationService.background_scale(
                foreign_matter_mass_mg, time_s
            )
            intensity = BASELINE_COUNTS * dirt + rng.gauss(
                0.0, BASELINE_NOISE_SIGMA * dirt
            )
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
                    sampling_interval_s=_mean_interval_s(times_s),
                    dwell_time_ms=transition.dwell_time_ms,
                    polarity=transition.polarity,
                    matched_reference_transition=reference is not None,
                    acquired_in_retention_window=(
                        reference is not None
                        and _is_within_retention_window(transition, reference)
                    ),
                ),
            )
        )
    return traces
