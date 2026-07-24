from __future__ import annotations

import random

import pytest

from app.domain.models import (
    InjectionContext,
    ProduceFraction,
    ProduceLot,
    QuechersExtractionResult,
    WorkbenchLiquid,
)
from app.services.domain_services.debug import (
    CreateDebugToolPresetRequest,
    CreateDebugToolPresetService,
)
from app.services.domain_services.pipette import (
    AspiratePipetteRequest,
    AspiratePipetteService,
    DispensePipetteRequest,
    DispensePipetteService,
)
from app.services.domain_services.workbench import (
    AddWorkbenchSlotService,
    EmptyWorkbenchRequest,
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
)
from app.services.experiment_repository import SqliteExperimentRepository
from app.services.experiment_service import ExperimentRuntimeService


def _prepared_experiment(
    service: ExperimentRuntimeService | None = None,
) -> tuple[ExperimentRuntimeService, str, str, str]:
    service = service or ExperimentRuntimeService()
    experiment_id = service.create_experiment().id
    PlaceToolOnWorkbenchService(service).run(
        experiment_id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="centrifuge_tube_50ml"),
    )
    PlaceToolOnWorkbenchService(service).run(
        experiment_id,
        PlaceToolOnWorkbenchRequest(slot_id="station_2", tool_id="sample_vial_lcms"),
    )
    experiment = service._require_experiment(experiment_id)
    tube = experiment.workbench.slots[0].tool
    vial = experiment.workbench.slots[1].tool
    assert tube is not None and vial is not None
    tube.quechers_state.phase = "mixed"
    tube.quechers_extraction_result = QuechersExtractionResult(
        extraction_manip_factor=1.0,
        istd_manip_factor=None,
        istd_phase=None,
    )
    tube.produce_fractions = [
        ProduceFraction(
            id="fraction_1",
            produce_lot_id="lot_1",
            produce_material_state_id="state_1",
            mass_g=10.0,
            location_kind="workbench_tool",
            location_id=tube.id,
            container_id=tube.id,
        )
    ]
    tube.liquids = [WorkbenchLiquid(id="liquid_1", liquid_id="acetonitrile_extraction", name="Acetonitrile", volume_ml=10.0, accent="amber")]
    return service, experiment_id, tube.id, vial.id


def test_pipette_aspirates_requested_volume_and_caps_at_capacity() -> None:
    service, experiment_id, tube_id, _ = _prepared_experiment()

    updated = AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=1.3)
    )

    assert updated.pipette.volume_ml == pytest.approx(1.0)
    assert updated.pipette.source_tool_id == tube_id
    assert sum(liquid.volume_ml for liquid in updated.pipette.liquids) == pytest.approx(1.0)


def test_pipette_aspirates_from_unprocessed_liquid_tube() -> None:
    service, experiment_id, tube_id, _ = _prepared_experiment()
    tube = service._require_experiment(experiment_id).workbench.slots[0].tool
    assert tube is not None
    tube.quechers_state.phase = "idle"
    tube.quechers_extraction_result = None

    updated = AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.2)
    )

    assert updated.pipette.volume_ml == pytest.approx(0.2)
    assert updated.pipette.injection_context is None


def test_pipette_aspirates_apple_slurry_without_liquid() -> None:
    service = ExperimentRuntimeService()
    experiment_id = service.create_experiment().id
    created = CreateDebugToolPresetService(service).run(
        experiment_id,
        CreateDebugToolPresetRequest(
            preset_id="apple_slurry_centrifuge_tube",
            destination_kind="workbench_slot",
            destination_id="station_1",
        ),
    )
    tube = created.workbench.slots[0].tool
    assert tube is not None
    tube_id = tube.id

    updated = AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.4)
    )

    assert updated.pipette.volume_ml == pytest.approx(0.4)
    assert sum(fraction.mass_g for fraction in updated.pipette.produce_fractions) == pytest.approx(0.4)
    source = updated.workbench.slots[0].tool
    assert source is not None
    assert sum(fraction.mass_g for fraction in source.produce_fractions) == pytest.approx(9.6)


