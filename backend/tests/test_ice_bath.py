import pytest

from app.domain.models import ProduceFraction, ProduceMaterialState
from app.services.dnd_move_service import (
    DndMoveObjectRequest,
    DndMoveObjectService,
    DndObjectRef,
)
from app.services.domain_services.workbench import (
    AddLiquidToWorkbenchToolRequest,
    AddLiquidToWorkbenchToolService,
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
)
from app.services.domain_services.workspace import (
    AdvanceWorkspaceCryogenicsRequest,
    AdvanceWorkspaceCryogenicsService,
)
from app.services.experiment_service import ExperimentRuntimeService
from app.services.physical_simulation_service import PhysicalSimulationService


def _advance(service: ExperimentRuntimeService, experiment_id: str, elapsed_ms: float) -> None:
    while elapsed_ms > 0:
        step_ms = min(elapsed_ms, 5000)
        AdvanceWorkspaceCryogenicsService(service).run(
            experiment_id,
            AdvanceWorkspaceCryogenicsRequest(elapsed_ms=step_ms),
        )
        elapsed_ms -= step_ms


def _tube_with_portion(
    service: ExperimentRuntimeService,
    experiment_id: str,
    portion_temperature_c: float,
) -> None:
    PlaceToolOnWorkbenchService(service).run(
        experiment_id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="centrifuge_tube_50ml"),
    )
    AddLiquidToWorkbenchToolService(service).run(
        experiment_id,
        AddLiquidToWorkbenchToolRequest(
            slot_id="station_1",
            liquid_id="acetonitrile_extraction",
            volume_ml=10,
        ),
    )
    experiment = service._require_experiment(experiment_id)
    tube = experiment.workbench.slots[0].tool
    assert tube is not None
    experiment.produce_material_states.append(
        ProduceMaterialState(
            id="state_portion",
            produce_lot_id="lot_apples",
            material_state="slurry",
            temperature_c=portion_temperature_c,
            pesticide_degradation_factors={"captan": 1.0, "boscalid": 1.0},
        )
    )
    tube.produce_fractions.append(
        ProduceFraction(
            id="fraction_portion",
            produce_lot_id="lot_apples",
            produce_material_state_id="state_portion",
            mass_g=10.0,
            location_kind="workbench_tool",
            location_id=tube.id,
            container_id=tube.id,
        )
    )


def _move_tube_to_ice_bath(service: ExperimentRuntimeService, experiment_id: str) -> None:
    tube = service._require_experiment(experiment_id).workbench.slots[0].tool
    assert tube is not None
    DndMoveObjectService(service).run(
        experiment_id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="tool", id=tube.id),
            source=DndObjectRef(kind="workbench", id="station_1"),
            destination=DndObjectRef(kind="ice_bath", id="ice_bath"),
        ),
    )


def _chilled_tube(service: ExperimentRuntimeService, experiment_id: str):
    widget = next(
        widget
        for widget in service._require_experiment(experiment_id).workspace.widgets
        if widget.id == "ice_bath"
    )
    assert widget.tool is not None
    return widget.tool


def _portion(service: ExperimentRuntimeService, experiment_id: str) -> ProduceMaterialState:
    tube = _chilled_tube(service, experiment_id)
    fraction = tube.produce_fractions[0]
    return next(
        state
        for state in service._require_experiment(experiment_id).produce_material_states
        if state.id == fraction.produce_material_state_id
    )


def test_a_tube_can_be_dragged_into_the_ice_bath_and_back_out() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _tube_with_portion(service, experiment.id, 20.0)

    _move_tube_to_ice_bath(service, experiment.id)
    tube_id = _chilled_tube(service, experiment.id).id

    DndMoveObjectService(service).run(
        experiment.id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="tool", id=tube_id),
            source=DndObjectRef(kind="ice_bath", id="ice_bath"),
            destination=DndObjectRef(kind="workbench_slot", id="station_1"),
        ),
    )

    widget = next(
        widget
        for widget in service._require_experiment(experiment.id).workspace.widgets
        if widget.id == "ice_bath"
    )
    assert widget.tool is None
    assert service._require_experiment(experiment.id).workbench.slots[0].tool is not None


