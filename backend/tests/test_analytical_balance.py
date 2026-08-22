import re

import pytest

from app.domain.models import ProduceFraction, ProduceMaterialState, TrashSampleLabelEntry
from app.services.dnd_move_service import DndMoveObjectRequest, DndMoveObjectService, DndObjectRef
from app.services.domain_services.analytical_balance import (
    AddLiquidToAnalyticalBalanceToolRequest,
    AddLiquidToAnalyticalBalanceToolService,
    ApplySampleLabelToAnalyticalBalanceToolService,
    CloseAnalyticalBalanceToolService,
    EmptyRequest,
    MoveAnalyticalBalanceToolToWorkbenchRequest,
    MoveAnalyticalBalanceToolToWorkbenchService,
    OpenAnalyticalBalanceToolService,
    PlaceToolOnAnalyticalBalanceRequest,
    PlaceToolOnAnalyticalBalanceService,
    RecordAnalyticalSampleMassService,
    TareAnalyticalBalanceService,
    UpdateAnalyticalBalanceToolSampleLabelTextRequest,
    UpdateAnalyticalBalanceToolSampleLabelTextService,
)
from app.services.domain_services.reception import (
    ApplyPrintedLimsLabelToAnalyticalBalanceToolService,
    CreateLimsReceptionRequest,
    CreateLimsReceptionService,
    EmptyReceptionRequest,
    PrintLimsLabelRequest,
    PrintLimsLabelService,
)
from app.services.experiment_service import ExperimentRuntimeService
from app.services.helpers.lookups import build_manual_label
from app.services.helpers.workbench import build_workbench_tool


def _find_workspace_widget(experiment, widget_type: str):
    return next(widget for widget in experiment.workspace.widgets if widget.widget_type == widget_type)


def _get_analytical_balance_tool(experiment):
    return _find_workspace_widget(experiment, "analytical_balance").tool


def test_analytical_balance_rejects_cutting_board() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    with pytest.raises(ValueError, match="cutting board"):
        PlaceToolOnAnalyticalBalanceService(service).run(
            experiment.id,
            PlaceToolOnAnalyticalBalanceRequest(tool_id="cutting_board_hdpe"),
        )


def test_analytical_balance_records_precise_sample_mass() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnAnalyticalBalanceService(service).run(
        experiment.id,
        PlaceToolOnAnalyticalBalanceRequest(tool_id="centrifuge_tube_50ml"),
    )
    TareAnalyticalBalanceService(service).run(experiment.id, EmptyRequest())
    MoveAnalyticalBalanceToolToWorkbenchService(service).run(
        experiment.id,
        MoveAnalyticalBalanceToolToWorkbenchRequest(target_slot_id="station_1"),
    )
    runtime_experiment = service._require_experiment(experiment.id)
    tool = runtime_experiment.workbench.slots[0].tool
    assert tool is not None
    runtime_experiment.produce_material_states = [ProduceMaterialState(id="state_1", produce_lot_id="test-lot", material_state="ground")]
    tool.produce_fractions = [
        ProduceFraction(
            id="test-frac",
            produce_lot_id="test-lot",
            produce_material_state_id="state_1",
            mass_g=10.124,
            location_kind="workbench_tool",
            location_id="station_1",
            container_id=tool.id,
            container_label=tool.label,
        )
    ]
    _find_workspace_widget(runtime_experiment, "gross_balance").tool = None
    _find_workspace_widget(runtime_experiment, "analytical_balance").tool = tool
    runtime_experiment.workbench.slots[0].tool = None
    updated = RecordAnalyticalSampleMassService(service).run(experiment.id, EmptyRequest())
    assert updated.lims_reception.measured_sample_mass_g == pytest.approx(10.124)


