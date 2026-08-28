"""One injection, in the platform's own chromatogram format.

The file is organised by *event* — one entry per compound — and each event
carries a single time axis shared by all of its channels. The instrument does
not work that way: it watches one channel at a time, so the two channels of a
compound are measured a dwell apart and never share an instant. Folding them
onto the event's cycle axis is what vendor software does when it writes the
file, and this module is where Betalab plays that role.

Two things are deliberately *absent* rather than empty:

* **No smoothed copy.** Only ``raw_ampl`` is written. Which filter to run over
  a trace is a processing decision, and it belongs to whoever integrates the
  peak — writing a second, pre-filtered array would be Betalab making that
  choice on their behalf.
* **No peak-picking verdict.** The platform names its own strategy from its own
  configuration. A key for it here would be an instrument claiming to have
  chosen a peak, which it never does.
"""

from __future__ import annotations

from typing import Any

from app.domain.acquisition_methods import AcquisitionMethod
from app.domain.models import InjectionMeasurement, TransitionTrace
from app.services.exports.channel_layout import ChannelSlot, build_event_layout

#: Times are written in minutes, rounded fine enough that the interval between
#: two consecutive points survives the conversion from seconds.
_TIME_DECIMALS = 6

#: Amplitudes keep enough digits to stay faithful without bloating the archive.
_AMPLITUDE_DECIMALS = 6


def analysis_name(output_filename: str) -> str:
    """The stem the platform indexes an analysis under.

    Their own files are named ``<stem>.mzML.json`` and carry ``<stem>`` in
    lower case, extension stripped.
    """
    stem = output_filename
    if stem.lower().endswith(".mzml"):
        stem = stem[: -len(".mzML")]
    return stem.lower()


def build_injection_document(
    injection: InjectionMeasurement,
    method: AcquisitionMethod,
) -> dict[str, Any]:
    """Reshape one injection's traces into the platform's chromatogram document."""
    traces = {trace.transition.id: trace for trace in injection.traces}
    measures: list[dict[str, Any]] = []

    for event in build_event_layout(method):
        axis_trace = traces.get(event.main_channel.transition.id)
        axis_s = list(axis_trace.times_s) if axis_trace is not None else []
        measures.append(
            {
                "event": event.event,
                "main_channel": event.main_channel.channel_number,
                "time": [round(value / 60.0, _TIME_DECIMALS) for value in axis_s],
                "time_step": _mean_step_min(axis_s),
                "channels": {str(slot.channel_number): _build_channel(slot, traces.get(slot.transition.id), axis_s) for slot in event.channels},
            }
        )

    return {"analysis_infos": {"name": analysis_name(injection.output_filename)}, "measures": measures}


def _mean_step_min(times_s: list[float]) -> float:
    if len(times_s) < 2:
        return 0.0
    return (times_s[-1] - times_s[0]) / (len(times_s) - 1) / 60.0


def _build_channel(
    slot: ChannelSlot,
    trace: TransitionTrace | None,
    axis_s: list[float],
) -> dict[str, Any]:
    transition = slot.transition
    amplitudes = _align_to_axis(trace, axis_s)
    return {
        "raw_ampl": amplitudes,
        "ampl_min": min(amplitudes, default=0.0),
        "ampl_max": max(amplitudes, default=0.0),
        "segment": slot.seg_id,
        "seg_id": slot.seg_id,
        "ce": transition.collision_energy_v,
        "q1": transition.q1_mz,
        "q3": transition.q3_mz,
        "polarity": transition.polarity,
        # Resolution and entrance voltage are not modelled.
        "q1_res": None,
        "q3_res": None,
        "ev": None,
        "time_seg": None,
    }


def _align_to_axis(trace: TransitionTrace | None, axis_s: list[float]) -> list[float]:
    """Read ``trace`` at the event's cycle instants.

    A channel measured on the same schedule as the axis is returned untouched.
    One measured on its own — a qualifier whose retention window was edited
    apart from its quantifier — is interpolated onto the axis, and reads zero
    wherever it was not watching, because that is what the detector reported
    there: nothing.
    """
    if trace is None or not axis_s:
        return []
    if trace.times_s == axis_s:
        return [round(value, _AMPLITUDE_DECIMALS) for value in trace.intensities]
    return [round(_interpolate(trace, instant), _AMPLITUDE_DECIMALS) for instant in axis_s]


def _interpolate(trace: TransitionTrace, instant: float) -> float:
    times = trace.times_s
    if not times or instant < times[0] or instant > times[-1]:
        return 0.0
    for index in range(1, len(times)):
        if instant <= times[index]:
            left, right = times[index - 1], times[index]
            span = right - left
            if span <= 0:
                return trace.intensities[index]
            weight = (instant - left) / span
            return trace.intensities[index - 1] * (1.0 - weight) + trace.intensities[index] * weight
    return trace.intensities[-1]
