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
    assert tool.produce_lots[0].label == "Apple"
    assert tool.produce_lots[0].total_mass_g == pytest.approx(10.0)
    assert tool.produce_fractions[0].mass_g == pytest.approx(10.0)
    assert tool.produce_fractions[0].is_mixed is True
    assert tool.produce_fractions[0].location_kind == "workbench_tool"
    assert tool.produce_fractions[0].location_id == "station_1"
    assert tool.liquids == []
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
            temperature_c=4.0,
        ),
    )

    balance = next(widget for widget in updated.workspace.widgets if widget.id == "analytical_balance")
    assert balance.tool is not None
    assert balance.tool.produce_fractions[0].mass_g == pytest.approx(12.5)
    assert balance.tool.liquids == []
    assert balance.tool.produce_fractions[0].location_kind == "workspace_widget_tool"
    assert balance.tool.produce_fractions[0].location_id == "analytical_balance"


def test_debug_vortexed_slurry_tube_is_ready_to_centrifuge() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = CreateDebugToolPresetService(service).run(
        experiment.id,
        CreateDebugToolPresetRequest(
            preset_id="vortexed_slurry_centrifuge_tube",
            destination_kind="workbench_slot",
            destination_id="station_1",
        ),
    )

    tool = updated.workbench.slots[0].tool
    assert tool is not None
    assert tool.tool_id == "centrifuge_tube_50ml"
    # Slurry is present, just like the raw preset.
    assert tool.produce_fractions[0].mass_g == pytest.approx(10.0)
    # Extraction solvent is loaded.
    assert [liq.liquid_id for liq in tool.liquids] == ["acetonitrile_extraction"]
    assert sum(liq.volume_ml for liq in tool.liquids) == pytest.approx(10.0)
    # Post-vortex state: sealed, mixed, and carrying a valid extract so the very
    # next centrifuge run separates into a pipettable supernatant.
    assert tool.quechers_state.salts_added is True
    assert tool.quechers_state.phase == "mixed"
    assert tool.contents_homogeneity == pytest.approx(1.0)
    assert tool.quechers_extraction_result is not None
    assert tool.is_sealed is True


def test_debug_separated_slurry_tube_is_ready_to_pipette() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = CreateDebugToolPresetService(service).run(
        experiment.id,
        CreateDebugToolPresetRequest(
            preset_id="separated_slurry_centrifuge_tube",
            destination_kind="workbench_slot",
            destination_id="station_1",
        ),
    )

    tool = updated.workbench.slots[0].tool
    assert tool is not None
    assert tool.tool_id == "centrifuge_tube_50ml"
    # Full extraction is present: slurry, solvent, salts and a valid extract result.
    assert tool.produce_fractions[0].mass_g == pytest.approx(10.0)
    assert [liq.liquid_id for liq in tool.liquids] == ["acetonitrile_extraction"]
    assert tool.quechers_state.salts_added is True
    assert tool.quechers_extraction_result is not None
    # Post-centrifuge state: separated and left open so the pipette can aspirate the
    # supernatant straight into a rack vial with no further steps.
    assert tool.quechers_state.phase == "separated"
    assert tool.quechers_state.separation_progress == pytest.approx(1.0)
    assert tool.is_sealed is False


def test_debug_separated_slurry_tube_aspirates_as_supernatant() -> None:
    from app.services.domain_services.pipette import (
        AspiratePipetteRequest,
        AspiratePipetteService,
    )

    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = CreateDebugToolPresetService(service).run(
        experiment.id,
        CreateDebugToolPresetRequest(
            preset_id="separated_slurry_centrifuge_tube",
            destination_kind="workbench_slot",
            destination_id="station_1",
        ),
    )
    tube = updated.workbench.slots[0].tool
    assert tube is not None

    aspirated = AspiratePipetteService(service).run(
        experiment.id,
        AspiratePipetteRequest(source_tool_id=tube.id, delta_volume_ml=1.0),
    )

    # A separated tube pipettes the supernatant only: solvent enters the pipette while
    # the settled matrix pellet stays behind in the tube.
    assert aspirated.pipette.volume_ml == pytest.approx(1.0)
    assert aspirated.pipette.injection_context is not None
    assert aspirated.pipette.produce_fractions == []


