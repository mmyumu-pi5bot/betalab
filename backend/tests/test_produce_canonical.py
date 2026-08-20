from app.domain.models import ProduceFraction, ProduceLot, ProduceMaterialState
from app.services.domain_services.gross_balance import PlaceToolOnGrossBalanceRequest, PlaceToolOnGrossBalanceService
from app.services.domain_services.workbench import PlaceToolOnWorkbenchRequest, PlaceToolOnWorkbenchService
from app.services.experiment_repository import _deserialize_experiment, _serialize_experiment
from app.services.experiment_service import ExperimentRuntimeService
from app.services.helpers.lookups import find_workspace_widget
from app.services.helpers.produce_canonical import sync_canonical_produce_model
from app.services.received_sample_generation import SAMPLE_BAG_TARE_MASS_G, resolve_received_bag_gross_mass_g


def test_sync_canonical_produce_model_exposes_tool_fraction_and_material_state() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="hdpe_storage_jar_2l"),
    )
    runtime_experiment = service._require_experiment(experiment.id)
    tool = runtime_experiment.workbench.slots[0].tool
    assert tool is not None
    tool.produce_lots = [
        ProduceLot(
            id="lot_1",
            label="Apple lot 1",
            produce_type="apple",
            total_mass_g=2450.0,
        )
    ]
    runtime_experiment.produce_material_states = [
        ProduceMaterialState(
            id="state_1",
            produce_lot_id="lot_1",
            material_state="ground",
            grind_quality_label="powder_fine",
            residual_co2_mass_g=18.0,
        )
    ]
    tool.produce_fractions = [
        ProduceFraction(
            id="powder_1",
            produce_lot_id="lot_1",
            produce_material_state_id="state_legacy",
            mass_g=500.0,
            location_kind="workbench_tool",
            location_id="station_1",
            container_id=tool.id,
            container_label=tool.label,
        )
    ]

    sync_canonical_produce_model(runtime_experiment)

    matching_states = [state for state in runtime_experiment.produce_material_states if state.produce_lot_id == "lot_1"]
    assert len(matching_states) == 1
    assert matching_states[0].material_state == "ground"
    assert len(tool.produce_fractions) == 1
    assert {fraction.id for fraction in tool.produce_fractions} == {
        "powder_1",
    }
    assert {fraction.produce_material_state_id for fraction in tool.produce_fractions} == {matching_states[0].id}


def test_experiment_schema_includes_canonical_produce_fields() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    runtime_experiment = service._require_experiment(experiment.id)
    runtime_experiment.workspace.produce_basket_lots = [
        ProduceLot(
            id="lot_1",
            label="Apple lot 1",
            produce_type="apple",
            total_mass_g=2500.0,
        )
    ]

    snapshot = service.get_experiment(experiment.id)

    assert snapshot.produce_material_states
    assert snapshot.workspace.produce_basket_fractions
    assert snapshot.workspace.produce_basket_fractions[0].produce_lot_id == "lot_1"


def test_received_bag_gross_mass_can_read_canonical_fractions() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    runtime_experiment = service._require_experiment(experiment.id)
    bag = runtime_experiment.basket_tools[0]
    bag.produce_lots = []
    bag.produce_fractions = []

    runtime_experiment.workspace.produce_basket_lots = [
        ProduceLot(
            id="lot_1",
            label="Apple lot 1",
            produce_type="apple",
            total_mass_g=2500.0,
        )
    ]
    sync_canonical_produce_model(runtime_experiment)
    bag.produce_fractions = [
        runtime_experiment.workspace.produce_basket_fractions[0],
    ]

    assert resolve_received_bag_gross_mass_g(bag) == 2500.0 + SAMPLE_BAG_TARE_MASS_G


def test_gross_balance_estimates_tool_mass_from_canonical_fractions() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnGrossBalanceService(service).run(
        experiment.id,
        PlaceToolOnGrossBalanceRequest(tool_id="centrifuge_tube_50ml"),
    )
    runtime_experiment = service._require_experiment(experiment.id)
    widget = find_workspace_widget(runtime_experiment.workspace, "gross_balance")
    tool = widget.tool
    assert tool is not None
    tool.produce_lots = []
    tool.liquids = []
    tool.produce_fractions = [
        ProduceFraction(
            id="fraction_1",
            produce_lot_id="lot_1",
            produce_material_state_id="state_1",
            mass_g=123.4,
            location_kind="workspace_widget_tool",
            location_id=widget.id,
            container_id=tool.id,
            container_label=tool.label,
        )
    ]

    PlaceToolOnGrossBalanceService(service)._update_balance_measured_mass(runtime_experiment)

    assert runtime_experiment.lims_reception.measured_gross_mass_g == 135.4


def test_experiment_roundtrip_keeps_only_canonical_produce_fields() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    runtime_experiment = service._require_experiment(experiment.id)
    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id="hdpe_storage_jar_2l"),
    )
    runtime_experiment.produce_material_states = []

    restored = _deserialize_experiment(_serialize_experiment(runtime_experiment))

    dumped = _serialize_experiment(restored)
    assert "powder_fractions" not in dumped["workbench"]["slots"][0]["tool"]
    assert "loaded_fractions" not in dumped["spatula"]
