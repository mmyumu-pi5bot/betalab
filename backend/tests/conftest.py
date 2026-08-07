import pytest

from app.services.acquisition_method_repository import InMemoryAcquisitionMethodRepository
from app.services.acquisition_method_service import acquisition_method_service
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
