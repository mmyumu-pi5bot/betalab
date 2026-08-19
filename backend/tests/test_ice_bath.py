from dataclasses import asdict

import pytest

from app.domain.models import (
    ProduceFraction,
    ProduceMaterialState,
    WorkbenchLiquid,
    WorkbenchTool,
    WorkspaceWidget,
)
from app.domain.workbench_catalog import get_toolbar_categories
from app.schemas.experiment import WorkbenchToolSchema
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
from app.services.experiment_repository import _deserialize_non_null_workbench_tool
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


def test_the_ice_bath_can_be_stored_in_the_inventory() -> None:
    """The bath is bench glassware, so it has to be tidied away like the rest."""
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    widget = next(widget for widget in experiment.workspace.widgets if widget.id == "ice_bath")

    assert widget.is_storable is True
    assert widget.can_store is True


def test_the_ice_bath_is_listed_under_misc() -> None:
    """A tray of ice water is a supporting item, not one of the large systems."""
    categories = get_toolbar_categories()

    owner = next(
        category
        for category in categories
        if any(item["id"] == "ice_bath_widget" for item in category["items"])  # type: ignore[index,union-attr]
    )
    item = next(item for item in owner["items"] if item["id"] == "ice_bath_widget")  # type: ignore[index,union-attr]

    assert owner["id"] == "misc"
    assert item["item_type"] == "workspace_widget"
    assert item["allowed_drop_targets"] == ["workspace_canvas"]


def _bare_tube(temperature_c: float = 20.0) -> WorkbenchTool:
    return WorkbenchTool(
        id="tube-thermal",
        tool_id="centrifuge_tube_50ml",
        tool_type="centrifuge_tube",
        label="50 mL tube",
        subtitle="",
        accent="amber",
        capacity_ml=50,
        body_temperature_c=temperature_c,
    )


def _bath_surroundings():
    return PhysicalSimulationService.surroundings_for_widget(
        WorkspaceWidget(
            id="ice_bath",
            widget_type="ice_bath",
            label="Ice bath",
            anchor="top-left",
            offset_x=0,
            offset_y=0,
            is_present=True,
            is_trashed=False,
        )
    )


def test_solvent_does_not_teleport_to_the_temperature_around_it() -> None:
    """A tube of acetonitrile moved into the bath cools, it does not snap to zero.

    The solvent used to carry no temperature of its own, so it was read at
    whatever surrounded the tube -- moving a third of the tube's thermal mass to
    the new temperature the instant the tube was picked up.
    """
    service = PhysicalSimulationService()
    tool = _bare_tube()
    tool.liquids.append(
        WorkbenchLiquid(
            id="acn",
            liquid_id="acetonitrile",
            name="Acetonitrile",
            volume_ml=10.0,
            accent="amber",
            true_volume_ml=10.0,
            temperature_c=20.0,
        )
    )
    bath = _bath_surroundings()

    on_arrival = PhysicalSimulationService.mixture_temperature_c(tool, [], surroundings=bath)
    service.advance_tool_contents_temperature(tool, 20.0, [], surroundings=bath)
    later = PhysicalSimulationService.mixture_temperature_c(tool, [], surroundings=bath)

    assert on_arrival == pytest.approx(20.0, abs=0.01)
    assert 0.0 < later < 20.0


def test_an_empty_tube_carries_its_own_warmth_out_of_the_bath() -> None:
    """The tube body is polypropylene, not a thermometer reading the room."""
    service = PhysicalSimulationService()
    tool = _bare_tube(temperature_c=0.0)
    bench = PhysicalSimulationService.bench_surroundings()

    on_arrival = PhysicalSimulationService.mixture_temperature_c(tool, [], surroundings=bench)
    service.advance_tool_contents_temperature(tool, 120.0, [], surroundings=bench)
    later = PhysicalSimulationService.mixture_temperature_c(tool, [], surroundings=bench)

    assert on_arrival == pytest.approx(0.0, abs=0.01)
    assert 0.0 < later < 20.0


def test_the_tube_body_tempers_powder_straight_out_of_the_mill() -> None:
    """A warm tube gives some of its heat back to cryogenic powder poured in."""
    tool = _bare_tube(temperature_c=20.0)
    state = ProduceMaterialState(id="cold", produce_lot_id="lot", temperature_c=-60.0)
    tool.produce_fractions.append(
        ProduceFraction(
            id="frac",
            produce_lot_id="lot",
            produce_material_state_id="cold",
            mass_g=10.0,
            true_mass_g=10.0,
        )
    )

    mixture = PhysicalSimulationService.mixture_temperature_c(
        tool, [state], surroundings=PhysicalSimulationService.bench_surroundings()
    )

    assert -60.0 < mixture < -20.0


def test_the_thermal_state_of_a_tube_survives_a_reload() -> None:
    """Temperature is persisted state: a saved run must reopen where it stopped."""
    tool = _bare_tube(temperature_c=3.5)
    tool.liquids.append(
        WorkbenchLiquid(
            id="acn",
            liquid_id="acetonitrile",
            name="Acetonitrile",
            volume_ml=10.0,
            accent="amber",
            true_volume_ml=10.0,
            temperature_c=4.25,
        )
    )

    restored = _deserialize_non_null_workbench_tool(WorkbenchToolSchema.model_validate(asdict(tool)))

    assert restored.body_temperature_c == pytest.approx(3.5)
    assert restored.liquids[0].temperature_c == pytest.approx(4.25)


def test_a_tube_taken_out_of_the_bath_warms_back_through_the_real_tick() -> None:
    """Solvent and tube wall must keep exchanging heat once they own a temperature.

    Only tools standing somewhere are advanced each tick. Giving the solvent a
    temperature of its own would trade an instant snap to the room for a
    permanent freeze if any of those places were missed.
    """
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    _tube_with_portion(service, experiment.id, portion_temperature_c=20.0)
    _move_tube_to_ice_bath(service, experiment.id)
    _advance(service, experiment.id, 120_000)

    chilled = _chilled_tube(service, experiment.id)
    assert chilled.body_temperature_c == pytest.approx(0.0, abs=0.5)
    assert chilled.liquids[0].temperature_c == pytest.approx(0.0, abs=0.5)

    DndMoveObjectService(service).run(
        experiment.id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="tool", id=chilled.id),
            source=DndObjectRef(kind="ice_bath", id="ice_bath"),
            destination=DndObjectRef(kind="workbench_slot", id="station_1"),
        ),
    )
    _advance(service, experiment.id, 120_000)

    tube = service._require_experiment(experiment.id).workbench.slots[0].tool
    assert tube is not None
    # Warming towards the room, and not there yet: still air is slow.
    assert 5.0 < tube.body_temperature_c < 19.0
    assert 5.0 < tube.liquids[0].temperature_c < 19.0