def test_the_ice_bath_only_takes_centrifuge_tubes() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="sample_vial_lcms"),
    )
    vial = service._require_experiment(experiment.id).workbench.slots[0].tool
    assert vial is not None

    with pytest.raises(ValueError):
        DndMoveObjectService(service).run(
            experiment.id,
            DndMoveObjectRequest(
                entity=DndObjectRef(kind="tool", id=vial.id),
                source=DndObjectRef(kind="workbench", id="station_1"),
                destination=DndObjectRef(kind="ice_bath", id="ice_bath"),
            ),
        )


def test_the_bath_chills_a_warm_portion_towards_zero() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _tube_with_portion(service, experiment.id, 20.0)

    _move_tube_to_ice_bath(service, experiment.id)
    _advance(service, experiment.id, 60000)

    portion = _portion(service, experiment.id)
    assert portion.temperature_c == pytest.approx(
        PhysicalSimulationService.ice_bath_temperature_c, abs=1.0
    )


def test_a_chilled_tube_keeps_the_exotherm_under_the_damage_threshold() -> None:
    # The whole point of the bath: the salts still release the same heat, but a
    # mixture starting near zero lands well under the temperature that breaks
    # thermolabile residues down.
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _tube_with_portion(service, experiment.id, 20.0)
    _move_tube_to_ice_bath(service, experiment.id)
    _advance(service, experiment.id, 60000)

    tube = _chilled_tube(service, experiment.id)
    from app.services.domain_services.tool_contents import (
        AddLiquidToToolRequest,
        AddLiquidToToolService,
    )

    AddLiquidToToolService(service).run(
        experiment.id,
        AddLiquidToToolRequest(tool_id=tube.id, liquid_id="quechers_salts", volume_ml=1),
    )
    _advance(service, experiment.id, 30000)

    state = _chilled_tube(service, experiment.id).quechers_state
    peak = state.start_temperature_c + PhysicalSimulationService.quechers_exotherm_delta_c
    assert peak < PhysicalSimulationService.pesticide_degradation_threshold_c
    assert _portion(service, experiment.id).pesticide_degradation_factors["captan"] == 1.0


def test_moving_a_hot_reacting_tube_into_the_bath_stops_the_losses() -> None:
    # The recovery for a player who let the powder reach the room: the exotherm
    # has already started, and dunking the tube pulls it back under the threshold
    # instead of leaving it to cool over a minute and a half of bench air.
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _tube_with_portion(service, experiment.id, 20.0)
    AddLiquidToWorkbenchToolService(service).run(
        experiment.id,
        AddLiquidToWorkbenchToolRequest(slot_id="station_1", liquid_id="quechers_salts"),
    )
    _advance(service, experiment.id, 10000)

    _move_tube_to_ice_bath(service, experiment.id)
    captan_on_arrival = _portion(service, experiment.id).pesticide_degradation_factors["captan"]
    assert captan_on_arrival < 1.0

    _advance(service, experiment.id, 30000)

    state = _chilled_tube(service, experiment.id).quechers_state
    assert state.temperature_c < PhysicalSimulationService.pesticide_degradation_threshold_c
    captan_after = _portion(service, experiment.id).pesticide_degradation_factors["captan"]
    assert captan_after > captan_on_arrival * 0.97


def test_the_bath_is_gentler_than_the_bench_for_the_same_delay() -> None:
    def captan_after_salting(use_bath: bool) -> float:
        service = ExperimentRuntimeService()
        experiment = service.create_experiment()
        _tube_with_portion(service, experiment.id, 20.0)
        AddLiquidToWorkbenchToolService(service).run(
            experiment.id,
            AddLiquidToWorkbenchToolRequest(slot_id="station_1", liquid_id="quechers_salts"),
        )
        _advance(service, experiment.id, 10000)
        if use_bath:
            _move_tube_to_ice_bath(service, experiment.id)
        _advance(service, experiment.id, 60000)
        return next(
            state
            for state in service._require_experiment(experiment.id).produce_material_states
            if state.id == "state_portion"
        ).pesticide_degradation_factors["captan"]

    assert captan_after_salting(use_bath=True) > captan_after_salting(use_bath=False)
