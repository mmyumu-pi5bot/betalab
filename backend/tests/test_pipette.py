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
from app.services.physical_simulation_service import PhysicalSimulationService


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
    tube.quechers_state.phase = "separated"
    tube.quechers_state.separation_progress = 1.0
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


def test_pipette_aspirates_turbid_extract_before_centrifugation() -> None:
    # Removing the hard block: an un-centrifuged tube is a turbid suspension that
    # can still be pipetted "as-is" — you draw up matrix solids along with the
    # solvent instead of a clean supernatant.
    service, experiment_id, tube_id, _ = _prepared_experiment()
    tube = service._require_experiment(experiment_id).workbench.slots[0].tool
    assert tube is not None
    tube.quechers_state.phase = "mixed"
    tube.quechers_state.separation_progress = 0.0
    tube.produce_lots = [
        ProduceLot(id="lot_1", label="Apple", produce_type="apple", total_mass_g=10.0)
    ]
    tube.contents_homogeneity = 1.0

    updated = AspiratePipetteService(service).run(
        experiment_id,
        AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=1.0),
    )

    assert sum(liquid.volume_ml for liquid in updated.pipette.liquids) == pytest.approx(0.5)
    assert sum(
        fraction.mass_g for fraction in updated.pipette.produce_fractions
    ) == pytest.approx(0.5)


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
    tube.quechers_state.phase = "mixed"
    tube.produce_lots = [
        ProduceLot(id="lot_1", label="Apple", produce_type="apple", total_mass_g=10.0)
    ]
    tube.contents_homogeneity = 1.0

    updated = AspiratePipetteService(service).run(
        experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=1.0)
    )

    assert sum(liquid.volume_ml for liquid in updated.pipette.liquids) == pytest.approx(0.5)
    assert sum(fraction.mass_g for fraction in updated.pipette.produce_fractions) == pytest.approx(0.5)


def test_separated_extract_aspirates_supernatant_only_leaving_pellet() -> None:
    # After centrifugation the matrix solids form a pellet at the bottom; a
    # supernatant aspiration draws only the acetonitrile extract and leaves the
    # pellet behind. The analyte-equivalent sample mass is still derived from the
    # pellet-mass / extract-volume ratio, not from carrying solids across.
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

    assert sum(liquid.volume_ml for liquid in updated.pipette.liquids) == pytest.approx(1.0)
    assert updated.pipette.produce_fractions == []
    source = updated.workbench.slots[0].tool
    assert source is not None
    assert sum(fraction.mass_g for fraction in source.produce_fractions) == pytest.approx(10.0)
    assert updated.pipette.injection_context is not None
    assert updated.pipette.injection_context.sample_mass_g == pytest.approx(1.0)


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