def test_mixed_slurry_and_liquid_are_aspirated_together() -> None:
    service, experiment_id, tube_id, _ = _prepared_experiment()
    experiment = service._require_experiment(experiment_id)
    tube = experiment.workbench.slots[0].tool
    assert tube is not None
    tube.produce_lots = [
        ProduceLot(id="lot_1", label="Apple", produce_type="apple", total_mass_g=10.0)
    ]
    tube.contents_homogeneity = 1.0

    updated = AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=1.0)
    )

    assert sum(liquid.volume_ml for liquid in updated.pipette.liquids) == pytest.approx(0.5)
    assert sum(fraction.mass_g for fraction in updated.pipette.produce_fractions) == pytest.approx(0.5)


def test_pipette_dispenses_apple_slurry_into_another_tube() -> None:
    service, experiment_id, tube_id, vial_id = _prepared_experiment()
    experiment = service._require_experiment(experiment_id)
    tube = experiment.workbench.slots[0].tool
    assert tube is not None
    tube.liquids = []
    tube.quechers_extraction_result = None
    tube.produce_lots = [
        ProduceLot(id="lot_1", label="Apple", produce_type="apple", total_mass_g=10.0)
    ]
    tube.contents_homogeneity = 1.0

    AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.4)
    )
    updated = DispensePipetteService(service).run(
        experiment_id, DispensePipetteRequest(target_tool_id=vial_id, delta_volume_ml=0.25)
    )

    vial = updated.workbench.slots[1].tool
    assert vial is not None
    assert sum(fraction.mass_g for fraction in vial.produce_fractions) == pytest.approx(0.25)
    assert updated.pipette.volume_ml == pytest.approx(0.15)
    assert sum(fraction.mass_g for fraction in updated.pipette.produce_fractions) == pytest.approx(0.15)


def test_unmixed_tube_aspirates_a_heterogeneous_liquid_composition() -> None:
    service, experiment_id, tube_id, _ = _prepared_experiment()
    tube = service._require_experiment(experiment_id).workbench.slots[0].tool
    assert tube is not None
    tube.contents_homogeneity = 0.0
    tube.liquids.append(WorkbenchLiquid(id="liquid_2", liquid_id="istd_solution", name="ISTD", volume_ml=10.0, accent="emerald"))
    random.seed(7)

    updated = AspiratePipetteService(service).run(experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=1.0))

    volumes = [liquid.volume_ml for liquid in updated.pipette.liquids]
    assert sum(volumes) == pytest.approx(1.0)
    assert volumes[0] != pytest.approx(0.5)


def test_partially_mixed_tube_has_less_sampling_bias_than_unmixed_tube() -> None:
    def sampling_deviation(homogeneity: float) -> float:
        service, experiment_id, tube_id, _ = _prepared_experiment()
        tube = service._require_experiment(experiment_id).workbench.slots[0].tool
        assert tube is not None
        tube.liquids.append(
            WorkbenchLiquid(
                id="liquid_2",
                liquid_id="istd_solution",
                name="ISTD",
                volume_ml=10.0,
                accent="emerald",
            )
        )
        tube.contents_homogeneity = homogeneity
        random.seed(11)
        updated = AspiratePipetteService(service).run(
            experiment_id,
            AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.5),
        )
        return abs(updated.pipette.liquids[0].volume_ml - 0.25)

    assert sampling_deviation(0.75) < sampling_deviation(0.0)


def test_loaded_pipette_dispenses_incrementally_and_prepares_vial() -> None:
    service, experiment_id, tube_id, vial_id = _prepared_experiment()
    AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.8)
    )

    updated = DispensePipetteService(service).run(
        experiment_id, DispensePipetteRequest(target_tool_id=vial_id, delta_volume_ml=0.3)
    )

    assert updated.pipette.volume_ml == pytest.approx(0.5)
    vial = updated.workbench.slots[1].tool
    assert vial is not None and vial.injection_context is not None
    assert vial.injection_context.extract_volume_ml == pytest.approx(0.3)
    assert vial.injection_context.sample_mass_g == pytest.approx(0.3)


