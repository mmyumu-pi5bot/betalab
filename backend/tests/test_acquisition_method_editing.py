"""Tests for authoring user acquisition methods: duplicate, validate, edit, persist."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, replace

import pytest
from fastapi.testclient import TestClient
from pydantic_core import to_jsonable_python

from app.api.experiment_routes import acquisition_methods as method_routes
from app.domain.acquisition_method_rules import (
    collect_acquisition_method_warnings,
    validate_acquisition_method,
)
from app.domain.acquisition_methods import (
    APPLE_PESTICIDES_MRM_V1,
    APPLE_PESTICIDES_MRM_V1_ID,
    build_transitions_for_compounds,
    duplicate_acquisition_method,
)
from app.main import app
from app.services.acquisition_method_repository import (
    InMemoryAcquisitionMethodRepository,
    SqliteAcquisitionMethodRepository,
)
from app.services.acquisition_method_service import (
    AcquisitionMethodNotFoundError,
    AcquisitionMethodService,
    ImmutableAcquisitionMethodError,
    InvalidAcquisitionMethodError,
)
from app.services.domain_services.lcmsms import (
    AcquisitionSequenceLineRequest,
    LoadRackIntoInstrumentRequest,
    LoadRackIntoInstrumentService,
    RunSequenceRequest,
    RunSequenceService,
)
from app.services.domain_services.rack import (
    PlaceToolInRackSlotRequest,
    PlaceToolInRackSlotService,
)
from app.services.experiment_service import ExperimentRuntimeService


def _service() -> AcquisitionMethodService:
    return AcquisitionMethodService(repository=InMemoryAcquisitionMethodRepository())


def _transition(compound_id: str, role: str = "quantifier"):
    return next(t for t in APPLE_PESTICIDES_MRM_V1.transitions if t.compound_id == compound_id and t.role == role)


class TestValidation:
    def test_the_built_in_method_is_valid(self) -> None:
        assert validate_acquisition_method(APPLE_PESTICIDES_MRM_V1) == []

    def test_rejects_an_empty_method(self) -> None:
        empty = replace(APPLE_PESTICIDES_MRM_V1, transitions=())

        assert "A method needs at least one transition." in validate_acquisition_method(empty)

    def test_rejects_a_negative_or_zero_mz(self) -> None:
        for q1, q3 in ((-343.0, 307.0), (343.0, 0.0)):
            method = replace(
                APPLE_PESTICIDES_MRM_V1,
                transitions=(replace(_transition("boscalid"), q1_mz=q1, q3_mz=q3),),
            )
            assert any("m/z values must be positive" in e for e in validate_acquisition_method(method))

    def test_rejects_a_zero_dwell_time(self) -> None:
        method = replace(
            APPLE_PESTICIDES_MRM_V1,
            transitions=(replace(_transition("boscalid"), dwell_time_ms=0.0),),
        )

        assert any("dwell time must be positive" in e for e in validate_acquisition_method(method))

    def test_rejects_duplicate_transition_identifiers(self) -> None:
        transition = _transition("boscalid")
        method = replace(APPLE_PESTICIDES_MRM_V1, transitions=(transition, transition))

        assert any("Duplicate transition identifier" in e for e in validate_acquisition_method(method))

    def test_rejects_a_compound_without_a_quantifier(self) -> None:
        method = replace(
            APPLE_PESTICIDES_MRM_V1,
            transitions=(_transition("boscalid", "qualifier"),),
        )

        errors = validate_acquisition_method(method)
        assert any("has no quantifier transition" in e for e in errors)

    def test_accepts_a_transition_that_matches_no_catalog_entry(self) -> None:
        """A physically well-formed channel that sees nothing is legal to save."""
        off_catalog = replace(_transition("boscalid"), q1_mz=911.4, q3_mz=455.2)
        method = replace(APPLE_PESTICIDES_MRM_V1, transitions=(off_catalog,))

        assert validate_acquisition_method(method) == []


class TestWarnings:
    def test_the_built_in_method_raises_no_warning(self) -> None:
        assert collect_acquisition_method_warnings(APPLE_PESTICIDES_MRM_V1) == []

    def test_warns_when_no_compound_responds_at_the_declared_masses(self) -> None:
        off_catalog = replace(_transition("boscalid"), q1_mz=911.4, q3_mz=455.2)
        method = replace(APPLE_PESTICIDES_MRM_V1, transitions=(off_catalog,))

        warnings = collect_acquisition_method_warnings(method)

        assert [w.code for w in warnings] == ["unmatched_transition"]
        assert "baseline noise only" in warnings[0].message

    def test_warns_when_the_retention_window_misses_the_peak(self) -> None:
        drifted = replace(
            _transition("boscalid"),
            expected_retention_time_s=60.0,
            retention_window_s=20.0,
        )
        method = replace(APPLE_PESTICIDES_MRM_V1, transitions=(drifted,))

        warnings = collect_acquisition_method_warnings(method)

        assert [w.code for w in warnings] == ["retention_window_misses_peak"]

    def test_warns_when_the_product_ion_is_heavier_than_the_precursor(self) -> None:
        inverted = replace(_transition("boscalid"), q1_mz=307.0, q3_mz=343.0)
        method = replace(APPLE_PESTICIDES_MRM_V1, transitions=(inverted,))

        codes = [w.code for w in collect_acquisition_method_warnings(method)]

        assert "product_ion_heavier_than_precursor" in codes


class TestSimpleModeTransitionProposal:
    def test_proposes_the_known_transitions_of_the_selected_compounds(self) -> None:
        transitions = build_transitions_for_compounds(["boscalid", "acetamiprid"])

        assert {t.compound_id for t in transitions} == {"boscalid", "acetamiprid"}
        assert {t.role for t in transitions} == {"quantifier", "qualifier"}

    def test_keeps_the_selection_order_and_deduplicates(self) -> None:
        transitions = build_transitions_for_compounds(["acetamiprid", "boscalid", "acetamiprid"])

        compound_order = list(dict.fromkeys(t.compound_id for t in transitions))
        assert compound_order == ["acetamiprid", "boscalid"]

    def test_proposed_transitions_form_a_valid_method(self) -> None:
        method = replace(
            APPLE_PESTICIDES_MRM_V1,
            transitions=build_transitions_for_compounds(["boscalid"]),
        )

        assert validate_acquisition_method(method) == []
        assert collect_acquisition_method_warnings(method) == []

    def test_rejects_an_unknown_compound(self) -> None:
        with pytest.raises(ValueError, match="Unknown compound"):
            build_transitions_for_compounds(["unobtainium"])


class TestDuplication:
    def test_a_copy_is_editable_and_keeps_its_provenance(self) -> None:
        copy = duplicate_acquisition_method(APPLE_PESTICIDES_MRM_V1, "my_method", "My method", "0.1.0")

        assert copy.id == "my_method"
        assert copy.is_built_in is False
        assert copy.is_educational is True
        assert copy.provenance_note == APPLE_PESTICIDES_MRM_V1.provenance_note
        assert copy.transitions == APPLE_PESTICIDES_MRM_V1.transitions

    def test_duplicating_does_not_touch_the_source(self) -> None:
        duplicate_acquisition_method(APPLE_PESTICIDES_MRM_V1, "my_method", "Mine", "0.1.0")

        assert APPLE_PESTICIDES_MRM_V1.is_built_in is True
        assert APPLE_PESTICIDES_MRM_V1.id == APPLE_PESTICIDES_MRM_V1_ID


class TestAcquisitionMethodServiceCrud:
    def test_lists_built_in_methods_first_then_user_methods(self) -> None:
        service = _service()
        service.duplicate(APPLE_PESTICIDES_MRM_V1_ID, "mine", "Mine", "0.1.0")

        assert [m.id for m in service.list_methods()] == [APPLE_PESTICIDES_MRM_V1_ID, "mine"]

    def test_reads_back_a_saved_user_method(self) -> None:
        service = _service()
        service.duplicate(APPLE_PESTICIDES_MRM_V1_ID, "mine", "Mine", "0.1.0")

        assert service.get_method("mine").name == "Mine"

    def test_refuses_to_overwrite_an_existing_id(self) -> None:
        service = _service()
        service.duplicate(APPLE_PESTICIDES_MRM_V1_ID, "mine", "Mine", "0.1.0")

        with pytest.raises(ValueError, match="already exists"):
            service.duplicate(APPLE_PESTICIDES_MRM_V1_ID, "mine", "Mine again", "0.2.0")

    def test_refuses_to_duplicate_onto_a_built_in_id(self) -> None:
        service = _service()

        with pytest.raises(ValueError, match="already exists"):
            service.duplicate(APPLE_PESTICIDES_MRM_V1_ID, APPLE_PESTICIDES_MRM_V1_ID, "Clone", "9.9.9")

    def test_saves_a_new_version_of_a_user_method(self) -> None:
        service = _service()
        copy = service.duplicate(APPLE_PESTICIDES_MRM_V1_ID, "mine", "Mine", "0.1.0")

        saved = service.save_new_version(replace(copy, version="0.2.0", transitions=copy.transitions[:2]))

        assert saved.version == "0.2.0"
        assert service.get_method("mine").version == "0.2.0"
        assert len(service.get_method("mine").transitions) == 2

    def test_refuses_to_save_over_a_built_in_method(self) -> None:
        service = _service()

        with pytest.raises(ImmutableAcquisitionMethodError, match="Duplicate it before editing"):
            service.save_new_version(replace(APPLE_PESTICIDES_MRM_V1, version="6.6.6"))

    def test_refuses_to_save_a_structurally_invalid_method(self) -> None:
        service = _service()
        copy = service.duplicate(APPLE_PESTICIDES_MRM_V1_ID, "mine", "Mine", "0.1.0")

        with pytest.raises(InvalidAcquisitionMethodError):
            service.save_new_version(replace(copy, transitions=()))

    def test_saves_a_method_that_will_see_nothing_but_reports_the_warning(self) -> None:
        service = _service()
        copy = service.duplicate(APPLE_PESTICIDES_MRM_V1_ID, "mine", "Mine", "0.1.0")
        blind = replace(
            copy,
            transitions=(replace(_transition("boscalid"), q1_mz=911.4, q3_mz=455.2),),
        )

        saved = service.save_new_version(blind)

        assert saved.id == "mine"
        assert [w.code for w in service.warnings_for(saved)] == ["unmatched_transition"]

    def test_deletes_a_user_method(self) -> None:
        service = _service()
        service.duplicate(APPLE_PESTICIDES_MRM_V1_ID, "mine", "Mine", "0.1.0")

        service.delete("mine")

        with pytest.raises(AcquisitionMethodNotFoundError):
            service.get_method("mine")

    def test_refuses_to_delete_a_built_in_method(self) -> None:
        with pytest.raises(ImmutableAcquisitionMethodError):
            _service().delete(APPLE_PESTICIDES_MRM_V1_ID)

    def test_unknown_method_raises(self) -> None:
        with pytest.raises(AcquisitionMethodNotFoundError, match="Unknown acquisition method"):
            _service().get_method("nope")


class TestUserMethodPersistence:
    def test_a_user_method_survives_a_restart(self, tmp_path) -> None:
        db_path = str(tmp_path / "methods.sqlite3")
        service = AcquisitionMethodService(repository=SqliteAcquisitionMethodRepository(db_path))
        copy = service.duplicate(APPLE_PESTICIDES_MRM_V1_ID, "mine", "Mine", "0.1.0")
        service.save_new_version(replace(copy, transitions=copy.transitions[:3]))

        reloaded = AcquisitionMethodService(repository=SqliteAcquisitionMethodRepository(db_path)).get_method("mine")

        assert reloaded.name == "Mine"
        assert reloaded.is_built_in is False
        assert len(reloaded.transitions) == 3
        assert reloaded.transitions[0] == copy.transitions[0]
        assert isinstance(reloaded.transitions, tuple)
        assert isinstance(reloaded.liquid_chromatography.gradient, tuple)


class TestRunningWithAUserMethod:
    def test_a_run_freezes_the_user_method_it_used(self) -> None:
        methods = _service()
        copy = methods.duplicate(APPLE_PESTICIDES_MRM_V1_ID, "mine", "Mine", "0.1.0")
        methods.save_new_version(replace(copy, transitions=copy.transitions[:2]))

        service = ExperimentRuntimeService()
        exp_id = service.create_experiment().id
        experiment = service._require_experiment(exp_id)
        for widget in experiment.workspace.widgets:
            if widget.id in ("instrument", "rack"):
                widget.is_present = True
        PlaceToolInRackSlotService(service).run(
            exp_id,
            PlaceToolInRackSlotRequest(rack_slot_id="rack_slot_1", tool_id="sample_vial_lcms"),
        )
        for slot in service._require_experiment(exp_id).rack.slots:
            if slot.tool is not None:
                slot.tool.is_sealed = True
        LoadRackIntoInstrumentService(service).run(exp_id, LoadRackIntoInstrumentRequest())

        RunSequenceService(service, method_resolver=methods.get_method).run(
            exp_id,
            RunSequenceRequest(
                method_id="mine",
                injections=[
                    AcquisitionSequenceLineRequest(
                        rack_slot_id="rack_slot_1",
                        sample_name="Apple A",
                        injection_volume_ul=5.0,
                        repetitions=1,
                        output_filename="apple_a.mzML",
                    )
                ],
            ),
        )

        instrument = next(w for w in service._require_experiment(exp_id).workspace.widgets if w.id == "instrument")
        run = instrument.sequence_runs[0]
        assert run.method_id == "mine"
        assert run.method_snapshot.name == "Mine"
        assert len(run.method_snapshot.transitions) == 2
        assert len(run.injections[0].traces) == 2

        # Editing the method afterwards must not rewrite the finished run.
        methods.save_new_version(replace(copy, version="0.3.0", transitions=copy.transitions[:5]))
        assert len(run.method_snapshot.transitions) == 2
        assert run.method_snapshot.version == "0.1.0"


class TestAcquisitionMethodRoutes:
    @pytest.fixture(autouse=True)
    def _isolated_service(self, monkeypatch):
        monkeypatch.setattr(method_routes, "acquisition_method_service", _service(), raising=True)

    def test_duplicates_a_method_over_http(self) -> None:
        response = TestClient(app).post(
            "/experiments/catalog/acquisition-methods/duplicate",
            json={
                "source_method_id": APPLE_PESTICIDES_MRM_V1_ID,
                "new_method_id": "mine",
                "name": "Mine",
                "version": "0.1.0",
            },
        )

        assert response.status_code == 201
        payload = response.json()
        assert payload["method"]["id"] == "mine"
        assert payload["method"]["is_built_in"] is False
        assert payload["warnings"] == []

    def test_duplicating_an_unknown_source_returns_404(self) -> None:
        response = TestClient(app).post(
            "/experiments/catalog/acquisition-methods/duplicate",
            json={
                "source_method_id": "nope",
                "new_method_id": "mine",
                "name": "Mine",
                "version": "0.1.0",
            },
        )

        assert response.status_code == 404

    def test_duplicating_onto_an_existing_id_returns_409(self) -> None:
        client = TestClient(app)
        body = {
            "source_method_id": APPLE_PESTICIDES_MRM_V1_ID,
            "new_method_id": "mine",
            "name": "Mine",
            "version": "0.1.0",
        }
        client.post("/experiments/catalog/acquisition-methods/duplicate", json=body)

        response = client.post("/experiments/catalog/acquisition-methods/duplicate", json=body)

        assert response.status_code == 409

    def test_saves_an_edited_user_method(self) -> None:
        client = TestClient(app)
        client.post(
            "/experiments/catalog/acquisition-methods/duplicate",
            json={
                "source_method_id": APPLE_PESTICIDES_MRM_V1_ID,
                "new_method_id": "mine",
                "name": "Mine",
                "version": "0.1.0",
            },
        )
        transitions = [asdict(_transition("boscalid")), asdict(_transition("boscalid", "qualifier"))]

        response = client.put(
            "/experiments/catalog/acquisition-methods/mine",
            json={
                "name": "Mine",
                "version": "0.2.0",
                "runtime_s": 600.0,
                "transitions": transitions,
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["method"]["version"] == "0.2.0"
        assert payload["method"]["runtime_s"] == 600.0
        assert len(payload["method"]["transitions"]) == 2

    def test_saving_over_a_built_in_method_returns_409(self) -> None:
        response = TestClient(app).put(
            f"/experiments/catalog/acquisition-methods/{APPLE_PESTICIDES_MRM_V1_ID}",
            json={
                "name": "Hacked",
                "version": "9.9.9",
                "runtime_s": 720.0,
                "transitions": [asdict(_transition("boscalid"))],
            },
        )

        assert response.status_code == 409

    def test_saving_a_structurally_invalid_method_returns_400(self) -> None:
        client = TestClient(app)
        client.post(
            "/experiments/catalog/acquisition-methods/duplicate",
            json={
                "source_method_id": APPLE_PESTICIDES_MRM_V1_ID,
                "new_method_id": "mine",
                "name": "Mine",
                "version": "0.1.0",
            },
        )

        response = client.put(
            "/experiments/catalog/acquisition-methods/mine",
            json={
                "name": "Mine",
                "version": "0.2.0",
                "runtime_s": 600.0,
                "transitions": [],
            },
        )

        assert response.status_code == 400

    def test_saves_an_off_catalog_transition_and_returns_its_warning(self) -> None:
        client = TestClient(app)
        client.post(
            "/experiments/catalog/acquisition-methods/duplicate",
            json={
                "source_method_id": APPLE_PESTICIDES_MRM_V1_ID,
                "new_method_id": "mine",
                "name": "Mine",
                "version": "0.1.0",
            },
        )
        blind = asdict(replace(_transition("boscalid"), q1_mz=911.4, q3_mz=455.2))

        response = client.put(
            "/experiments/catalog/acquisition-methods/mine",
            json={
                "name": "Mine",
                "version": "0.2.0",
                "runtime_s": 600.0,
                "transitions": [blind],
            },
        )

        assert response.status_code == 200
        warnings = response.json()["warnings"]
        assert [w["code"] for w in warnings] == ["unmatched_transition"]

    def test_deletes_a_user_method(self) -> None:
        client = TestClient(app)
        client.post(
            "/experiments/catalog/acquisition-methods/duplicate",
            json={
                "source_method_id": APPLE_PESTICIDES_MRM_V1_ID,
                "new_method_id": "mine",
                "name": "Mine",
                "version": "0.1.0",
            },
        )

        assert client.delete("/experiments/catalog/acquisition-methods/mine").status_code == 204
        assert client.get("/experiments/catalog/acquisition-methods/mine").status_code == 404

    def test_deleting_a_built_in_method_returns_409(self) -> None:
        response = TestClient(app).delete(f"/experiments/catalog/acquisition-methods/{APPLE_PESTICIDES_MRM_V1_ID}")

        assert response.status_code == 409

    def test_lists_user_methods_alongside_built_in_ones(self) -> None:
        client = TestClient(app)
        client.post(
            "/experiments/catalog/acquisition-methods/duplicate",
            json={
                "source_method_id": APPLE_PESTICIDES_MRM_V1_ID,
                "new_method_id": "mine",
                "name": "Mine",
                "version": "0.1.0",
            },
        )

        payload = client.get("/experiments/catalog/acquisition-methods").json()

        assert [m["id"] for m in payload] == [APPLE_PESTICIDES_MRM_V1_ID, "mine"]
        assert payload[1]["is_built_in"] is False

    def test_exposes_the_reference_catalog_for_simple_mode(self) -> None:
        payload = TestClient(app).get("/experiments/catalog/mrm-reference").json()

        boscalid = next(entry for entry in payload if entry["compound_id"] == "boscalid")
        assert boscalid["compound_label"] == "Boscalid"
        assert {t["role"] for t in boscalid["transitions"]} == {"quantifier", "qualifier"}
        assert all(t["provenance"] == "educational_placeholder" for t in boscalid["transitions"])

    def test_proposes_transitions_for_selected_compounds(self) -> None:
        response = TestClient(app).post(
            "/experiments/catalog/acquisition-methods/propose-transitions",
            json={"compound_ids": ["boscalid"]},
        )

        assert response.status_code == 200
        payload = response.json()
        assert {t["compound_id"] for t in payload} == {"boscalid"}
        assert {t["role"] for t in payload} == {"quantifier", "qualifier"}

    def test_proposing_an_unknown_compound_returns_400(self) -> None:
        response = TestClient(app).post(
            "/experiments/catalog/acquisition-methods/propose-transitions",
            json={"compound_ids": ["unobtainium"]},
        )

        assert response.status_code == 400


class TestCalibrationLevels:
    """The concentration ladder a method declares for its calibration series.

    It is a *declaration*, exactly like a retention window: the user states what
    the standards are meant to contain. Nothing reads it back from the vials in
    the rack, so a method whose ladder does not match the standards actually
    injected produces a method file that lies — and that is the point.
    """

    def test_the_built_in_method_declares_no_ladder(self) -> None:
        assert APPLE_PESTICIDES_MRM_V1.calibration_levels_ng_per_ml == ()

    def test_a_ladder_is_declared_in_the_order_it_was_typed(self) -> None:
        method = replace(
            APPLE_PESTICIDES_MRM_V1,
            id="mine",
            is_built_in=False,
            calibration_levels_ng_per_ml=(10.0, 1.0, 5.0),
        )

        assert validate_acquisition_method(method) == []
        assert method.calibration_levels_ng_per_ml == (10.0, 1.0, 5.0)

    def test_a_non_positive_level_is_rejected(self) -> None:
        method = replace(
            APPLE_PESTICIDES_MRM_V1,
            id="mine",
            is_built_in=False,
            calibration_levels_ng_per_ml=(1.0, 0.0),
        )

        assert validate_acquisition_method(method) == ["Calibration levels must be positive."]

    def test_a_ladder_survives_a_restart_as_a_tuple(self, tmp_path) -> None:
        db_path = str(tmp_path / "methods.sqlite3")
        service = AcquisitionMethodService(repository=SqliteAcquisitionMethodRepository(db_path))
        copy = service.duplicate(APPLE_PESTICIDES_MRM_V1_ID, "mine", "Mine", "0.1.0")
        service.save_new_version(replace(copy, calibration_levels_ng_per_ml=(1.0, 2.0, 5.0)))

        reloaded = AcquisitionMethodService(repository=SqliteAcquisitionMethodRepository(db_path)).get_method("mine")

        assert reloaded.calibration_levels_ng_per_ml == (1.0, 2.0, 5.0)
        assert isinstance(reloaded.calibration_levels_ng_per_ml, tuple)

    def test_a_method_stored_before_the_field_existed_still_loads(self, tmp_path) -> None:
        """Old payloads carry no ladder key; they must default to an empty one."""
        db_path = str(tmp_path / "methods.sqlite3")
        repository = SqliteAcquisitionMethodRepository(db_path)
        legacy = asdict(replace(APPLE_PESTICIDES_MRM_V1, id="legacy", is_built_in=False))
        legacy.pop("calibration_levels_ng_per_ml", None)
        with sqlite3.connect(db_path) as connection:
            connection.execute(
                "INSERT INTO acquisition_methods (id, payload) VALUES (?, ?)",
                ("legacy", json.dumps(to_jsonable_python(legacy), sort_keys=True)),
            )
            connection.commit()

        assert repository.load("legacy").calibration_levels_ng_per_ml == ()

    def test_duplicating_carries_the_ladder_over(self) -> None:
        service = _service()
        source = replace(
            APPLE_PESTICIDES_MRM_V1,
            id="source",
            is_built_in=False,
            calibration_levels_ng_per_ml=(1.0, 2.0),
        )
        service.save_new_version(source)

        copy = service.duplicate("source", "copy", "Copy", "0.1.0")

        assert copy.calibration_levels_ng_per_ml == (1.0, 2.0)

    def test_the_save_route_records_the_ladder(self) -> None:
        client = TestClient(app)
        client.post(
            "/experiments/catalog/acquisition-methods/duplicate",
            json={
                "source_method_id": APPLE_PESTICIDES_MRM_V1_ID,
                "new_method_id": "ladder_route",
                "name": "Ladder",
                "version": "0.1.0",
            },
        )
        detail = client.get("/experiments/catalog/acquisition-methods/ladder_route").json()

        response = client.put(
            "/experiments/catalog/acquisition-methods/ladder_route",
            json={
                "name": "Ladder",
                "version": "0.2.0",
                "runtime_s": detail["runtime_s"],
                "transitions": detail["transitions"],
                "calibration_levels_ng_per_ml": [1.0, 2.0, 5.0, 10.0],
            },
        )

        assert response.status_code == 200
        assert response.json()["method"]["calibration_levels_ng_per_ml"] == [
            1.0,
            2.0,
            5.0,
            10.0,
        ]
        client.delete("/experiments/catalog/acquisition-methods/ladder_route")

    def test_the_save_route_defaults_to_no_ladder(self) -> None:
        """Omitting the field must not silently wipe nothing into something."""
        client = TestClient(app)
        client.post(
            "/experiments/catalog/acquisition-methods/duplicate",
            json={
                "source_method_id": APPLE_PESTICIDES_MRM_V1_ID,
                "new_method_id": "no_ladder",
                "name": "No ladder",
                "version": "0.1.0",
            },
        )
        detail = client.get("/experiments/catalog/acquisition-methods/no_ladder").json()

        response = client.put(
            "/experiments/catalog/acquisition-methods/no_ladder",
            json={
                "name": "No ladder",
                "version": "0.2.0",
                "runtime_s": detail["runtime_s"],
                "transitions": detail["transitions"],
            },
        )

        assert response.status_code == 200
        assert response.json()["method"]["calibration_levels_ng_per_ml"] == []
        client.delete("/experiments/catalog/acquisition-methods/no_ladder")