def test_pipette_keeps_visible_theoretical_and_hidden_actual_liquid_compositions(
    monkeypatch,
) -> None:
    service, experiment_id, tube_id, vial_id = _prepared_experiment()
    tube = service._require_experiment(experiment_id).workbench.slots[0].tool
    assert tube is not None
    tube.produce_fractions = []
    tube.liquids[0].true_volume_ml = 9.0
    tube.liquids.append(
        WorkbenchLiquid(
            id="liquid_2",
            liquid_id="istd_solution",
            name="ISTD",
            volume_ml=5.0,
            true_volume_ml=6.0,
            accent="emerald",
        )
    )
    tube.contents_homogeneity = 1.0
    monkeypatch.setattr(
        PhysicalSimulationService,
        "draw_dispensed_volume",
        staticmethod(lambda nominal_ml: nominal_ml * 0.9),
    )

    updated = AspiratePipetteService(service).run(
        experiment_id,
        AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=1.0),
    )

    assert [liquid.volume_ml for liquid in updated.pipette.liquids] == pytest.approx(
        [2.0 / 3.0, 1.0 / 3.0],
        abs=1e-6,
    )
    runtime = service._require_experiment(experiment_id)
    assert runtime.pipette.true_volume_ml == pytest.approx(0.9)
    assert updated.pipette.true_volume_ml == pytest.approx(0.9)
    assert "true_volume_ml" not in updated.pipette.model_dump()
    assert [liquid.true_volume_ml for liquid in updated.pipette.liquids] == pytest.approx(
        [0.54, 0.36],
        abs=1e-6,
    )
    assert all(
        "true_volume_ml" not in liquid
        for liquid in updated.pipette.model_dump()["liquids"]
    )
    assert [liquid.true_volume_ml for liquid in runtime.pipette.liquids] == pytest.approx(
        [0.54, 0.36],
        abs=1e-6,
    )
    assert [liquid.volume_ml for liquid in tube.liquids] == pytest.approx(
        [10.0 - 2.0 / 3.0, 5.0 - 1.0 / 3.0],
        abs=1e-6,
    )
    assert [liquid.true_volume_ml for liquid in tube.liquids] == pytest.approx(
        [8.46, 5.64],
        abs=1e-6,
    )

    dispensed = DispensePipetteService(service).run(
        experiment_id,
        DispensePipetteRequest(target_tool_id=vial_id, delta_volume_ml=1.0),
    )

    vial = dispensed.workbench.slots[1].tool
    assert vial is not None
    assert [liquid.volume_ml for liquid in vial.liquids] == pytest.approx(
        [2.0 / 3.0, 1.0 / 3.0],
        abs=1e-6,
    )
    runtime_vial = service._require_experiment(experiment_id).workbench.slots[1].tool
    assert runtime_vial is not None
    assert [liquid.true_volume_ml for liquid in runtime_vial.liquids] == pytest.approx(
        [0.54, 0.36],
        abs=1e-6,
    )


def test_unmixed_tube_hides_heterogeneous_liquid_composition_from_visible_values(
    monkeypatch,
) -> None:
    service, experiment_id, tube_id, _ = _prepared_experiment()
    tube = service._require_experiment(experiment_id).workbench.slots[0].tool
    assert tube is not None
    tube.produce_fractions = []
    tube.contents_homogeneity = 0.0
    tube.liquids.append(WorkbenchLiquid(id="liquid_2", liquid_id="istd_solution", name="ISTD", volume_ml=10.0, accent="emerald"))
    monkeypatch.setattr(
        PhysicalSimulationService,
        "draw_dispensed_volume",
        staticmethod(lambda nominal_ml: nominal_ml),
    )
    random.seed(7)

    updated = AspiratePipetteService(service).run(experiment_id, AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=1.0))

    volumes = [liquid.volume_ml for liquid in updated.pipette.liquids]
    assert sum(volumes) == pytest.approx(1.0)
    assert volumes == pytest.approx([0.5, 0.5])
    runtime = service._require_experiment(experiment_id)
    true_volumes = [liquid.true_volume_ml for liquid in runtime.pipette.liquids]
    assert sum(volume or 0.0 for volume in true_volumes) == pytest.approx(1.0)
    assert true_volumes[0] != pytest.approx(0.5)


def test_partially_mixed_tube_has_less_hidden_sampling_bias_than_unmixed_tube(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        PhysicalSimulationService,
        "draw_dispensed_volume",
        staticmethod(lambda nominal_ml: nominal_ml),
    )

    def sampling_deviation(homogeneity: float) -> float:
        service, experiment_id, tube_id, _ = _prepared_experiment()
        tube = service._require_experiment(experiment_id).workbench.slots[0].tool
        assert tube is not None
        tube.produce_fractions = []
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
        assert [liquid.volume_ml for liquid in updated.pipette.liquids] == pytest.approx(
            [0.25, 0.25]
        )
        runtime = service._require_experiment(experiment_id)
        return abs((runtime.pipette.liquids[0].true_volume_ml or 0.0) - 0.25)

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


def test_dispense_tracks_hidden_true_volume_on_both_sides(monkeypatch) -> None:
    service, experiment_id, tube_id, vial_id = _prepared_experiment()
    tube = service._require_experiment(experiment_id).workbench.slots[0].tool
    assert tube is not None
    tube.liquids[0].true_volume_ml = 9.0
    monkeypatch.setattr(
        PhysicalSimulationService,
        "draw_dispensed_volume",
        staticmethod(lambda nominal_ml: nominal_ml * 0.9),
    )

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


