import pytest

from app.domain.models import ProduceFraction, ProduceMaterialState
from app.services.experiment_repository import _deserialize_experiment, _serialize_experiment
from app.services.experiment_service import ExperimentRuntimeService
from app.services.helpers.produce_canonical import _pour_produce_fractions_proportional
from app.services.helpers.workbench import build_workbench_tool


def test_build_workbench_tool_assigns_contact_impurity() -> None:
    tool = build_workbench_tool("hdpe_storage_jar_2l")

    assert tool.contact_impurity_mg_per_g > 0


def test_pour_fractions_adds_target_contact_impurity_and_tracks_exposure() -> None:
    source = [
        ProduceFraction(
            id="produce_fraction_source",
            produce_lot_id="lot_a",
            produce_material_state_id="state_ground",
            mass_g=2.0,
            impurity_mass_mg=0.1,
            exposure_container_ids=["jar_source"],
        )
    ]
    dest: list[ProduceFraction] = []
    target_tool = build_workbench_tool("sample_vial_lcms")
    target_tool.id = "vial_1"
    target_tool.contact_impurity_mg_per_g = 0.02

    _pour_produce_fractions_proportional(
        source,
        dest,
        0.5,
        target_tool,
        location_kind="workbench_tool",
        location_id="station_1",
    )

    assert source[0].mass_g == 1.0
    assert source[0].impurity_mass_mg == 0.05
    assert dest == [
        ProduceFraction(
            id=dest[0].id,
            produce_lot_id="lot_a",
            produce_material_state_id="state_ground",
            mass_g=1.0,
            impurity_mass_mg=0.07,
            exposure_container_ids=["jar_source", "vial_1"],
            location_kind="workbench_tool",
            location_id="station_1",
            container_id="vial_1",
            container_label=target_tool.label,
        )
    ]


def test_pour_fractions_keeps_distinct_exposure_histories_separate() -> None:
    source = [
        ProduceFraction(
            id="produce_fraction_source",
            produce_lot_id="lot_a",
            produce_material_state_id="state_ground",
            mass_g=1.0,
            impurity_mass_mg=0.02,
            exposure_container_ids=["jar_source"],
        )
    ]
    target_tool = build_workbench_tool("sample_vial_lcms")
    target_tool.id = "vial_1"
    target_tool.contact_impurity_mg_per_g = 0.01
    dest = [
        ProduceFraction(
            id="produce_fraction_existing",
            produce_lot_id="lot_a",
            produce_material_state_id="state_ground",
            mass_g=0.5,
            impurity_mass_mg=0.03,
            exposure_container_ids=["other_jar", "vial_1"],
            location_kind="workbench_tool",
            location_id="station_1",
            container_id="vial_1",
            container_label=target_tool.label,
        )
    ]

    _pour_produce_fractions_proportional(
        source,
        dest,
        1.0,
        target_tool,
        location_kind="workbench_tool",
        location_id="station_1",
    )

    assert len(dest) == 2
    assert {tuple(f.exposure_container_ids) for f in dest} == {
        ("other_jar", "vial_1"),
        ("jar_source", "vial_1"),
    }


def test_pour_fractions_preserves_mixed_state_and_keeps_it_separate() -> None:
    source = [
        ProduceFraction(
            id="produce_fraction_source",
            produce_lot_id="lot_a",
            produce_material_state_id="state_ground",
            mass_g=1.0,
            is_mixed=True,
            exposure_container_ids=["jar_source"],
        )
    ]
    target_tool = build_workbench_tool("sample_vial_lcms")
    target_tool.id = "vial_1"
    dest = [
        ProduceFraction(
            id="produce_fraction_existing",
            produce_lot_id="lot_a",
            produce_material_state_id="state_ground",
            mass_g=0.5,
            is_mixed=False,
            exposure_container_ids=["jar_source", "vial_1"],
            location_kind="workbench_tool",
            location_id="station_1",
            container_id="vial_1",
            container_label=target_tool.label,
        )
    ]

    _pour_produce_fractions_proportional(
        source,
        dest,
        0.5,
        target_tool,
        location_kind="workbench_tool",
        location_id="station_1",
    )

    assert source[0].is_mixed is True
    assert len(dest) == 2
    assert sorted((fraction.mass_g, fraction.is_mixed) for fraction in dest) == [
        (0.5, False),
        (0.5, True),
    ]


def test_experiment_roundtrip_preserves_powder_impurity_state() -> None:
    service = ExperimentRuntimeService()
    created = service.create_experiment()
    experiment = service._require_experiment(created.id)
    tool = build_workbench_tool("centrifuge_tube_50ml")
    tool.contact_impurity_mg_per_g = 0.015
    # produce_fractions is the persisted source of truth.
    experiment.produce_material_states = [ProduceMaterialState(id="state_ground_1", produce_lot_id="lot_a", material_state="ground")]
    tool.produce_fractions = [
        ProduceFraction(
            id="powder_1",
            produce_lot_id="lot_a",
            produce_material_state_id="state_ground_1",
            mass_g=1.25,
            is_mixed=True,
            impurity_mass_mg=0.08,
            exposure_container_ids=["jar_a", "tube_a"],
            location_kind="workbench_tool",
            location_id="station_1",
            container_id=tool.id,
            container_label=tool.label,
        )
    ]
    experiment.workbench.slots[0].tool = tool

    restored = _deserialize_experiment(_serialize_experiment(experiment))
    restored_tool = restored.workbench.slots[0].tool

    assert restored_tool is not None
    assert restored_tool.contact_impurity_mg_per_g == 0.015
    # Canonical produce_fraction survives with impurity history intact
    assert len(restored_tool.produce_fractions) == 1
    assert restored_tool.produce_fractions[0].produce_lot_id == "lot_a"
    assert restored_tool.produce_fractions[0].mass_g == 1.25
    assert restored_tool.produce_fractions[0].is_mixed is True
    assert restored_tool.produce_fractions[0].impurity_mass_mg == pytest.approx(0.08)
    assert restored_tool.produce_fractions[0].exposure_container_ids == ["jar_a", "tube_a"]
