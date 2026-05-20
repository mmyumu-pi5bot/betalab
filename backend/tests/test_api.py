from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import app.api.experiments as experiments_api
from app.api.experiment_routes import analytical_balance as experiment_routes_analytical_balance
from app.api.experiment_routes import common as experiment_routes_common
from app.api.experiment_routes import core as experiment_routes_core
from app.api.experiment_routes import dnd as experiment_routes_dnd
from app.api.experiment_routes import gross_balance as experiment_routes_gross_balance
from app.api.experiment_routes import rack as experiment_routes_rack
from app.api.experiment_routes import reception as experiment_routes_reception
from app.api.experiment_routes import trash as experiment_routes_trash
from app.api.experiment_routes import workbench as experiment_routes_workbench
from app.api.experiment_routes import workspace as experiment_routes_workspace
from app.core.config import Settings, settings
from app.domain.models import ProduceFraction, ProduceMaterialState
from app.main import app
from app.services.experiment_repository import SqliteExperimentRepository
from app.services.experiment_service import ExperimentRuntimeService
from app.services.helpers.produce_material_states import set_material_state_name, update_material_state
from app.services.helpers.workbench import build_workbench_tool


@pytest.fixture(autouse=True)
def isolated_api_experiment_service(tmp_path, monkeypatch):
    isolated_service = ExperimentRuntimeService(repository=SqliteExperimentRepository(str(tmp_path / "api-tests.sqlite3")))
    monkeypatch.setattr(experiment_routes_common, "experiment_service", isolated_service)
    monkeypatch.setattr(experiment_routes_analytical_balance, "experiment_service", isolated_service)
    monkeypatch.setattr(experiment_routes_core, "experiment_service", isolated_service)
    monkeypatch.setattr(experiment_routes_dnd, "experiment_service", isolated_service)
    monkeypatch.setattr(
        experiment_routes_gross_balance,
        "experiment_service",
        isolated_service,
    )
    monkeypatch.setattr(experiment_routes_rack, "experiment_service", isolated_service)
    monkeypatch.setattr(experiment_routes_reception, "experiment_service", isolated_service)
    monkeypatch.setattr(experiment_routes_trash, "experiment_service", isolated_service)
    monkeypatch.setattr(experiment_routes_workbench, "experiment_service", isolated_service)
    monkeypatch.setattr(experiment_routes_workspace, "experiment_service", isolated_service)
    monkeypatch.setattr(experiments_api, "experiment_service", isolated_service)
    globals()["experiment_service"] = isolated_service
    return isolated_service


experiment_service = experiments_api.experiment_service


def _create_experiment(client: TestClient) -> str:
    created = client.post("/experiments")
    assert created.status_code == 200
    return created.json()["id"]


def _find_widget(payload: dict, widget_id: str) -> dict:
    return next(widget for widget in payload["workspace"]["widgets"] if widget["id"] == widget_id)


def _find_material_state(payload: dict, produce_lot_id: str) -> dict:
    return next(state for state in payload["produce_material_states"] if state["produce_lot_id"] == produce_lot_id)


def test_settings_defaults_are_exposed() -> None:
    configured = Settings()

    assert configured.app_name == "Betalab Simulation API"
    assert configured.app_version == "0.1.0"
    assert settings.app_name == configured.app_name


def test_healthcheck_returns_ok() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_and_fetch_experiment_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)
        fetched = client.get(f"/experiments/{experiment_id}")

    assert fetched.status_code == 200
    assert fetched.json()["id"] == experiment_id
    assert "last_simulation_at" in fetched.json()
    assert fetched.json()["snapshot_version"] >= 1
    assert fetched.json()["workbench"]["slots"][0]["tool"] is None
    assert fetched.json()["rack"]["slots"][0]["tool"] is None
    assert fetched.json()["trash"]["children"] == []
    assert any(widget["id"] == "workbench" for widget in fetched.json()["workspace"]["widgets"])
    assert fetched.json()["basket_tools"][0]["tool_type"] == "sample_bag"
    assert fetched.json()["lims_reception"]["status"] == "awaiting_reception"


def test_reception_routes_register_and_label_received_bag_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        created = client.get(f"/experiments/{experiment_id}")
        basket_tool_id = created.json()["basket_tools"][0]["id"]

        placed = client.post(
            f"/experiments/{experiment_id}/reception/bag/place-on-workbench",
            json={"target_slot_id": "station_1", "tool_id": basket_tool_id},
        )
        weighed = client.post(
            f"/experiments/{experiment_id}/reception/gross-weight/record",
            json={"measured_gross_mass_g": 2486.0},
        )
        registered = client.post(
            f"/experiments/{experiment_id}/lims/reception",
            json={
                "orchard_name": "Verger Saint-Martin",
                "harvest_date": "2026-03-29",
                "indicative_mass_g": 2500.0,
                "measured_gross_mass_g": 2486.0,
                "measured_sample_mass_g": 10.0,
            },
        )
        printed = client.post(f"/experiments/{experiment_id}/lims/print-label")
        applied = client.post(
            f"/experiments/{experiment_id}/lims/apply-label-to-workbench-bag",
            json={"slot_id": "station_1"},
        )

    assert placed.status_code == 200
    assert placed.json()["basket_tools"] == []
    assert placed.json()["workbench"]["slots"][0]["tool"]["tool_type"] == "sample_bag"
    assert weighed.status_code == 200
    assert weighed.json()["lims_reception"]["measured_gross_mass_g"] == pytest.approx(2486.0)
    assert registered.status_code == 200
    assert registered.json()["lims_reception"]["measured_sample_mass_g"] == pytest.approx(10.0)
    sample_code = registered.json()["lims_reception"]["lab_sample_code"]
    assert sample_code.startswith("APP-2026-")
    assert printed.status_code == 200
    assert printed.json()["lims_reception"]["printed_label_ticket"]["sample_code"] == sample_code
    assert printed.json()["lims_reception"]["printed_label_ticket"]["received_date"]
    assert applied.status_code == 200
    assert applied.json()["workbench"]["slots"][0]["tool"]["sample_label_text"] == sample_code
    assert applied.json()["workbench"]["slots"][0]["tool"]["sample_label_received_date"]
    assert applied.json()["lims_reception"]["status"] == "received"


