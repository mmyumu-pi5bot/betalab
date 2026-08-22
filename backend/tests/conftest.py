import pkgutil

import pytest

from app.api import experiment_routes
from app.services.acquisition_method_repository import InMemoryAcquisitionMethodRepository
from app.services.acquisition_method_service import acquisition_method_service
from app.services.experiment_repository import SqliteExperimentRepository
from app.services.experiment_service import ExperimentRuntimeService


def create_service() -> ExperimentRuntimeService:
    return ExperimentRuntimeService()


@pytest.fixture(autouse=True)
def isolated_acquisition_method_store():
    """Keep user-authored methods out of the developer database.

    The route tests drive the module-level ``acquisition_method_service``, which
    is wired to the real SQLite file. Without this, saving a method during a test
    leaves a row behind, and a later run of the catalog test sees a library it
    never created.
    """
    original = acquisition_method_service._repository
    acquisition_method_service._repository = InMemoryAcquisitionMethodRepository()
    try:
        yield
    finally:
        acquisition_method_service._repository = original


@pytest.fixture(autouse=True)
def isolated_route_experiment_store(tmp_path, monkeypatch):
    """Keep experiments created through the routes out of the developer database.

    Each route module binds ``experiment_service`` by name at import time, so
    patching the one in ``common`` is not enough — every module that imported it
    keeps its own reference. They are discovered rather than listed: a test that
    drives a route module nobody thought to add here would otherwise write into
    ``./data/experiments.sqlite3`` and leave rows behind, which is exactly how
    eighteen stray "Untitled experiment" rows once appeared there.
    """
    isolated = ExperimentRuntimeService(
        repository=SqliteExperimentRepository(str(tmp_path / "route-tests.sqlite3"))
    )
    for module_info in pkgutil.iter_modules(experiment_routes.__path__):
        module = __import__(
            f"{experiment_routes.__name__}.{module_info.name}",
            fromlist=["experiment_service"],
        )
        if hasattr(module, "experiment_service"):
            monkeypatch.setattr(module, "experiment_service", isolated)
    yield
