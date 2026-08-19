import math
from pathlib import Path

import pytest

from app.domain.models import ProduceFraction, ProduceMaterialState
from app.services.dnd_move_service import (
    DndMoveObjectRequest,
    DndMoveObjectService,
    DndObjectRef,
)
from app.services.domain_services.centrifuge import StartCentrifugeCycleService
from app.services.domain_services.tool_contents import (
    AddLiquidToToolRequest,
    AddLiquidToToolService,
)
from app.services.domain_services.vortex import (
    EmptyRequest,
    MoveWorkbenchToolToVortexRequest,
    MoveWorkbenchToolToVortexService,
    StartVortexCycleService,
)
from app.services.domain_services.workbench import (
    AddLiquidToWorkbenchToolRequest,
    AddLiquidToWorkbenchToolService,
    CloseWorkbenchToolService,
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
    RemoveLiquidFromWorkbenchToolService,
    WorkbenchLiquidRequest,
    WorkbenchSlotRequest,
)
from app.services.domain_services.workspace import (
    AdvanceWorkspaceCryogenicsRequest,
    AdvanceWorkspaceCryogenicsService,
)
from app.services.experiment_repository import SqliteExperimentRepository
from app.services.experiment_service import ExperimentRuntimeService
from app.services.physical_simulation_service import PhysicalSimulationService


def _place_tube(service: ExperimentRuntimeService, experiment_id: str) -> None:
    PlaceToolOnWorkbenchService(service).run(
        experiment_id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="centrifuge_tube_50ml"),
    )


def _add(
    service: ExperimentRuntimeService,
    experiment_id: str,
    liquid_id: str,
    volume_ml: float | None = None,
) -> None:
    AddLiquidToWorkbenchToolService(service).run(
        experiment_id,
        AddLiquidToWorkbenchToolRequest(
            slot_id="station_1",
            liquid_id=liquid_id,
            volume_ml=volume_ml,
        ),
    )


def _advance(service: ExperimentRuntimeService, experiment_id: str, elapsed_ms: float) -> None:
    while elapsed_ms > 0:
        step_ms = min(elapsed_ms, 5000)
        AdvanceWorkspaceCryogenicsService(service).run(
            experiment_id,
            AdvanceWorkspaceCryogenicsRequest(elapsed_ms=step_ms),
        )
        elapsed_ms -= step_ms


def _tube(service: ExperimentRuntimeService, experiment_id: str):
    tool = service._require_experiment(experiment_id).workbench.slots[0].tool
    assert tool is not None
    return tool


def _centrifuged_tube(service: ExperimentRuntimeService, experiment_id: str):
    widget = next(widget for widget in service._require_experiment(experiment_id).workspace.widgets if widget.id == "centrifuge")
    assert widget.tool is not None
    return widget.tool


def _vortex_tool(service: ExperimentRuntimeService, experiment_id: str):
    widget = next(widget for widget in service._require_experiment(experiment_id).workspace.widgets if widget.id == "vortex")
    assert widget.tool is not None
    return widget.tool


def test_salts_added_to_wet_tube_start_exothermic_reaction_and_cementation() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)

    _add(service, experiment.id, "quechers_salts")
    _advance(service, experiment.id, 7500)

    state = _tube(service, experiment.id).quechers_state
    assert state.salts_added is True
    assert state.phase == "reacting"
    assert state.temperature_c == pytest.approx(
        PhysicalSimulationService.ambient_temperature_c + PhysicalSimulationService.quechers_exotherm_delta_c,
        abs=0.01,
    )
    assert state.cementation_progress == pytest.approx(0.5, abs=0.001)
    assert state.thermal_degradation_progress > 0


@pytest.mark.parametrize(
    "tool_id",
    ("centrifuge_tube_50ml", "sample_vial_lcms"),
)
def test_salts_can_be_added_to_every_open_liquid_container(tool_id: str) -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id=tool_id),
    )

    _add(service, experiment.id, "quechers_salts")

    state = _tube(service, experiment.id).quechers_state
    assert state.salts_added is True
    assert state.phase == "armed"


