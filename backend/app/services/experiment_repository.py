from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

from app.domain.models import (
    ContainerLabel,
    EntityOrigin,
    Experiment,
    ExperimentStatus,
    LimsLabel,
    LimsReception,
    ManualLabel,
    PrintedLabelTicket,
    ProduceFraction,
    ProduceLot,
    ProduceMaterialState,
    QuechersState,
    Rack,
    RackSlot,
    SpatulaState,
    Trash,
    TrashProduceLotEntry,
    TrashSampleLabelEntry,
    Workbench,
    WorkbenchLiquid,
    WorkbenchSlot,
    WorkbenchTool,
    Workspace,
    WorkspaceWidget,
)
from app.schemas.experiment import ExperimentListEntrySchema, ExperimentSchema
from app.services.helpers.produce_canonical import sync_canonical_produce_model


class ExperimentRepository(Protocol):
    def save(self, experiment: Experiment) -> None: ...

    def load(self, experiment_id: str) -> Experiment | None: ...

    def list(self) -> list[ExperimentListEntrySchema]: ...

    def delete(self, experiment_id: str) -> bool: ...


class InMemoryExperimentRepository:
    def save(self, experiment: Experiment) -> None:
        return None

    def load(self, experiment_id: str) -> Experiment | None:
        return None

    def list(self) -> list[ExperimentListEntrySchema]:
        return []

    def delete(self, experiment_id: str) -> bool:
        return False


