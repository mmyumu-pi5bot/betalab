from app.schemas.experiment import RackSchema


def test_available_rack_advertises_only_the_lcmsms_instrument_target() -> None:
    rack = RackSchema(slots=[])

    expected_matrix = {
        "analytical_balance_widget": False,
        "centrifuge_widget": False,
        "grinder_widget": False,
        "gross_balance_widget": False,
        "lcmsms_instrument": True,
        "rack_slot": False,
        "trash_bin": False,
        "vortex_widget": False,
        "workbench_slot": False,
        "workspace_canvas": False,
    }

    for target_type, expected in expected_matrix.items():
        assert (target_type in rack.allowed_drop_targets) is expected


def test_loaded_rack_is_not_draggable_and_advertises_no_target() -> None:
    rack = RackSchema(slots=[], state="loaded")

    assert rack.is_draggable is False
    assert rack.allowed_drop_targets == []