def test_snapshot_exposes_dnd_contract_fields_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        created = client.get(f"/experiments/{experiment_id}")
        basket_tool_id = created.json()["basket_tools"][0]["id"]

        placed = client.post(
            f"/experiments/{experiment_id}/reception/bag/place-on-workbench",
            json={"target_slot_id": "station_1", "tool_id": basket_tool_id},
        )
        registered = client.post(
            f"/experiments/{experiment_id}/lims/reception",
            json={
                "orchard_name": "Verger Saint-Martin",
                "harvest_date": "2026-03-29",
                "indicative_mass_g": 2500.0,
                "measured_gross_mass_g": None,
                "measured_sample_mass_g": 10.0,
            },
        )
        printed = client.post(f"/experiments/{experiment_id}/lims/print-label")
        applied = client.post(
            f"/experiments/{experiment_id}/lims/apply-label-to-workbench-bag",
            json={"slot_id": "station_1"},
        )

    assert placed.status_code == 200
    assert registered.status_code == 200
    assert printed.status_code == 200
    assert applied.status_code == 200

    printed_ticket = printed.json()["lims_reception"]["printed_label_ticket"]
    assert printed_ticket["is_draggable"] is True
    assert printed_ticket["allowed_drop_targets"] == [
        "workbench_slot",
        "gross_balance_widget",
        "analytical_balance_widget",
        "trash_bin",
    ]
    placed_slot = placed.json()["workbench"]["slots"][0]
    assert placed_slot["drop_target_types"] == ["workbench_slot"]
    placed_tool_containment = placed_slot["tool"]["containment"]
    assert placed_tool_containment["can_receive"] is True
    assert {"entity_kind": "sample_label", "tool_type": None, "liquid_type": None} in placed_tool_containment["accepts"]

    tool = applied.json()["workbench"]["slots"][0]["tool"]
    applied_slot = applied.json()["workbench"]["slots"][0]
    assert applied_slot["drop_target_types"] == ["workbench_slot"]
    assert tool["is_draggable"] is True
    assert tool["can_seal"] is True
    assert tool["can_receive_liquids"] is False
    assert tool["can_receive_produce"] is True
    assert tool["is_sealed"] is True
    assert tool["can_receive_contents"] is False
    assert tool["allowed_drop_targets"] == [
        "workbench_slot",
        "trash_bin",
        "gross_balance_widget",
    ]
    assert tool["labels"][0]["is_draggable"] is True
    assert tool["labels"][0]["allowed_drop_targets"] == [
        "workbench_slot",
        "gross_balance_widget",
        "analytical_balance_widget",
        "trash_bin",
    ]
    assert {
        "entity_kind": "sample_label",
        "id": tool["labels"][0]["id"],
        "tool_type": None,
        "liquid_type": None,
        "produce_type": None,
    } in tool["children"]
    assert tool["containment"]["accepts"] == [
        {"entity_kind": "sample_label", "tool_type": None, "liquid_type": None},
    ]
    gross_balance_widget = next(widget for widget in applied.json()["workspace"]["widgets"] if widget["id"] == "gross_balance")
    analytical_balance_widget = next(widget for widget in applied.json()["workspace"]["widgets"] if widget["id"] == "analytical_balance")
    grinder_widget = next(widget for widget in applied.json()["workspace"]["widgets"] if widget["id"] == "grinder")
    assert gross_balance_widget["drop_target_types"] == ["gross_balance_widget"]
    assert gross_balance_widget["is_storable"] is True
    assert gross_balance_widget["can_store"] is True
    assert gross_balance_widget["allowed_drop_targets"] == ["workspace_canvas"]
    assert analytical_balance_widget["drop_target_types"] == ["analytical_balance_widget"]
    assert grinder_widget["drop_target_types"] == ["grinder_widget"]
    assert grinder_widget["is_storable"] is True
    assert grinder_widget["can_store"] is True
    assert grinder_widget["allowed_drop_targets"] == ["workspace_canvas"]


def test_toolbar_catalog_exposes_backend_dnd_targets_over_http() -> None:
    with TestClient(app) as client:
        response = client.get("/experiments/catalog/toolbar")

    assert response.status_code == 200
    categories = response.json()
    sample_vial = next(item for category in categories for item in category["items"] if item["id"] == "sample_vial_lcms")
    cutting_board = next(item for category in categories for item in category["items"] if item["id"] == "cutting_board_hdpe")
    dry_ice = next(item for category in categories for item in category["items"] if item["id"] == "dry_ice_pellets")
    label = next(item for category in categories for item in category["items"] if item["id"] == "sampling_bag_label")

    assert sample_vial["item_type"] == "tool"
    assert sample_vial["can_seal"] is True
    assert sample_vial["can_receive_liquids"] is True
    assert sample_vial["can_receive_produce"] is False
    assert sample_vial["allowed_drop_targets"] == [
        "workbench_slot",
        "rack_slot",
        "trash_bin",
        "gross_balance_widget",
        "analytical_balance_widget",
    ]
    assert cutting_board["item_type"] == "tool"
    assert cutting_board["allowed_drop_targets"] == ["workbench_slot", "gross_balance_widget"]
    assert dry_ice["item_type"] == "liquid"
    assert dry_ice["allowed_drop_targets"] == ["grinder_widget"]
    assert label["item_type"] == "sample_label"
    assert label["allowed_drop_targets"] == [
        "workbench_slot",
        "gross_balance_widget",
        "analytical_balance_widget",
        "trash_bin",
    ]


def _find_slot(payload: dict, slot_id: str) -> dict:
    return next(s for s in payload["workbench"]["slots"] if s["id"] == slot_id)


def test_dnd_move_places_palette_tool_on_workbench_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)
        moved = client.post(
            f"/experiments/{experiment_id}/dnd/move",
            json={
                "entity": {"kind": "tool", "id": "cutting_board_hdpe"},
                "source": {"kind": "palette", "id": "lab_tools"},
                "destination": {"kind": "workbench_slot", "id": "station_1"},
            },
        )

    assert moved.status_code == 200
    assert _find_slot(moved.json(), "station_1")["tool"]["tool_type"] == "cutting_board"


def test_dnd_move_rejects_cutting_board_to_trash_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)
        response = client.post(
            f"/experiments/{experiment_id}/dnd/move",
            json={
                "entity": {"kind": "tool", "id": "cutting_board_hdpe"},
                "source": {"kind": "palette", "id": "lab_tools"},
                "destination": {"kind": "trash_bin", "id": "trash_bin"},
            },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Cutting board cannot be dropped on trash."


def test_dnd_move_moves_workbench_tool_to_gross_balance_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)
        placed = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_1/place-tool",
            json={"tool_id": "sealed_sampling_bag"},
        )
        moved = client.post(
            f"/experiments/{experiment_id}/dnd/move",
            json={
                "entity": {"kind": "tool", "id": "station_1"},
                "source": {"kind": "workbench", "id": "station_1"},
                "destination": {"kind": "gross_balance", "id": "gross_balance"},
            },
        )

    assert placed.status_code == 200
    assert moved.status_code == 200
    assert _find_slot(moved.json(), "station_1")["tool"] is None
    assert _find_widget(moved.json(), "gross_balance")["tool"]["tool_type"] == "sample_bag"


def test_dnd_move_moves_produce_lot_between_workbench_tools_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)
        created_lot = client.post(f"/experiments/{experiment_id}/workspace/produce-lots", json={"produce_type": "apple"})
        placed_bag = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_1/place-tool",
            json={"tool_id": "sealed_sampling_bag"},
        )
        client.post(f"/experiments/{experiment_id}/workbench/slots")
        client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_2/place-tool",
            json={"tool_id": "cutting_board_hdpe"},
        )
        produce_lot_id = created_lot.json()["basket_tools"][-1]["produce_lots"][0]["id"]
        added_to_bag = client.post(
            f"/experiments/{experiment_id}/dnd/move",
            json={
                "entity": {"kind": "produce_lot", "id": produce_lot_id},
                "source": {"kind": "basket", "id": "produce_basket"},
                "destination": {"kind": "workbench_tool", "id": "station_1"},
            },
        )
        moved_to_board = client.post(
            f"/experiments/{experiment_id}/dnd/move",
            json={
                "entity": {"kind": "produce_lot", "id": produce_lot_id},
                "source": {"kind": "workbench", "id": "station_1"},
                "destination": {"kind": "workbench_tool", "id": "station_2"},
            },
        )

    assert placed_bag.status_code == 200
    assert added_to_bag.status_code == 200
    assert moved_to_board.status_code == 200
    assert _find_slot(moved_to_board.json(), "station_1")["tool"]["produce_lots"] == []
    assert _find_slot(moved_to_board.json(), "station_2")["tool"]["produce_lots"][0]["id"] == produce_lot_id


