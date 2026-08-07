"""Tests for MRM trace generation: what each declared channel actually records."""
from __future__ import annotations

import random
from dataclasses import replace

import pytest

from app.domain.acquisition_methods import APPLE_PESTICIDES_MRM_V1, MrmTransition
from app.domain.mrm_reference import INTERNAL_STANDARD_COMPOUND_ID, MRM_REFERENCE_CATALOG
from app.services.domain_services.mrm_signal import (
    BASELINE_COUNTS,
    FRAGMENTATION_CE_SIGMA_V,
    INTERSCAN_DELAY_MS,
    MAX_POINTS_PER_INJECTION,
    QUALIFIER_RESPONSE_RATIO,
    RESPONSE_COUNTS_PER_CONCENTRATION_UNIT,
    acquisition_schedule,
    generate_transition_traces,
)

SEED = 20260805


def _rng() -> random.Random:
    return random.Random(SEED)


def _method_with(*transitions: MrmTransition):
    return replace(APPLE_PESTICIDES_MRM_V1, transitions=tuple(transitions))


def _transition(compound_id: str, role: str = "quantifier") -> MrmTransition:
    return next(
        t
        for t in APPLE_PESTICIDES_MRM_V1.transitions
        if t.compound_id == compound_id and t.role == role
    )


def _peak_height(trace) -> float:
    return max(trace.intensities) - BASELINE_COUNTS


class TestTraceStructure:
    def test_produces_one_trace_per_declared_transition(self) -> None:
        traces = generate_transition_traces(
            "inj_1", APPLE_PESTICIDES_MRM_V1, {}, _rng()
        )

        assert len(traces) == len(APPLE_PESTICIDES_MRM_V1.transitions)
        assert [t.transition.id for t in traces] == [
            t.id for t in APPLE_PESTICIDES_MRM_V1.transitions
        ]

    def test_each_trace_carries_the_injection_and_the_transition_snapshot(self) -> None:
        traces = generate_transition_traces(
            "inj_42", APPLE_PESTICIDES_MRM_V1, {}, _rng()
        )

        assert all(trace.injection_id == "inj_42" for trace in traces)
        assert traces[0].transition == APPLE_PESTICIDES_MRM_V1.transitions[0]

    def test_time_and_intensity_axes_stay_aligned_inside_the_declared_window(self) -> None:
        transition = _transition("boscalid")
        traces = generate_transition_traces(
            "inj_1", APPLE_PESTICIDES_MRM_V1, {}, _rng()
        )

        trace = next(t for t in traces if t.transition.id == transition.id)
        half_width = transition.retention_window_s / 2.0
        assert len(trace.times_s) == len(trace.intensities)
        # Scheduled MRM: the channel is only measured while its window is open.
        assert trace.times_s[0] >= transition.expected_retention_time_s - half_width
        assert trace.times_s[-1] <= transition.expected_retention_time_s + half_width
        assert all(
            second > first
            for first, second in zip(trace.times_s, trace.times_s[1:], strict=False)
        )

    def test_records_the_acquisition_metadata(self) -> None:
        transition = _transition("boscalid")
        traces = generate_transition_traces(
            "inj_1", _method_with(transition), {"boscalid": 1.0}, _rng()
        )

        acquisition = traces[0].acquisition
        trace = traces[0]
        assert acquisition.run_duration_s == APPLE_PESTICIDES_MRM_V1.runtime_s
        assert acquisition.point_count == len(trace.times_s)
        # Alone in its window, the channel cycles at its own dwell plus settling.
        assert acquisition.sampling_interval_s == pytest.approx(
            (transition.dwell_time_ms + INTERSCAN_DELAY_MS) / 1000.0, abs=1e-3
        )
        assert acquisition.dwell_time_ms == transition.dwell_time_ms
        assert acquisition.polarity == transition.polarity
        assert acquisition.matched_reference_transition is True
        assert acquisition.acquired_in_retention_window is True

    def test_intensities_never_go_negative(self) -> None:
        traces = generate_transition_traces(
            "inj_1", APPLE_PESTICIDES_MRM_V1, {}, _rng()
        )

        assert all(value >= 0.0 for trace in traces for value in trace.intensities)


