from __future__ import annotations

from app.domain.models import (
    ContainerLabel,
    Experiment,
    LimsLabel,
    ManualLabel,
    ProduceLot,
    Rack,
    RackSlot,
    Trash,
    TrashProduceLotEntry,
    TrashSampleLabelEntry,
    Workbench,
    WorkbenchLiquid,
    WorkbenchSlot,
    WorkbenchTool,
    Workspace,
    WorkspaceWidget,
    new_id,
)


def find_experiment_tool(experiment: Experiment, tool_id: str) -> WorkbenchTool:
    candidates = [
        *(slot.tool for slot in experiment.workbench.slots),
        *(slot.tool for slot in experiment.rack.slots),
        *(widget.tool for widget in experiment.workspace.widgets),
        *experiment.basket_tools,
        *experiment.trash.children,
    ]
    tool = next((entry for entry in candidates if entry is not None and entry.id == tool_id), None)
    if tool is None:
        raise ValueError("Unknown tool")
    return tool


def find_workbench_slot(workbench: Workbench, slot_id: str) -> WorkbenchSlot:
    slot = next((entry for entry in workbench.slots if entry.id == slot_id), None)
    if slot is None:
        raise ValueError("Unknown workbench slot")
    return slot


def find_rack_slot(rack: Rack, slot_id: str) -> RackSlot:
    slot = next((entry for entry in rack.slots if entry.id == slot_id), None)
    if slot is None:
        raise ValueError("Unknown rack slot")
    return slot


def find_trash_tool(trash: Trash, tool_id: str) -> WorkbenchTool:
    tool = next((t for t in trash.children if t.id == tool_id), None)
    if tool is None:
        raise ValueError("Unknown trash tool")
    return tool


def find_trash_produce_lot(trash: Trash, trash_produce_lot_id: str) -> TrashProduceLotEntry:
    produce_lot = next((entry for entry in trash.produce_lots if entry.id == trash_produce_lot_id), None)
    if produce_lot is None:
        raise ValueError("Unknown trash produce lot")
    return produce_lot


def find_trash_sample_label(trash: Trash, trash_sample_label_id: str) -> TrashSampleLabelEntry:
    sample_label = next((entry for entry in trash.sample_labels if entry.id == trash_sample_label_id), None)
    if sample_label is None:
        raise ValueError("Unknown trash sample label")
    return sample_label


def find_tool_label(tool: WorkbenchTool, label_id: str) -> ContainerLabel:
    label = next((entry for entry in tool.labels if entry.id == label_id), None)
    if label is None:
        raise ValueError("Unknown tool label")
    return label


def build_manual_label(*, label_id: str | None = None, text: str = "") -> ManualLabel:
    return ManualLabel(id=label_id or new_id("label_manual"), text=text, label_kind="manual")


def build_lims_label(
    *,
    label_id: str | None = None,
    sample_code: str,
    text: str,
    received_date: str,
) -> LimsLabel:
    return LimsLabel(
        id=label_id or new_id("label_lims"),
        text=text,
        label_kind="lims",
        sample_code=sample_code,
        received_date=received_date,
    )


def find_workspace_widget(workspace: Workspace, widget_id: str) -> WorkspaceWidget:
    widget = next((entry for entry in workspace.widgets if entry.id == widget_id), None)
    if widget is None:
        raise ValueError("Unknown workspace widget")
    return widget


def find_produce_basket_lot(workspace: Workspace, produce_lot_id: str) -> ProduceLot:
    produce_lot = next((entry for entry in workspace.produce_basket_lots if entry.id == produce_lot_id), None)
    if produce_lot is None:
        raise ValueError("Unknown produce lot")
    return produce_lot


def find_workspace_widget_liquid(widget: WorkspaceWidget, liquid_entry_id: str) -> WorkbenchLiquid:
    liquid_entry = next((entry for entry in widget.liquids if entry.id == liquid_entry_id), None)
    if liquid_entry is None:
        raise ValueError("Unknown workspace widget liquid")
    return liquid_entry


def round_volume(volume_ml: float) -> float:
    return round(volume_ml, 3)


def format_volume(volume_ml: float) -> str:
    return f"{round_volume(volume_ml):g}"