def test_received_lot_can_flow_from_reception_to_ground_jar_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        # --- Réception ---
        created = client.get(f"/experiments/{experiment_id}")
        basket_tool_id = created.json()["basket_tools"][0]["id"]
        basket_moved_to_balance = client.post(
            f"/experiments/{experiment_id}/gross-balance/place-basket-tool",
            json={"tool_id": basket_tool_id},
        )
        registered = client.post(
            f"/experiments/{experiment_id}/lims/reception",
            json={
                "orchard_name": "Verger Saint-Martin",
                "harvest_date": "2026-03-29",
                "indicative_mass_g": 2500.0,
                "measured_gross_mass_g": None,
                "measured_sample_mass_g": 10.0,
            },
        )
        printed = client.post(f"/experiments/{experiment_id}/lims/print-label")
        labeled = client.post(f"/experiments/{experiment_id}/lims/apply-label-to-gross-balance-bag")

        # --- Découpe ---
        moved_bag_to_bench = client.post(
            f"/experiments/{experiment_id}/gross-balance/move-tool-to-workbench",
            json={"target_slot_id": "station_1"},
        )
        added_slot = client.post(f"/experiments/{experiment_id}/workbench/slots")
        placed_board = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_2/place-tool",
            json={"tool_id": "cutting_board_hdpe"},
        )

        received_bag = _find_slot(moved_bag_to_bench.json(), "station_1")["tool"]
        board = _find_slot(placed_board.json(), "station_2")["tool"]
        produce_lot_id = received_bag["produce_lots"][0]["id"]
        bag_tool_id = received_bag["id"]
        board_tool_id = board["id"]

        moved_to_board = client.post(
            f"/experiments/{experiment_id}/workbench/produce-lots/{produce_lot_id}/move-to-tool",
            json={"source_slot_id": "station_1", "target_slot_id": "station_2"},
        )
        cut = client.post(
            f"/experiments/{experiment_id}/workbench/produce-lots/{produce_lot_id}/cut",
            json={"slot_id": "station_2"},
        )

        # --- Broyage ---
        added_grinder = client.post(
            f"/experiments/{experiment_id}/workspace/widgets",
            json={"widget_id": "grinder", "anchor": "top-right", "offset_x": 0, "offset_y": 420},
        )
        moved_to_grinder = client.post(
            f"/experiments/{experiment_id}/workspace/widgets/grinder/move-workbench-produce-lot",
            json={"source_slot_id": "station_2", "produce_lot_id": produce_lot_id},
        )
        cooled = client.post(
            f"/experiments/{experiment_id}/workspace/widgets/grinder/liquids",
            json={"liquid_id": "dry_ice_pellets", "volume_ml": 1000},
        )
        completed = client.post(f"/experiments/{experiment_id}/workspace/widgets/grinder/complete-grinder-cycle")

        # --- Transfert en pot ---
        placed_jar = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_3/place-tool",
            json={"tool_id": "hdpe_storage_jar_2l"},
        )
        jar_tool_id = _find_slot(placed_jar.json(), "station_3")["tool"]["id"]
        opened_jar = client.post(f"/experiments/{experiment_id}/workbench/tools/{jar_tool_id}/open")
        moved_to_jar = client.post(
            f"/experiments/{experiment_id}/workspace/widgets/grinder/produce-lots/{produce_lot_id}/move-to-workbench-tool",
            json={"target_slot_id": "station_3"},
        )

    assert basket_moved_to_balance.status_code == 200
    assert basket_moved_to_balance.json()["basket_tools"] == []
    assert basket_moved_to_balance.json()["lims_reception"]["measured_gross_mass_g"] > 0
    assert registered.status_code == 200
    sample_code = registered.json()["lims_reception"]["lab_sample_code"]
    assert sample_code.startswith("APP-2026-")
    assert printed.status_code == 200
    assert labeled.status_code == 200
    gross_balance = _find_widget(labeled.json(), "gross_balance")
    assert gross_balance["tool"]["sample_label_text"] == sample_code
    assert moved_bag_to_bench.status_code == 200
    assert _find_slot(moved_bag_to_bench.json(), "station_1")["tool"]["id"] == bag_tool_id
    assert added_slot.status_code == 200
    assert len(added_slot.json()["workbench"]["slots"]) == 3
    assert placed_board.status_code == 200
    assert _find_slot(placed_board.json(), "station_2")["tool"]["id"] == board_tool_id
    assert moved_to_board.status_code == 200
    assert _find_slot(moved_to_board.json(), "station_1")["tool"]["produce_lots"] == []
    assert _find_slot(moved_to_board.json(), "station_2")["tool"]["produce_lots"][0]["id"] == produce_lot_id
    assert cut.status_code == 200
    cut_payload = cut.json()
    cut_lot_id = _find_slot(cut_payload, "station_2")["tool"]["produce_lots"][0]["id"]
    assert _find_material_state(cut_payload, cut_lot_id)["material_state"] == "cut"
    assert added_grinder.status_code == 200
    assert moved_to_grinder.status_code == 200
    assert _find_widget(moved_to_grinder.json(), "grinder")["produce_lots"][0]["id"] == produce_lot_id
    assert cooled.status_code == 200
    cooled_grinder = _find_widget(cooled.json(), "grinder")
    assert cooled_grinder["liquids"][0]["liquid_id"] == "dry_ice_pellets"
    assert completed.status_code == 200
    completed_grinder = _find_widget(completed.json(), "grinder")
    completed_lot_id = completed_grinder["produce_lots"][0]["id"]
    assert _find_material_state(completed.json(), completed_lot_id)["material_state"] == "ground"
    assert placed_jar.status_code == 200
    assert opened_jar.status_code == 200
    assert moved_to_jar.status_code == 200
    assert _find_widget(moved_to_jar.json(), "grinder")["produce_lots"] == []
    jar_tool = _find_slot(moved_to_jar.json(), "station_3")["tool"]
    assert jar_tool["tool_id"] == "hdpe_storage_jar_2l"
    assert jar_tool["produce_lots"][0]["id"] == produce_lot_id
    jar_lot_id = jar_tool["produce_lots"][0]["id"]
    assert _find_material_state(moved_to_jar.json(), jar_lot_id)["material_state"] == "ground"
    assert moved_to_jar.json()["audit_log"][-1] == ("Orchard apple lot moved from Cryogenic grinder to Wide-neck HDPE jar.")


def test_analytical_balance_sample_label_routes_work_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        placed = client.post(
            f"/experiments/{experiment_id}/analytical-balance/place-tool",
            json={"tool_id": "centrifuge_tube_50ml"},
        )
        applied = client.post(f"/experiments/{experiment_id}/analytical-balance/sample-label")

        assert placed.status_code == 200
        assert applied.status_code == 200
        tool = _find_widget(applied.json(), "analytical_balance")["tool"]
        assert tool is not None
        assert len(tool["labels"]) == 1

        label_id = tool["labels"][0]["id"]
        updated = client.patch(
            f"/experiments/{experiment_id}/analytical-balance/sample-labels/{label_id}",
            json={"sample_label_text": "LOT-2026-041"},
        )

    assert updated.status_code == 200
    updated_tool = _find_widget(updated.json(), "analytical_balance")["tool"]
    assert updated_tool is not None
    assert updated_tool["labels"][0]["text"] == "LOT-2026-041"