def test_analytical_balance_rejects_out_of_spec_sample_mass() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnAnalyticalBalanceService(service).run(
        experiment.id,
        PlaceToolOnAnalyticalBalanceRequest(tool_id="centrifuge_tube_50ml"),
    )
    TareAnalyticalBalanceService(service).run(experiment.id, EmptyRequest())
    MoveAnalyticalBalanceToolToWorkbenchService(service).run(
        experiment.id,
        MoveAnalyticalBalanceToolToWorkbenchRequest(target_slot_id="station_1"),
    )
    runtime_experiment = service._require_experiment(experiment.id)
    tool = runtime_experiment.workbench.slots[0].tool
    assert tool is not None
    runtime_experiment.produce_material_states = [ProduceMaterialState(id="state_1", produce_lot_id="test-lot", material_state="ground")]
    tool.produce_fractions = [
        ProduceFraction(
            id="test-frac",
            produce_lot_id="test-lot",
            produce_material_state_id="state_1",
            mass_g=10.5,
            location_kind="workbench_tool",
            location_id="station_1",
            container_id=tool.id,
            container_label=tool.label,
        )
    ]
    _find_workspace_widget(runtime_experiment, "gross_balance").tool = None
    _find_workspace_widget(runtime_experiment, "analytical_balance").tool = tool
    runtime_experiment.workbench.slots[0].tool = None

    with pytest.raises(ValueError, match="ERR_RANGE"):
        RecordAnalyticalSampleMassService(service).run(experiment.id, EmptyRequest())


def test_analytical_balance_records_sample_mass_from_canonical_produce_fractions() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnAnalyticalBalanceService(service).run(
        experiment.id,
        PlaceToolOnAnalyticalBalanceRequest(tool_id="centrifuge_tube_50ml"),
    )
    runtime_experiment = service._require_experiment(experiment.id)
    tool = _get_analytical_balance_tool(runtime_experiment)
    assert tool is not None
    tool.produce_fractions = [
        ProduceFraction(
            id="fraction_1",
            produce_lot_id="lot_1",
            produce_material_state_id="state_1",
            mass_g=10.124,
            location_kind="workspace_widget_tool",
            location_id="analytical_balance",
            container_id=tool.id,
            container_label=tool.label,
        )
    ]
    runtime_experiment.produce_material_states = [ProduceMaterialState(id="state_1", produce_lot_id="lot_1", material_state="ground")]
    runtime_experiment.analytical_balance.tare_mass_g = 12.0

    updated = RecordAnalyticalSampleMassService(service).run(experiment.id, EmptyRequest())

    assert updated.lims_reception.measured_sample_mass_g == pytest.approx(10.124)


def test_analytical_balance_tare_persists_when_different_tube_placed() -> None:
    """Tare is a balance property, not a tube property — placing a new tube must not clear it."""
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    # Tare with tube A
    PlaceToolOnAnalyticalBalanceService(service).run(
        experiment.id,
        PlaceToolOnAnalyticalBalanceRequest(tool_id="centrifuge_tube_50ml"),
    )
    TareAnalyticalBalanceService(service).run(experiment.id, EmptyRequest())
    tare_mass = service._require_experiment(experiment.id).analytical_balance.tare_mass_g
    assert tare_mass == pytest.approx(12.0)

    # Remove tube A, place tube B
    MoveAnalyticalBalanceToolToWorkbenchService(service).run(
        experiment.id,
        MoveAnalyticalBalanceToolToWorkbenchRequest(target_slot_id="station_1"),
    )
    PlaceToolOnAnalyticalBalanceService(service).run(
        experiment.id,
        PlaceToolOnAnalyticalBalanceRequest(tool_id="centrifuge_tube_50ml"),
    )

    # Tare value must still be set — placing a new tube must not clear it
    updated = service._require_experiment(experiment.id)
    assert updated.analytical_balance.tare_mass_g == pytest.approx(12.0)


def test_analytical_balance_tare_works_on_empty_balance() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    updated = TareAnalyticalBalanceService(service).run(experiment.id, EmptyRequest())
    assert updated.analytical_balance.tare_mass_g == pytest.approx(0.0)


def test_analytical_balance_tare_works_with_liquid_in_tube() -> None:
    from app.domain.models import WorkbenchLiquid

    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnAnalyticalBalanceService(service).run(
        experiment.id,
        PlaceToolOnAnalyticalBalanceRequest(tool_id="centrifuge_tube_50ml"),
    )
    runtime_experiment = service._require_experiment(experiment.id)
    tool = _get_analytical_balance_tool(runtime_experiment)
    assert tool is not None
    tool.liquids.append(WorkbenchLiquid(id="liq1", liquid_id="acetonitrile", name="ACN", volume_ml=10.0, accent="blue"))

    updated = TareAnalyticalBalanceService(service).run(experiment.id, EmptyRequest())
    # 12g (tube) + 10g (liquid) = 22g tare
    assert updated.analytical_balance.tare_mass_g == pytest.approx(22.0)


