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
from math import ceil, cos, exp, pi, sqrt

from app.domain.acquisition_methods import AcquisitionMethod, MrmTransition
from app.domain.models import TraceAcquisitionMetadata, TransitionTrace
from app.domain.mrm_reference import (
    DEFAULT_PEAK_PROFILE,
    MZ_MATCH_TOLERANCE,
    CompoundPeakProfile,
    ReferenceTransition,
    find_reference_transition,
    peak_profile_for,
)
from app.services.physical_simulation_service import PhysicalSimulationService

#: Detector counts produced per unit of extract concentration.
RESPONSE_COUNTS_PER_CONCENTRATION_UNIT = 1.0e4

#: Injection volume the response constants are calibrated against. Everything
#: scales relative to it, so the nominal injection reproduces the old magnitudes.
NOMINAL_INJECTION_VOLUME_UL = 5.0

#: How much further than its own plug width a strong-solvent injection spreads.
#: An extract in acetonitrile does not refocus at the head of a column
#: equilibrated near 5 % organic: it travels with its own solvent instead of
#: sticking, so the band spreads more than the plug alone would explain. A
#: **pedagogical placeholder** — the real factor depends on the solvent pair and
#: on how strongly the compound retains.
SOLVENT_MISMATCH_BROADENING = 4.0

#: Band half-width shared by the whole method, before a compound's own
#: :class:`~app.domain.mrm_reference.CompoundPeakProfile` widens or narrows it.
#:
#: 3 s puts the peak at roughly 7 s wide at half height, which is what a
#: 100 x 2.1 mm, 1.8 um C18 run at 0.4 mL/min actually delivers. It also keeps
#: the peak clear of the edges of a 60 s acquisition window: a peak that filled
#: its own window would never return to baseline, and the learner could not see
#: where the integration should start and stop.
#:
#: A **pedagogical placeholder** in its exact value, but the order of magnitude
#: is not free: raising it much past 5 s reproduces the unrealistically wide
#: peaks this constant used to produce.
PEAK_SIGMA_S = 3.0

#: Ion ratio used for a compound that has no profile of its own. Every compound
#: in the reference catalog does have one, so this is the fallback for a channel
#: addressed outside it.
QUALIFIER_RESPONSE_RATIO = DEFAULT_PEAK_PROFILE.ion_ratio

#: How far the collision energy may drift from the tuned value before the
#: fragment yield collapses. At one sigma the channel keeps ~61 % of its
#: response, at three sigma ~1 %. A **pedagogical placeholder**: real breakdown
#: curves are compound-specific and not symmetric.
FRAGMENTATION_CE_SIGMA_V = 8.0

#: Half-width of the flat top of a quadrupole mass peak.
#:
#: The *shape* is established: a quadrupole transmits within a band, unit
#: resolution puts that band around 0.7 Da wide at half height, and methods
#: survive being transferred between instruments whose calibration wanders by
#: about a tenth of a Dalton — which requires a small mis-set to cost little.
#:
#: This particular half-width is a **pedagogical placeholder**. A real peak top
#: is not perfectly flat, and how flat it is depends on how the instrument was
#: tuned and on a resolution setting Betalab does not model.
MZ_PLATEAU_DA = 0.15

#: Dead time between two channels while the quadrupoles settle on new masses.
#: Real instruments pay a few milliseconds; it is what makes a method crowded
#: with transitions lose points even when every dwell is short.
INTERSCAN_DELAY_MS = 5.0

BASELINE_COUNTS = 120.0
BASELINE_NOISE_SIGMA = 35.0
#: Shot-like noise proportional to the peak, so tall peaks are noisier in absolute terms.
PEAK_NOISE_RELATIVE_SIGMA = 0.02
#: Run-to-run drift of the elution time, drawn once per compound per injection.
#: A compound elutes once, so every channel watching it shares the draw: the
#: quantifier and its qualifier are the same molecules leaving the column
#: together.
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


def _role_scale(reference: ReferenceTransition, profile: CompoundPeakProfile) -> float:
    """Quantifier at full response, qualifier at the compound's own ion ratio."""
    return 1.0 if reference.role == "quantifier" else profile.ion_ratio


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


def _effective_peak_sigma_s(
    injection_volume_ul: float,
    flow_ml_per_min: float,
    width_factor: float = 1.0,
) -> float:
    """Peak width once the injected band is added to the compound's own.

    A peak is never narrower than the plug that produced it. Variances add, so a
    small injection disappears into the column's own band and a large one starts
    to dominate it — which is the whole trade-off of turning the injection
    volume up: more analyte on column, but spread over more time.

    ``width_factor`` is the compound's share of that: a late, strongly retained
    pyrethroid leaves the column wider than an early neonicotinoid, and only the
    column band scales with it. The injected plug does not — it is the same
    volume of liquid whatever is dissolved in it.
    """
    column_sigma_s = PEAK_SIGMA_S * width_factor
    if flow_ml_per_min <= 0:
        return column_sigma_s
    flow_ul_per_s = flow_ml_per_min * 1000.0 / 60.0
    plug_duration_s = max(injection_volume_ul, 0.0) / flow_ul_per_s
    band_sigma_s = plug_duration_s / sqrt(12.0) * SOLVENT_MISMATCH_BROADENING
    return sqrt(column_sigma_s**2 + band_sigma_s**2)