def test_printed_lims_label_can_apply_to_analytical_balance_tool_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        client.post(
            f"/experiments/{experiment_id}/lims/reception",
            json={
                "orchard_name": "Verger Saint-Martin",
                "harvest_date": "2026-03-29",
                "indicative_mass_g": 2500.0,
                "measured_gross_mass_g": 2486.0,
                "measured_sample_mass_g": 10.0,
            },
        )
        printed = client.post(f"/experiments/{experiment_id}/lims/print-label")
        placed = client.post(
            f"/experiments/{experiment_id}/analytical-balance/place-tool",
            json={"tool_id": "centrifuge_tube_50ml"},
        )
        applied = client.post(f"/experiments/{experiment_id}/lims/apply-label-to-analytical-balance-tool")

    assert printed.status_code == 200
    assert placed.status_code == 200
    assert applied.status_code == 200
    updated_tool = _find_widget(applied.json(), "analytical_balance")["tool"]
    assert updated_tool is not None
    assert updated_tool["labels"][0]["label_kind"] == "lims"
    assert updated_tool["labels"][0]["sample_code"].startswith("APP-2026-")
    assert applied.json()["lims_reception"]["printed_label_ticket"] is None


def test_lims_reception_route_allows_missing_gross_weight_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        registered = client.post(
            f"/experiments/{experiment_id}/lims/reception",
            json={
                "orchard_name": "Martin Orchard",
                "harvest_date": "2026-03-29",
                "indicative_mass_g": 2500.0,
                "measured_gross_mass_g": None,
            },
        )

    assert registered.status_code == 200
    assert registered.json()["lims_reception"]["lab_sample_code"].startswith("APP-2026-")
    assert registered.json()["lims_reception"]["measured_gross_mass_g"] is None


def test_lims_reception_route_records_precise_sample_mass_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        registered = client.post(
            f"/experiments/{experiment_id}/lims/reception",
            json={
                "orchard_name": "Martin Orchard",
                "harvest_date": "2026-03-29",
                "indicative_mass_g": 2500.0,
                "measured_sample_mass_g": 10.0,
            },
        )

    assert registered.status_code == 200
    assert registered.json()["lims_reception"]["measured_sample_mass_g"] == pytest.approx(10.0)


def test_printed_lims_label_can_be_applied_to_basket_bag_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        client.post(
            f"/experiments/{experiment_id}/lims/reception",
            json={
                "orchard_name": "Martin Orchard",
                "harvest_date": "2026-03-29",
                "indicative_mass_g": 2500.0,
                "measured_gross_mass_g": None,
            },
        )
        printed = client.post(f"/experiments/{experiment_id}/lims/print-label")
        applied = client.post(f"/experiments/{experiment_id}/lims/apply-label-to-basket-bag")

    assert printed.status_code == 200
    assert applied.status_code == 200
    sample_code = printed.json()["lims_reception"]["printed_label_ticket"]["sample_code"]
    assert applied.json()["basket_tools"][0]["sample_label_text"] == sample_code
    assert applied.json()["basket_tools"][0]["sample_label_received_date"]
    assert applied.json()["lims_reception"]["printed_label_ticket"] is None
    assert applied.json()["lims_reception"]["status"] == "received"


def test_received_bag_can_be_discarded_from_basket_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)
        created = client.get(f"/experiments/{experiment_id}")
        basket_tool_id = created.json()["basket_tools"][0]["id"]
        discarded = client.post(
            f"/experiments/{experiment_id}/reception/bag/discard",
            json={"tool_id": basket_tool_id},
        )

    assert discarded.status_code == 200
    assert discarded.json()["basket_tools"] == []
    assert len(discarded.json()["trash"]["children"]) == 1
    child_id = discarded.json()["trash"]["children"][0]["id"]
    assert discarded.json()["trash"]["discarded_from"][child_id] == "Produce basket"


def test_printed_lims_ticket_can_be_discarded_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        client.post(
            f"/experiments/{experiment_id}/lims/reception",
            json={
                "orchard_name": "Martin Orchard",
                "harvest_date": "2026-03-29",
                "indicative_mass_g": 2500.0,
                "measured_gross_mass_g": None,
            },
        )
        client.post(f"/experiments/{experiment_id}/lims/print-label")
        discarded = client.delete(f"/experiments/{experiment_id}/lims/printed-label")

    assert discarded.status_code == 200
    assert discarded.json()["lims_reception"]["printed_label_ticket"] is None


def test_record_gross_weight_route_accepts_explicit_mass_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        weighed = client.post(
            f"/experiments/{experiment_id}/reception/gross-weight/record",
            json={"measured_gross_mass_g": 36.0},
        )

    assert weighed.status_code == 200
    assert weighed.json()["lims_reception"]["measured_gross_mass_g"] == pytest.approx(36.0)


def test_set_gross_balance_container_offset_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        updated = client.post(
            f"/experiments/{experiment_id}/gross-balance/container-offset",
            json={"gross_mass_offset_g": -35},
        )

    assert updated.status_code == 200
    assert updated.json()["lims_reception"]["gross_mass_offset_g"] == -35


def test_analytical_balance_routes_capture_sample_mass_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)
        experiment = experiment_service._require_experiment(experiment_id)
        analytical_balance = next(widget for widget in experiment.workspace.widgets if widget.id == "analytical_balance")
        analytical_balance.tool = build_workbench_tool("centrifuge_tube_50ml")
        experiment.produce_material_states = [ProduceMaterialState(id="state_1", produce_lot_id="test-lot", material_state="ground")]
        analytical_balance.tool.produce_fractions = [
            ProduceFraction(
                id="test-frac",
                produce_lot_id="test-lot",
                produce_material_state_id="state_1",
                mass_g=10.124,
                location_kind="workspace_widget_tool",
                location_id="analytical_balance",
                container_id=analytical_balance.tool.id,
                container_label=analytical_balance.tool.label,
            )
        ]
        experiment.analytical_balance.tare_mass_g = 12.0
        experiment_service._persist_mutation_and_to_schema(experiment)

        recorded = client.post(f"/experiments/{experiment_id}/analytical-balance/record-sample-mass")

    assert recorded.status_code == 200
    assert recorded.json()["lims_reception"]["measured_sample_mass_g"] == pytest.approx(10.124)


def test_analytical_balance_rejects_out_of_spec_mass_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)
        experiment = experiment_service._require_experiment(experiment_id)
        analytical_balance = next(widget for widget in experiment.workspace.widgets if widget.id == "analytical_balance")
        analytical_balance.tool = build_workbench_tool("centrifuge_tube_50ml")
        experiment.produce_material_states = [ProduceMaterialState(id="state_1", produce_lot_id="test-lot", material_state="ground")]
        analytical_balance.tool.produce_fractions = [
            ProduceFraction(
                id="test-frac2",
                produce_lot_id="test-lot",
                produce_material_state_id="state_1",
                mass_g=10.5,
                location_kind="workspace_widget_tool",
                location_id="analytical_balance",
                container_id=analytical_balance.tool.id,
                container_label=analytical_balance.tool.label,
            )
        ]
        experiment.analytical_balance.tare_mass_g = 12.0
        experiment_service._persist_mutation_and_to_schema(experiment)
        recorded = client.post(f"/experiments/{experiment_id}/analytical-balance/record-sample-mass")

    assert recorded.status_code == 400
    assert "ERR_RANGE" in recorded.json()["detail"]