def test_salts_can_be_added_to_a_wet_tube_on_the_vortex() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    MoveWorkbenchToolToVortexService(service).run(
        experiment.id,
        MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"),
    )

    vortex_tool = _vortex_tool(service, experiment.id)
    AddLiquidToToolService(service).run(
        experiment.id,
        AddLiquidToToolRequest(
            tool_id=vortex_tool.id,
            liquid_id="quechers_salts",
            volume_ml=1,
        ),
    )

    state = _vortex_tool(service, experiment.id).quechers_state
    assert state.salts_added is True
    assert state.phase == "reacting"


def test_unmixed_salted_tube_cements_after_fifteen_seconds() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _add(service, experiment.id, "quechers_salts")

    _advance(service, experiment.id, 15000)

    state = _tube(service, experiment.id).quechers_state
    assert state.phase == "cemented"
    assert state.cementation_progress == pytest.approx(1.0)
    assert state.is_usable is False


def test_full_cementation_generates_extraction_result() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _add(service, experiment.id, "quechers_salts")

    _advance(service, experiment.id, 15000)

    assert _tube(service, experiment.id).quechers_extraction_result is not None


def test_starting_vortex_in_time_stops_cementation_and_cycle_marks_mixed() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _add(service, experiment.id, "quechers_salts")
    _advance(service, experiment.id, 10000)
    CloseWorkbenchToolService(service).run(experiment.id, WorkbenchSlotRequest(slot_id="station_1"))
    MoveWorkbenchToolToVortexService(service).run(
        experiment.id,
        MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"),
    )

    StartVortexCycleService(service).run(experiment.id, EmptyRequest())
    progress_at_start = _vortex_tool(service, experiment.id).quechers_state.cementation_progress
    _advance(service, experiment.id, 3000)

    state = _vortex_tool(service, experiment.id).quechers_state
    assert state.phase == "mixed"
    assert state.cementation_progress == pytest.approx(progress_at_start)
    assert state.is_usable is True
    assert _vortex_tool(service, experiment.id).quechers_extraction_result is not None


def test_vortex_builds_hidden_container_homogeneity_progressively() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _add(service, experiment.id, "quechers_salts")
    CloseWorkbenchToolService(service).run(
        experiment.id,
        WorkbenchSlotRequest(slot_id="station_1"),
    )
    MoveWorkbenchToolToVortexService(service).run(
        experiment.id,
        MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"),
    )

    StartVortexCycleService(service).run(experiment.id, EmptyRequest())
    _advance(service, experiment.id, 1000)

    expected_after_one_second = 1.0 - math.exp(-1.0 / 1.25)
    assert _vortex_tool(service, experiment.id).contents_homogeneity == pytest.approx(
        expected_after_one_second,
        abs=0.001,
    )

    _advance(service, experiment.id, 2000)
    assert _vortex_tool(service, experiment.id).contents_homogeneity == pytest.approx(
        1.0 - math.exp(-3.0 / 1.25),
        abs=0.001,
    )


def test_vortexing_open_tube_with_wet_contents_contaminates_tool() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    MoveWorkbenchToolToVortexService(service).run(
        experiment.id,
        MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"),
    )

    StartVortexCycleService(service).run(experiment.id, EmptyRequest())

    state = _vortex_tool(service, experiment.id).quechers_state
    assert state.phase == "contaminated"
    assert state.faults == ["vortexed_open", "vortexed_without_salts"]
    assert state.is_usable is False

    _advance(service, experiment.id, 3000)
    assert all(not fraction.is_mixed for fraction in _vortex_tool(service, experiment.id).produce_fractions)
    with pytest.raises(ValueError, match="contaminated"):
        StartVortexCycleService(service).run(experiment.id, EmptyRequest())


def test_vortexing_open_tube_without_salts_records_both_faults() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    MoveWorkbenchToolToVortexService(service).run(
        experiment.id,
        MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"),
    )

    StartVortexCycleService(service).run(experiment.id, EmptyRequest())

    state = _vortex_tool(service, experiment.id).quechers_state
    assert state.phase == "contaminated"
    assert state.faults == ["vortexed_open", "vortexed_without_salts"]
    assert state.is_usable is False


