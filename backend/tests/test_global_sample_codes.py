"""Sample codes identify a sample on the platform, not inside one experiment.

The code is printed on a label, the label names the injection, and the injection
file is what the reprocessing platform reads. Two experiments handing out the same
code means two different apples arriving downstream under one identity — so the
globally unique half of the code is the experiment number, allocated once by the
store that knows every experiment.
"""
from __future__ import annotations

from app.services.domain_services.reception import (
    CreateLimsReceptionRequest,
    CreateLimsReceptionService,
    RecordGrossWeightRequest,
    RecordGrossWeightService,
)
from app.services.experiment_repository import SqliteExperimentRepository
from app.services.experiment_service import ExperimentRuntimeService


def _receive(service: ExperimentRuntimeService, exp_id: str, orchard: str = "Verger du Clos") -> str:
    RecordGrossWeightService(service).run(
        exp_id, RecordGrossWeightRequest(measured_gross_mass_g=1036.0)
    )
    CreateLimsReceptionService(service).run(
        exp_id,
        CreateLimsReceptionRequest(
            orchard_name=orchard,
            harvest_date="2026-08-01",
            indicative_mass_g=1000.0,
            measured_gross_mass_g=None,
            measured_sample_mass_g=None,
            entry_id=None,
        ),
    )
    code = service._require_experiment(exp_id).lims_reception.lab_sample_code
    assert code is not None
    return code


def test_code_pairs_the_experiment_number_with_a_local_sequence(tmp_path) -> None:
    service = ExperimentRuntimeService(
        repository=SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
    )
    exp_id = service.create_experiment().id

    first = _receive(service, exp_id)
    second = _receive(service, exp_id, orchard="Verger du Haut")

    number = service._require_experiment(exp_id).sequence_number
    assert first == f"APP-{number:04d}-01"
    assert second == f"APP-{number:04d}-02"


def test_two_experiments_never_share_a_sample_code(tmp_path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
    service = ExperimentRuntimeService(repository=repository)

    first_code = _receive(service, service.create_experiment().id)
    second_code = _receive(service, service.create_experiment().id)

    assert first_code != second_code


def test_experiment_numbers_are_allocated_across_processes(tmp_path) -> None:
    # Two runtimes over one database is what two browser tabs — or a restart — look
    # like from the store's side. Numbering has to come from the database, not from
    # whatever a single process happens to remember.
    db_path = str(tmp_path / "experiments.sqlite3")
    first_service = ExperimentRuntimeService(repository=SqliteExperimentRepository(db_path))
    first_code = _receive(first_service, first_service.create_experiment().id)

    second_service = ExperimentRuntimeService(repository=SqliteExperimentRepository(db_path))
    second_code = _receive(second_service, second_service.create_experiment().id)

    assert first_code != second_code


def test_a_deleted_experiment_never_lends_its_number_to_the_next_one(tmp_path) -> None:
    # Its samples may already be sitting in the reprocessing platform under that code.
    repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
    service = ExperimentRuntimeService(repository=repository)
    doomed_id = service.create_experiment().id
    doomed_number = service._require_experiment(doomed_id).sequence_number

    service.delete_experiment(doomed_id)
    replacement_number = service._require_experiment(service.create_experiment().id).sequence_number

    assert replacement_number != doomed_number


def test_a_duplicate_gets_its_own_number(tmp_path) -> None:
    # A copy is a second experiment: its samples are not the originals.
    repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
    service = ExperimentRuntimeService(repository=repository)
    source_id = service.create_experiment().id
    source_number = service._require_experiment(source_id).sequence_number

    duplicate_id = service.duplicate_experiment(source_id).id

    assert service._require_experiment(duplicate_id).sequence_number != source_number


def test_the_number_survives_a_reload(tmp_path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "experiments.sqlite3"))
    service = ExperimentRuntimeService(repository=repository)
    exp_id = service.create_experiment().id
    code = _receive(service, exp_id)
    number = service._require_experiment(exp_id).sequence_number

    reloaded = ExperimentRuntimeService(repository=repository)._require_experiment(exp_id)

    assert reloaded.sequence_number == number
    assert reloaded.lims_reception.lab_sample_code == code


def _strip_sequence_numbers(db_path: str) -> None:
    """Rewind a database to what it looked like before experiments were numbered."""
    import json
    import sqlite3

    with sqlite3.connect(db_path) as connection:
        rows = connection.execute("SELECT id, payload FROM experiments").fetchall()
        for experiment_id, serialized in rows:
            payload = json.loads(serialized)
            payload.pop("sequence_number", None)
            connection.execute(
                "UPDATE experiments SET payload = ? WHERE id = ?",
                (json.dumps(payload, sort_keys=True), experiment_id),
            )
        connection.execute("DELETE FROM platform_counters")
        connection.commit()


def test_experiments_saved_before_numbering_are_numbered_on_open(tmp_path) -> None:
    # Without this, every pre-existing experiment reports number 0 and starts handing
    # out identical codes — the collision the number exists to prevent.
    db_path = str(tmp_path / "experiments.sqlite3")
    service = ExperimentRuntimeService(repository=SqliteExperimentRepository(db_path))
    first_id = service.create_experiment().id
    second_id = service.create_experiment().id
    _strip_sequence_numbers(db_path)

    migrated = ExperimentRuntimeService(repository=SqliteExperimentRepository(db_path))
    first_number = migrated._require_experiment(first_id).sequence_number
    second_number = migrated._require_experiment(second_id).sequence_number

    assert first_number > 0
    assert second_number > 0
    assert first_number != second_number


def test_numbering_carries_on_above_the_backfilled_experiments(tmp_path) -> None:
    db_path = str(tmp_path / "experiments.sqlite3")
    service = ExperimentRuntimeService(repository=SqliteExperimentRepository(db_path))
    legacy_id = service.create_experiment().id
    _strip_sequence_numbers(db_path)

    migrated = ExperimentRuntimeService(repository=SqliteExperimentRepository(db_path))
    legacy_number = migrated._require_experiment(legacy_id).sequence_number
    fresh_number = migrated._require_experiment(migrated.create_experiment().id).sequence_number

    assert fresh_number > legacy_number