def test_pipette_rejects_aspiration_from_an_empty_vial() -> None:
    service, experiment_id, tube_id, vial_id = _prepared_experiment()
    AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.2)
    )

    with pytest.raises(ValueError, match="contains no liquid"):
        AspiratePipetteService(service).run(
            experiment_id, AspiratePipetteRequest(source_tool_id=vial_id, delta_volume_ml=0.1)
        )


def test_dispense_tracks_hidden_true_volume_on_both_sides() -> None:
    service, experiment_id, tube_id, vial_id = _prepared_experiment()
    tube = service._require_experiment(experiment_id).workbench.slots[0].tool
    assert tube is not None
    tube.liquids[0].true_volume_ml = 9.0

    AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=1.0)
    )
    DispensePipetteService(service).run(
        experiment_id, DispensePipetteRequest(target_tool_id=vial_id, delta_volume_ml=0.5)
    )
    updated = DispensePipetteService(service).run(
        experiment_id, DispensePipetteRequest(target_tool_id=vial_id, delta_volume_ml=0.5)
    )

    vial = updated.workbench.slots[1].tool
    assert vial is not None
    assert sum(liquid.volume_ml for liquid in vial.liquids) == pytest.approx(1.0)
    assert sum(liquid.true_volume_ml or 0.0 for liquid in vial.liquids) == pytest.approx(0.9, abs=0.001)
    assert updated.pipette.volume_ml == pytest.approx(0.0)
    assert updated.pipette.liquids == []


def test_aspiration_ignores_zero_volume_liquid_entries() -> None:
    service, experiment_id, tube_id, _ = _prepared_experiment()
    tube = service._require_experiment(experiment_id).workbench.slots[0].tool
    assert tube is not None
    tube.liquids.append(WorkbenchLiquid(id="liquid_0", liquid_id="istd_solution", name="ISTD", volume_ml=0.0, accent="emerald"))

    updated = AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.2)
    )

    assert updated.pipette.volume_ml == pytest.approx(0.2)
    assert all(liquid.volume_ml > 0 for liquid in updated.pipette.liquids)
    assert all(liquid.volume_ml > 0 for liquid in tube.liquids)


def test_dispensing_plain_solvent_into_extract_vial_is_allowed() -> None:
    service, experiment_id, tube_id, vial_id = _prepared_experiment()
    experiment = service._require_experiment(experiment_id)
    tube = experiment.workbench.slots[0].tool
    vial = experiment.workbench.slots[1].tool
    assert tube is not None and vial is not None
    tube.quechers_state.phase = "idle"
    tube.quechers_extraction_result = None
    tube.produce_fractions = []
    vial.injection_context = InjectionContext(
        source_tube_id="another_tube",
        sample_mass_g=0.5,
        extract_volume_ml=0.5,
        effective_residues_ug_per_kg={},
    )

    AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.2)
    )
    updated = DispensePipetteService(service).run(
        experiment_id, DispensePipetteRequest(target_tool_id=vial_id, delta_volume_ml=0.1)
    )

    vial = updated.workbench.slots[1].tool
    assert vial is not None and vial.injection_context is not None
    assert vial.injection_context.sample_mass_g == pytest.approx(0.5)
    assert sum(liquid.volume_ml for liquid in vial.liquids) == pytest.approx(0.1)