def test_vortexing_sealed_tube_without_salts_contaminates_tool() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    CloseWorkbenchToolService(service).run(experiment.id, WorkbenchSlotRequest(slot_id="station_1"))
    MoveWorkbenchToolToVortexService(service).run(
        experiment.id,
        MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"),
    )

    StartVortexCycleService(service).run(experiment.id, EmptyRequest())

    state = _vortex_tool(service, experiment.id).quechers_state
    assert state.phase == "contaminated"
    assert state.faults == ["vortexed_without_salts"]
    assert state.is_usable is False


def test_salts_added_dry_arm_then_instantly_cement_when_liquid_arrives() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "quechers_salts")

    armed = _tube(service, experiment.id).quechers_state
    assert armed.phase == "armed"
    assert armed.cementation_progress == 0

    _add(service, experiment.id, "acetonitrile_extraction", 10)

    state = _tube(service, experiment.id).quechers_state
    assert state.phase == "cemented"
    assert state.faults == ["dry_salts_wetted"]
    assert state.cementation_progress == 1
    assert state.is_usable is False

    with pytest.raises(ValueError, match="contaminated"):
        _add(service, experiment.id, "ultrapure_water_rinse", 1)


def test_cemented_tool_rejects_liquid_removal() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    liquid_entry_id = _tube(service, experiment.id).liquids[0].id
    _add(service, experiment.id, "quechers_salts")
    _advance(service, experiment.id, 15000)

    with pytest.raises(ValueError, match="contaminated"):
        RemoveLiquidFromWorkbenchToolService(service).run(
            experiment.id,
            WorkbenchLiquidRequest(slot_id="station_1", liquid_entry_id=liquid_entry_id),
        )


def test_quechers_state_round_trips_through_sqlite(tmp_path: Path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
    first_service = ExperimentRuntimeService(repository=repository)
    experiment = first_service.create_experiment()
    _place_tube(first_service, experiment.id)
    _add(first_service, experiment.id, "acetonitrile_extraction", 10)
    _add(first_service, experiment.id, "quechers_salts")
    _advance(first_service, experiment.id, 5000)

    second_service = ExperimentRuntimeService(repository=repository)
    state = _tube(second_service, experiment.id).quechers_state

    assert state.salts_added is True
    assert state.phase == "reacting"
    assert state.temperature_c > 20
    assert state.cementation_progress > 0


def test_hidden_container_homogeneity_round_trips_through_sqlite(tmp_path: Path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "homogeneity.sqlite3"))
    first_service = ExperimentRuntimeService(repository=repository)
    experiment = first_service.create_experiment()
    _place_tube(first_service, experiment.id)
    _add(first_service, experiment.id, "acetonitrile_extraction", 10)
    _add(first_service, experiment.id, "quechers_salts")
    CloseWorkbenchToolService(first_service).run(
        experiment.id,
        WorkbenchSlotRequest(slot_id="station_1"),
    )
    MoveWorkbenchToolToVortexService(first_service).run(
        experiment.id,
        MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"),
    )
    StartVortexCycleService(first_service).run(experiment.id, EmptyRequest())
    _advance(first_service, experiment.id, 1000)
    expected = _vortex_tool(first_service, experiment.id).contents_homogeneity

    second_service = ExperimentRuntimeService(repository=repository)

    assert _vortex_tool(second_service, experiment.id).contents_homogeneity == expected


def test_cemented_tube_can_still_be_discarded_from_the_vortex() -> None:
    """The tutorial recovers from cementation by having the learner throw the tube
    away, so the ruined tube has to remain movable even though every operation that
    would advance the extraction is refused."""
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _add(service, experiment.id, "quechers_salts")
    CloseWorkbenchToolService(service).run(experiment.id, WorkbenchSlotRequest(slot_id="station_1"))
    MoveWorkbenchToolToVortexService(service).run(
        experiment.id,
        MoveWorkbenchToolToVortexRequest(source_slot_id="station_1"),
    )
    _advance(service, experiment.id, 15000)

    tube = _vortex_tool(service, experiment.id)
    assert tube.quechers_state.phase == "cemented"
    with pytest.raises(ValueError, match="cannot be vortexed"):
        StartVortexCycleService(service).run(experiment.id, EmptyRequest())

    DndMoveObjectService(service).run(
        experiment.id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="tool", id=tube.id),
            source=DndObjectRef(kind="vortex", id="vortex"),
            destination=DndObjectRef(kind="trash_bin", id="trash_bin"),
        ),
    )

    reloaded = service._require_experiment(experiment.id)
    vortex = next(widget for widget in reloaded.workspace.widgets if widget.id == "vortex")
    assert vortex.tool is None
    assert [tool.id for tool in reloaded.trash.children] == [tube.id]