def test_analytical_balance_tool_can_be_closed_and_opened_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)
        experiment = experiment_service._require_experiment(experiment_id)
        analytical_balance = next(widget for widget in experiment.workspace.widgets if widget.id == "analytical_balance")
        analytical_balance.tool = build_workbench_tool("centrifuge_tube_50ml")
        experiment_service._persist_mutation_and_to_schema(experiment)

        closed = client.post(f"/experiments/{experiment_id}/analytical-balance/close-tool")
        opened = client.post(f"/experiments/{experiment_id}/analytical-balance/open-tool")

    assert closed.status_code == 200
    assert closed.json()["workspace"]["widgets"][2]["tool"]["is_sealed"] is True
    assert opened.status_code == 200
    assert opened.json()["workspace"]["widgets"][2]["tool"]["is_sealed"] is False


def test_list_experiments_returns_saved_sessions_over_http() -> None:
    with TestClient(app) as client:
        first_id = _create_experiment(client)
        second_id = _create_experiment(client)
        listed = client.get("/experiments")

    assert listed.status_code == 200
    payload = listed.json()
    assert {entry["id"] for entry in payload} >= {first_id, second_id}
    assert payload[0]["last_audit_entry"] is not None


def test_delete_experiment_removes_saved_session_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)
        deleted = client.delete(f"/experiments/{experiment_id}")
        listed = client.get("/experiments")
        fetched = client.get(f"/experiments/{experiment_id}")

    assert deleted.status_code == 204
    assert all(entry["id"] != experiment_id for entry in listed.json())
    assert fetched.status_code == 404


def test_get_experiment_returns_404_for_unknown_id() -> None:
    with TestClient(app) as client:
        response = client.get("/experiments/missing")

    assert response.status_code == 404
    assert response.json() == {"detail": "Experiment not found"}


def test_workbench_routes_round_trip_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        added_slot = client.post(f"/experiments/{experiment_id}/workbench/slots")
        placed = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_1/place-tool",
            json={"tool_id": "centrifuge_tube_50ml"},
        )
        tool_id = placed.json()["workbench"]["slots"][0]["tool"]["id"]
        added_liquid = client.post(
            f"/experiments/{experiment_id}/workbench/tools/{tool_id}/liquids",
            json={"liquid_id": "acetonitrile_extraction", "volume_ml": 7.5},
        )
        liquid_id = added_liquid.json()["workbench"]["slots"][0]["tool"]["liquids"][0]["id"]
        updated_liquid = client.patch(
            f"/experiments/{experiment_id}/workbench/tools/{tool_id}/liquids/{liquid_id}",
            json={"volume_ml": 8.5},
        )
        moved = client.post(
            f"/experiments/{experiment_id}/workbench/tools/{tool_id}/move-to-slot",
            json={"target_slot_id": "station_2"},
        )
        removed_liquid = client.delete(f"/experiments/{experiment_id}/workbench/tools/{tool_id}/liquids/{liquid_id}")
        removed_slot = client.delete(f"/experiments/{experiment_id}/workbench/slots/station_3")

    assert added_slot.status_code == 200
    assert [slot["id"] for slot in added_slot.json()["workbench"]["slots"]] == [
        "station_1",
        "station_2",
        "station_3",
    ]
    assert added_liquid.status_code == 200
    assert added_liquid.json()["workbench"]["slots"][0]["tool"]["liquids"][0]["volume_ml"] == 7.5
    assert updated_liquid.status_code == 200
    assert updated_liquid.json()["workbench"]["slots"][0]["tool"]["liquids"][0]["volume_ml"] == 8.5
    assert moved.status_code == 200
    assert moved.json()["workbench"]["slots"][1]["tool"]["id"] == tool_id
    assert removed_liquid.status_code == 200
    assert removed_liquid.json()["workbench"]["slots"][1]["tool"]["liquids"] == []
    assert removed_slot.status_code == 200
    assert [slot["id"] for slot in removed_slot.json()["workbench"]["slots"]] == [
        "station_1",
        "station_2",
    ]


def test_workbench_close_route_projects_powder_when_co2_is_still_present() -> None:
    frozen_now = datetime(2026, 4, 1, 12, 0, tzinfo=UTC)
    experiment_service._now_fn = lambda: frozen_now
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        created = client.post(
            f"/experiments/{experiment_id}/workspace/produce-lots",
            json={"produce_type": "apple"},
        )
        produce_lot_id = created.json()["basket_tools"][-1]["produce_lots"][0]["id"]
        placed = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_1/place-tool",
            json={"tool_id": "hdpe_storage_jar_2l"},
        )
        tool_id = placed.json()["workbench"]["slots"][0]["tool"]["id"]
        client.post(
            f"/experiments/{experiment_id}/workbench/tools/{tool_id}/add-produce-lot",
            json={"produce_lot_id": produce_lot_id},
        )

        experiment_state = experiment_service._experiments[experiment_id]
        assert experiment_state.workbench.slots[0].tool is not None
        stored_lot = experiment_state.workbench.slots[0].tool.produce_lots[0]
        set_material_state_name(experiment_state.produce_material_states, stored_lot.id, "ground")
        stored_lot.total_mass_g = 1000.0
        update_material_state(experiment_state.produce_material_states, stored_lot.id, residual_co2_mass_g=18.0)

        closed = client.post(f"/experiments/{experiment_id}/workbench/tools/{tool_id}/close")

    assert closed.status_code == 200
    tool = closed.json()["workbench"]["slots"][0]["tool"]
    assert tool["is_sealed"] is True
    assert tool["closure_fault"] is None
    assert tool["internal_pressure_bar"] == pytest.approx(1.0, abs=0.01)
    assert tool["trapped_co2_mass_g"] == pytest.approx(0.0, abs=0.01)
    assert tool["produce_lots"][0]["total_mass_g"] == 1000.0
    lot_state = _find_material_state(closed.json(), tool["produce_lots"][0]["id"])
    assert 17.5 <= lot_state["residual_co2_mass_g"] <= 18.0


def test_sealed_storage_jar_pops_after_physics_ticks_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)
        created = client.post(
            f"/experiments/{experiment_id}/workspace/produce-lots",
            json={"produce_type": "apple"},
        )
        produce_lot_id = created.json()["basket_tools"][-1]["produce_lots"][0]["id"]
        placed = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_1/place-tool",
            json={"tool_id": "hdpe_storage_jar_2l"},
        )
        tool_id = placed.json()["workbench"]["slots"][0]["tool"]["id"]
        client.post(
            f"/experiments/{experiment_id}/workbench/tools/{tool_id}/add-produce-lot",
            json={"produce_lot_id": produce_lot_id},
        )

        experiment_state = experiment_service._experiments[experiment_id]
        assert experiment_state.workbench.slots[0].tool is not None
        stored_lot = experiment_state.workbench.slots[0].tool.produce_lots[0]
        set_material_state_name(experiment_state.produce_material_states, stored_lot.id, "ground")
        stored_lot.total_mass_g = 1000.0
        update_material_state(experiment_state.produce_material_states, stored_lot.id, residual_co2_mass_g=18.0)

        closed = client.post(f"/experiments/{experiment_id}/workbench/tools/{tool_id}/close")
        assert closed.status_code == 200

        experiment_state.last_simulation_at = experiment_state.last_simulation_at - timedelta(minutes=2)
        snapshot = client.get(f"/experiments/{experiment_id}")

    assert snapshot.status_code == 200
    tool = snapshot.json()["workbench"]["slots"][0]["tool"]
    assert tool["is_sealed"] is False
    assert tool["closure_fault"] == "pressure_pop"
    assert tool["internal_pressure_bar"] == pytest.approx(1.0, abs=0.01)


