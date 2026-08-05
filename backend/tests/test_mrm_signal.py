"""Tests for MRM trace generation: what each declared channel actually records."""
from __future__ import annotations

import random
from dataclasses import replace

import pytest

from app.domain.acquisition_methods import APPLE_PESTICIDES_MRM_V1, MrmTransition
from app.domain.mrm_reference import INTERNAL_STANDARD_COMPOUND_ID, MRM_REFERENCE_CATALOG
from app.services.domain_services.mrm_signal import (
    BASELINE_COUNTS,
    QUALIFIER_RESPONSE_RATIO,
    RESPONSE_COUNTS_PER_CONCENTRATION_UNIT,
    TRACE_POINT_COUNT,
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

    def test_time_and_intensity_axes_align_on_the_run_duration(self) -> None:
        traces = generate_transition_traces(
            "inj_1", APPLE_PESTICIDES_MRM_V1, {}, _rng()
        )

        trace = traces[0]
        assert len(trace.times_s) == TRACE_POINT_COUNT
        assert len(trace.intensities) == TRACE_POINT_COUNT
        assert trace.times_s[0] == 0.0
        assert trace.times_s[-1] == pytest.approx(APPLE_PESTICIDES_MRM_V1.runtime_s)
        assert all(second > first for first, second in zip(trace.times_s, trace.times_s[1:], strict=False))

    def test_records_the_acquisition_metadata(self) -> None:
        transition = _transition("boscalid")
        traces = generate_transition_traces(
            "inj_1", _method_with(transition), {"boscalid": 1.0}, _rng()
        )

        acquisition = traces[0].acquisition
        assert acquisition.run_duration_s == APPLE_PESTICIDES_MRM_V1.runtime_s
        assert acquisition.point_count == TRACE_POINT_COUNT
        assert acquisition.sampling_interval_s == pytest.approx(
            APPLE_PESTICIDES_MRM_V1.runtime_s / (TRACE_POINT_COUNT - 1), abs=1e-4
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
