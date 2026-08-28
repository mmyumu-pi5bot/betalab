"""The reception mass check is an operator acknowledgement, so it has to survive a reload.

Reviewing the gross/tare/net calculation is a real step of the reception: the LIMS
record is created against numbers a human said they had looked at. Holding that
acknowledgement in component state meant every page refresh silently un-reviewed it —
and, mid-tutorial, sent the learner back to click a button they had already clicked.
"""

from __future__ import annotations

import pytest

from app.services.domain_services.reception import (
    AcknowledgeReceptionMassCheckRequest,
    AcknowledgeReceptionMassCheckService,
    CreateLimsReceptionRequest,
    CreateLimsReceptionService,
    RecordGrossWeightRequest,
    RecordGrossWeightService,
)
from app.services.experiment_repository import SqliteExperimentRepository
from app.services.experiment_service import ExperimentRuntimeService


def _weighed_experiment(service: ExperimentRuntimeService, gross_mass_g: float = 1036.0) -> str:
    experiment = service.create_experiment()
    RecordGrossWeightService(service).run(experiment.id, RecordGrossWeightRequest(measured_gross_mass_g=gross_mass_g))
    return experiment.id


def test_acknowledges_the_net_mass_currently_on_screen() -> None:
    service = ExperimentRuntimeService()
    exp_id = _weighed_experiment(service)

    AcknowledgeReceptionMassCheckService(service).run(exp_id, AcknowledgeReceptionMassCheckRequest(entry_id=None))

    reception = service._require_experiment(exp_id).lims_reception
    assert reception.measured_gross_mass_g is not None
    expected_net = reception.measured_gross_mass_g - reception.packaging_tare_mass_g
    assert reception.acknowledged_net_mass_g == pytest.approx(expected_net)


def test_acknowledgement_works_before_the_record_exists() -> None:
    # The tutorial has the learner review the calculation *before* creating the LIMS
    # record, so there is no entry to hang the acknowledgement on yet.
    service = ExperimentRuntimeService()
    exp_id = _weighed_experiment(service)

    AcknowledgeReceptionMassCheckService(service).run(exp_id, AcknowledgeReceptionMassCheckRequest(entry_id=None))

    experiment = service._require_experiment(exp_id)
    assert experiment.lims_reception.lab_sample_code is None
    assert experiment.lims_reception.acknowledged_net_mass_g is not None


def test_acknowledgement_survives_a_reload(tmp_path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
    service = ExperimentRuntimeService(repository=repository)
    exp_id = _weighed_experiment(service)
    AcknowledgeReceptionMassCheckService(service).run(exp_id, AcknowledgeReceptionMassCheckRequest(entry_id=None))
    acknowledged = service._require_experiment(exp_id).lims_reception.acknowledged_net_mass_g

    reloaded = ExperimentRuntimeService(repository=repository)._require_experiment(exp_id)

    assert reloaded.lims_reception.acknowledged_net_mass_g == pytest.approx(acknowledged)


def test_a_new_weighing_invalidates_the_acknowledgement() -> None:
    # The operator vouched for one calculation, not for whatever the balance says next.
    service = ExperimentRuntimeService()
    exp_id = _weighed_experiment(service, 1036.0)
    AcknowledgeReceptionMassCheckService(service).run(exp_id, AcknowledgeReceptionMassCheckRequest(entry_id=None))

    RecordGrossWeightService(service).run(exp_id, RecordGrossWeightRequest(measured_gross_mass_g=1042.0))

    reception = service._require_experiment(exp_id).lims_reception
    assert reception.acknowledged_net_mass_g is not None
    assert reception.measured_gross_mass_g is not None
    current_net = reception.measured_gross_mass_g - reception.packaging_tare_mass_g
    assert reception.acknowledged_net_mass_g != pytest.approx(current_net)


def test_acknowledgement_without_a_weighing_raises() -> None:
    # There is no calculation to vouch for until the bag has been on the balance.
    service = ExperimentRuntimeService()
    exp_id = service.create_experiment().id
    assert service._require_experiment(exp_id).lims_reception.measured_gross_mass_g is None

    with pytest.raises(ValueError, match="Weigh"):
        AcknowledgeReceptionMassCheckService(service).run(exp_id, AcknowledgeReceptionMassCheckRequest(entry_id=None))


def test_acknowledgement_lands_on_the_named_entry() -> None:
    service = ExperimentRuntimeService()
    exp_id = _weighed_experiment(service)
    CreateLimsReceptionService(service).run(
        exp_id,
        CreateLimsReceptionRequest(
            orchard_name="Verger du Clos",
            harvest_date="2026-08-01",
            indicative_mass_g=1000.0,
            measured_gross_mass_g=None,
            measured_sample_mass_g=None,
            entry_id=None,
        ),
    )
    entry_id = service._require_experiment(exp_id).lims_reception.id
    assert entry_id is not None

    AcknowledgeReceptionMassCheckService(service).run(exp_id, AcknowledgeReceptionMassCheckRequest(entry_id=entry_id))

    experiment = service._require_experiment(exp_id)
    entry = next(entry for entry in experiment.lims_entries if entry.id == entry_id)
    assert entry.acknowledged_net_mass_g is not None
    # The live reception mirrors the entry it points at, so the widget sees it too.
    assert experiment.lims_reception.acknowledged_net_mass_g == pytest.approx(entry.acknowledged_net_mass_g)