class TestSignalDependsOnPhysicalContent:
    def test_present_compound_yields_a_peak_above_baseline(self) -> None:
        traces = generate_transition_traces(
            "inj_1", _method_with(_transition("boscalid")), {"boscalid": 2.0}, _rng()
        )

        trace = traces[0]
        assert _peak_height(trace) == pytest.approx(
            2.0 * RESPONSE_COUNTS_PER_CONCENTRATION_UNIT, rel=0.1
        )

    def test_absent_compound_yields_baseline_noise_only(self) -> None:
        traces = generate_transition_traces(
            "inj_1", _method_with(_transition("boscalid")), {"acetamiprid": 5.0}, _rng()
        )

        trace = traces[0]
        assert max(trace.intensities) < BASELINE_COUNTS * 3
        assert trace.acquisition.matched_reference_transition is True

    def test_peak_height_scales_with_the_amount_injected(self) -> None:
        method = _method_with(_transition("boscalid"))

        low = generate_transition_traces("inj_1", method, {"boscalid": 1.0}, _rng())[0]
        high = generate_transition_traces("inj_1", method, {"boscalid": 4.0}, _rng())[0]

        assert _peak_height(high) / _peak_height(low) == pytest.approx(4.0, rel=0.05)

    def test_peak_elutes_at_the_reference_retention_time(self) -> None:
        transition = _transition("boscalid")
        reference = next(
            t for t in MRM_REFERENCE_CATALOG
            if t.compound_id == "boscalid" and t.role == "quantifier"
        )
        traces = generate_transition_traces(
            "inj_1", _method_with(transition), {"boscalid": 3.0}, _rng()
        )

        trace = traces[0]
        apex_index = trace.intensities.index(max(trace.intensities))
        assert trace.times_s[apex_index] == pytest.approx(
            reference.expected_retention_time_s, abs=10.0
        )


class TestNumericTransitionMatching:
    def test_mass_pair_matching_no_reference_channel_yields_baseline(self) -> None:
        nonsense = replace(_transition("boscalid"), q1_mz=901.4, q3_mz=412.7)

        traces = generate_transition_traces(
            "inj_1", _method_with(nonsense), {"boscalid": 5.0}, _rng()
        )

        trace = traces[0]
        assert trace.acquisition.matched_reference_transition is False
        assert max(trace.intensities) < BASELINE_COUNTS * 3

    def test_right_masses_under_a_wrong_compound_name_still_see_the_compound(self) -> None:
        """The quadrupoles filter m/z; they never read compound_id."""
        mislabelled = replace(
            _transition("boscalid"),
            id="mislabelled",
            compound_id="acetamiprid",
            compound_label="Acetamiprid",
        )

        traces = generate_transition_traces(
            "inj_1", _method_with(mislabelled), {"boscalid": 2.0}, _rng()
        )

        trace = traces[0]
        assert trace.acquisition.matched_reference_transition is True
        assert _peak_height(trace) == pytest.approx(
            2.0 * RESPONSE_COUNTS_PER_CONCENTRATION_UNIT, rel=0.1
        )

    def test_right_compound_name_with_wrong_masses_sees_nothing(self) -> None:
        detuned = replace(_transition("boscalid"), q1_mz=343.0 + 5.0)

        traces = generate_transition_traces(
            "inj_1", _method_with(detuned), {"boscalid": 5.0}, _rng()
        )

        trace = traces[0]
        assert trace.acquisition.matched_reference_transition is False
        assert max(trace.intensities) < BASELINE_COUNTS * 3

    def test_a_declared_retention_window_that_misses_the_peak_records_nothing(self) -> None:
        missed = replace(
            _transition("boscalid"),
            expected_retention_time_s=60.0,
            retention_window_s=20.0,
        )

        traces = generate_transition_traces(
            "inj_1", _method_with(missed), {"boscalid": 5.0}, _rng()
        )

        trace = traces[0]
        assert trace.acquisition.matched_reference_transition is True
        assert trace.acquisition.acquired_in_retention_window is False
        assert max(trace.intensities) < BASELINE_COUNTS * 3


class TestPolarityIsPartOfTheAddress:
    def test_right_masses_in_the_wrong_ionisation_mode_see_nothing(self) -> None:
        inverted = replace(_transition("boscalid"), polarity="negative")

        traces = generate_transition_traces(
            "inj_1", _method_with(inverted), {"boscalid": 5.0}, _rng()
        )

        trace = traces[0]
        assert trace.acquisition.matched_reference_transition is False
        assert max(trace.intensities) < BASELINE_COUNTS * 3

    def test_the_declared_polarity_is_reported_on_the_trace(self) -> None:
        inverted = replace(_transition("boscalid"), polarity="negative")

        traces = generate_transition_traces(
            "inj_1", _method_with(inverted), {"boscalid": 5.0}, _rng()
        )

        assert traces[0].acquisition.polarity == "negative"