def test_debug_produce_preset_route_spawns_powder_on_workbench() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)
        placed = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_1/place-tool",
            json={"tool_id": "hdpe_storage_jar_2l"},
        )
        assert placed.status_code == 200

        spawned = client.post(
            f"/experiments/{experiment_id}/debug/produce-presets/apple_powder_residual_co2/spawn-on-workbench",
            json={"target_slot_id": "station_1", "total_mass_g": 2450.0},
        )

    assert spawned.status_code == 200
    tool = spawned.json()["workbench"]["slots"][0]["tool"]
    lot_state = _find_material_state(spawned.json(), tool["produce_lots"][0]["id"])
    assert lot_state["material_state"] == "ground"
    assert tool["produce_lots"][0]["total_mass_g"] == 2450.0
    assert lot_state["residual_co2_mass_g"] == 18.0
    assert lot_state["temperature_c"] == -62.0


def test_open_workbench_tool_route_unseals_a_jar() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)
        placed = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_1/place-tool",
            json={"tool_id": "hdpe_storage_jar_2l"},
        )
        assert placed.status_code == 200
        tool_id = placed.json()["workbench"]["slots"][0]["tool"]["id"]
        closed = client.post(f"/experiments/{experiment_id}/workbench/tools/{tool_id}/close")
        assert closed.status_code == 200

        opened = client.post(f"/experiments/{experiment_id}/workbench/tools/{tool_id}/open")

    assert opened.status_code == 200
    tool = opened.json()["workbench"]["slots"][0]["tool"]
    assert tool["is_sealed"] is False
    assert tool["closure_fault"] is None


def test_workbench_sample_label_routes_round_trip_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        first_bag = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_1/place-tool",
            json={"tool_id": "sealed_sampling_bag"},
        )
        second_bag = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_2/place-tool",
            json={"tool_id": "sealed_sampling_bag"},
        )
        first_tool_id = first_bag.json()["workbench"]["slots"][0]["tool"]["id"]
        second_tool_id = second_bag.json()["workbench"]["slots"][1]["tool"]["id"]
        labeled = client.post(f"/experiments/{experiment_id}/workbench/tools/{first_tool_id}/sample-label")
        updated = client.patch(
            f"/experiments/{experiment_id}/workbench/tools/{first_tool_id}/sample-label",
            json={"sample_label_text": "LOT-2026-041"},
        )
        moved = client.post(
            f"/experiments/{experiment_id}/workbench/tools/{first_tool_id}/sample-label/move-to-tool",
            json={"target_tool_id": second_tool_id},
        )
        discarded = client.delete(f"/experiments/{experiment_id}/workbench/tools/{second_tool_id}/sample-label")
        trash_entry_id = discarded.json()["trash"]["sample_labels"][0]["id"]
        restored = client.post(
            f"/experiments/{experiment_id}/trash/sample-labels/{trash_entry_id}/restore-to-workbench-tool",
            json={"target_tool_id": first_tool_id},
        )

    assert labeled.status_code == 200
    assert updated.status_code == 200
    assert updated.json()["workbench"]["slots"][0]["tool"]["sample_label_text"] == "LOT-2026-041"
    assert moved.status_code == 200
    assert moved.json()["workbench"]["slots"][1]["tool"]["sample_label_text"] == "LOT-2026-041"
    assert discarded.status_code == 200
    assert discarded.json()["trash"]["sample_labels"][0]["sample_label_text"] == "LOT-2026-041"
    assert restored.status_code == 200
    assert restored.json()["workbench"]["slots"][0]["tool"]["sample_label_text"] == "LOT-2026-041"


def test_palette_and_rack_routes_round_trip_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        discarded_from_palette = client.post(
            f"/experiments/{experiment_id}/palette/tools/discard",
            json={"tool_id": "sealed_sampling_bag"},
        )
        discarded_label = client.post(f"/experiments/{experiment_id}/palette/sample-labels/discard")
        placed_on_bench = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_1/place-tool",
            json={"tool_id": "sample_vial_lcms"},
        )
        tool_id = placed_on_bench.json()["workbench"]["slots"][0]["tool"]["id"]
        placed_in_rack = client.post(
            f"/experiments/{experiment_id}/rack/slots/rack_slot_1/place-tool-from-workbench",
            json={"source_slot_id": "station_1"},
        )
        moved_in_rack = client.post(
            f"/experiments/{experiment_id}/rack/tools/{tool_id}/move-to-slot",
            json={"target_rack_slot_id": "rack_slot_2"},
        )
        returned_to_bench = client.post(
            f"/experiments/{experiment_id}/rack/tools/{tool_id}/move-to-workbench-slot",
            json={"target_slot_id": "station_2"},
        )
        placed_from_palette = client.post(
            f"/experiments/{experiment_id}/rack/slots/rack_slot_1/place-tool-from-palette",
            json={"tool_id": "sample_vial_lcms"},
        )

    assert discarded_from_palette.status_code == 200
    palette_child_id = discarded_from_palette.json()["trash"]["children"][0]["id"]
    assert discarded_from_palette.json()["trash"]["discarded_from"][palette_child_id] == "Palette"
    assert discarded_label.status_code == 200
    assert len(discarded_label.json()["trash"]["sample_labels"]) == 1
    assert placed_in_rack.status_code == 200
    assert placed_in_rack.json()["rack"]["slots"][0]["tool"]["id"] == tool_id
    assert moved_in_rack.status_code == 200
    assert moved_in_rack.json()["rack"]["slots"][1]["tool"]["id"] == tool_id
    assert returned_to_bench.status_code == 200
    assert returned_to_bench.json()["workbench"]["slots"][1]["tool"]["id"] == tool_id
    assert placed_from_palette.status_code == 200
    assert placed_from_palette.json()["rack"]["slots"][0]["tool"]["label"] == "Autosampler vial"


def test_trash_tool_restore_routes_round_trip_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        placed = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_1/place-tool",
            json={"tool_id": "sample_vial_lcms"},
        )
        tool_id = placed.json()["workbench"]["slots"][0]["tool"]["id"]
        discarded = client.post(f"/experiments/{experiment_id}/workbench/tools/{tool_id}/discard")
        trash_entry_id = discarded.json()["trash"]["children"][0]["id"]
        restored_to_bench = client.post(
            f"/experiments/{experiment_id}/trash/tools/{trash_entry_id}/restore-to-workbench",
            json={"target_slot_id": "station_2"},
        )
        restored_tool_id = restored_to_bench.json()["workbench"]["slots"][1]["tool"]["id"]
        discarded_again = client.post(f"/experiments/{experiment_id}/workbench/tools/{restored_tool_id}/discard")
        second_entry_id = discarded_again.json()["trash"]["children"][0]["id"]
        restored_to_rack = client.post(
            f"/experiments/{experiment_id}/trash/tools/{second_entry_id}/restore-to-rack",
            json={"rack_slot_id": "rack_slot_1"},
        )

    assert restored_to_bench.status_code == 200
    assert restored_to_bench.json()["workbench"]["slots"][1]["tool"]["label"] == "Autosampler vial"
    assert restored_to_rack.status_code == 200
    assert restored_to_rack.json()["rack"]["slots"][0]["tool"]["label"] == "Autosampler vial"
    assert restored_to_rack.json()["trash"]["children"] == []