def test_reaspiration_from_intermediate_tube_keeps_provenance() -> None:
    service, experiment_id, tube_id, vial_id = _prepared_experiment()
    AddWorkbenchSlotService(service).run(experiment_id, EmptyWorkbenchRequest())
    PlaceToolOnWorkbenchService(service).run(
        experiment_id,
        PlaceToolOnWorkbenchRequest(slot_id="station_3", tool_id="centrifuge_tube_50ml"),
    )
    experiment = service._require_experiment(experiment_id)
    intermediate = experiment.workbench.slots[2].tool
    tube = experiment.workbench.slots[0].tool
    assert intermediate is not None and tube is not None
    # The canonical produce sync wipes hand-crafted fractions on every command;
    # re-register them so the first aspiration still sees a completed extraction.
    tube.produce_fractions = [
        ProduceFraction(
            id="fraction_1",
            produce_lot_id="lot_1",
            produce_material_state_id="state_1",
            mass_g=10.0,
            location_kind="workbench_tool",
            location_id=tube.id,
            container_id=tube.id,
        )
    ]

    AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=1.0)
    )
    DispensePipetteService(service).run(
        experiment_id, DispensePipetteRequest(target_tool_id=intermediate.id, delta_volume_ml=1.0)
    )
    AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=intermediate.id, delta_volume_ml=0.5)
    )
    updated = DispensePipetteService(service).run(
        experiment_id, DispensePipetteRequest(target_tool_id=vial_id, delta_volume_ml=0.5)
    )

    vial = updated.workbench.slots[1].tool
    assert vial is not None and vial.injection_context is not None
    assert vial.injection_context.source_tube_id == tube_id
    assert vial.injection_context.sample_mass_g > 0


def test_dispense_into_unusable_tool_is_rejected() -> None:
    service, experiment_id, tube_id, _ = _prepared_experiment()
    AddWorkbenchSlotService(service).run(experiment_id, EmptyWorkbenchRequest())
    PlaceToolOnWorkbenchService(service).run(
        experiment_id,
        PlaceToolOnWorkbenchRequest(slot_id="station_3", tool_id="centrifuge_tube_50ml"),
    )
    contaminated = service._require_experiment(experiment_id).workbench.slots[2].tool
    assert contaminated is not None
    contaminated.quechers_state.phase = "contaminated"

    AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.2)
    )

    with pytest.raises(ValueError, match="contaminated"):
        DispensePipetteService(service).run(
            experiment_id, DispensePipetteRequest(target_tool_id=contaminated.id, delta_volume_ml=0.1)
        )


def test_tiny_aspiration_keeps_pipette_state_consistent(tmp_path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "pipette.sqlite3"))
    service, experiment_id, tube_id, _ = _prepared_experiment(
        ExperimentRuntimeService(repository=repository)
    )

    updated = AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.0004)
    )

    assert (updated.pipette.volume_ml > 0) == bool(updated.pipette.liquids)
    assert (updated.pipette.volume_ml > 0) == (updated.pipette.source_tool_id is not None)
    reloaded = ExperimentRuntimeService(repository=repository)._require_experiment(experiment_id)
    assert reloaded.pipette.volume_ml == pytest.approx(updated.pipette.volume_ml)


def test_loaded_pipette_round_trips_through_sqlite(tmp_path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "pipette.sqlite3"))
    service, experiment_id, tube_id, _ = _prepared_experiment(
        ExperimentRuntimeService(repository=repository)
    )
    AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.4)
    )

    reloaded = ExperimentRuntimeService(repository=repository)._require_experiment(experiment_id)

    assert reloaded.pipette.volume_ml == pytest.approx(0.4)
    assert reloaded.pipette.source_tool_id == tube_id
    assert reloaded.pipette.injection_context is not None


def test_loaded_slurry_pipette_round_trips_through_sqlite(tmp_path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "pipette-slurry.sqlite3"))
    service, experiment_id, tube_id, _ = _prepared_experiment(
        ExperimentRuntimeService(repository=repository)
    )
    experiment = service._require_experiment(experiment_id)
    tube = experiment.workbench.slots[0].tool
    assert tube is not None
    tube.liquids = []
    tube.quechers_extraction_result = None
    tube.produce_lots = [
        ProduceLot(id="lot_1", label="Apple", produce_type="apple", total_mass_g=10.0)
    ]
    tube.contents_homogeneity = 1.0

    AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=0.4)
    )
    reloaded = ExperimentRuntimeService(repository=repository)._require_experiment(experiment_id)

    assert reloaded.pipette.volume_ml == pytest.approx(0.4)
    assert sum(fraction.mass_g for fraction in reloaded.pipette.produce_fractions) == pytest.approx(0.4)
