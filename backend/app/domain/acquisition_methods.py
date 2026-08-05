"""LC-MS/MS acquisition methods: structured, versioned, and registered.

An :class:`AcquisitionMethod` is what the technician selects in the console and
what the instrument is programmed with. It is a *declaration*: it says which MRM
channels to watch and under which chromatographic and source conditions. Whether
those channels actually see anything is decided by
:mod:`app.domain.mrm_reference`.

.. warning::
   The built-in ``apple_pesticides_mrm_v1`` is an **educational method**. Its
   transitions are copied from the reference catalog, whose values are explicit
   placeholders rather than validated laboratory data. ``is_educational`` is
   ``True`` and every transition carries its own ``provenance`` marker so the
   distinction survives serialization, persistence and the run snapshot.
"""
from __future__ import annotations

from dataclasses import dataclass, replace

from app.domain.mrm_reference import (
    INTERNAL_STANDARD_COMPOUND_ID,
    MRM_REFERENCE_CATALOG,
    CompoundKind,
    Polarity,
    TransitionProvenance,
    TransitionRole,
)

APPLE_PESTICIDES_MRM_V1_ID = "apple_pesticides_mrm_v1"


@dataclass(frozen=True, slots=True)
class MrmTransition:
    """One MRM channel declared by a method."""

    id: str
    compound_id: str
    compound_label: str
    compound_kind: CompoundKind
    q1_mz: float
    q3_mz: float
    polarity: Polarity
    role: TransitionRole
    collision_energy_v: float
    dwell_time_ms: float
    expected_retention_time_s: float
    retention_window_s: float
    #: Compound id of the internal standard used to correct this channel.
    #: ``None`` on the internal standard's own channels.
    internal_standard_id: str | None
    #: Where the numeric values come from. Never leave this implicit.
    provenance: TransitionProvenance


@dataclass(frozen=True, slots=True)
class GradientStep:
    time_s: float
    mobile_phase_b_percent: float


@dataclass(frozen=True, slots=True)
class LiquidChromatographyParameters:
    column_label: str
    column_temperature_c: float
    mobile_phase_a: str
    mobile_phase_b: str
    flow_ml_per_min: float
    gradient: tuple[GradientStep, ...]


@dataclass(frozen=True, slots=True)
class IonSourceParameters:
    source_type: str
    ion_spray_voltage_v: float
    source_temperature_c: float
    nebulizer_gas_psi: float
    heater_gas_psi: float
    curtain_gas_psi: float


@dataclass(frozen=True, slots=True)
class AcquisitionMethod:
    id: str
    name: str
    version: str
    runtime_s: float
    #: ``True`` when the numeric content is pedagogical rather than validated.
    is_educational: bool
    #: Human-readable statement of where the method as a whole comes from.
    provenance_note: str
    #: Built-in methods cannot be edited; a user must duplicate them first.
    is_built_in: bool
    liquid_chromatography: LiquidChromatographyParameters
    ion_source: IonSourceParameters
    transitions: tuple[MrmTransition, ...]

    @property
    def compound_ids(self) -> tuple[str, ...]:
        """Distinct compounds targeted by the method, in declaration order."""
        seen: dict[str, None] = {}
        for transition in self.transitions:
            seen.setdefault(transition.compound_id, None)
        return tuple(seen)


def _transition_id(compound_id: str, role: TransitionRole) -> str:
    return f"{compound_id}__{role}"


def _built_in_transitions() -> tuple[MrmTransition, ...]:
    """Mirror the reference catalog into a correctly configured method.

    The built-in method is the "right answer": every declared channel addresses a
    real reference channel. Step-5 user methods are free to drift away from it.
    """
    dwell_by_kind = {"analyte": 25.0, "internal_standard": 40.0}
    return tuple(
        MrmTransition(
            id=_transition_id(reference.compound_id, reference.role),
            compound_id=reference.compound_id,
            compound_label=reference.compound_label,
            compound_kind=reference.compound_kind,
            q1_mz=reference.q1_mz,
            q3_mz=reference.q3_mz,
            polarity=reference.polarity,
            role=reference.role,
            collision_energy_v=reference.collision_energy_v,
            dwell_time_ms=dwell_by_kind[reference.compound_kind],
            expected_retention_time_s=reference.expected_retention_time_s,
            retention_window_s=60.0,
            internal_standard_id=(
                None
                if reference.compound_kind == "internal_standard"
                else INTERNAL_STANDARD_COMPOUND_ID
            ),
            provenance=reference.provenance,
        )
        for reference in MRM_REFERENCE_CATALOG
    )


APPLE_PESTICIDES_MRM_V1 = AcquisitionMethod(
    id=APPLE_PESTICIDES_MRM_V1_ID,
    name="Apple pesticides — MRM",
    version="1.0.0",
    runtime_s=720.0,
    is_educational=True,
    provenance_note=(
        "Educational method. Retention times, m/z pairs and collision energies are "
        "internally consistent placeholders authored for Betalab, not values from a "
        "validated laboratory method, a vendor application note or the literature. "
        "Do not reuse them as analytical reference data."
    ),
    is_built_in=True,
    liquid_chromatography=LiquidChromatographyParameters(
        column_label="C18 reversed phase, 100 x 2.1 mm, 1.8 µm",
        column_temperature_c=40.0,
        mobile_phase_a="Water + 5 mM ammonium formate + 0.1 % formic acid",
        mobile_phase_b="Methanol + 5 mM ammonium formate + 0.1 % formic acid",
        flow_ml_per_min=0.4,
        gradient=(
            GradientStep(0.0, 5.0),
            GradientStep(60.0, 5.0),
            GradientStep(480.0, 95.0),
            GradientStep(600.0, 95.0),
            GradientStep(610.0, 5.0),
            GradientStep(720.0, 5.0),
        ),
    ),
    ion_source=IonSourceParameters(
        source_type="Heated electrospray (ESI)",
        ion_spray_voltage_v=4500.0,
        source_temperature_c=450.0,
        nebulizer_gas_psi=50.0,
        heater_gas_psi=55.0,
        curtain_gas_psi=30.0,
    ),
    transitions=_built_in_transitions(),
)


BUILT_IN_ACQUISITION_METHODS: tuple[AcquisitionMethod, ...] = (APPLE_PESTICIDES_MRM_V1,)

_BUILT_IN_BY_ID: dict[str, AcquisitionMethod] = {
    method.id: method for method in BUILT_IN_ACQUISITION_METHODS
}


def list_acquisition_methods() -> tuple[AcquisitionMethod, ...]:
    """Return every method the console may offer, built-in ones first."""
    return BUILT_IN_ACQUISITION_METHODS


def get_acquisition_method(method_id: str) -> AcquisitionMethod:
    """Return the method registered under ``method_id``.

    Raises:
        ValueError: when no such method exists.
    """
    method = _BUILT_IN_BY_ID.get(method_id)
    if method is None:
        raise ValueError(f"Unknown acquisition method '{method_id}'.")
    return method


def snapshot_acquisition_method(method: AcquisitionMethod) -> AcquisitionMethod:
    """Return an immutable copy of ``method`` to freeze into a sequence run.

    Every dataclass involved is frozen, and the collections are tuples, so the
    copy cannot drift even if the registry later ships a new version under the
    same id. Reproducibility of a past run is therefore guaranteed by the run
    itself, not by the registry.
    """
    return replace(method)
