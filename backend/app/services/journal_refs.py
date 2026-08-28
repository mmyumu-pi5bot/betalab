from __future__ import annotations

from app.domain.journal_codes import JournalRef
from app.domain.models import (
    ProduceLot,
    RackSlot,
    WorkbenchLiquid,
    WorkbenchSlot,
    WorkbenchTool,
    WorkspaceWidget,
)

#: Entities named inside journal messages. Each ref carries the stable id the
#: client translates from, so a French journal reads "Tube à centrifuger 50 mL"
#: without the backend knowing any French.


def tool_ref(tool: WorkbenchTool) -> JournalRef:
    return JournalRef(kind="tool", id=tool.tool_id, text=tool.label)


def widget_ref(widget: WorkspaceWidget) -> JournalRef:
    return JournalRef(kind="widget", id=widget.widget_type, text=widget.label)


def widget_type_ref(widget_type: str, text: str) -> JournalRef:
    """A piece of equipment named in a message without the widget at hand."""
    return JournalRef(kind="widget", id=widget_type, text=text)


def slot_ref(slot: WorkbenchSlot | RackSlot) -> JournalRef:
    return JournalRef(kind="slot", id=slot.id, text=slot.label)


def liquid_ref(liquid: WorkbenchLiquid) -> JournalRef:
    return JournalRef(kind="liquid", id=liquid.liquid_id, text=liquid.name)


def liquid_id_ref(liquid_id: str, name: str) -> JournalRef:
    return JournalRef(kind="liquid", id=liquid_id, text=name)


def produce_ref(produce_lot: ProduceLot) -> JournalRef:
    return JournalRef(
        kind="produce",
        id=produce_lot.label_code or produce_lot.produce_type,
        text=produce_lot.label,
        index=produce_lot.label_index,
    )


def text_ref(text: str) -> JournalRef:
    """A name the backend cannot resolve to an id — free label text, a slot
    label coming from a source the caller only knows as a string."""
    return JournalRef(kind="text", id="", text=text)
