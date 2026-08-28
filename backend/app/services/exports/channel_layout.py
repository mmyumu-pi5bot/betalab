"""The channel numbering shared by the two result files.

The method file declares the channels and the injection files reference them
back. Both must agree on two things: which channel of a compound is number 1,
and what ``seg_id`` each one carries. Deriving that layout twice would let the
pair drift apart, so it is derived once, here.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.domain.acquisition_methods import AcquisitionMethod, MrmTransition


@dataclass(frozen=True, slots=True)
class ChannelSlot:
    """One transition, placed in the numbering the result files use."""

    #: 1-based channel number inside its compound. The quantifier is always 1,
    #: because it is the channel an area would be read from.
    channel_number: int
    #: 0-based counter running across every channel of the method, in emission
    #: order. This is the ``seg_id`` both files write.
    seg_id: int
    transition: MrmTransition


@dataclass(frozen=True, slots=True)
class EventSlot:
    """One compound, as the platform's ``event``."""

    #: 1-based, following the method's declaration order.
    event: int
    compound_id: str
    compound_label: str
    compound_kind: str
    internal_standard_id: str | None
    channels: tuple[ChannelSlot, ...]

    @property
    def main_channel(self) -> ChannelSlot:
        return self.channels[0]


def build_event_layout(method: AcquisitionMethod) -> tuple[EventSlot, ...]:
    """Group a method's transitions into numbered events and channels.

    Compounds keep their declaration order. Inside a compound the quantifier
    comes first — everything else follows in declaration order, so a second
    qualifier lands on channel 3 rather than displacing anything.
    """
    grouped: dict[str, list[MrmTransition]] = {}
    for transition in method.transitions:
        grouped.setdefault(transition.compound_id, []).append(transition)

    events: list[EventSlot] = []
    seg_id = 0
    for event_number, (compound_id, transitions) in enumerate(grouped.items(), start=1):
        ordered = sorted(transitions, key=lambda t: 0 if t.role == "quantifier" else 1)
        channels: list[ChannelSlot] = []
        for channel_number, transition in enumerate(ordered, start=1):
            channels.append(
                ChannelSlot(
                    channel_number=channel_number,
                    seg_id=seg_id,
                    transition=transition,
                )
            )
            seg_id += 1
        first = ordered[0]
        events.append(
            EventSlot(
                event=event_number,
                compound_id=compound_id,
                compound_label=first.compound_label,
                compound_kind=first.compound_kind,
                internal_standard_id=first.internal_standard_id,
                channels=tuple(channels),
            )
        )
    return tuple(events)
