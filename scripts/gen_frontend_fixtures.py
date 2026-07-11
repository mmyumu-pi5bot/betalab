#!/usr/bin/env python3
"""Generate frontend test fixtures from backend domain data.

Run from the repo root:
    python scripts/gen_frontend_fixtures.py

Writes frontend/src/generated/dnd-contract.json.
Re-run after any change to backend/app/domain/dnd_contracts.py or workbench_catalog.py.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.domain.dnd_contracts import DndEntityContract, get_dnd_contract
from app.domain.workbench_catalog import get_toolbar_categories


def serialize_contract(contract: DndEntityContract) -> dict[str, object]:
    return {
        "allowed_drop_targets": contract.allowed_drop_targets,
        "can_receive_liquids": contract.can_receive_liquids,
        "can_receive_produce": contract.can_receive_produce,
        "can_seal": contract.can_seal,
        "is_discardable": contract.is_discardable,
        "is_draggable": contract.is_draggable,
        "is_storable": contract.is_storable,
    }


def build_dnd_contract() -> dict[str, object]:
    tool_specs: dict[str, object] = {}
    liquid_specs: dict[str, object] = {}
    for category in get_toolbar_categories():
        for item in category["items"]:
            if item["item_type"] == "tool" and item["tool_type"] not in tool_specs:
                tool_specs[item["tool_type"]] = serialize_contract(
                    get_dnd_contract("tool", item["tool_type"])
                )
            if item["item_type"] == "liquid" and item["liquid_type"] not in liquid_specs:
                liquid_specs[item["liquid_type"]] = serialize_contract(
                    get_dnd_contract("liquid", item["liquid_type"])
                )
    return {
        "entities": {
            "lims_label_ticket": serialize_contract(
                get_dnd_contract("lims_label_ticket", "lims_label_ticket")
            ),
            "produce_lot": serialize_contract(get_dnd_contract("produce_lot", "produce_lot")),
            "sample_label": serialize_contract(get_dnd_contract("sample_label", "sample_label")),
            "workspace_widget": serialize_contract(
                get_dnd_contract("workspace_widget", "workspace_widget")
            ),
        },
        "liquids": liquid_specs,
        "tools": tool_specs,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if the generated fixture is stale")
    args = parser.parse_args()

    output_path = Path(__file__).parent.parent / "frontend" / "src" / "generated" / "dnd-contract.json"
    contract = build_dnd_contract()
    generated = json.dumps(contract, indent=2, sort_keys=True) + "\n"

    if args.check:
        if output_path.read_text() != generated:
            print(f"{output_path} is stale. Run scripts/gen_frontend_fixtures.py.", file=sys.stderr)
            return 1
        print(f"{output_path} is up to date.")
        return 0

    output_path.write_text(generated)
    print(f"Written DnD contract to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
