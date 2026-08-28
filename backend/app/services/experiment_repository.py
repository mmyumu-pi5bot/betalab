from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

from pydantic_core import to_jsonable_python

from app.domain.acquisition_methods import MrmTransition
from app.domain.models import (
    CalibrationContext,
    ContainerLabel,
    EntityOrigin,
    Experiment,
    ExperimentStatus,
    InjectionContext,
    InjectionMeasurement,
    JournalEvent,
    JournalEventCategory,
    JournalEventSeverity,
    LimsLabel,
    LimsReception,
    ManualLabel,
    PipetteState,
    PrintedLabelTicket,
    ProduceFraction,
    ProduceLot,
    ProduceMaterialState,
    QuechersExtractionResult,
    QuechersState,
    Rack,
    RackSlot,
    SampleWeighing,
    SequenceRun,
    SpatulaState,
    TraceAcquisitionMetadata,
    TransitionTrace,
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
from app.schemas.experiment import (
    ExperimentListEntrySchema,
    ExperimentSchema,
    ExperimentSummarySchema,
    LastJournalEventSchema,
    TransitionTraceSchema,
)
from app.services.acquisition_method_repository import deserialize_acquisition_method
from app.services.helpers.produce_canonical import (
    sync_canonical_produce_model,
    sync_pesticide_material_states,
)
from app.services.journal_service import build_journal_event


class ExperimentRepository(Protocol):
    def save(self, experiment: Experiment) -> None: ...

    def load(self, experiment_id: str) -> Experiment | None: ...

    def list(self) -> list[ExperimentListEntrySchema]: ...

    def delete(self, experiment_id: str) -> bool: ...

    def reserve_experiment_number(self) -> int:
        """Hand out the next platform-wide experiment number.

        Sample codes are built on it, and those codes leave the platform on labels and
        in injection file names, so a number is never handed out twice — not after a
        restart, and not after the experiment that held it was deleted.
        """
        ...


class InMemoryExperimentRepository:
    def __init__(self) -> None:
        self._last_experiment_number = 0

    def save(self, experiment: Experiment) -> None:
        return None

    def load(self, experiment_id: str) -> Experiment | None:
        return None

    def list(self) -> list[ExperimentListEntrySchema]:
        return []

    def delete(self, experiment_id: str) -> bool:
        return False

    def reserve_experiment_number(self) -> int:
        self._last_experiment_number += 1
        return self._last_experiment_number


class SqliteExperimentRepository:
    def __init__(self, db_path: str) -> None:
        self._db_path = db_path
        self._ensure_parent_directory()
        self._initialize_schema()

    def reserve_experiment_number(self) -> int:
        """Bump and read the counter in one transaction, so two callers cannot tie.

        The counter is its own row rather than ``MAX(sequence_number) + 1`` precisely so
        that deleting the highest-numbered experiment does not put its number back in
        circulation.
        """
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO platform_counters (name, value) VALUES ('experiment_number', 1)
                ON CONFLICT(name) DO UPDATE SET value = value + 1
                """
            )
            row = connection.execute("SELECT value FROM platform_counters WHERE name = 'experiment_number'").fetchone()
            connection.commit()
        return int(row[0])

    def save(self, experiment: Experiment) -> None:
        payload = json.dumps(_serialize_experiment(experiment), sort_keys=True)
        now = datetime.now(UTC).isoformat()
        last_entry = next(
            (entry for entry in reversed(experiment.journal_entries) if entry.category != JournalEventCategory.LAYOUT),
            None,
        )
        last_audit_entry = last_entry.message if last_entry is not None else None
        # Stored structured as well as rendered, so the experiment list can show
        # that line in the reader's language rather than only in English.
        last_journal_event = (
            json.dumps({"code": last_entry.code, "params": last_entry.params}, sort_keys=True)
            if last_entry is not None and last_entry.code is not None
            else None
        )
        summary = _build_experiment_summary(experiment)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO experiments (
                    id,
                    name,
                    created_at,
                    updated_at,
                    snapshot_version,
                    status,
                    last_simulation_at,
                    last_audit_entry,
                    last_journal_event,
                    workbench_tool_count,
                    rack_tool_count,
                    material_count,
                    run_count,
                    payload
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    updated_at = excluded.updated_at,
                    snapshot_version = excluded.snapshot_version,
                    status = excluded.status,
                    last_simulation_at = excluded.last_simulation_at,
                    last_audit_entry = excluded.last_audit_entry,
                    last_journal_event = excluded.last_journal_event,
                    workbench_tool_count = excluded.workbench_tool_count,
                    rack_tool_count = excluded.rack_tool_count,
                    material_count = excluded.material_count,
                    run_count = excluded.run_count,
                    payload = excluded.payload
                """,
                (
                    experiment.id,
                    experiment.name,
                    now,
                    now,
                    experiment.snapshot_version,
                    experiment.status.value,
                    experiment.last_simulation_at.isoformat(),
                    last_audit_entry,
                    last_journal_event,
                    summary.workbench_tool_count,
                    summary.rack_tool_count,
                    summary.material_count,
                    summary.run_count,
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
                SELECT id, COALESCE(name, 'Untitled experiment'), updated_at,
                       snapshot_version, status, last_simulation_at, last_audit_entry,
                       last_journal_event,
                       COALESCE(workbench_tool_count, 0), COALESCE(rack_tool_count, 0),
                       COALESCE(material_count, 0), COALESCE(run_count, 0)
                FROM experiments
                ORDER BY updated_at DESC, id DESC
                """
            ).fetchall()

        return [
            ExperimentListEntrySchema(
                id=experiment_id,
                name=name,
                status=status,
                last_simulation_at=datetime.fromisoformat(last_simulation_at),
                snapshot_version=snapshot_version,
                updated_at=datetime.fromisoformat(updated_at),
                last_audit_entry=last_audit_entry,
                last_journal_event=_deserialize_last_journal_event(
                    last_journal_event,
                    last_audit_entry,
                ),
                summary=ExperimentSummarySchema(
                    workbench_tool_count=workbench_tool_count,
                    rack_tool_count=rack_tool_count,
                    material_count=material_count,
                    run_count=run_count,
                ),
            )
            for (
                experiment_id,
                name,
                updated_at,
                snapshot_version,
                status,
                last_simulation_at,
                last_audit_entry,
                last_journal_event,
                workbench_tool_count,
                rack_tool_count,
                material_count,
                run_count,
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
                name TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                snapshot_version INTEGER NOT NULL,
                status TEXT,
                last_simulation_at TEXT,
                last_audit_entry TEXT,
                workbench_tool_count INTEGER,
                rack_tool_count INTEGER,
                material_count INTEGER,
                run_count INTEGER,
                payload TEXT NOT NULL
            )
            """
        )
        self._ensure_column(connection, "status", "TEXT")
        self._ensure_column(connection, "last_simulation_at", "TEXT")
        self._ensure_column(connection, "last_audit_entry", "TEXT")
        self._ensure_column(connection, "last_journal_event", "TEXT")
        self._ensure_column(connection, "name", "TEXT")
        self._ensure_column(connection, "workbench_tool_count", "INTEGER")
        self._ensure_column(connection, "rack_tool_count", "INTEGER")
        self._ensure_column(connection, "material_count", "INTEGER")
        self._ensure_column(connection, "run_count", "INTEGER")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS platform_counters (
                name TEXT PRIMARY KEY,
                value INTEGER NOT NULL
            )
            """
        )
        self._backfill_summary_metadata(connection)
        self._backfill_experiment_numbers(connection)
        connection.commit()

    def _backfill_experiment_numbers(self, connection: sqlite3.Connection) -> None:
        """Number the experiments saved before numbering existed, oldest first.

        Without this they all report number 0 and hand out identical sample codes —
        the very collision the number exists to prevent. The counter is left above the
        highest number assigned, so new experiments carry on from there.
        """
        rows = connection.execute("SELECT id, payload FROM experiments ORDER BY created_at, id").fetchall()
        unnumbered = [(experiment_id, payload) for experiment_id, payload in rows if not json.loads(payload).get("sequence_number")]
        if not unnumbered:
            return

        counter_row = connection.execute("SELECT value FROM platform_counters WHERE name = 'experiment_number'").fetchone()
        next_number = int(counter_row[0]) if counter_row is not None else 0
        for experiment_id, serialized_payload in unnumbered:
            next_number += 1
            payload = json.loads(serialized_payload)
            payload["sequence_number"] = next_number
            connection.execute(
                "UPDATE experiments SET payload = ? WHERE id = ?",
                (json.dumps(payload, sort_keys=True), experiment_id),
            )
        connection.execute(
            """
            INSERT INTO platform_counters (name, value) VALUES ('experiment_number', ?)
            ON CONFLICT(name) DO UPDATE SET value = excluded.value
            """,
            (next_number,),
        )

    def _backfill_summary_metadata(self, connection: sqlite3.Connection) -> None:
        rows = connection.execute(
            """
            SELECT id, payload
            FROM experiments
            WHERE name IS NULL
               OR workbench_tool_count IS NULL
               OR rack_tool_count IS NULL
               OR material_count IS NULL
               OR run_count IS NULL
            """
        ).fetchall()
        for experiment_id, serialized_payload in rows:
            payload = json.loads(serialized_payload)
            name, summary = _summary_metadata_from_payload(payload)
            connection.execute(
                """
                UPDATE experiments
                SET name = ?, workbench_tool_count = ?, rack_tool_count = ?,
                    material_count = ?, run_count = ?
                WHERE id = ?
                """,
                (
                    name,
                    summary.workbench_tool_count,
                    summary.rack_tool_count,
                    summary.material_count,
                    summary.run_count,
                    experiment_id,
                ),
            )

    def _ensure_column(self, connection: sqlite3.Connection, column_name: str, column_type: str) -> None:
        existing_columns = {row[1] for row in connection.execute("PRAGMA table_info(experiments)").fetchall()}
        if column_name in existing_columns:
            return
        connection.execute(f"ALTER TABLE experiments ADD COLUMN {column_name} {column_type}")


def _serialize_experiment(experiment: Experiment) -> dict:
    return to_jsonable_python(asdict(experiment))


def _build_experiment_summary(experiment: Experiment) -> ExperimentSummarySchema:
    return ExperimentSummarySchema(
        workbench_tool_count=sum(slot.tool is not None for slot in experiment.workbench.slots),
        rack_tool_count=sum(slot.tool is not None for slot in experiment.rack.slots),
        material_count=len(experiment.produce_material_states),
        run_count=sum(len(widget.sequence_runs) for widget in experiment.workspace.widgets),
    )


def _summary_metadata_from_payload(payload: dict) -> tuple[str, ExperimentSummarySchema]:
    workbench_slots = payload.get("workbench", {}).get("slots", [])
    rack_slots = payload.get("rack", {}).get("slots", [])
    widgets = payload.get("workspace", {}).get("widgets", [])
    return (
        str(payload.get("name") or "Untitled experiment"),
        ExperimentSummarySchema(
            workbench_tool_count=sum(slot.get("tool") is not None for slot in workbench_slots),
            rack_tool_count=sum(slot.get("tool") is not None for slot in rack_slots),
            material_count=len(payload.get("produce_material_states", [])),
            run_count=sum(len(widget.get("sequence_runs", [])) for widget in widgets),
        ),
    )


def _deserialize_last_journal_event(
    stored: str | None,
    message: str | None,
) -> LastJournalEventSchema | None:
    """The list's last journal line, structured when the row carries it.

    Rows written before the journal was structured only have the rendered
    message; they come back with no code, and a client renders them as-is.
    """
    if message is None:
        return None
    if stored is None:
        return LastJournalEventSchema(message=message)
    event = json.loads(stored)
    return LastJournalEventSchema(
        message=message,
        code=event.get("code"),
        params=event.get("params") or {},
    )


def _deserialize_experiment(payload: dict) -> Experiment:
    schema = ExperimentSchema.model_validate(payload)
    journal_entries = [
        JournalEvent(
            id=entry.id,
            occurred_at=entry.occurred_at,
            category=JournalEventCategory(entry.category),
            severity=JournalEventSeverity(entry.severity),
            message=entry.message,
            code=entry.code,
            params=entry.params,
        )
        for entry in schema.journal_entries
    ]
    if not journal_entries and schema.audit_log:
        journal_entries = [build_journal_event(message, occurred_at=schema.last_simulation_at) for message in schema.audit_log]
    experiment = Experiment(
        id=schema.id,
        name=schema.name,
        sequence_number=schema.sequence_number,
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
            ],
            state=schema.rack.state,
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
            packaging_tare_mass_g=schema.lims_reception.packaging_tare_mass_g,
            gross_mass_offset_g=schema.lims_reception.gross_mass_offset_g,
            measured_sample_mass_g=schema.lims_reception.measured_sample_mass_g,
            lab_sample_code=schema.lims_reception.lab_sample_code,
            status=schema.lims_reception.status,
            printed_label_ticket=_deserialize_printed_label_ticket(schema.lims_reception.printed_label_ticket)
            if schema.lims_reception.printed_label_ticket is not None
            else None,
            acknowledged_net_mass_g=schema.lims_reception.acknowledged_net_mass_g,
        ),
        last_simulation_at=schema.last_simulation_at,
        basket_tools=[_deserialize_non_null_workbench_tool(t) for t in schema.basket_tools],
        produce_material_states=[ProduceMaterialState(**state.model_dump()) for state in schema.produce_material_states],
        spatula=SpatulaState(
            is_loaded=schema.spatula.is_loaded,
            produce_fractions=[_deserialize_produce_fraction(f) for f in schema.spatula.produce_fractions],
            source_tool_id=schema.spatula.source_tool_id,
        ),
        pipette=PipetteState(
            capacity_ml=schema.pipette.capacity_ml,
            volume_ml=schema.pipette.volume_ml,
            true_volume_ml=schema.pipette.true_volume_ml,
            source_tool_id=schema.pipette.source_tool_id,
            injection_context=_deserialize_injection_context(schema.pipette.injection_context),
            calibration_context=_deserialize_calibration_context(schema.pipette.calibration_context),
            liquids=[_deserialize_workbench_liquid(liquid) for liquid in schema.pipette.liquids],
            produce_lots=[_deserialize_produce_lot(lot) for lot in schema.pipette.produce_lots],
            produce_fractions=[_deserialize_produce_fraction(fraction) for fraction in schema.pipette.produce_fractions],
        ),
        lims_entries=_deserialize_lims_entries(schema),
        snapshot_version=schema.snapshot_version,
        audit_log=list(schema.audit_log),
        journal_entries=journal_entries,
    )
    sync_canonical_produce_model(experiment)
    sync_pesticide_material_states(experiment)
    return experiment


def _deserialize_transition_trace(schema: TransitionTraceSchema) -> TransitionTrace:
    return TransitionTrace(
        injection_id=schema.injection_id,
        transition=MrmTransition(**schema.transition.model_dump()),
        times_s=list(schema.times_s),
        intensities=list(schema.intensities),
        acquisition=TraceAcquisitionMetadata(**schema.acquisition.model_dump()),
    )


def _deserialize_sample_weighing(schema) -> SampleWeighing | None:
    if schema is None:
        return None
    return SampleWeighing(sample_mass_g=schema.sample_mass_g, extract_volume_ml=schema.extract_volume_ml)


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
                centrifuge_run_duration_ms=widget.centrifuge_run_duration_ms,
                centrifuge_run_remaining_ms=widget.centrifuge_run_remaining_ms,
                centrifuge_speed_rpm=widget.centrifuge_speed_rpm,
                tool=_deserialize_workbench_tool(widget.tool),
                produce_lots=[_deserialize_produce_lot(lot) for lot in widget.produce_lots],
                liquids=[_deserialize_workbench_liquid(liquid) for liquid in widget.liquids],
                produce_fractions=[_deserialize_produce_fraction(fraction) for fraction in widget.produce_fractions],
                sequence_runs=[
                    SequenceRun(
                        id=run.id,
                        method_id=run.method_id,
                        # Rebuilt from the stored snapshot — never from the live
                        # registry — so a method republished under the same id
                        # cannot rewrite the history of a past run. The shared
                        # deserializer is the one the method library itself uses,
                        # so a field added there cannot go missing here.
                        method_snapshot=deserialize_acquisition_method(run.method_snapshot),
                        total_duration_s=run.total_duration_s,
                        elapsed_s=run.elapsed_s,
                        injections=[
                            InjectionMeasurement(
                                id=injection.id,
                                vial_id=injection.vial_id,
                                vial_label=injection.vial_label,
                                rack_slot_id=injection.rack_slot_id,
                                status=injection.status,
                                traces=[_deserialize_transition_trace(trace) for trace in injection.traces],
                                sample_name=injection.sample_name,
                                injection_volume_ul=injection.injection_volume_ul,
                                replicate_index=injection.replicate_index,
                                output_filename=injection.output_filename,
                                start_offset_s=injection.start_offset_s,
                                weighing=_deserialize_sample_weighing(injection.weighing),
                            )
                            for injection in run.injections
                        ],
                    )
                    for run in widget.sequence_runs
                ],
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
                packaging_tare_mass_g=entry.packaging_tare_mass_g,
                gross_mass_offset_g=entry.gross_mass_offset_g,
                measured_sample_mass_g=entry.measured_sample_mass_g,
                lab_sample_code=entry.lab_sample_code,
                status=entry.status,
                printed_label_ticket=_deserialize_printed_label_ticket(entry.printed_label_ticket)
                if entry.printed_label_ticket is not None
                else None,
                acknowledged_net_mass_g=entry.acknowledged_net_mass_g,
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
            packaging_tare_mass_g=schema.lims_reception.packaging_tare_mass_g,
            gross_mass_offset_g=schema.lims_reception.gross_mass_offset_g,
            measured_sample_mass_g=schema.lims_reception.measured_sample_mass_g,
            lab_sample_code=schema.lims_reception.lab_sample_code,
            status=schema.lims_reception.status,
            printed_label_ticket=None,
            acknowledged_net_mass_g=schema.lims_reception.acknowledged_net_mass_g,
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
        contents_homogeneity=tool_schema.contents_homogeneity,
        is_sealed=tool_schema.is_sealed,
        closure_fault=tool_schema.closure_fault,
        internal_pressure_bar=tool_schema.internal_pressure_bar,
        trapped_co2_mass_g=tool_schema.trapped_co2_mass_g,
        body_temperature_c=tool_schema.body_temperature_c,
        field_label_text=tool_schema.field_label_text,
        labels=[_deserialize_container_label(label) for label in tool_schema.labels],
        produce_lots=[_deserialize_produce_lot(lot) for lot in tool_schema.produce_lots],
        liquids=[_deserialize_workbench_liquid(liquid) for liquid in tool_schema.liquids],
        produce_fractions=[_deserialize_produce_fraction(fraction) for fraction in tool_schema.produce_fractions],
        quechers_state=QuechersState(**tool_schema.quechers_state.model_dump(exclude={"is_usable"})),
        istd_phase_added=tool_schema.istd_phase_added,
        quechers_extraction_result=(
            QuechersExtractionResult(**tool_schema.quechers_extraction_result.model_dump())
            if tool_schema.quechers_extraction_result is not None
            else None
        ),
        injection_context=_deserialize_injection_context(tool_schema.injection_context),
        calibration_context=_deserialize_calibration_context(tool_schema.calibration_context),
    )


def _deserialize_workbench_liquid(liquid_schema) -> WorkbenchLiquid:
    return WorkbenchLiquid(
        id=liquid_schema.id,
        liquid_id=liquid_schema.liquid_id,
        name=liquid_schema.name,
        volume_ml=liquid_schema.volume_ml,
        accent=liquid_schema.accent,
        true_volume_ml=liquid_schema.true_volume_ml,
        temperature_c=liquid_schema.temperature_c,
    )


def _deserialize_calibration_context(context_schema) -> CalibrationContext | None:
    if context_schema is None:
        return None
    return CalibrationContext(
        level_ng_per_ml=context_schema.level_ng_per_ml,
        compound_ids=list(context_schema.compound_ids),
        true_level_ng_per_ml=context_schema.true_level_ng_per_ml,
    )


def _deserialize_injection_context(context_schema) -> InjectionContext | None:
    if context_schema is None:
        return None
    extraction_result = (
        # Built field by field rather than from model_dump(): the hidden factors
        # are excluded from serialization, so dumping would silently drop them.
        QuechersExtractionResult(
            extraction_manip_factor=context_schema.extraction_result.extraction_manip_factor,
            istd_manip_factor=context_schema.extraction_result.istd_manip_factor,
            istd_phase=context_schema.extraction_result.istd_phase,
            sampling_representativeness=(context_schema.extraction_result.sampling_representativeness),
        )
        if context_schema.extraction_result is not None
        else None
    )
    return InjectionContext(
        source_tube_id=context_schema.source_tube_id,
        sample_mass_g=context_schema.sample_mass_g,
        sample_true_mass_g=context_schema.sample_true_mass_g,
        extract_volume_ml=context_schema.extract_volume_ml,
        foreign_matter_mass_mg=context_schema.foreign_matter_mass_mg,
        effective_residues_ug_per_kg=dict(context_schema.effective_residues_ug_per_kg),
        extraction_result=extraction_result,
        istd_volume_ml=context_schema.istd_volume_ml,
        istd_reference_conc_ng_per_ml=context_schema.istd_reference_conc_ng_per_ml,
        extract_true_volume_ml=context_schema.extract_true_volume_ml,
        istd_true_volume_ml=context_schema.istd_true_volume_ml,
        weighing=_deserialize_sample_weighing(context_schema.weighing),
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
    payload = fraction_schema.model_dump()
    payload["is_mixed"] = fraction_schema.is_mixed
    payload["true_mass_g"] = fraction_schema.true_mass_g
    # Hidden fields are excluded from the dump, so they have to be carried over by
    # hand or a reload quietly resets them.
    payload["temperature_c"] = fraction_schema.temperature_c
    return ProduceFraction(**payload)