def _tube_with_produce_at(
    service: ExperimentRuntimeService,
    experiment_id: str,
    temperature_c: float,
) -> None:
    """Put a weighed portion of powder at a chosen temperature into the tube."""
    experiment = service._require_experiment(experiment_id)
    tube = experiment.workbench.slots[0].tool
    assert tube is not None
    experiment.produce_material_states.append(
        ProduceMaterialState(
            id="state_portion",
            produce_lot_id="lot_apples",
            material_state="slurry",
            temperature_c=temperature_c,
            pesticide_degradation_factors={"captan": 1.0, "boscalid": 1.0},
        )
    )
    tube.produce_fractions.append(
        ProduceFraction(
            id="fraction_portion",
            produce_lot_id="lot_apples",
            produce_material_state_id="state_portion",
            temperature_c=temperature_c,
            mass_g=10.0,
            location_kind="workbench_tool",
            location_id=tube.id,
            container_id=tube.id,
        )
    )


def test_exotherm_starts_from_the_temperature_of_what_is_in_the_tube() -> None:
    # The salts release a fixed amount of heat, so the peak is set by where the
    # mixture started. Powder taken straight from the cryomill lands the whole
    # exotherm far below where bench-temperature powder would.
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _tube_with_produce_at(service, experiment.id, -66.0)

    _add(service, experiment.id, "quechers_salts")
    _advance(service, experiment.id, 7500)

    state = _tube(service, experiment.id).quechers_state
    assert state.start_temperature_c < 0.0
    assert state.temperature_c == pytest.approx(
        state.start_temperature_c + PhysicalSimulationService.quechers_exotherm_delta_c,
        abs=0.01,
    )
    assert state.temperature_c < PhysicalSimulationService.quechers_degradation_threshold_c


def test_cold_powder_spares_the_thermolabile_residues() -> None:
    # The payoff of weighing promptly after the cryomill: the exotherm never
    # crosses the degradation threshold, so nothing is lost.
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _tube_with_produce_at(service, experiment.id, -66.0)

    _add(service, experiment.id, "quechers_salts")
    _advance(service, experiment.id, 60000)

    portion = next(state for state in service._require_experiment(experiment.id).produce_material_states if state.id == "state_portion")
    assert portion.pesticide_degradation_factors["captan"] == pytest.approx(1.0)
    assert _tube(service, experiment.id).quechers_state.thermal_degradation_progress == 0.0


def test_powder_left_to_warm_loses_the_thermolabile_residues() -> None:
    # Same tube, same gestures, powder that sat on the bench until it reached the
    # room: the exotherm now peaks at 65 C and the labile compounds pay for it.
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _tube_with_produce_at(service, experiment.id, 20.0)

    _add(service, experiment.id, "quechers_salts")
    _advance(service, experiment.id, 60000)

    portion = next(state for state in service._require_experiment(experiment.id).produce_material_states if state.id == "state_portion")
    assert portion.pesticide_degradation_factors["captan"] < 0.7
    # Captan is far more labile than boscalid, so the loss must not be uniform:
    # that difference is the whole lesson.
    assert portion.pesticide_degradation_factors["captan"] < portion.pesticide_degradation_factors["boscalid"]


def test_a_cold_tube_still_relaxes_towards_the_room() -> None:
    # The tube exchanges heat with the bench, so it settles at room temperature
    # once the reaction is spent -- not back down to where it started.
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _tube_with_produce_at(service, experiment.id, -66.0)

    _add(service, experiment.id, "quechers_salts")
    _advance(service, experiment.id, 600000)

    state = _tube(service, experiment.id).quechers_state
    assert state.temperature_c == pytest.approx(PhysicalSimulationService.ambient_temperature_c, abs=0.5)


