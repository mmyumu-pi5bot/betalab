"""The weighed powder's residues must survive the whole way to the injection.

A test portion is scooped out of a storage jar with the spatula: the tube
receives a ProduceFraction, while the ProduceLot that carries the residue
concentrations stays behind in the jar. Every lookup between the balance and
the injection has to follow that reference, otherwise the sample chromatogram
comes out as a blank while the calibration point looks perfect.
"""
from __future__ import annotations

import pytest

from app.domain.models import (
    ProduceFraction,
    ProduceLot,
    ProduceMaterialState,
    QuechersExtractionResult,
    WorkbenchLiquid,
)
from app.services.domain_services.lcmsms import build_extract_injection_context
from app.services.domain_services.workbench import (
    AddLiquidToWorkbenchToolRequest,
    AddLiquidToWorkbenchToolService,
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
)
from app.services.experiment_service import ExperimentRuntimeService
from app.services.helpers.produce_canonical import sync_canonical_produce_model
from app.services.physical_simulation_service import PhysicalSimulationService

LOT_ID = "lot_apples"
RESIDUES = {"boscalid": 480.0, "captan": 640.0}


def _jar_and_tube() -> tuple[ExperimentRuntimeService, str]:
    """A storage jar holding the bulk lot, and a tube holding a weighed portion."""
    service = ExperimentRuntimeService()
    experiment_id = service.create_experiment().id
    PlaceToolOnWorkbenchService(service).run(
        experiment_id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="centrifuge_tube_50ml"),
    )
    PlaceToolOnWorkbenchService(service).run(
        experiment_id,
        PlaceToolOnWorkbenchRequest(slot_id="station_2", tool_id="hdpe_storage_jar_2l"),
    )
    experiment = service._require_experiment(experiment_id)
    tube = experiment.workbench.slots[0].tool
    jar = experiment.workbench.slots[1].tool
    assert tube is not None and jar is not None

    experiment.produce_material_states = [
        ProduceMaterialState(
            id="state_ground",
            produce_lot_id=LOT_ID,
            material_state="ground",
            homogeneity_score=0.9,
            pesticide_degradation_factors={"boscalid": 1.0, "captan": 0.5},
        )
    ]
    # The lot never leaves the jar — the spatula only ever moves fractions.
    jar.produce_lots = [
        ProduceLot(
            id=LOT_ID,
            label="Orchard apple lot",
            produce_type="apple",
            total_mass_g=4000.0,
            pesticide_residues=dict(RESIDUES),
        )
    ]
    jar.produce_fractions = [
        ProduceFraction(
            id="fraction_jar",
            produce_lot_id=LOT_ID,
            produce_material_state_id="state_ground",
            mass_g=3990.0,
            location_kind="workbench_tool",
            location_id=jar.id,
            container_id=jar.id,
        )
    ]
    tube.produce_fractions = [
        ProduceFraction(
            id="fraction_tube",
            produce_lot_id=LOT_ID,
            produce_material_state_id="state_ground",
            mass_g=10.0,
            location_kind="workbench_tool",
            location_id=tube.id,
            container_id=tube.id,
        )
    ]
    return service, experiment_id


def test_injection_context_reads_residues_from_the_lot_left_in_the_jar() -> None:
    service, experiment_id = _jar_and_tube()
    experiment = service._require_experiment(experiment_id)
    tube = experiment.workbench.slots[0].tool
    assert tube is not None
    tube.quechers_extraction_result = QuechersExtractionResult(
        extraction_manip_factor=1.0, istd_manip_factor=None, istd_phase=None
    )
    tube.liquids = [
        WorkbenchLiquid(
            id="liquid_acn",
            liquid_id="acetonitrile_extraction",
            name="Acetonitrile",
            volume_ml=10.0,
            accent="amber",
        )
    ]

    context = build_extract_injection_context(experiment, tube, 1.0)

    # 480 intact, 640 halved by the degradation factors carried on the state.
    assert context.effective_residues_ug_per_kg == pytest.approx(
        {"boscalid": 480.0, "captan": 320.0}
    )


def test_slurry_conversion_keeps_the_degradation_already_accumulated() -> None:
    # Wetting the test portion clones its material state so the jar's powder can
    # stay "ground". The clone describes the same physical material, so it must
    # inherit the degradation booked against it — not restart from intact.
    service, experiment_id = _jar_and_tube()

    AddLiquidToWorkbenchToolService(service).run(
        experiment_id,
        AddLiquidToWorkbenchToolRequest(
            slot_id="station_1", liquid_id="acetonitrile_extraction", volume_ml=10.0
        ),
    )

    experiment = service._require_experiment(experiment_id)
    tube = experiment.workbench.slots[0].tool
    assert tube is not None
    states = {state.id: state for state in experiment.produce_material_states}
    tube_state = states[tube.produce_fractions[0].produce_material_state_id]

    assert tube_state.material_state == "slurry"
    assert tube_state.pesticide_degradation_factors == {"boscalid": 1.0, "captan": 0.5}


def test_quechers_heat_degrades_the_tube_portion_not_the_jar_stock() -> None:
    # Two states share the lot id once the portion is wetted. The exotherm is in
    # the tube, so it must reach the state the tube's fraction points at and
    # leave the powder still sitting in the jar untouched.
    service, experiment_id = _jar_and_tube()
    experiment = service._require_experiment(experiment_id)
    tube = experiment.workbench.slots[0].tool
    assert tube is not None

    slurry_state = ProduceMaterialState(
        id="state_slurry",
        produce_lot_id=LOT_ID,
        material_state="slurry",
        pesticide_degradation_factors={"boscalid": 1.0, "captan": 0.5},
    )
    experiment.produce_material_states.append(slurry_state)
    tube.produce_fractions[0].produce_material_state_id = slurry_state.id
    tube.quechers_state.temperature_c = 60.0

    PhysicalSimulationService().advance_quechers_pesticide_degradation(
        tube, 120.0, experiment.produce_material_states
    )

    jar_state = experiment.produce_material_states[0]
    assert slurry_state.pesticide_degradation_factors["boscalid"] < 1.0
    assert jar_state.pesticide_degradation_factors["boscalid"] == 1.0


def test_reminting_a_material_state_carries_the_degradation_factors_over() -> None:
    # The canonical resync mints a fresh material state whenever the signature it
    # keys on changes -- and temperature is part of that signature, so the powder
    # simply warming up on the bench is enough to trigger it. The new record has
    # to inherit the degradation factors, otherwise every warming tick quietly
    # resets the residues to intact and the exotherm can never cost anything.
    #
    # It takes more than one state on the lot to bite: the resync resolves the
    # state to copy from by lot id and takes the first match, so once the wetted
    # portion has a state of its own the jar's powder gets rebuilt from a
    # stranger.
    service, experiment_id = _jar_and_tube()
    AddLiquidToWorkbenchToolService(service).run(
        experiment_id,
        AddLiquidToWorkbenchToolRequest(
            slot_id="station_1", liquid_id="acetonitrile_extraction", volume_ml=10.0
        ),
    )
    experiment = service._require_experiment(experiment_id)

    ground_state = next(
        state for state in experiment.produce_material_states if state.material_state == "ground"
    )
    ground_state.temperature_c = 12.34
    sync_canonical_produce_model(experiment)

    reminted = next(
        state for state in experiment.produce_material_states if state.material_state == "ground"
    )
    assert reminted.pesticide_degradation_factors == {"boscalid": 1.0, "captan": 0.5}