def test_debug_calibration_vial_defaults_to_level_100_in_rack() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = CreateDebugToolPresetService(service).run(
        experiment.id,
        CreateDebugToolPresetRequest(
            preset_id="calibration_standard_vial",
            destination_kind="rack_slot",
            destination_id="rack_slot_1",
        ),
    )

    slot = next(slot for slot in updated.rack.slots if slot.id == "rack_slot_1")
    vial = slot.tool
    assert vial is not None
    assert vial.tool_id == "sample_vial_lcms"
    assert vial.calibration_context is not None
    assert vial.calibration_context.level_ng_per_ml == pytest.approx(100.0)
    assert [liq.liquid_id for liq in vial.liquids] == ["calibration_solution"]


def test_debug_calibration_vial_honors_custom_level_on_workbench() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = CreateDebugToolPresetService(service).run(
        experiment.id,
        CreateDebugToolPresetRequest(
            preset_id="calibration_standard_vial",
            destination_kind="workbench_slot",
            destination_id="station_1",
            level_ng_per_ml=250.0,
        ),
    )

    vial = updated.workbench.slots[0].tool
    assert vial is not None
    assert vial.tool_id == "sample_vial_lcms"
    assert vial.calibration_context is not None
    assert vial.calibration_context.level_ng_per_ml == pytest.approx(250.0)


def test_debug_calibration_tube_spawns_a_centrifuge_tube_stock() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = CreateDebugToolPresetService(service).run(
        experiment.id,
        CreateDebugToolPresetRequest(
            preset_id="calibration_standard_tube",
            destination_kind="workbench_slot",
            destination_id="station_1",
        ),
    )

    tube = updated.workbench.slots[0].tool
    assert tube is not None
    assert tube.tool_id == "centrifuge_tube_50ml"
    assert tube.calibration_context is not None
    assert tube.calibration_context.level_ng_per_ml == pytest.approx(100.0)
    assert [liq.liquid_id for liq in tube.liquids] == ["calibration_solution"]


def test_debug_calibration_tube_pipettes_into_a_recognized_calibration_vial() -> None:
    from app.services.domain_services.pipette import (
        AspiratePipetteRequest,
        AspiratePipetteService,
        DispensePipetteRequest,
        DispensePipetteService,
    )

    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    CreateDebugToolPresetService(service).run(
        experiment.id,
        CreateDebugToolPresetRequest(
            preset_id="calibration_standard_tube",
            destination_kind="workbench_slot",
            destination_id="station_1",
            level_ng_per_ml=100.0,
        ),
    )
    placed = PlaceToolOnWorkbenchService(service).run(
        experiment.id,
        PlaceToolOnWorkbenchRequest(slot_id="station_2", tool_id="sample_vial_lcms"),
    )
    tube = placed.workbench.slots[0].tool
    vial = placed.workbench.slots[1].tool
    assert tube is not None
    assert vial is not None
    tube_id = tube.id
    vial_id = vial.id

    AspiratePipetteService(service).run(
        experiment.id,
        AspiratePipetteRequest(source_tool_id=tube_id, delta_volume_ml=1.0),
    )
    updated = DispensePipetteService(service).run(
        experiment.id,
        DispensePipetteRequest(target_tool_id=vial_id, delta_volume_ml=1.0),
    )

    vial = updated.workbench.slots[1].tool
    assert vial is not None
    # The pipette carried the calibration identity across: the vial is now a recognised
    # calibration point at the same (fixed) level, ready to place in the rack and inject.
    assert vial.calibration_context is not None
    assert vial.calibration_context.level_ng_per_ml == pytest.approx(100.0)
    assert [liq.liquid_id for liq in vial.liquids] == ["calibration_solution"]
    # The pipette is emptied and no longer carries the calibration identity.
    assert updated.pipette.calibration_context is None


def test_debug_unknown_tool_preset_is_rejected() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    with pytest.raises(ValueError, match="Unknown debug tool preset"):
        CreateDebugToolPresetService(service).run(
            experiment.id,
            CreateDebugToolPresetRequest(
                preset_id="not_a_real_preset",
                destination_kind="workbench_slot",
                destination_id="station_1",
            ),
        )


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
    assert tool.produce_lots[0].label == "Apple"
    assert tool.produce_fractions[0].location_kind == "workbench_tool"
    assert tool.produce_fractions[0].location_id == "station_1"
    assert tool.produce_fractions[0].container_id == tool.id
    assert tool.liquids == []


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
