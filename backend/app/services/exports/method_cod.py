"""The acquisition method, in the platform's ``.cod.xlsx`` layout.

One row per compound, columns fixed except for the concentration ladder, whose
width is whatever the method declared. The layout is copied from a real
platform export, including the columns Betalab has nothing to put in: their own
file leaves ``num_cas``, ``formula``, ``loq`` and the rest blank, and inventing
a CAS number would mean inventing a real-world identifier rather than a
pedagogical placeholder. Blank is the honest value.
"""
from __future__ import annotations

import io
from typing import Any

from openpyxl import Workbook

from app.domain.acquisition_methods import AcquisitionMethod
from app.services.exports.channel_layout import EventSlot, build_event_layout

#: Channel column groups the layout always writes, whatever a compound uses.
#: Their reference file declares two; a method targeting only quantifiers still
#: writes the empty ``Ch.(2)`` group so every export has the same shape.
_MIN_CHANNEL_GROUPS = 2

#: Columns Betalab does not model. Present, always empty. See module docstring.
_UNMODELLED = ""

#: Value their own export carries on every row. Its meaning is internal to the
#: platform, so Betalab reproduces it rather than interpreting it.
_COMPOUND_TYPE = 3

_IDENTITY_COLUMNS = (
    "event",
    "name",
    "num_cas",
    "formula",
    "loq",
    "loq_unit",
    "nb_peaks",
    "type",
    "istd",
    "istd_name",
    "is_istd",
    "group",
    "ret_time",
    "min_time",
    "max_time",
    "main_channel",
)

_CHANNEL_COLUMNS = ("q1", "q3", "seg_id", "polarity", "q1_res", "q3_res", "ev")


def _channel_columns(group_count: int) -> tuple[str, ...]:
    return tuple(
        f"Ch.({number}) {column}"
        for number in range(1, group_count + 1)
        for column in _CHANNEL_COLUMNS
    )


#: Every column except the concentration ladder, whose width varies.
COD_BASE_COLUMNS: tuple[str, ...] = _IDENTITY_COLUMNS + _channel_columns(_MIN_CHANNEL_GROUPS)


def build_method_cod_rows(method: AcquisitionMethod) -> tuple[list[str], list[list[Any]]]:
    """Return the header and the data rows of the method file.

    The first column has no name: it is the platform's 0-based row index, while
    ``event`` numbers the same compounds from 1.
    """
    events = build_event_layout(method)
    group_count = max(
        [len(event.channels) for event in events] + [_MIN_CHANNEL_GROUPS]
    )
    levels = method.calibration_levels_ng_per_ml

    header = [
        "",
        *_IDENTITY_COLUMNS,
        *_channel_columns(group_count),
        *(f"Conc.({index})" for index in range(len(levels))),
    ]
    labels = {event.compound_id: event.compound_label for event in events}
    rows = [
        _build_row(index, event, group_count, levels, labels)
        for index, event in enumerate(events)
    ]
    return header, rows


def _build_row(
    index: int,
    event: EventSlot,
    group_count: int,
    levels: tuple[float, ...],
    labels: dict[str, str],
) -> list[Any]:
    is_istd = event.compound_kind == "internal_standard"
    quantifier = event.main_channel.transition
    retention_min = quantifier.expected_retention_time_s / 60.0
    half_window_min = quantifier.retention_window_s / 2.0 / 60.0

    row: list[Any] = [
        index,
        event.event,
        event.compound_label,
        _UNMODELLED,  # num_cas
        _UNMODELLED,  # formula
        _UNMODELLED,  # loq
        _UNMODELLED,  # loq_unit
        _UNMODELLED,  # nb_peaks
        _COMPOUND_TYPE,
        _UNMODELLED,  # istd
        "" if is_istd else labels.get(event.internal_standard_id or "", ""),
        1 if is_istd else 0,
        _UNMODELLED,  # group
        retention_min,
        retention_min - half_window_min,
        retention_min + half_window_min,
        event.main_channel.channel_number,
    ]

    by_number = {slot.channel_number: slot for slot in event.channels}
    for number in range(1, group_count + 1):
        slot = by_number.get(number)
        if slot is None:
            row.extend([_UNMODELLED] * len(_CHANNEL_COLUMNS))
            continue
        row.extend(
            [
                slot.transition.q1_mz,
                slot.transition.q3_mz,
                slot.seg_id,
                slot.transition.polarity,
                _UNMODELLED,  # q1_res
                _UNMODELLED,  # q3_res
                _UNMODELLED,  # ev
            ]
        )

    row.extend(levels)
    return row


def build_method_cod_workbook(method: AcquisitionMethod) -> bytes:
    """Render the method file as ``.xlsx`` bytes."""
    header, rows = build_method_cod_rows(method)
    workbook = Workbook()
    sheet = workbook.create_sheet("molecules", 0)
    del workbook["Sheet"]
    sheet.append([value if value != "" else None for value in header])
    for row in rows:
        sheet.append([value if value != "" else None for value in row])

    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
