"""Tests for the LC-MS/MS acquisition method model, registry and read API."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.domain.acquisition_methods import (
    APPLE_PESTICIDES_MRM_V1,
    APPLE_PESTICIDES_MRM_V1_ID,
    AcquisitionMethod,
    get_built_in_acquisition_method,
    list_built_in_acquisition_methods,
    snapshot_acquisition_method,
)
from app.domain.mrm_reference import (
    INTERNAL_STANDARD_COMPOUND_ID,
    MRM_REFERENCE_CATALOG,
    MZ_MATCH_TOLERANCE,
    find_reference_transition,
    reference_transitions_for,
)
from app.main import app


class TestMrmReferenceCatalog:
    def test_every_reference_transition_declares_its_provenance(self) -> None:
        assert MRM_REFERENCE_CATALOG
        for transition in MRM_REFERENCE_CATALOG:
            assert transition.provenance == "educational_placeholder"

    def test_product_ion_is_lighter_than_the_precursor(self) -> None:
        for transition in MRM_REFERENCE_CATALOG:
            assert transition.q3_mz < transition.q1_mz, transition.compound_id

    def test_every_analyte_has_a_quantifier_and_a_qualifier(self) -> None:
        analytes = {t.compound_id for t in MRM_REFERENCE_CATALOG if t.compound_kind == "analyte"}
        for compound_id in analytes:
            roles = {t.role for t in reference_transitions_for(compound_id)}
            assert roles == {"quantifier", "qualifier"}, compound_id

    def test_matches_a_transition_on_exact_masses(self) -> None:
        reference = MRM_REFERENCE_CATALOG[0]

        found = find_reference_transition(reference.q1_mz, reference.q3_mz)

        assert found is not None
        assert found.compound_id == reference.compound_id
        assert found.role == reference.role

    def test_matches_within_tolerance_but_not_beyond(self) -> None:
        reference = MRM_REFERENCE_CATALOG[0]
        inside = MZ_MATCH_TOLERANCE / 2
        outside = MZ_MATCH_TOLERANCE + 1.0

        assert find_reference_transition(
            reference.q1_mz + inside, reference.q3_mz
        ) is not None
        assert find_reference_transition(
            reference.q1_mz + outside, reference.q3_mz
        ) is None
        assert find_reference_transition(
            reference.q1_mz, reference.q3_mz + outside
        ) is None

    def test_unknown_mass_pair_matches_nothing(self) -> None:
        assert find_reference_transition(999.9, 111.1) is None


class TestAcquisitionMethodRegistry:
    def test_lists_the_built_in_method(self) -> None:
        methods = list_built_in_acquisition_methods()

        assert [method.id for method in methods] == [APPLE_PESTICIDES_MRM_V1_ID]

    def test_reads_a_method_by_id(self) -> None:
        method = get_built_in_acquisition_method(APPLE_PESTICIDES_MRM_V1_ID)

        assert method is APPLE_PESTICIDES_MRM_V1
        assert method.version == "1.0.0"
        assert method.runtime_s == 720.0

    def test_unknown_method_id_raises(self) -> None:
        with pytest.raises(ValueError, match="Unknown acquisition method"):
            get_built_in_acquisition_method("does_not_exist")

    def test_built_in_method_is_flagged_educational_and_immutable(self) -> None:
        assert APPLE_PESTICIDES_MRM_V1.is_educational is True
        assert APPLE_PESTICIDES_MRM_V1.is_built_in is True
        assert "not values from a validated" in APPLE_PESTICIDES_MRM_V1.provenance_note

    def test_every_declared_transition_documents_its_provenance(self) -> None:
        for transition in APPLE_PESTICIDES_MRM_V1.transitions:
            assert transition.provenance == "educational_placeholder"

    def test_transition_ids_are_unique_and_stable(self) -> None:
        ids = [transition.id for transition in APPLE_PESTICIDES_MRM_V1.transitions]

        assert len(ids) == len(set(ids))
        assert "boscalid__quantifier" in ids
        assert "boscalid__qualifier" in ids

    def test_declares_lc_and_source_parameters(self) -> None:
        chromatography = APPLE_PESTICIDES_MRM_V1.liquid_chromatography
        source = APPLE_PESTICIDES_MRM_V1.ion_source

        assert chromatography.flow_ml_per_min > 0
        assert chromatography.gradient[0].time_s == 0.0
        assert chromatography.gradient[-1].time_s == APPLE_PESTICIDES_MRM_V1.runtime_s
        assert source.ion_spray_voltage_v > 0

    def test_built_in_transitions_all_address_a_real_reference_channel(self) -> None:
        for transition in APPLE_PESTICIDES_MRM_V1.transitions:
            reference = find_reference_transition(transition.q1_mz, transition.q3_mz)
            assert reference is not None, transition.id
            assert reference.compound_id == transition.compound_id

    def test_analytes_reference_the_internal_standard_channel(self) -> None:
        analytes = [t for t in APPLE_PESTICIDES_MRM_V1.transitions if t.compound_kind == "analyte"]
        istd = [
            t for t in APPLE_PESTICIDES_MRM_V1.transitions if t.compound_kind == "internal_standard"
        ]

        assert analytes and istd
        assert all(t.internal_standard_id == INTERNAL_STANDARD_COMPOUND_ID for t in analytes)
        assert all(t.internal_standard_id is None for t in istd)

    def test_every_transition_has_a_usable_dwell_and_retention_window(self) -> None:
        for transition in APPLE_PESTICIDES_MRM_V1.transitions:
            assert transition.dwell_time_ms > 0
            assert transition.retention_window_s > 0
            assert 0 <= transition.expected_retention_time_s <= APPLE_PESTICIDES_MRM_V1.runtime_s

    def test_compound_ids_are_distinct_and_ordered(self) -> None:
        compound_ids = APPLE_PESTICIDES_MRM_V1.compound_ids

        assert len(compound_ids) == len(set(compound_ids))
        assert compound_ids[0] == APPLE_PESTICIDES_MRM_V1.transitions[0].compound_id
        assert INTERNAL_STANDARD_COMPOUND_ID in compound_ids

    def test_snapshot_is_an_equal_but_independent_frozen_copy(self) -> None:
        snapshot = snapshot_acquisition_method(APPLE_PESTICIDES_MRM_V1)

        assert snapshot == APPLE_PESTICIDES_MRM_V1
        assert isinstance(snapshot, AcquisitionMethod)
        assert isinstance(snapshot.transitions, tuple)
        with pytest.raises(AttributeError):
            snapshot.version = "9.9.9"  # type: ignore[misc]


class TestAcquisitionMethodRoutes:
    def test_lists_methods_without_their_transitions(self) -> None:
        response = TestClient(app).get("/experiments/catalog/acquisition-methods")

        assert response.status_code == 200
        payload = response.json()
        assert [method["id"] for method in payload] == [APPLE_PESTICIDES_MRM_V1_ID]
        summary = payload[0]
        assert summary["version"] == "1.0.0"
        assert summary["is_educational"] is True
        assert summary["is_built_in"] is True
        assert summary["transition_count"] == len(APPLE_PESTICIDES_MRM_V1.transitions)
        assert summary["compound_count"] == len(APPLE_PESTICIDES_MRM_V1.compound_ids)
        assert "transitions" not in summary

    def test_reads_the_full_method_detail(self) -> None:
        response = TestClient(app).get(
            f"/experiments/catalog/acquisition-methods/{APPLE_PESTICIDES_MRM_V1_ID}"
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["name"] == "Apple pesticides — MRM"
        assert payload["runtime_s"] == 720.0
        assert payload["provenance_note"]
        assert len(payload["transitions"]) == len(APPLE_PESTICIDES_MRM_V1.transitions)
        assert payload["liquid_chromatography"]["gradient"][0]["mobile_phase_b_percent"] == 5.0
        assert payload["ion_source"]["source_type"].startswith("Heated electrospray")

        transition = next(
            t for t in payload["transitions"] if t["id"] == "boscalid__quantifier"
        )
        assert transition["compound_id"] == "boscalid"
        assert transition["role"] == "quantifier"
        assert transition["polarity"] == "positive"
        assert transition["provenance"] == "educational_placeholder"
        assert transition["q1_mz"] > transition["q3_mz"]
        assert transition["collision_energy_v"] > 0
        assert transition["dwell_time_ms"] > 0
        assert transition["internal_standard_id"] == INTERNAL_STANDARD_COMPOUND_ID

    def test_unknown_method_returns_404(self) -> None:
        response = TestClient(app).get("/experiments/catalog/acquisition-methods/nope")

        assert response.status_code == 404