def _tailed_gaussian(offset_s: float, sigma_s: float, tailing_factor: float) -> float:
    """Peak shape at ``offset_s`` from the apex, as a fraction of the apex.

    A bi-gaussian: the same curve on both sides of the apex, but the trailing
    half is ``tailing_factor`` times wider than the leading one. Real tailing
    comes from a slow desorption process and is better described by an
    exponentially modified gaussian; this reproduces the part a learner reads
    off the screen — the peak rises faster than it falls — at a fraction of the
    cost, and is a **pedagogical placeholder** for the real shape.
    """
    half_width = sigma_s * tailing_factor if offset_s > 0 else sigma_s
    return exp(-(offset_s * offset_s) / (2.0 * half_width * half_width))


def _apex_from_area(sigma_s: float, tailing_factor: float) -> float:
    """Convert the response into the apex height that preserves the peak *area*.

    Quantification integrates, so the area is what has to carry the amount
    injected: a compound that elutes broad or drags must lose exactly as much
    height as it gains width, or its profile would silently rewrite its
    concentration. Normalising here is what lets the profiles above be pure
    cosmetics as far as the numbers are concerned.
    """
    mean_half_width = sigma_s * (1.0 + tailing_factor) / 2.0
    return PEAK_SIGMA_S / mean_half_width


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
    return _filter_transmission(declared.q1_mz - reference.q1_mz) * _filter_transmission(declared.q3_mz - reference.q3_mz)


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
    return {transition_id: samples[::step] for transition_id, samples in schedule.items()}


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
            upcoming = [start for start, _ in bounds.values() if clock < start < method.runtime_s]
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
    injection_volume_ul: float = NOMINAL_INJECTION_VOLUME_UL,
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
        injection_volume_ul: How much extract reached the column. It sets the
            amount injected, and past a point widens the band it arrives in.
    """
    # Injecting twice as much puts twice as much on column, so the peak *area*
    # doubles. Its height does not follow when the band also widens: the same
    # material is spread over more time. That is the trade-off of turning the
    # injection volume up.
    volume_scale = injection_volume_ul / NOMINAL_INJECTION_VOLUME_UL
    flow_ml_per_min = method.liquid_chromatography.flow_ml_per_min
    schedule = acquisition_schedule(method)

    # One draw per compound, shared by every channel that watches it. The drift
    # belongs to the injection — the gradient starts a moment early, the column
    # is a degree warmer — not to the channel: two transitions of one compound
    # are the same molecules leaving the column at the same instant, and only
    # the duty cycle separates the moments they are *measured*, by milliseconds.
    # Drawing per channel pulled a qualifier seconds away from its quantifier,
    # which reads as two compounds and destroys the ion ratio a reviewer reads
    # at the apex.
    retention_drift_s: dict[str, float] = {}

    traces: list[TransitionTrace] = []
    for transition in method.transitions:
        times_s = schedule[transition.id]
        reference = find_reference_transition(transition.q1_mz, transition.q3_mz, transition.polarity)
        response = compound_responses.get(reference.compound_id, 0.0) if reference is not None else 0.0
        # The shape belongs to the compound the channel truly watches, not to the
        # one the method names: a transition addressing the wrong molecule sees
        # that molecule's peak, tailing and all.
        profile = peak_profile_for(reference.compound_id) if reference is not None else DEFAULT_PEAK_PROFILE
        peak_sigma_s = _effective_peak_sigma_s(injection_volume_ul, flow_ml_per_min, profile.width_factor)
        peak_height = (
            response
            * _role_scale(reference, profile)
            * _fragmentation_yield(transition, reference)
            * _mass_transmission(transition, reference)
            * volume_scale
            * _apex_from_area(peak_sigma_s, profile.tailing_factor)
            * RESPONSE_COUNTS_PER_CONCENTRATION_UNIT
            if reference is not None
            else 0.0
        )
        # Even a perfectly configured channel records nothing when the vial does
        # not contain the compound; the difference between "wrong masses" and
        # "compound absent" lives in the metadata, not in the signal.
        centre_s = 0.0
        if reference is not None:
            if reference.compound_id not in retention_drift_s:
                retention_drift_s[reference.compound_id] = rng.gauss(0.0, RETENTION_JITTER_SIGMA_S)
            centre_s = reference.expected_retention_time_s + retention_drift_s[reference.compound_id]

        intensities: list[float] = []
        for time_s in times_s:
            # Background follows the matrix: a dirty extract lifts the trace near
            # the void and again among the waxes, and takes its noise with it.
            dirt = PhysicalSimulationService.background_scale(foreign_matter_mass_mg, time_s)
            intensity = BASELINE_COUNTS * dirt + rng.gauss(0.0, BASELINE_NOISE_SIGMA * dirt)
            if peak_height > 0.0:
                offset = time_s - centre_s
                peak = peak_height * _tailed_gaussian(offset, peak_sigma_s, profile.tailing_factor)
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
                    acquired_in_retention_window=(reference is not None and _is_within_retention_window(transition, reference)),
                ),
            )
        )
    return traces
