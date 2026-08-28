from datetime import UTC, datetime

from app.domain.journal_codes import JournalCode
from app.services.domain_services.workspace import (
    AddWorkspaceWidgetService,
    MoveWorkspaceWidgetService,
    WorkspaceWidgetLayoutRequest,
)
from app.services.experiment_repository import SqliteExperimentRepository
from app.services.experiment_service import ExperimentRuntimeService
from app.services.journal_messages import JOURNAL_TEMPLATES
from app.services.journal_service import classify_journal_message


def test_mutations_create_structured_journal_entries_with_stable_timestamps() -> None:
    now = datetime(2026, 8, 19, 12, 30, tzinfo=UTC)
    service = ExperimentRuntimeService()
    service._now_fn = lambda: now

    created = service.create_experiment("Apple preparation")

    assert [entry.message for entry in created.journal_entries] == created.audit_log
    assert all(entry.occurred_at == now for entry in created.journal_entries)
    assert created.journal_entries[0].category == "system"
    assert created.journal_entries[0].severity == "info"


def test_workspace_reposition_is_classified_as_layout_noise() -> None:
    service = ExperimentRuntimeService()
    created = service.create_experiment()
    request = WorkspaceWidgetLayoutRequest(
        widget_id="rack",
        anchor="top-left",
        offset_x=100,
        offset_y=120,
    )

    AddWorkspaceWidgetService(service).run(created.id, request)
    moved = MoveWorkspaceWidgetService(service).run(created.id, request)

    assert moved.journal_entries[-1].message == "Autosampler rack moved in workspace."
    assert moved.journal_entries[-1].category == "layout"


def test_warning_messages_keep_their_business_category() -> None:
    category, severity = classify_journal_message("Apple lot 1 placed directly on Station 2 and marked contaminated.")

    assert category == "manipulation"
    assert severity == "warning"


def test_structured_journal_survives_repository_round_trip(tmp_path) -> None:
    database_path = tmp_path / "journal.sqlite3"
    service = ExperimentRuntimeService(repository=SqliteExperimentRepository(str(database_path)))
    created = service.create_experiment()

    reloaded_service = ExperimentRuntimeService(repository=SqliteExperimentRepository(str(database_path)))
    reloaded = reloaded_service.get_experiment(created.id)

    assert reloaded.journal_entries == created.journal_entries


def test_experiment_summary_ignores_layout_noise(tmp_path) -> None:
    repository = SqliteExperimentRepository(str(tmp_path / "journal-summary.sqlite3"))
    service = ExperimentRuntimeService(repository=repository)
    created = service.create_experiment()
    request = WorkspaceWidgetLayoutRequest(
        widget_id="rack",
        anchor="top-left",
        offset_x=100,
        offset_y=120,
    )
    AddWorkspaceWidgetService(service).run(created.id, request)
    MoveWorkspaceWidgetService(service).run(created.id, request)

    summary = repository.list()[0]

    assert summary.last_audit_entry == "Autosampler rack added to workspace."


def test_every_journal_code_has_english_wording() -> None:
    """A code with no template renders as a crash the first time it is emitted."""
    missing = [code for code in JournalCode if code not in JOURNAL_TEMPLATES]

    assert missing == []


def test_recorded_entries_carry_their_code_and_parameters() -> None:
    service = ExperimentRuntimeService()
    created = service.create_experiment()
    request = WorkspaceWidgetLayoutRequest(
        widget_id="rack",
        anchor="top-left",
        offset_x=100,
        offset_y=120,
    )

    added = AddWorkspaceWidgetService(service).run(created.id, request)
    entry = added.journal_entries[-1]

    assert entry.code == JournalCode.WIDGET_ADDED
    # The widget is named by its stable type, not only by its English label, so a
    # client can render the sentence in another language.
    assert entry.params["widget"] == {
        "kind": "widget",
        "id": "autosampler_rack",
        "text": "Autosampler rack",
        "index": None,
    }
    assert entry.message == "Autosampler rack added to workspace."


def test_codes_and_parameters_survive_a_repository_round_trip(tmp_path) -> None:
    repository = SqliteExperimentRepository(tmp_path / "experiments.db")
    service = ExperimentRuntimeService(repository=repository)
    created = service.create_experiment()
    AddWorkspaceWidgetService(service).run(
        created.id,
        WorkspaceWidgetLayoutRequest(widget_id="rack", anchor="top-left", offset_x=1, offset_y=2),
    )

    reloaded = ExperimentRuntimeService(repository=repository).get_experiment(created.id)

    entry = reloaded.journal_entries[-1]
    assert entry.code == JournalCode.WIDGET_ADDED
    assert entry.params["widget"]["id"] == "autosampler_rack"


def test_every_mutation_records_a_code() -> None:
    """An entry without a code can only be rendered in English."""
    service = ExperimentRuntimeService()
    created = service.create_experiment()
    AddWorkspaceWidgetService(service).run(
        created.id,
        WorkspaceWidgetLayoutRequest(widget_id="rack", anchor="top-left", offset_x=1, offset_y=2),
    )
    ready = service.get_experiment(created.id)

    assert [entry.message for entry in ready.journal_entries if entry.code is None] == []


def test_experiment_list_carries_the_last_journal_line_structured(tmp_path) -> None:
    repository = SqliteExperimentRepository(tmp_path / "experiments.db")
    service = ExperimentRuntimeService(repository=repository)
    created = service.create_experiment()
    AddWorkspaceWidgetService(service).run(
        created.id,
        WorkspaceWidgetLayoutRequest(widget_id="rack", anchor="top-left", offset_x=1, offset_y=2),
    )

    entry = next(item for item in repository.list() if item.id == created.id)

    assert entry.last_audit_entry == "Autosampler rack added to workspace."
    assert entry.last_journal_event is not None
    assert entry.last_journal_event.code == JournalCode.WIDGET_ADDED
    assert entry.last_journal_event.params["widget"]["id"] == "autosampler_rack"