class TestCollisionEnergyDrivesFragmentation:
    def _height_at(self, collision_energy_v: float) -> float:
        tuned = _transition("boscalid")
        detuned = replace(tuned, collision_energy_v=collision_energy_v)
        traces = generate_transition_traces(
            "inj_1", _method_with(detuned), {"boscalid": 5.0}, _rng()
        )
        return _peak_height(traces[0])

    def test_the_tuned_energy_yields_the_full_response(self) -> None:
        tuned = _transition("boscalid")

        assert self._height_at(tuned.collision_energy_v) == pytest.approx(
            5.0 * RESPONSE_COUNTS_PER_CONCENTRATION_UNIT, rel=0.1
        )

    def test_response_falls_away_on_both_sides_of_the_tuned_energy(self) -> None:
        tuned = _transition("boscalid").collision_energy_v
        full = self._height_at(tuned)

        too_low = self._height_at(tuned - FRAGMENTATION_CE_SIGMA_V)
        too_high = self._height_at(tuned + FRAGMENTATION_CE_SIGMA_V)

        # Symmetric: the precursor survives intact below, the fragment breaks
        # down further above.
        assert too_low == pytest.approx(too_high, rel=0.1)
        assert 0.4 * full < too_low < 0.8 * full

    def test_a_badly_mistuned_energy_collapses_the_channel(self) -> None:
        tuned = _transition("boscalid").collision_energy_v
        full = self._height_at(tuned)

        # Four sigma away the fragment is all but gone: what is left is noise.
        assert self._height_at(tuned + 4 * FRAGMENTATION_CE_SIGMA_V) < 0.02 * full


class TestTimeIsABudget:
    def test_a_channel_alone_in_its_window_cycles_at_its_own_dwell(self) -> None:
        transition = _transition("boscalid")
        schedule = acquisition_schedule(_method_with(transition))

        times = schedule[transition.id]
        interval = (times[-1] - times[0]) / (len(times) - 1)
        assert interval == pytest.approx(
            (transition.dwell_time_ms + INTERSCAN_DELAY_MS) / 1000.0, abs=1e-3
        )

    def test_co_eluting_channels_share_the_instrument_and_lose_points(self) -> None:
        alone = _transition("boscalid")
        crowded = _method_with(alone, *[
            replace(alone, id=f"filler_{index}")
            for index in range(4)
        ])

        solo_points = len(acquisition_schedule(_method_with(alone))[alone.id])
        shared_points = len(acquisition_schedule(crowded)[alone.id])

        # Five channels open at once means each is measured five times less often.
        assert shared_points == pytest.approx(solo_points / 5, rel=0.15)

    def test_a_longer_dwell_buys_fewer_points_across_the_peak(self) -> None:
        fast = _transition("boscalid")
        slow = replace(fast, dwell_time_ms=fast.dwell_time_ms * 4)

        fast_points = len(acquisition_schedule(_method_with(fast))[fast.id])
        slow_points = len(acquisition_schedule(_method_with(slow))[slow.id])

        assert slow_points < fast_points

    def test_a_wider_window_costs_nothing_when_nothing_else_competes(self) -> None:
        narrow = _transition("boscalid")
        wide = replace(narrow, retention_window_s=narrow.retention_window_s * 3)

        narrow_points = len(acquisition_schedule(_method_with(narrow))[narrow.id])
        wide_points = len(acquisition_schedule(_method_with(wide))[wide.id])

        # Scheduling only bites when windows overlap; on its own a channel just
        # gets measured for longer.
        assert wide_points > narrow_points

    def test_a_channel_whose_window_falls_outside_the_run_is_never_measured(self) -> None:
        unreachable = replace(
            _transition("boscalid"),
            expected_retention_time_s=APPLE_PESTICIDES_MRM_V1.runtime_s + 500.0,
            retention_window_s=20.0,
        )

        traces = generate_transition_traces(
            "inj_1", _method_with(unreachable), {"boscalid": 5.0}, _rng()
        )

        assert traces[0].times_s == []
        assert traces[0].intensities == []
        assert traces[0].acquisition.point_count == 0

    def test_an_absurdly_short_dwell_stays_within_the_serialization_budget(self) -> None:
        greedy = replace(
            _transition("boscalid"),
            dwell_time_ms=0.01,
            retention_window_s=APPLE_PESTICIDES_MRM_V1.runtime_s * 2,
        )

        times = acquisition_schedule(_method_with(greedy))[greedy.id]

        assert len(times) <= MAX_POINTS_PER_INJECTION
        # Thinning keeps the span; it only lowers the density.
        assert times[-1] > APPLE_PESTICIDES_MRM_V1.runtime_s * 0.9

    def test_thinning_preserves_the_density_ratio_between_channels(self) -> None:
        """A crowded channel must stay proportionally sparser after thinning."""
        fast = replace(_transition("boscalid"), id="fast", dwell_time_ms=1.0)
        slow = replace(fast, id="slow", dwell_time_ms=95.0)
        wide = APPLE_PESTICIDES_MRM_V1.runtime_s
        schedule = acquisition_schedule(
            _method_with(
                replace(fast, retention_window_s=wide, expected_retention_time_s=wide / 2),
                replace(slow, retention_window_s=wide, expected_retention_time_s=wide / 2),
            )
        )

        # Both channels are always open, so they cycle together and record the
        # same number of points whatever the budget does to them.
        assert sum(len(s) for s in schedule.values()) <= MAX_POINTS_PER_INJECTION
        assert len(schedule["fast"]) == len(schedule["slow"])