def test_workspace_routes_round_trip_over_http() -> None:
    created_at = datetime(2026, 3, 28, 19, 0, tzinfo=UTC)
    warmed_at = created_at + timedelta(seconds=10)
    original_now_fn = experiment_service._now_fn
    experiment_service._now_fn = lambda: created_at

    try:
        with TestClient(app) as client:
            experiment_id = _create_experiment(client)

            added_widget = client.post(
                f"/experiments/{experiment_id}/workspace/widgets",
                json={
                    "widget_id": "grinder",
                    "anchor": "top-right",
                    "offset_x": 0,
                    "offset_y": 420,
                },
            )
            moved_widget = client.post(
                f"/experiments/{experiment_id}/workspace/widgets/grinder/move",
                json={"anchor": "top-left", "offset_x": 100, "offset_y": 460},
            )
            produce_created = client.post(
                f"/experiments/{experiment_id}/workspace/produce-lots",
                json={"produce_type": "apple"},
            )
            produce_lot_id = produce_created.json()["basket_tools"][-1]["produce_lots"][0]["id"]
            produce_loaded = client.post(
                f"/experiments/{experiment_id}/workspace/widgets/grinder/add-produce-lot",
                json={"produce_lot_id": produce_lot_id},
            )
            added_liquid = client.post(
                f"/experiments/{experiment_id}/workspace/widgets/grinder/liquids",
                json={"liquid_id": "dry_ice_pellets", "volume_ml": 275.25},
            )
            liquid_id = _find_widget(added_liquid.json(), "grinder")["liquids"][0]["id"]
            updated_liquid = client.patch(
                f"/experiments/{experiment_id}/workspace/widgets/grinder/liquids/{liquid_id}",
                json={"volume_ml": 125.5},
            )
            experiment_service._now_fn = lambda: warmed_at
            advanced = client.get(f"/experiments/{experiment_id}")
            removed_liquid = client.delete(f"/experiments/{experiment_id}/workspace/widgets/grinder/liquids/{liquid_id}")
            discarded_produce_lot = client.post(f"/experiments/{experiment_id}/workspace/widgets/grinder/produce-lots/{produce_lot_id}/discard")
            stored_widget = client.post(f"/experiments/{experiment_id}/workspace/widgets/grinder/store")
    finally:
        experiment_service._now_fn = original_now_fn

    assert added_widget.status_code == 200
    assert next(widget for widget in added_widget.json()["workspace"]["widgets"] if widget["id"] == "grinder")["is_present"] is True
    assert moved_widget.status_code == 200
    assert next(widget for widget in moved_widget.json()["workspace"]["widgets"] if widget["id"] == "grinder")["anchor"] == "top-left"
    assert produce_loaded.status_code == 200
    assert produce_loaded.json()["workspace"]["produce_basket_lots"] == []
    assert updated_liquid.status_code == 200
    assert _find_widget(updated_liquid.json(), "grinder")["liquids"][0]["volume_ml"] == 125.5
    assert advanced.status_code == 200
    grinder_lot_id = _find_widget(advanced.json(), "grinder")["produce_lots"][0]["id"]
    assert _find_material_state(advanced.json(), grinder_lot_id)["temperature_c"] < 20.0
    assert removed_liquid.status_code == 200
    assert _find_widget(removed_liquid.json(), "grinder")["liquids"] == []
    assert discarded_produce_lot.status_code == 200
    assert _find_widget(discarded_produce_lot.json(), "grinder")["produce_lots"] == []
    assert stored_widget.status_code == 200
    assert next(widget for widget in stored_widget.json()["workspace"]["widgets"] if widget["id"] == "grinder")["is_present"] is False
    assert next(widget for widget in stored_widget.json()["workspace"]["widgets"] if widget["id"] == "grinder")["is_trashed"] is False


def test_experiment_stream_pushes_updated_snapshots() -> None:
    created_at = datetime(2026, 3, 28, 19, 0, tzinfo=UTC)
    warmed_at = created_at + timedelta(seconds=10)
    original_now_fn = experiment_service._now_fn
    experiment_service._now_fn = lambda: created_at

    try:
        with TestClient(app) as client:
            experiment_id = _create_experiment(client)
            client.post(
                f"/experiments/{experiment_id}/workspace/widgets",
                json={
                    "widget_id": "grinder",
                    "anchor": "top-right",
                    "offset_x": 0,
                    "offset_y": 420,
                },
            )
            produced = client.post(
                f"/experiments/{experiment_id}/workspace/produce-lots",
                json={"produce_type": "apple"},
            )
            produce_lot_id = produced.json()["basket_tools"][-1]["produce_lots"][0]["id"]
            client.post(
                f"/experiments/{experiment_id}/workspace/widgets/grinder/add-produce-lot",
                json={"produce_lot_id": produce_lot_id},
            )
            client.post(
                f"/experiments/{experiment_id}/workspace/widgets/grinder/liquids",
                json={"liquid_id": "dry_ice_pellets", "volume_ml": 500},
            )
            experiment_service._now_fn = lambda: warmed_at

            with client.websocket_connect(f"/experiments/{experiment_id}/stream") as websocket:
                snapshot = websocket.receive_json()
    finally:
        experiment_service._now_fn = original_now_fn

    assert snapshot["id"] == experiment_id
    assert snapshot["snapshot_version"] >= 1
    grinder_lot_id = _find_widget(snapshot, "grinder")["produce_lots"][0]["id"]
    assert _find_material_state(snapshot, grinder_lot_id)["temperature_c"] < 20.0


