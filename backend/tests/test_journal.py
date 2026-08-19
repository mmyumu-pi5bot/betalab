from datetime import UTC, datetime

from app.services.domain_services.workspace import (
    AddWorkspaceWidgetService,
    MoveWorkspaceWidgetService,
    WorkspaceWidgetLayoutRequest,
)
from app.services.experiment_repository import SqliteExperimentRepository
from app.services.experiment_service import ExperimentRuntimeService
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
