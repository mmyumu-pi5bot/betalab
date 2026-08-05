"""Orchestration for acquisition methods: read built-ins, author user copies."""
from __future__ import annotations

from dataclasses import replace

from app.core.config import settings
from app.domain.acquisition_method_rules import (
    MethodWarning,
    collect_acquisition_method_warnings,
    validate_acquisition_method,
)
from app.domain.acquisition_methods import (
    BUILT_IN_ACQUISITION_METHODS,
    AcquisitionMethod,
    duplicate_acquisition_method,
    get_built_in_acquisition_method,
)
from app.services.acquisition_method_repository import (
    AcquisitionMethodRepository,
    InMemoryAcquisitionMethodRepository,
    SqliteAcquisitionMethodRepository,
)


class AcquisitionMethodNotFoundError(ValueError):
    """Raised when no method is registered under an id.

    A ``ValueError`` so that a sequence launched against an unknown method is
    rejected as bad input by the generic route error handler; the method routes
    map it to 404 explicitly.
    """


class ImmutableAcquisitionMethodError(ValueError):
    pass


class InvalidAcquisitionMethodError(ValueError):
    def __init__(self, errors: list[str]) -> None:
        super().__init__("; ".join(errors))
        self.errors = errors


class AcquisitionMethodService:
    """Read access to every method, write access to user methods only."""

    def __init__(self, repository: AcquisitionMethodRepository | None = None) -> None:
        self._repository = (
            repository if repository is not None else InMemoryAcquisitionMethodRepository()
        )

    # -- reads ---------------------------------------------------------------

    def list_methods(self) -> list[AcquisitionMethod]:
        """Built-in methods first, then user methods."""
        return [*BUILT_IN_ACQUISITION_METHODS, *self._repository.list()]

    def get_method(self, method_id: str) -> AcquisitionMethod:
        try:
            return get_built_in_acquisition_method(method_id)
        except ValueError:
            pass
        stored = self._repository.load(method_id)
        if stored is None:
            raise AcquisitionMethodNotFoundError(
                f"Unknown acquisition method '{method_id}'."
            )
        return stored

    def warnings_for(self, method: AcquisitionMethod) -> list[MethodWarning]:
        return collect_acquisition_method_warnings(method)

    # -- writes --------------------------------------------------------------

    def duplicate(
        self,
        source_method_id: str,
        new_id: str,
        name: str,
        version: str,
    ) -> AcquisitionMethod:
        """Copy an existing method into an editable user method."""
        source = self.get_method(source_method_id)
        self._reject_existing_id(new_id)
        copy = duplicate_acquisition_method(source, new_id, name, version)
        self._require_valid(copy)
        self._repository.save(copy)
        return copy

    def save_new_version(self, method: AcquisitionMethod) -> AcquisitionMethod:
        """Persist an edited user method.

        A built-in method can never be overwritten: editing one means saving the
        result under a different id.
        """
        if self._is_built_in(method.id):
            raise ImmutableAcquisitionMethodError(
                f"'{method.id}' is a built-in method. Duplicate it before editing."
            )
        stored = replace(method, is_built_in=False)
        self._require_valid(stored)
        self._repository.save(stored)
        return stored

    def delete(self, method_id: str) -> None:
        if self._is_built_in(method_id):
            raise ImmutableAcquisitionMethodError(
                f"'{method_id}' is a built-in method and cannot be deleted."
            )
        if not self._repository.delete(method_id):
            raise AcquisitionMethodNotFoundError(
                f"Unknown acquisition method '{method_id}'."
            )

    # -- helpers -------------------------------------------------------------

    def _is_built_in(self, method_id: str) -> bool:
        return any(method.id == method_id for method in BUILT_IN_ACQUISITION_METHODS)

    def _reject_existing_id(self, method_id: str) -> None:
        if self._is_built_in(method_id) or self._repository.load(method_id) is not None:
            raise ValueError(f"An acquisition method '{method_id}' already exists.")

    def _require_valid(self, method: AcquisitionMethod) -> None:
        errors = validate_acquisition_method(method)
        if errors:
            raise InvalidAcquisitionMethodError(errors)


acquisition_method_service = AcquisitionMethodService(
    repository=SqliteAcquisitionMethodRepository(settings.experiments_db_path)
)