def test_produce_lot_routes_round_trip_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        created = client.post(
            f"/experiments/{experiment_id}/workspace/produce-lots",
            json={"produce_type": "apple"},
        )
        first_lot_id = created.json()["basket_tools"][-1]["produce_lots"][0]["id"]
        placed_board = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_1/place-tool",
            json={"tool_id": "cutting_board_hdpe"},
        )
        board_id = placed_board.json()["workbench"]["slots"][0]["tool"]["id"]
        added_to_board = client.post(
            f"/experiments/{experiment_id}/workbench/tools/{board_id}/add-produce-lot",
            json={"produce_lot_id": first_lot_id},
        )
        cut = client.post(
            f"/experiments/{experiment_id}/workbench/produce-lots/{first_lot_id}/cut",
            json={"slot_id": "station_1"},
        )
        discarded_from_board = client.post(
            f"/experiments/{experiment_id}/workbench/produce-lots/{first_lot_id}/discard",
            json={"slot_id": "station_1"},
        )
        trash_entry_id = discarded_from_board.json()["trash"]["produce_lots"][0]["id"]
        restored_to_board = client.post(
            f"/experiments/{experiment_id}/trash/produce-lots/{trash_entry_id}/restore-to-workbench-tool",
            json={"target_slot_id": "station_1"},
        )
        discarded_again = client.post(
            f"/experiments/{experiment_id}/workbench/produce-lots/{first_lot_id}/discard",
            json={"slot_id": "station_1"},
        )
        second_entry_id = discarded_again.json()["trash"]["produce_lots"][0]["id"]
        added_grinder = client.post(
            f"/experiments/{experiment_id}/workspace/widgets",
            json={"widget_id": "grinder", "anchor": "top-right", "offset_x": 0, "offset_y": 420},
        )
        restored_to_widget = client.post(
            f"/experiments/{experiment_id}/trash/produce-lots/{second_entry_id}/restore-to-widget",
            json={"widget_id": "grinder"},
        )
        moved_to_bench = client.post(
            f"/experiments/{experiment_id}/workspace/widgets/grinder/produce-lots/{first_lot_id}/move-to-workbench-tool",
            json={"target_slot_id": "station_2"},
        )
        discarded_from_widget_target = client.post(
            f"/experiments/{experiment_id}/workbench/produce-lots/{first_lot_id}/discard",
            json={"slot_id": "station_2"},
        )
        third_entry_id = discarded_from_widget_target.json()["trash"]["produce_lots"][0]["id"]
        restored_to_widget_again = client.post(
            f"/experiments/{experiment_id}/trash/produce-lots/{third_entry_id}/restore-to-widget",
            json={"widget_id": "grinder"},
        )
        discarded_from_widget = client.post(f"/experiments/{experiment_id}/workspace/widgets/grinder/produce-lots/{first_lot_id}/discard")

    assert added_to_board.status_code == 200
    assert cut.status_code == 200
    cut_payload = cut.json()
    cut_lot_id = cut_payload["workbench"]["slots"][0]["tool"]["produce_lots"][0]["id"]
    assert _find_material_state(cut_payload, cut_lot_id)["material_state"] == "cut"
    assert restored_to_board.status_code == 200
    assert restored_to_board.json()["workbench"]["slots"][0]["tool"]["produce_lots"][0]["id"] == first_lot_id
    assert added_grinder.status_code == 200
    assert restored_to_widget.status_code == 200
    assert _find_widget(restored_to_widget.json(), "grinder")["produce_lots"][0]["id"] == first_lot_id
    assert moved_to_bench.status_code == 200
    assert moved_to_bench.json()["workbench"]["slots"][1]["surface_produce_lots"][0]["id"] == first_lot_id
    assert restored_to_widget_again.status_code == 200
    assert discarded_from_widget.status_code == 200
    assert discarded_from_widget.json()["trash"]["produce_lots"][0]["produce_lot"]["id"] == first_lot_id


def test_workspace_move_workbench_produce_lot_to_widget_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        created = client.post(
            f"/experiments/{experiment_id}/workspace/produce-lots",
            json={"produce_type": "apple"},
        )
        produce_lot_id = created.json()["basket_tools"][-1]["produce_lots"][0]["id"]
        placed_board = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_1/place-tool",
            json={"tool_id": "cutting_board_hdpe"},
        )
        board_id = placed_board.json()["workbench"]["slots"][0]["tool"]["id"]
        client.post(
            f"/experiments/{experiment_id}/workbench/tools/{board_id}/add-produce-lot",
            json={"produce_lot_id": produce_lot_id},
        )
        client.post(
            f"/experiments/{experiment_id}/workspace/widgets",
            json={"widget_id": "grinder", "anchor": "top-right", "offset_x": 0, "offset_y": 420},
        )
        moved = client.post(
            f"/experiments/{experiment_id}/workspace/widgets/grinder/move-workbench-produce-lot",
            json={"source_slot_id": "station_1", "produce_lot_id": produce_lot_id},
        )

    assert moved.status_code == 200
    assert _find_widget(moved.json(), "grinder")["produce_lots"][0]["id"] == produce_lot_id


def test_workspace_move_grinder_produce_lot_to_storage_jar_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        client.post(
            f"/experiments/{experiment_id}/workspace/widgets",
            json={"widget_id": "grinder", "anchor": "top-right", "offset_x": 0, "offset_y": 420},
        )
        client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_1/place-tool",
            json={"tool_id": "hdpe_storage_jar_2l"},
        )
        produced = client.post(
            f"/experiments/{experiment_id}/debug/produce-presets/apple_powder_residual_co2/spawn-on-widget",
            json={"widget_id": "grinder", "total_mass_g": 10},
        )
        produce_lot_id = _find_widget(produced.json(), "grinder")["produce_lots"][0]["id"]

        moved = client.post(
            f"/experiments/{experiment_id}/workspace/widgets/grinder/produce-lots/{produce_lot_id}/move-to-workbench-tool",
            json={"target_slot_id": "station_1"},
        )

    assert moved.status_code == 200
    assert moved.json()["workbench"]["slots"][0]["tool"]["tool_id"] == "hdpe_storage_jar_2l"
    assert moved.json()["workbench"]["slots"][0]["tool"]["produce_lots"][0]["id"] == produce_lot_id
    moved_payload = moved.json()
    moved_lot_id = moved_payload["workbench"]["slots"][0]["tool"]["produce_lots"][0]["id"]
    assert _find_material_state(moved_payload, moved_lot_id)["material_state"] == "ground"
    assert _find_widget(moved.json(), "grinder")["produce_lots"] == []


def test_move_gross_balance_produce_lot_to_workbench_over_http() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)
        client.post(
            f"/experiments/{experiment_id}/workspace/widgets",
            json={
                "widget_id": "gross_balance",
                "anchor": "top-right",
                "offset_x": 0,
                "offset_y": 420,
            },
        )
        produced = client.post(
            f"/experiments/{experiment_id}/debug/produce-presets/apple_powder_residual_co2/spawn-on-widget",
            json={"widget_id": "gross_balance", "total_mass_g": 10},
        )
        produce_lot_id = _find_widget(produced.json(), "gross_balance")["produce_lots"][0]["id"]
        moved = client.post(
            f"/experiments/{experiment_id}/gross-balance/move-produce-lot-to-workbench",
            json={"target_slot_id": "station_1", "produce_lot_id": produce_lot_id},
        )

    assert moved.status_code == 200
    assert moved.json()["workbench"]["slots"][0]["surface_produce_lots"][0]["id"] == produce_lot_id


def test_new_routes_return_expected_http_errors() -> None:
    with TestClient(app) as client:
        experiment_id = _create_experiment(client)

        missing_experiment = client.post(
            "/experiments/missing/workbench/slots/station_1/place-tool",
            json={"tool_id": "sample_vial_lcms"},
        )
        invalid_payload = client.post(
            f"/experiments/{experiment_id}/workbench/slots/station_1/place-tool",
            json={"tool_id": "sample_vial_lcms"},
        )
        invalid_state = client.post(
            f"/experiments/{experiment_id}/workbench/tools/unknown/liquids",
            json={"liquid_id": "acetonitrile_extraction"},
        )
        invalid_shape = client.post(
            f"/experiments/{experiment_id}/workspace/produce-lots",
            json={"produce_type": "pear"},
        )

    assert missing_experiment.status_code == 404
    assert invalid_payload.status_code == 200
    assert invalid_state.status_code == 400
    assert invalid_state.json() == {"detail": "Unknown workbench tool"}
    assert invalid_shape.status_code == 422
