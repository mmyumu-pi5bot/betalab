"""Acquisition method catalog: read every method, author user copies."""
from dataclasses import asdict, replace

from fastapi import HTTPException
from pydantic import BaseModel, Field

from app.domain.acquisition_methods import (
    AcquisitionMethod,
    GradientStep,
    IonSourceParameters,
    LiquidChromatographyParameters,
    MrmTransition,
    build_transitions_for_compounds,
)
from app.domain.mrm_reference import MRM_REFERENCE_CATALOG
from app.schemas.acquisition_method import (
    AcquisitionMethodSchema,
    AcquisitionMethodSummarySchema,
    MethodWarningSchema,
    MrmTransitionSchema,
    ReferenceCompoundSchema,
    ReferenceTransitionSchema,
    SavedAcquisitionMethodSchema,
    to_method_summary,
)
from app.services.acquisition_method_service import (
    AcquisitionMethodNotFoundError,
    ImmutableAcquisitionMethodError,
    InvalidAcquisitionMethodError,
    acquisition_method_service,
)

from .common import router


class DuplicateMethodBody(BaseModel):
    source_method_id: str
    new_method_id: str
    name: str
    version: str


class SaveMethodBody(BaseModel):
    name: str
    version: str
    runtime_s: float
    transitions: list[MrmTransitionSchema]
    calibration_levels_ng_per_ml: list[float] = Field(default_factory=list)


class ProposeTransitionsBody(BaseModel):
    compound_ids: list[str]


def _to_detail(method: AcquisitionMethod) -> SavedAcquisitionMethodSchema:
    return SavedAcquisitionMethodSchema(
        method=AcquisitionMethodSchema.model_validate(asdict(method)),
        warnings=[
            MethodWarningSchema(**asdict(warning))
            for warning in acquisition_method_service.warnings_for(method)
        ],
    )


def _resolve_or_404(method_id: str) -> AcquisitionMethod:
    try:
        return acquisition_method_service.get_method(method_id)
    except AcquisitionMethodNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get(
    "/catalog/acquisition-methods",
    response_model=list[AcquisitionMethodSummarySchema],
)
def list_acquisition_method_catalog() -> list[AcquisitionMethodSummarySchema]:
    return [to_method_summary(method) for method in acquisition_method_service.list_methods()]


@router.get(
    "/catalog/mrm-reference",
    response_model=list[ReferenceCompoundSchema],
)
def list_mrm_reference_catalog() -> list[ReferenceCompoundSchema]:
    """Compounds the simulated detector can see, with their known channels.

    This is what the console's simple mode offers: pick a pesticide and the
    catalog proposes its transitions.
    """
    by_compound: dict[str, ReferenceCompoundSchema] = {}
    for reference in MRM_REFERENCE_CATALOG:
        entry = by_compound.get(reference.compound_id)
        if entry is None:
            entry = ReferenceCompoundSchema(
                compound_id=reference.compound_id,
                compound_label=reference.compound_label,
                compound_kind=reference.compound_kind,
                transitions=[],
            )
            by_compound[reference.compound_id] = entry
        entry.transitions.append(
            ReferenceTransitionSchema(
                q1_mz=reference.q1_mz,
                q3_mz=reference.q3_mz,
                polarity=reference.polarity,
                role=reference.role,
                collision_energy_v=reference.collision_energy_v,
                expected_retention_time_s=reference.expected_retention_time_s,
                provenance=reference.provenance,
            )
        )
    return list(by_compound.values())


@router.post(
    "/catalog/acquisition-methods/propose-transitions",
    response_model=list[MrmTransitionSchema],
)
def propose_transitions(body: ProposeTransitionsBody) -> list[MrmTransitionSchema]:
    try:
        transitions = build_transitions_for_compounds(body.compound_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return [MrmTransitionSchema.model_validate(asdict(t)) for t in transitions]


@router.post(
    "/catalog/acquisition-methods/duplicate",
    response_model=SavedAcquisitionMethodSchema,
    status_code=201,
)
def duplicate_acquisition_method_route(body: DuplicateMethodBody) -> SavedAcquisitionMethodSchema:
    try:
        method = acquisition_method_service.duplicate(
            body.source_method_id,
            body.new_method_id,
            body.name,
            body.version,
        )
    except AcquisitionMethodNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidAcquisitionMethodError as exc:
        raise HTTPException(status_code=400, detail=exc.errors) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _to_detail(method)


@router.get(
    "/catalog/acquisition-methods/{method_id}",
    response_model=AcquisitionMethodSchema,
)
def get_acquisition_method_detail(method_id: str) -> AcquisitionMethodSchema:
    return AcquisitionMethodSchema.model_validate(asdict(_resolve_or_404(method_id)))


@router.get(
    "/catalog/acquisition-methods/{method_id}/warnings",
    response_model=list[MethodWarningSchema],
)
def get_acquisition_method_warnings(method_id: str) -> list[MethodWarningSchema]:
    method = _resolve_or_404(method_id)
    return [
        MethodWarningSchema(**asdict(warning))
        for warning in acquisition_method_service.warnings_for(method)
    ]


@router.put(
    "/catalog/acquisition-methods/{method_id}",
    response_model=SavedAcquisitionMethodSchema,
)
def save_acquisition_method(
    method_id: str, body: SaveMethodBody
) -> SavedAcquisitionMethodSchema:
    existing = _resolve_or_404(method_id)
    edited = replace(
        existing,
        name=body.name,
        version=body.version,
        runtime_s=body.runtime_s,
        transitions=tuple(
            MrmTransition(**transition.model_dump()) for transition in body.transitions
        ),
        calibration_levels_ng_per_ml=tuple(body.calibration_levels_ng_per_ml),
    )
    try:
        saved = acquisition_method_service.save_new_version(edited)
    except ImmutableAcquisitionMethodError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except InvalidAcquisitionMethodError as exc:
        raise HTTPException(status_code=400, detail=exc.errors) from exc
    return _to_detail(saved)


@router.delete("/catalog/acquisition-methods/{method_id}", status_code=204)
def delete_acquisition_method(method_id: str) -> None:
    try:
        acquisition_method_service.delete(method_id)
    except ImmutableAcquisitionMethodError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except AcquisitionMethodNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


__all__ = [
    "GradientStep",
    "IonSourceParameters",
    "LiquidChromatographyParameters",
    "delete_acquisition_method",
    "duplicate_acquisition_method_route",
    "get_acquisition_method_detail",
    "get_acquisition_method_warnings",
    "list_acquisition_method_catalog",
    "list_mrm_reference_catalog",
    "propose_transitions",
    "save_acquisition_method",
]