class SqliteExperimentRepository:
    def __init__(self, db_path: str) -> None:
        self._db_path = db_path
        self._ensure_parent_directory()
        self._initialize_schema()

    def save(self, experiment: Experiment) -> None:
        payload = json.dumps(_serialize_experiment(experiment), sort_keys=True)
        now = datetime.now(UTC).isoformat()
        last_audit_entry = experiment.audit_log[-1] if experiment.audit_log else None
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO experiments (
                    id,
                    created_at,
                    updated_at,
                    snapshot_version,
                    status,
                    last_simulation_at,
                    last_audit_entry,
                    payload
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    updated_at = excluded.updated_at,
                    snapshot_version = excluded.snapshot_version,
                    status = excluded.status,
                    last_simulation_at = excluded.last_simulation_at,
                    last_audit_entry = excluded.last_audit_entry,
                    payload = excluded.payload
                """,
                (
                    experiment.id,
                    now,
                    now,
                    experiment.snapshot_version,
                    experiment.status.value,
                    experiment.last_simulation_at.isoformat(),
                    last_audit_entry,
                    payload,
                ),
            )
            connection.commit()

    def load(self, experiment_id: str) -> Experiment | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT payload FROM experiments WHERE id = ?",
                (experiment_id,),
            ).fetchone()

        if row is None:
            return None

        payload = json.loads(row[0])
        return _deserialize_experiment(payload)

    def list(self) -> list[ExperimentListEntrySchema]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, updated_at, snapshot_version, status, last_simulation_at, last_audit_entry
                FROM experiments
                ORDER BY updated_at DESC, id DESC
                """
            ).fetchall()

        return [
            ExperimentListEntrySchema(
                id=experiment_id,
                status=status,
                last_simulation_at=datetime.fromisoformat(last_simulation_at),
                snapshot_version=snapshot_version,
                updated_at=datetime.fromisoformat(updated_at),
                last_audit_entry=last_audit_entry,
            )
            for (
                experiment_id,
                updated_at,
                snapshot_version,
                status,
                last_simulation_at,
                last_audit_entry,
            ) in rows
        ]

    def delete(self, experiment_id: str) -> bool:
        with self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM experiments WHERE id = ?",
                (experiment_id,),
            )
            connection.commit()
        return cursor.rowcount > 0

    def _ensure_parent_directory(self) -> None:
        Path(self._db_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)

    def _initialize_schema(self) -> None:
        with sqlite3.connect(self._db_path) as connection:
            self._ensure_schema(connection)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        self._ensure_parent_directory()
        with sqlite3.connect(self._db_path) as connection:
            self._ensure_schema(connection)
            yield connection

    def _ensure_schema(self, connection: sqlite3.Connection) -> None:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS experiments (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                snapshot_version INTEGER NOT NULL,
                status TEXT,
                last_simulation_at TEXT,
                last_audit_entry TEXT,
                payload TEXT NOT NULL
            )
            """
        )
        self._ensure_column(connection, "status", "TEXT")
        self._ensure_column(connection, "last_simulation_at", "TEXT")
        self._ensure_column(connection, "last_audit_entry", "TEXT")
        connection.commit()

    def _ensure_column(self, connection: sqlite3.Connection, column_name: str, column_type: str) -> None:
        existing_columns = {row[1] for row in connection.execute("PRAGMA table_info(experiments)").fetchall()}
        if column_name in existing_columns:
            return
        connection.execute(f"ALTER TABLE experiments ADD COLUMN {column_name} {column_type}")


def _serialize_experiment(experiment: Experiment) -> dict:
    return ExperimentSchema.model_validate(
        {
            "id": experiment.id,
            "status": experiment.status.value,
            "last_simulation_at": experiment.last_simulation_at,
            "snapshot_version": experiment.snapshot_version,
            "workbench": asdict(experiment.workbench),
            "rack": asdict(experiment.rack),
            "trash": asdict(experiment.trash),
            "workspace": asdict(experiment.workspace),
            "lims_reception": asdict(experiment.lims_reception),
            "lims_entries": [asdict(entry) for entry in experiment.lims_entries],
            "basket_tools": [asdict(t) for t in experiment.basket_tools],
            "produce_material_states": [asdict(state) for state in experiment.produce_material_states],
            "spatula": asdict(experiment.spatula),
            "audit_log": experiment.audit_log,
        }
    ).model_dump(mode="json")


def _deserialize_experiment(payload: dict) -> Experiment:
    schema = ExperimentSchema.model_validate(payload)
    experiment = Experiment(
        id=schema.id,
        status=ExperimentStatus(schema.status),
        workbench=Workbench(
            slots=[
                WorkbenchSlot(
                    id=slot.id,
                    label=slot.label,
                    tool=_deserialize_workbench_tool(slot.tool),
                    surface_produce_lots=[_deserialize_produce_lot(lot) for lot in slot.surface_produce_lots],
                    surface_produce_fractions=[_deserialize_produce_fraction(fraction) for fraction in slot.surface_produce_fractions],
                )
                for slot in schema.workbench.slots
            ]
        ),
        rack=Rack(
            slots=[
                RackSlot(
                    id=slot.id,
                    label=slot.label,
                    tool=_deserialize_workbench_tool(slot.tool),
                )
                for slot in schema.rack.slots
            ]
        ),
        trash=Trash(
            children=[_deserialize_non_null_workbench_tool(tool_schema) for tool_schema in schema.trash.children],
            discarded_from=dict(schema.trash.discarded_from),
            produce_lots=[
                TrashProduceLotEntry(
                    id=entry.id,
                    origin_label=entry.origin_label,
                    produce_lot=_deserialize_produce_lot(entry.produce_lot),
                    origin=_deserialize_entity_origin(entry.origin),
                    produce_fraction=_deserialize_produce_fraction(entry.produce_fraction),
                )
                for entry in schema.trash.produce_lots
            ],
            sample_labels=[
                TrashSampleLabelEntry(
                    id=entry.id,
                    origin_label=entry.origin_label,
                    label=_deserialize_container_label(entry.label),
                )
                for entry in schema.trash.sample_labels
            ],
        ),
        workspace=_deserialize_workspace(schema),
        lims_reception=LimsReception(
            orchard_name=schema.lims_reception.orchard_name,
            harvest_date=schema.lims_reception.harvest_date,
            indicative_mass_g=schema.lims_reception.indicative_mass_g,
            id=schema.lims_reception.id,
            measured_gross_mass_g=schema.lims_reception.measured_gross_mass_g,
            measured_sample_mass_g=schema.lims_reception.measured_sample_mass_g,
            lab_sample_code=schema.lims_reception.lab_sample_code,
            status=schema.lims_reception.status,
            printed_label_ticket=_deserialize_printed_label_ticket(schema.lims_reception.printed_label_ticket)
            if schema.lims_reception.printed_label_ticket is not None
            else None,
        ),
        last_simulation_at=schema.last_simulation_at,
        basket_tools=[_deserialize_non_null_workbench_tool(t) for t in schema.basket_tools],
        produce_material_states=[ProduceMaterialState(**state.model_dump()) for state in schema.produce_material_states],
        spatula=SpatulaState(
            is_loaded=schema.spatula.is_loaded,
            produce_fractions=[_deserialize_produce_fraction(f) for f in schema.spatula.produce_fractions],
            source_tool_id=schema.spatula.source_tool_id,
        ),
        lims_entries=_deserialize_lims_entries(schema),
        snapshot_version=schema.snapshot_version,
        audit_log=list(schema.audit_log),
    )
    sync_canonical_produce_model(experiment)
    return experiment


def _deserialize_workspace(schema: ExperimentSchema) -> Workspace:
    workspace = Workspace(
        widgets=[
            WorkspaceWidget(
                id=widget.id,
                widget_type=widget.widget_type,
                label=widget.label,
                anchor=widget.anchor,
                offset_x=widget.offset_x,
                offset_y=widget.offset_y,
                is_present=widget.is_present,
                is_trashed=widget.is_trashed,
                grinder_run_duration_ms=widget.grinder_run_duration_ms,
                grinder_run_remaining_ms=widget.grinder_run_remaining_ms,
                grinder_fault=widget.grinder_fault,
                vortex_run_duration_ms=widget.vortex_run_duration_ms,
                vortex_run_remaining_ms=widget.vortex_run_remaining_ms,
                tool=_deserialize_workbench_tool(widget.tool),
                produce_lots=[_deserialize_produce_lot(lot) for lot in widget.produce_lots],
                liquids=[WorkbenchLiquid(**liquid.model_dump()) for liquid in widget.liquids],
                produce_fractions=[_deserialize_produce_fraction(fraction) for fraction in widget.produce_fractions],
            )
            for widget in schema.workspace.widgets
        ],
    )
    workspace.produce_basket_lots = [_deserialize_produce_lot(lot) for lot in schema.workspace.produce_basket_lots]
    workspace.produce_basket_fractions = [_deserialize_produce_fraction(fraction) for fraction in schema.workspace.produce_basket_fractions]
    return workspace


def _deserialize_lims_entries(schema: ExperimentSchema) -> list[LimsReception]:
    if schema.lims_entries:
        return [
            LimsReception(
                orchard_name=entry.orchard_name,
                harvest_date=entry.harvest_date,
                indicative_mass_g=entry.indicative_mass_g,
                id=entry.id,
                measured_gross_mass_g=entry.measured_gross_mass_g,
                measured_sample_mass_g=entry.measured_sample_mass_g,
                lab_sample_code=entry.lab_sample_code,
                status=entry.status,
                printed_label_ticket=_deserialize_printed_label_ticket(entry.printed_label_ticket)
                if entry.printed_label_ticket is not None
                else None,
            )
            for entry in schema.lims_entries
        ]

    if schema.lims_reception.lab_sample_code is None:
        return []

    return [
        LimsReception(
            orchard_name=schema.lims_reception.orchard_name,
            harvest_date=schema.lims_reception.harvest_date,
            indicative_mass_g=schema.lims_reception.indicative_mass_g,
            id=schema.lims_reception.id,
            measured_gross_mass_g=schema.lims_reception.measured_gross_mass_g,
            measured_sample_mass_g=schema.lims_reception.measured_sample_mass_g,
            lab_sample_code=schema.lims_reception.lab_sample_code,
            status=schema.lims_reception.status,
            printed_label_ticket=None,
        )
    ]


def _deserialize_workbench_tool(tool_schema) -> WorkbenchTool | None:
    if tool_schema is None:
        return None
    return WorkbenchTool(
        id=tool_schema.id,
        tool_id=tool_schema.tool_id,
        label=tool_schema.label,
        subtitle=tool_schema.subtitle,
        accent=tool_schema.accent,
        tool_type=tool_schema.tool_type,
        capacity_ml=tool_schema.capacity_ml,
        contact_impurity_mg_per_g=tool_schema.contact_impurity_mg_per_g,
        is_sealed=tool_schema.is_sealed,
        closure_fault=tool_schema.closure_fault,
        internal_pressure_bar=tool_schema.internal_pressure_bar,
        trapped_co2_mass_g=tool_schema.trapped_co2_mass_g,
        field_label_text=tool_schema.field_label_text,
        labels=[_deserialize_container_label(label) for label in tool_schema.labels],
        produce_lots=[_deserialize_produce_lot(lot) for lot in tool_schema.produce_lots],
        liquids=[WorkbenchLiquid(**liquid.model_dump()) for liquid in tool_schema.liquids],
        produce_fractions=[_deserialize_produce_fraction(fraction) for fraction in tool_schema.produce_fractions],
        quechers_state=QuechersState(**tool_schema.quechers_state.model_dump(exclude={"is_usable"})),
    )


def _deserialize_non_null_workbench_tool(tool_schema) -> WorkbenchTool:
    tool = _deserialize_workbench_tool(tool_schema)
    if tool is None:
        raise ValueError("Expected workbench tool payload.")
    return tool


def _deserialize_printed_label_ticket(ticket_schema) -> PrintedLabelTicket:
    computed = set(ticket_schema.model_computed_fields.keys())
    payload = ticket_schema.model_dump(exclude=computed)
    return PrintedLabelTicket(**payload)


def _deserialize_container_label(label_schema) -> ContainerLabel:
    if label_schema.label_kind == "lims":
        return LimsLabel(
            id=label_schema.id,
            text=label_schema.text,
            label_kind="lims",
            sample_code=label_schema.sample_code or "",
            received_date=label_schema.received_date or "",
        )

    return ManualLabel(
        id=label_schema.id,
        text=label_schema.text,
        label_kind="manual",
    )


def _deserialize_entity_origin(origin_schema) -> EntityOrigin | None:
    if origin_schema is None:
        return None
    return EntityOrigin(**origin_schema.model_dump())


def _deserialize_produce_lot(lot_schema) -> ProduceLot:
    computed = set(type(lot_schema).model_computed_fields.keys())
    payload = lot_schema.model_dump(exclude=computed)
    return ProduceLot(**payload)


def _deserialize_produce_fraction(fraction_schema) -> ProduceFraction:
    return ProduceFraction(**fraction_schema.model_dump())