def test_add_liquid_to_analytical_balance_tool() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnAnalyticalBalanceService(service).run(
        experiment.id,
        PlaceToolOnAnalyticalBalanceRequest(tool_id="centrifuge_tube_50ml"),
    )

    updated = AddLiquidToAnalyticalBalanceToolService(service).run(
        experiment.id,
        AddLiquidToAnalyticalBalanceToolRequest(
            liquid_id="acetonitrile_extraction",
            volume_ml=10,
        ),
    )

    tool = _get_analytical_balance_tool(updated)
    assert tool is not None
    assert len(tool.liquids) == 1
    assert tool.liquids[0].liquid_id == "acetonitrile_extraction"
    assert tool.liquids[0].volume_ml == pytest.approx(10.0)


def test_analytical_balance_tool_can_be_closed_and_reopened() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnAnalyticalBalanceService(service).run(
        experiment.id,
        PlaceToolOnAnalyticalBalanceRequest(tool_id="centrifuge_tube_50ml"),
    )

    closed = CloseAnalyticalBalanceToolService(service).run(experiment.id, EmptyRequest())
    closed_tool = _get_analytical_balance_tool(closed)
    assert closed_tool is not None
    assert closed_tool.is_sealed is True

    reopened = OpenAnalyticalBalanceToolService(service).run(experiment.id, EmptyRequest())
    reopened_tool = _get_analytical_balance_tool(reopened)
    assert reopened_tool is not None
    assert reopened_tool.is_sealed is False


def test_analytical_balance_accepts_manual_sample_label_operations() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnAnalyticalBalanceService(service).run(
        experiment.id,
        PlaceToolOnAnalyticalBalanceRequest(tool_id="centrifuge_tube_50ml"),
    )

    labeled = ApplySampleLabelToAnalyticalBalanceToolService(service).run(experiment.id, EmptyRequest())
    tool = _get_analytical_balance_tool(labeled)
    assert tool is not None
    assert len(tool.labels) == 1

    label_id = tool.labels[0].id
    updated = UpdateAnalyticalBalanceToolSampleLabelTextService(service).run(
        experiment.id,
        UpdateAnalyticalBalanceToolSampleLabelTextRequest(
            label_id=label_id,
            sample_label_text="LOT-2026-041",
        ),
    )
    updated_tool = _get_analytical_balance_tool(updated)
    assert updated_tool is not None
    assert updated_tool.labels[0].text == "LOT-2026-041"


def test_sample_label_can_move_from_workbench_and_trash_to_analytical_balance() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnAnalyticalBalanceService(service).run(
        experiment.id,
        PlaceToolOnAnalyticalBalanceRequest(tool_id="centrifuge_tube_50ml"),
    )
    runtime_experiment = service._require_experiment(experiment.id)
    runtime_experiment.workbench.slots[0].tool = build_workbench_tool("sample_vial_lcms")
    runtime_experiment.workbench.slots[0].tool.labels.append(build_manual_label(text="WB-1"))

    label_id = runtime_experiment.workbench.slots[0].tool.labels[0].id
    moved = DndMoveObjectService(service).run(
        experiment.id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="sample_label", id=label_id),
            source=DndObjectRef(kind="workbench", id="station_1"),
            destination=DndObjectRef(kind="analytical_balance", id="analytical_balance"),
        ),
    )
    moved_tool = _get_analytical_balance_tool(moved)
    assert moved_tool is not None
    assert [label.text for label in moved_tool.labels] == ["WB-1"]
    assert moved.workbench.slots[0].tool is not None
    assert moved.workbench.slots[0].tool.labels == []

    moved_runtime = service._require_experiment(experiment.id)
    moved_runtime.trash.sample_labels.append(
        TrashSampleLabelEntry(
            id="trash_sample_label_1",
            origin_label="Autosampler vial",
            label=build_manual_label(text="TRASH-1"),
        )
    )

    restored = DndMoveObjectService(service).run(
        experiment.id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="sample_label", id="trash_sample_label_1"),
            source=DndObjectRef(kind="trash", id="trash_sample_label_1"),
            destination=DndObjectRef(kind="analytical_balance", id="analytical_balance"),
        ),
    )
    restored_tool = _get_analytical_balance_tool(restored)
    assert restored_tool is not None
    assert [label.text for label in restored_tool.labels] == ["WB-1", "TRASH-1"]
    assert restored.trash.sample_labels == []


