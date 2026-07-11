import pytest

from app.services.domain_services.debug import (
    CreateDebugToolPresetRequest,
    CreateDebugToolPresetService,
)
from app.services.domain_services.workbench import (
    PlaceToolOnWorkbenchRequest,
    PlaceToolOnWorkbenchService,
)
from app.services.experiment_service import ExperimentRuntimeService


def test_debug_apple_slurry_tube_defaults_to_ten_grams_on_workbench() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = CreateDebugToolPresetService(service).run(
        experiment.id,
        CreateDebugToolPresetRequest(
            preset_id="apple_slurry_centrifuge_tube",
            destination_kind="workbench_slot",
            destination_id="station_1",
        ),
    )

    tool = updated.workbench.slots[0].tool
    assert tool is not None
    assert tool.tool_id == "centrifuge_tube_50ml"
    assert tool.produce_lots[0].label == "Apple slurry"
    assert tool.produce_lots[0].total_mass_g == pytest.approx(10.0)
    assert tool.produce_fractions[0].mass_g == pytest.approx(10.0)
    assert tool.produce_fractions[0].is_mixed is True
    assert tool.produce_fractions[0].location_kind == "workbench_tool"
    assert tool.produce_fractions[0].location_id == "station_1"
    assert tool.liquids[0].liquid_id == "apple_extract"
    assert tool.liquids[0].volume_ml == pytest.approx(10.0)
    material_state = next(state for state in updated.produce_material_states if state.id == tool.produce_fractions[0].produce_material_state_id)
    assert material_state.material_state == "slurry"
    assert material_state.temperature_c == pytest.approx(20.0)


def test_debug_apple_slurry_tube_can_spawn_on_analytical_balance_with_overrides() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = CreateDebugToolPresetService(service).run(
        experiment.id,
        CreateDebugToolPresetRequest(
            preset_id="apple_slurry_centrifuge_tube",
            destination_kind="analytical_balance",
            destination_id="analytical_balance",
            produce_mass_g=12.5,
            liquid_volume_ml=8.0,
            temperature_c=4.0,
        ),
    )

    balance = next(widget for widget in updated.workspace.widgets if widget.id == "analytical_balance")
    assert balance.tool is not None
    assert balance.tool.produce_fractions[0].mass_g == pytest.approx(12.5)
    assert balance.tool.liquids[0].volume_ml == pytest.approx(8.0)
    assert balance.tool.produce_fractions[0].location_kind == "workspace_widget_tool"
    assert balance.tool.produce_fractions[0].location_id == "analytical_balance"


@pytest.mark.parametrize("tool_id", ["centrifuge_tube_50ml", "sample_vial_lcms"])
def test_debug_apple_slurry_can_be_added_to_an_open_workbench_container(tool_id: str) -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()
    PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(slot_id="station_1", tool_id=tool_id),
    )

    updated = CreateDebugToolPresetService(service).run(
        experiment.id,
        CreateDebugToolPresetRequest(
            preset_id="apple_slurry_centrifuge_tube",
            destination_kind="workbench_tool",
            destination_id="station_1",
        ),
    )

    tool = updated.workbench.slots[0].tool
    assert tool is not None
    assert tool.tool_id == tool_id
    assert tool.produce_lots[0].label == "Apple slurry"
    assert tool.produce_fractions[0].location_kind == "workbench_tool"
    assert tool.produce_fractions[0].location_id == "station_1"
    assert tool.produce_fractions[0].container_id == tool.id
    assert tool.liquids[0].liquid_id == "apple_extract"


@pytest.mark.parametrize(
    ("destination_kind", "destination_id"),
    [
        ("workbench_slot", "station_1"),
        ("gross_balance", "gross_balance"),
        ("analytical_balance", "analytical_balance"),
        ("vortex", "vortex"),
        ("trash_bin", "trash_bin"),
    ],
)
def test_debug_apple_slurry_tube_supports_every_centrifuge_tube_target(
    destination_kind: str,
    destination_id: str,
) -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = CreateDebugToolPresetService(service).run(
        experiment.id,
        CreateDebugToolPresetRequest(
            preset_id="apple_slurry_centrifuge_tube",
            destination_kind=destination_kind,
            destination_id=destination_id,
        ),
    )

    placed_tools = [
        *(slot.tool for slot in updated.workbench.slots if slot.tool is not None),
        *(widget.tool for widget in updated.workspace.widgets if widget.tool is not None),
        *updated.trash.children,
    ]
    assert any(tool.tool_id == "centrifuge_tube_50ml" for tool in placed_tools)
