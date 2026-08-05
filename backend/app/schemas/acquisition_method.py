"""Serialization schemas for LC-MS/MS acquisition methods.

These schemas serve two callers: the read-only catalog endpoints, and the
immutable method snapshot frozen into every sequence run.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.domain.acquisition_methods import AcquisitionMethod


class MrmTransitionSchema(BaseModel):
    id: str
    compound_id: str
    compound_label: str
    compound_kind: str
    q1_mz: float
    q3_mz: float
    polarity: str
    role: str
    collision_energy_v: float
    dwell_time_ms: float
    expected_retention_time_s: float
    retention_window_s: float
    internal_standard_id: str | None = None
    provenance: str


class GradientStepSchema(BaseModel):
    time_s: float
    mobile_phase_b_percent: float


class LiquidChromatographyParametersSchema(BaseModel):
    column_label: str
    column_temperature_c: float
    mobile_phase_a: str
    mobile_phase_b: str
    flow_ml_per_min: float
    gradient: list[GradientStepSchema] = Field(default_factory=list)


class IonSourceParametersSchema(BaseModel):
    source_type: str
    ion_spray_voltage_v: float
    source_temperature_c: float
    nebulizer_gas_psi: float
    heater_gas_psi: float
    curtain_gas_psi: float


class AcquisitionMethodSchema(BaseModel):
    """Full method content — also the shape of a run's frozen snapshot."""

    id: str
    name: str
    version: str
    runtime_s: float
    is_educational: bool
    provenance_note: str
    is_built_in: bool
    liquid_chromatography: LiquidChromatographyParametersSchema
    ion_source: IonSourceParametersSchema
    transitions: list[MrmTransitionSchema] = Field(default_factory=list)


class AcquisitionMethodSummarySchema(BaseModel):
    """List view: identity and size, without the transition table."""

    id: str
    name: str
    version: str
    runtime_s: float
    is_educational: bool
    provenance_note: str
    is_built_in: bool
    compound_count: int
    transition_count: int


def to_method_summary(method: AcquisitionMethod) -> AcquisitionMethodSummarySchema:
    return AcquisitionMethodSummarySchema(
        id=method.id,
        name=method.name,
        version=method.version,
        runtime_s=method.runtime_s,
        is_educational=method.is_educational,
        provenance_note=method.provenance_note,
        is_built_in=method.is_built_in,
        compound_count=len(method.compound_ids),
        transition_count=len(method.transitions),
    )