def test_dispense_moves_theoretical_and_actual_slurry_ledgers_independently(
    monkeypatch,
) -> None:
    service, experiment_id, tube_id, vial_id = _prepared_experiment()
    experiment = service._require_experiment(experiment_id)
    tube = experiment.workbench.slots[0].tool
    assert tube is not None
    tube.produce_lots = [
        ProduceLot(id="lot_1", label="Apple", produce_type="apple", total_mass_g=10.0)
    ]
    tube.quechers_state.phase = "mixed"
    tube.produce_fractions[0].true_mass_g = 12.0
    tube.liquids[0].true_volume_ml = 8.0
    tube.contents_homogeneity = 0.0
    monkeypatch.setattr(
        PhysicalSimulationService,
        "draw_dispensed_volume",
        staticmethod(lambda nominal_ml: nominal_ml * 0.9),
    )
    random.seed(7)

    aspirated = AspiratePipetteService(service).run(
        experiment_id,
        AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=1.0),
    )

    assert sum(liquid.volume_ml for liquid in aspirated.pipette.liquids) == pytest.approx(0.5)
    assert sum(fraction.mass_g for fraction in aspirated.pipette.produce_fractions) == pytest.approx(0.5)
    runtime = service._require_experiment(experiment_id)
    true_liquid_ml = sum(liquid.true_volume_ml or 0.0 for liquid in runtime.pipette.liquids)
    true_slurry_g = sum(
        fraction.true_mass_g or 0.0 for fraction in runtime.pipette.produce_fractions
    )
    assert runtime.pipette.true_volume_ml == pytest.approx(0.9)
    assert true_liquid_ml + true_slurry_g == pytest.approx(0.9)
    assert true_liquid_ml != pytest.approx(0.45)
    assert runtime.pipette.injection_context is not None
    assert runtime.pipette.injection_context.sample_mass_g == pytest.approx(0.5)
    assert runtime.pipette.injection_context.sample_true_mass_g == pytest.approx(
        true_slurry_g
    )
    assert aspirated.pipette.injection_context is not None
    assert [fraction.true_mass_g for fraction in aspirated.pipette.produce_fractions] == pytest.approx(
        [true_slurry_g]
    )
    assert all(
        "true_mass_g" not in fraction
        for fraction in aspirated.pipette.model_dump()["produce_fractions"]
    )
    assert (
        "sample_true_mass_g"
        not in aspirated.pipette.injection_context.model_dump()
    )

    dispensed = DispensePipetteService(service).run(
        experiment_id,
        DispensePipetteRequest(target_tool_id=vial_id, delta_volume_ml=1.0),
    )

    vial = dispensed.workbench.slots[1].tool
    assert vial is not None
    assert sum(liquid.volume_ml for liquid in vial.liquids) == pytest.approx(0.5)
    assert sum(fraction.mass_g for fraction in vial.produce_fractions) == pytest.approx(0.5)
    runtime_vial = service._require_experiment(experiment_id).workbench.slots[1].tool
    assert runtime_vial is not None
    assert sum(liquid.true_volume_ml or 0.0 for liquid in runtime_vial.liquids) == pytest.approx(
        true_liquid_ml
    )
    assert sum(
        fraction.true_mass_g or 0.0 for fraction in runtime_vial.produce_fractions
    ) == pytest.approx(true_slurry_g)


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
    before_reload = service._require_experiment(experiment_id).pipette
    expected_true_volume_ml = before_reload.true_volume_ml
    expected_liquid_true_volumes = [
        liquid.true_volume_ml for liquid in before_reload.liquids
    ]

    reloaded = ExperimentRuntimeService(repository=repository)._require_experiment(experiment_id)

    assert reloaded.pipette.volume_ml == pytest.approx(0.4)
    assert reloaded.pipette.true_volume_ml == expected_true_volume_ml
    assert [
        liquid.true_volume_ml for liquid in reloaded.pipette.liquids
    ] == expected_liquid_true_volumes
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
    assert sum(
        fraction.true_mass_g or 0.0 for fraction in reloaded.pipette.produce_fractions
    ) > 0