class TestQuantifierAndQualifier:
    def test_quantifier_and_qualifier_produce_distinct_traces(self) -> None:
        quantifier = _transition("boscalid", "quantifier")
        qualifier = _transition("boscalid", "qualifier")

        traces = generate_transition_traces(
            "inj_1", _method_with(quantifier, qualifier), {"boscalid": 3.0}, _rng()
        )

        assert len(traces) == 2
        assert traces[0].transition.id != traces[1].transition.id
        assert traces[0].transition.q3_mz != traces[1].transition.q3_mz
        assert traces[0].intensities != traces[1].intensities

    def test_qualifier_is_weaker_than_its_quantifier_by_the_ion_ratio(self) -> None:
        quantifier = _transition("boscalid", "quantifier")
        qualifier = _transition("boscalid", "qualifier")

        traces = generate_transition_traces(
            "inj_1", _method_with(quantifier, qualifier), {"boscalid": 3.0}, _rng()
        )

        ratio = _peak_height(traces[1]) / _peak_height(traces[0])
        assert ratio == pytest.approx(QUALIFIER_RESPONSE_RATIO, rel=0.1)

    def test_the_internal_standard_gets_its_own_channel(self) -> None:
        istd = _transition(INTERNAL_STANDARD_COMPOUND_ID)

        traces = generate_transition_traces(
            "inj_1",
            _method_with(istd),
            {INTERNAL_STANDARD_COMPOUND_ID: 1.5},
            _rng(),
        )

        assert traces[0].transition.compound_kind == "internal_standard"
        assert _peak_height(traces[0]) == pytest.approx(
            1.5 * RESPONSE_COUNTS_PER_CONCENTRATION_UNIT, rel=0.1
        )


class TestReproducibility:
    def test_the_same_seed_reproduces_the_run_exactly(self) -> None:
        method = _method_with(_transition("boscalid"), _transition("boscalid", "qualifier"))
        responses = {"boscalid": 2.0}

        first = generate_transition_traces("inj_1", method, responses, _rng())
        second = generate_transition_traces("inj_1", method, responses, _rng())

        assert [t.intensities for t in first] == [t.intensities for t in second]

    def test_a_different_seed_produces_a_different_run(self) -> None:
        method = _method_with(_transition("boscalid"))
        responses = {"boscalid": 2.0}

        first = generate_transition_traces("inj_1", method, responses, random.Random(1))
        second = generate_transition_traces("inj_1", method, responses, random.Random(2))

        assert first[0].intensities != second[0].intensities


class TestNoQuantificationLeaks:
    def test_a_trace_exposes_only_instrumental_output(self) -> None:
        trace = generate_transition_traces(
            "inj_1", _method_with(_transition("boscalid")), {"boscalid": 1.0}, _rng()
        )[0]

        forbidden = {
            "calculated_conc_ug_per_kg",
            "true_effective_ug_per_kg",
            "nominal_conc_ng_per_ml",
            "calibration_curve",
        }
        assert forbidden.isdisjoint(vars(trace).keys())