def test_sample_label_moves_through_generic_dnd_object_command() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnAnalyticalBalanceService(service).run(
        experiment.id,
        PlaceToolOnAnalyticalBalanceRequest(tool_id="centrifuge_tube_50ml"),
    )
    runtime_experiment = service._require_experiment(experiment.id)
    runtime_experiment.workbench.slots[0].tool = build_workbench_tool("sample_vial_lcms")
    runtime_experiment.workbench.slots[0].tool.labels.append(build_manual_label(text="GENERIC-1"))

    label_id = runtime_experiment.workbench.slots[0].tool.labels[0].id
    moved_to_balance = DndMoveObjectService(service).run(
        experiment.id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="sample_label", id=label_id),
            source=DndObjectRef(kind="workbench", id="station_1"),
            destination=DndObjectRef(kind="analytical_balance", id="analytical_balance"),
        ),
    )

    balance_tool = _get_analytical_balance_tool(moved_to_balance)
    assert balance_tool is not None
    assert [label.text for label in balance_tool.labels] == ["GENERIC-1"]
    assert moved_to_balance.workbench.slots[0].tool is not None
    assert moved_to_balance.workbench.slots[0].tool.labels == []

    moved_to_trash = DndMoveObjectService(service).run(
        experiment.id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="sample_label", id=label_id),
            source=DndObjectRef(kind="analytical_balance", id="analytical_balance"),
            destination=DndObjectRef(kind="trash_bin", id="trash_bin"),
        ),
    )

    assert _get_analytical_balance_tool(moved_to_trash) is not None
    assert _get_analytical_balance_tool(moved_to_trash).labels == []
    assert [entry.label.text for entry in moved_to_trash.trash.sample_labels] == ["GENERIC-1"]

    trash_entry_id = moved_to_trash.trash.sample_labels[0].id
    restored = DndMoveObjectService(service).run(
        experiment.id,
        DndMoveObjectRequest(
            entity=DndObjectRef(kind="sample_label", id=trash_entry_id),
            source=DndObjectRef(kind="trash", id=trash_entry_id),
            destination=DndObjectRef(kind="workbench_tool", id="station_1"),
        ),
    )

    assert restored.trash.sample_labels == []
    assert restored.workbench.slots[0].tool is not None
    assert [label.text for label in restored.workbench.slots[0].tool.labels] == ["GENERIC-1"]


def test_printed_lims_ticket_can_apply_to_analytical_balance_tool() -> None:
    service = ExperimentRuntimeService()
    experiment = service.create_experiment()

    PlaceToolOnAnalyticalBalanceService(service).run(
        experiment.id,
        PlaceToolOnAnalyticalBalanceRequest(tool_id="centrifuge_tube_50ml"),
    )
    CreateLimsReceptionService(service).run(
        experiment.id,
        CreateLimsReceptionRequest(
            orchard_name="Verger Saint-Martin",
            harvest_date="2026-03-29",
            indicative_mass_g=2500.0,
            measured_gross_mass_g=2486.0,
            measured_sample_mass_g=10.0,
        ),
    )
    PrintLimsLabelService(service).run(experiment.id, PrintLimsLabelRequest())

    updated = ApplyPrintedLimsLabelToAnalyticalBalanceToolService(service).run(
        experiment.id,
        EmptyReceptionRequest(),
    )

    analytical_widget = next(widget for widget in updated.workspace.widgets if widget.id == "analytical_balance")
    assert analytical_widget.tool is not None
    assert analytical_widget.tool.labels[0].label_kind == "lims"
    assert analytical_widget.tool.labels[0].sample_code is not None
    assert re.fullmatch(r"APP-\d{4}-\d{2}", analytical_widget.tool.labels[0].sample_code)
    assert updated.lims_reception.printed_label_ticket is None
