import pytest

from app.domain.journal_codes import JournalCode
from app.services.domain_services.rack import (
    CloseRackToolRequest,
    CloseRackToolService,
    OpenRackToolRequest,
    OpenRackToolService,
    PlaceToolInRackSlotRequest,
    PlaceToolInRackSlotService,
)
from app.services.experiment_service import ExperimentRuntimeService


def _rack_slot(service: ExperimentRuntimeService, exp_id: str, rack_slot_id: str = "rack_slot_1"):
    experiment = service._require_experiment(exp_id)
    return next(slot for slot in experiment.rack.slots if slot.id == rack_slot_id)


def _place_vial_in_rack(service: ExperimentRuntimeService, exp_id: str, rack_slot_id: str = "rack_slot_1") -> None:
    PlaceToolInRackSlotService(service).run(
        exp_id,
        PlaceToolInRackSlotRequest(rack_slot_id=rack_slot_id, tool_id="sample_vial_lcms"),
    )


class TestSealingAVialInTheRack:
    def test_caps_an_open_vial_without_taking_it_off_the_rack(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = service.create_experiment().id
        _place_vial_in_rack(service, exp_id)
        assert _rack_slot(service, exp_id).tool.is_sealed is False

        CloseRackToolService(service).run(exp_id, CloseRackToolRequest(rack_slot_id="rack_slot_1"))

        slot = _rack_slot(service, exp_id)
        assert slot.tool.is_sealed is True
        experiment = service._require_experiment(exp_id)
        assert experiment.journal_entries[-1].code == JournalCode.TOOL_SEALED

    def test_uncaps_a_capped_vial_in_place(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = service.create_experiment().id
        _place_vial_in_rack(service, exp_id)
        CloseRackToolService(service).run(exp_id, CloseRackToolRequest(rack_slot_id="rack_slot_1"))

        OpenRackToolService(service).run(exp_id, OpenRackToolRequest(rack_slot_id="rack_slot_1"))

        assert _rack_slot(service, exp_id).tool.is_sealed is False
        experiment = service._require_experiment(exp_id)
        assert experiment.journal_entries[-1].code == JournalCode.TOOL_OPENED

    def test_refuses_an_empty_slot(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = service.create_experiment().id

        with pytest.raises(ValueError):
            CloseRackToolService(service).run(exp_id, CloseRackToolRequest(rack_slot_id="rack_slot_1"))

    def test_refuses_to_reach_a_rack_sitting_inside_the_instrument(self) -> None:
        service = ExperimentRuntimeService()
        exp_id = service.create_experiment().id
        _place_vial_in_rack(service, exp_id)
        CloseRackToolService(service).run(exp_id, CloseRackToolRequest(rack_slot_id="rack_slot_1"))
        experiment = service._require_experiment(exp_id)
        experiment.rack.state = "loaded"

        with pytest.raises(ValueError):
            OpenRackToolService(service).run(exp_id, OpenRackToolRequest(rack_slot_id="rack_slot_1"))
