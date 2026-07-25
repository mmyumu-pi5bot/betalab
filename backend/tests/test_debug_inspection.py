from typing import cast

import pytest
from fastapi import HTTPException

from app.api.experiment_routes import debug_inspection
from app.core.config import Settings
from app.domain.models import ProduceFraction, WorkbenchLiquid, WorkbenchTool
from app.services.experiment_service import ExperimentRuntimeService


def test_debug_inspection_returns_true_tool_quantities_without_mutating_state() -> None:
    service = ExperimentRuntimeService()
    created = service.create_experiment()
    experiment = service._require_experiment(created.id)
    tool = WorkbenchTool(
        id="tube_1",
        tool_id="centrifuge_tube_50ml",
        label="50 mL centrifuge tube",
        subtitle="Extraction ready",
        accent="sky",
        tool_type="centrifuge_tube",
        capacity_ml=50.0,
        liquids=[
            WorkbenchLiquid(
                id="liquid_1",
                liquid_id="acetonitrile_extraction",
                name="Acetonitrile",
                volume_ml=10.0,
                true_volume_ml=9.87,
                accent="amber",
            )
        ],
        produce_fractions=[
            ProduceFraction(
                id="fraction_1",
                produce_lot_id="lot_1",
                produce_material_state_id="state_1",
                mass_g=1.2,
                true_mass_g=1.08,
            )
        ],
    )
    experiment.workbench.slots[0].tool = tool
    version_before = experiment.snapshot_version

    inspected = service.get_debug_inspection(created.id, "tool", tool.id)
    liquids = cast(list[dict[str, object]], inspected["liquids"])
    fractions = cast(list[dict[str, object]], inspected["produce_fractions"])

    assert liquids[0]["volume_ml"] == pytest.approx(10.0)
    assert liquids[0]["true_volume_ml"] == pytest.approx(9.87)
    assert fractions[0]["mass_g"] == pytest.approx(1.2)
    assert fractions[0]["true_mass_g"] == pytest.approx(1.08)
    assert experiment.snapshot_version == version_before


def test_debug_inspection_returns_true_pipette_quantities() -> None:
    service = ExperimentRuntimeService()
    created = service.create_experiment()
    experiment = service._require_experiment(created.id)
    experiment.pipette.volume_ml = 0.5
    experiment.pipette.true_volume_ml = 0.49

    inspected = service.get_debug_inspection(created.id, "pipette", "pipette")

    assert inspected["volume_ml"] == pytest.approx(0.5)
    assert inspected["true_volume_ml"] == pytest.approx(0.49)


def test_debug_inspection_rejects_unknown_entity_kind() -> None:
    service = ExperimentRuntimeService()
    created = service.create_experiment()

    with pytest.raises(ValueError, match="Unknown debug inspection kind"):
        service.get_debug_inspection(created.id, "unknown", "anything")


def test_debug_inspection_endpoint_is_disabled_outside_development(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        debug_inspection,
        "settings",
        Settings(environment="production"),
    )

    with pytest.raises(HTTPException) as exc_info:
        debug_inspection.inspect_debug_entity("experiment_1", "pipette", "pipette")

    assert exc_info.value.status_code == 404


def test_debug_inspection_endpoint_returns_private_state_in_development(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = ExperimentRuntimeService()
    created = service.create_experiment()
    experiment = service._require_experiment(created.id)
    experiment.pipette.volume_ml = 0.5
    experiment.pipette.true_volume_ml = 0.49
    monkeypatch.setattr(debug_inspection, "experiment_service", service)
    monkeypatch.setattr(
        debug_inspection,
        "settings",
        Settings(environment="development"),
    )

    inspected = debug_inspection.inspect_debug_entity(
        created.id,
        "pipette",
        "pipette",
    )

    assert inspected["true_volume_ml"] == pytest.approx(0.49)
