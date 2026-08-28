"""Persistence for user-authored acquisition methods.

Built-in methods live in code and are never stored. Only the methods a user
creates by duplicating one land here.
"""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import asdict
from pathlib import Path
from typing import Protocol

from pydantic_core import to_jsonable_python

from app.domain.acquisition_methods import (
    AcquisitionMethod,
    GradientStep,
    IonSourceParameters,
    LiquidChromatographyParameters,
    MrmTransition,
)
from app.schemas.acquisition_method import AcquisitionMethodSchema


def deserialize_acquisition_method(schema: AcquisitionMethodSchema) -> AcquisitionMethod:
    """Rebuild the frozen domain method from its stored shape."""
    return AcquisitionMethod(
        id=schema.id,
        name=schema.name,
        version=schema.version,
        runtime_s=schema.runtime_s,
        is_educational=schema.is_educational,
        provenance_note=schema.provenance_note,
        is_built_in=schema.is_built_in,
        liquid_chromatography=LiquidChromatographyParameters(
            column_label=schema.liquid_chromatography.column_label,
            column_temperature_c=schema.liquid_chromatography.column_temperature_c,
            mobile_phase_a=schema.liquid_chromatography.mobile_phase_a,
            mobile_phase_b=schema.liquid_chromatography.mobile_phase_b,
            flow_ml_per_min=schema.liquid_chromatography.flow_ml_per_min,
            gradient=tuple(
                GradientStep(
                    time_s=step.time_s,
                    mobile_phase_b_percent=step.mobile_phase_b_percent,
                )
                for step in schema.liquid_chromatography.gradient
            ),
        ),
        ion_source=IonSourceParameters(**schema.ion_source.model_dump()),
        transitions=tuple(MrmTransition(**transition.model_dump()) for transition in schema.transitions),
        calibration_levels_ng_per_ml=tuple(schema.calibration_levels_ng_per_ml),
    )


class AcquisitionMethodRepository(Protocol):
    def save(self, method: AcquisitionMethod) -> None: ...

    def load(self, method_id: str) -> AcquisitionMethod | None: ...

    def list(self) -> list[AcquisitionMethod]: ...

    def delete(self, method_id: str) -> bool: ...


class InMemoryAcquisitionMethodRepository:
    def __init__(self) -> None:
        self._methods: dict[str, AcquisitionMethod] = {}

    def save(self, method: AcquisitionMethod) -> None:
        self._methods[method.id] = method

    def load(self, method_id: str) -> AcquisitionMethod | None:
        return self._methods.get(method_id)

    def list(self) -> list[AcquisitionMethod]:
        return sorted(self._methods.values(), key=lambda method: method.id)

    def delete(self, method_id: str) -> bool:
        return self._methods.pop(method_id, None) is not None


class SqliteAcquisitionMethodRepository:
    def __init__(self, db_path: str) -> None:
        self._db_path = db_path
        self._ensure_parent_directory()
        with sqlite3.connect(self._db_path) as connection:
            self._ensure_schema(connection)

    def save(self, method: AcquisitionMethod) -> None:
        payload = json.dumps(to_jsonable_python(asdict(method)), sort_keys=True)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO acquisition_methods (id, payload)
                VALUES (?, ?)
                ON CONFLICT(id) DO UPDATE SET payload = excluded.payload
                """,
                (method.id, payload),
            )
            connection.commit()

    def load(self, method_id: str) -> AcquisitionMethod | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT payload FROM acquisition_methods WHERE id = ?",
                (method_id,),
            ).fetchone()
        if row is None:
            return None
        return self._decode(row[0])

    def list(self) -> list[AcquisitionMethod]:
        with self._connect() as connection:
            rows = connection.execute("SELECT payload FROM acquisition_methods ORDER BY id").fetchall()
        return [self._decode(row[0]) for row in rows]

    def delete(self, method_id: str) -> bool:
        with self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM acquisition_methods WHERE id = ?",
                (method_id,),
            )
            connection.commit()
        return cursor.rowcount > 0

    def _decode(self, payload: str) -> AcquisitionMethod:
        return deserialize_acquisition_method(AcquisitionMethodSchema.model_validate(json.loads(payload)))

    def _ensure_parent_directory(self) -> None:
        Path(self._db_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        self._ensure_parent_directory()
        with sqlite3.connect(self._db_path) as connection:
            self._ensure_schema(connection)
            yield connection

    def _ensure_schema(self, connection: sqlite3.Connection) -> None:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS acquisition_methods (
                id TEXT PRIMARY KEY,
                payload TEXT NOT NULL
            )
            """
        )
        connection.commit()