def test_an_idle_tube_reports_the_temperature_of_what_it_holds() -> None:
    # The tube is what the player watches while deciding whether to weigh now or
    # let the powder sit. Reporting a flat 20 C until the salts go in hides the
    # only variable that decides how high the exotherm climbs.
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _tube_with_produce_at(service, experiment.id, -66.0)

    _advance(service, experiment.id, 1000)

    state = _tube(service, experiment.id).quechers_state
    assert state.temperature_c < 0.0


def test_an_empty_tube_reports_the_room() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)

    _advance(service, experiment.id, 1000)

    state = _tube(service, experiment.id).quechers_state
    assert state.temperature_c == pytest.approx(PhysicalSimulationService.ambient_temperature_c)


def test_separating_the_phases_stops_the_thermal_degradation() -> None:
    # Spinning the tube pulls the residues into the acetonitrile, away from the
    # aqueous phase where the heat does its damage. The tube stays hot -- what
    # protects the residues is the phase transfer, not a drop in temperature.
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _tube_with_produce_at(service, experiment.id, 20.0)
    _add(service, experiment.id, "quechers_salts")
    _advance(service, experiment.id, 5000)

    tube = _tube(service, experiment.id)
    tube.is_sealed = True
    DndMoveObjectService(service).run(
        experiment.id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="tool", id=tube.id),
            source=DndObjectRef(kind="workbench", id="station_1"),
            destination=DndObjectRef(kind="centrifuge", id="centrifuge"),
        ),
    )
    StartCentrifugeCycleService(service).run(experiment.id, EmptyRequest())
    _advance(service, experiment.id, 10000)

    portion = next(state for state in service._require_experiment(experiment.id).produce_material_states if state.id == "state_portion")
    assert _centrifuged_tube(service, experiment.id).quechers_state.phase == "separated"
    captan_at_separation = portion.pesticide_degradation_factors["captan"]
    assert captan_at_separation < 1.0

    _advance(service, experiment.id, 5000)

    # The tube has not had time to cool below the threshold, so anything still
    # degrading would show up here.
    assert _centrifuged_tube(service, experiment.id).quechers_state.temperature_c > PhysicalSimulationService.pesticide_degradation_threshold_c
    assert portion.pesticide_degradation_factors["captan"] == pytest.approx(captan_at_separation)


def _portion(service: ExperimentRuntimeService, experiment_id: str) -> ProduceMaterialState:
    tube = _tube(service, experiment_id)
    fraction = tube.produce_fractions[0]
    return next(
        state for state in service._require_experiment(experiment_id).produce_material_states if state.id == fraction.produce_material_state_id
    )


def _portion_fraction(service: ExperimentRuntimeService, experiment_id: str):
    """The body of powder itself, which is what owns a temperature."""
    return _tube(service, experiment_id).produce_fractions[0]


def test_a_weighed_portion_exchanges_heat_with_the_bench() -> None:
    # A test portion is ten grams of powder in a plastic tube -- it warms towards
    # the room exactly as the jar it was scooped from does. Freezing it at the
    # temperature it was weighed at would let a player weigh cold and then take
    # the rest of the run at their leisure.
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _tube_with_produce_at(service, experiment.id, -60.0)

    _advance(service, experiment.id, 60000)

    portion = _portion_fraction(service, experiment.id)
    assert portion.temperature_c > -30.0
    assert portion.temperature_c < PhysicalSimulationService.ambient_temperature_c


def test_a_portion_left_long_enough_settles_at_room_temperature() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _tube_with_produce_at(service, experiment.id, -60.0)

    _advance(service, experiment.id, 600000)

    portion = _portion_fraction(service, experiment.id)
    assert portion.temperature_c == pytest.approx(PhysicalSimulationService.ambient_temperature_c, abs=0.5)


def test_a_portion_that_warmed_keeps_the_degradation_already_booked() -> None:
    # Warming remints the material state, since temperature is part of its
    # signature. The residues it already lost must survive that.
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _place_tube(service, experiment.id)
    _add(service, experiment.id, "acetonitrile_extraction", 10)
    _tube_with_produce_at(service, experiment.id, 20.0)
    _add(service, experiment.id, "quechers_salts")
    _advance(service, experiment.id, 20000)

    captan = _portion(service, experiment.id).pesticide_degradation_factors["captan"]
    assert 0.0 < captan < 1.0
