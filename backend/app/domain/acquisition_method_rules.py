"""Validation and pedagogical warnings for user-authored acquisition methods.

Two very different judgements live here, and they must not be confused.

**Errors** are structural: the method could not be programmed into an
instrument at all. They block saving.

**Warnings** are analytical: the method is perfectly well-formed, it simply
will not see what its author probably expects. A transition watching masses no
compound produces is a legitimate thing to save — running it and finding a flat
trace is the whole point of the exercise. Warnings never block.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.domain.acquisition_methods import AcquisitionMethod
from app.domain.mrm_reference import find_reference_transition

WarningCode = Literal[
    "unmatched_transition",
    "retention_window_misses_peak",
    "product_ion_heavier_than_precursor",
]


@dataclass(frozen=True, slots=True)
class MethodWarning:
    code: WarningCode
    transition_id: str
    message: str


def validate_acquisition_method(method: AcquisitionMethod) -> list[str]:
    """Return the structural errors that make ``method`` unusable.

    An empty list means the method can be saved, however unwise its content.
    """
    errors: list[str] = []

    if not method.id.strip():
        errors.append("A method needs an identifier.")
    if not method.name.strip():
        errors.append("A method needs a name.")
    if not method.version.strip():
        errors.append("A method needs a version.")
    if method.runtime_s <= 0:
        errors.append("Run duration must be positive.")

    if not method.transitions:
        errors.append("A method needs at least one transition.")
        return errors

    seen_ids: set[str] = set()
    duplicated: set[str] = set()
    for transition in method.transitions:
        if not transition.id.strip():
            errors.append("Every transition needs an identifier.")
        elif transition.id in seen_ids:
            duplicated.add(transition.id)
        else:
            seen_ids.add(transition.id)

        if transition.q1_mz <= 0 or transition.q3_mz <= 0:
            errors.append(f"Transition '{transition.id}': m/z values must be positive.")
        if transition.dwell_time_ms <= 0:
            errors.append(f"Transition '{transition.id}': dwell time must be positive.")
        if transition.retention_window_s <= 0:
            errors.append(f"Transition '{transition.id}': retention window must be positive.")

    for transition_id in sorted(duplicated):
        errors.append(f"Duplicate transition identifier '{transition_id}'.")

    # Every targeted compound needs the channel its area would be read from.
    compounds_with_quantifier = {
        transition.compound_id
        for transition in method.transitions
        if transition.role == "quantifier"
    }
    for compound_id in method.compound_ids:
        if compound_id not in compounds_with_quantifier:
            errors.append(f"Compound '{compound_id}' has no quantifier transition.")

    return errors


def collect_acquisition_method_warnings(method: AcquisitionMethod) -> list[MethodWarning]:
    """Return non-blocking remarks about what ``method`` will actually record."""
    warnings: list[MethodWarning] = []

    for transition in method.transitions:
        if transition.q3_mz >= transition.q1_mz:
            warnings.append(
                MethodWarning(
                    code="product_ion_heavier_than_precursor",
                    transition_id=transition.id,
                    message=(
                        f"Q3 ({transition.q3_mz}) is not lighter than Q1 ({transition.q1_mz}). "
                        "A fragment heavier than its precursor is not physically expected."
                    ),
                )
            )

        reference = find_reference_transition(transition.q1_mz, transition.q3_mz)
        if reference is None:
            warnings.append(
                MethodWarning(
                    code="unmatched_transition",
                    transition_id=transition.id,
                    message=(
                        f"No known compound responds at {transition.q1_mz} → {transition.q3_mz}. "
                        "This channel will record baseline noise only."
                    ),
                )
            )
            continue

        half_width = transition.retention_window_s / 2.0
        drift = abs(reference.expected_retention_time_s - transition.expected_retention_time_s)
        if drift > half_width:
            warnings.append(
                MethodWarning(
                    code="retention_window_misses_peak",
                    transition_id=transition.id,
                    message=(
                        f"{reference.compound_label} elutes around "
                        f"{reference.expected_retention_time_s:.0f} s, outside the declared "
                        f"window. The channel will miss the peak."
                    ),
                )
            )

    return warnings
