"""Read-only catalog of LC-MS/MS acquisition methods."""
from dataclasses import asdict

from fastapi import HTTPException

from app.domain.acquisition_methods import get_acquisition_method, list_acquisition_methods
from app.schemas.acquisition_method import (
    AcquisitionMethodSchema,
    AcquisitionMethodSummarySchema,
    to_method_summary,
)

from .common import router


@router.get(
    "/catalog/acquisition-methods",
    response_model=list[AcquisitionMethodSummarySchema],
)
def list_acquisition_method_catalog() -> list[AcquisitionMethodSummarySchema]:
    return [to_method_summary(method) for method in list_acquisition_methods()]


@router.get(
    "/catalog/acquisition-methods/{method_id}",
    response_model=AcquisitionMethodSchema,
)
def get_acquisition_method_detail(method_id: str) -> AcquisitionMethodSchema:
    try:
        method = get_acquisition_method(method_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return AcquisitionMethodSchema.model_validate(asdict(method))
