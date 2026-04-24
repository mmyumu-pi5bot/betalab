from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Generic, TypeVar
from uuid import uuid4

T = TypeVar("T")


@dataclass
class Container(Generic[T]):
    children: list[T] = field(default_factory=list)


@dataclass
class SingleContainer(Container[T]):
    pass


class ExperimentStatus(StrEnum):
    PREPARING = "preparing"


@dataclass
class PrintedLabelTicket:
    id: str
    sample_code: str
    label_text: str
    received_date: str = ""


@dataclass
class ContainerLabel:
    id: str
    text: str
    label_kind: str


@dataclass
class ManualLabel(ContainerLabel):
    pass


@dataclass
class LimsLabel(ContainerLabel):
    sample_code: str = ""
    received_date: str = ""


@dataclass
class LimsReception:
    orchard_name: str
    harvest_date: str
    indicative_mass_g: float
    id: str | None = None
    measured_gross_mass_g: float | None = None
    gross_mass_offset_g: int = 0
    measured_sample_mass_g: float | None = None
    lab_sample_code: str | None = None
    status: str = "awaiting_reception"
    printed_label_ticket: PrintedLabelTicket | None = None


@dataclass
class WorkbenchLiquid:
    id: str
    liquid_id: str
    name: str
    volume_ml: float
    accent: str


@dataclass
class ProduceMaterialState:
    id: str
    produce_lot_id: str
    material_state: str = "whole"
    temperature_c: float = 20.0
    grind_quality_label: str | None = None
    homogeneity_score: float | None = None
    residual_co2_mass_g: float = 0.0
    grinding_elapsed_seconds: float = 0.0
    grinding_temperature_integral: float = 0.0


@dataclass
class ProduceFraction:
    id: str
    produce_lot_id: str
    produce_material_state_id: str
    mass_g: float
    unit_count: int | None = None
    is_contaminated: bool = False
    impurity_mass_mg: float = 0.0
    exposure_container_ids: list[str] = field(default_factory=list)
    location_kind: str | None = None
    location_id: str | None = None
    container_id: str | None = None
    container_label: str | None = None


@dataclass
class WorkbenchTool:
    id: str
    tool_id: str
    label: str
    subtitle: str
    accent: str
    tool_type: str
    capacity_ml: float
    contact_impurity_mg_per_g: float = 0.0
    is_sealed: bool = False
    closure_fault: str | None = None
    internal_pressure_bar: float = 1.0
    trapped_co2_mass_g: float = 0.0
    field_label_text: str | None = None
    is_mixed: bool = False
    labels: list[ContainerLabel] = field(default_factory=list)
    produce_lots: list[ProduceLot] = field(default_factory=list)
    liquids: list[WorkbenchLiquid] = field(default_factory=list)
    produce_fractions: list[ProduceFraction] = field(default_factory=list)


@dataclass
class SpatulaState:
    is_loaded: bool = False
    produce_fractions: list[ProduceFraction] = field(default_factory=list)
    source_tool_id: str | None = None


@dataclass
class AnalyticalBalanceState:
    tare_mass_g: float | None = None
    tared_tool_id: str | None = None


@dataclass
class WorkbenchSlot:
    id: str
    label: str
    tool: WorkbenchTool | None = None
    surface_produce_lots: list[ProduceLot] = field(default_factory=list)
    surface_produce_fractions: list[ProduceFraction] = field(default_factory=list)


@dataclass
class Workbench:
    slots: list[WorkbenchSlot] = field(default_factory=list)


@dataclass
class RackSlot:
    id: str
    label: str
    tool: WorkbenchTool | None = None


@dataclass
class Rack:
    slots: list[RackSlot] = field(default_factory=list)


@dataclass
class EntityOrigin:
    kind: str
    location_id: str | None = None
    location_label: str | None = None
    container_id: str | None = None
    container_label: str | None = None


@dataclass
class TrashProduceLotEntry:
    id: str
    origin_label: str
    produce_lot: ProduceLot
    origin: EntityOrigin | None = None
    produce_fraction: ProduceFraction | None = None


@dataclass
class TrashSampleLabelEntry:
    id: str
    origin_label: str
    label: ContainerLabel


@dataclass
class Trash:
    children: list[WorkbenchTool] = field(default_factory=list)
    discarded_from: dict[str, str] = field(default_factory=dict)
    produce_lots: list[TrashProduceLotEntry] = field(default_factory=list)
    sample_labels: list[TrashSampleLabelEntry] = field(default_factory=list)


@dataclass
class WorkspaceWidget:
    id: str
    widget_type: str
    label: str
    anchor: str
    offset_x: int
    offset_y: int
    is_present: bool
    is_trashed: bool
    grinder_run_duration_ms: float = 0.0
    grinder_run_remaining_ms: float = 0.0
    grinder_fault: str | None = None
    vortex_run_duration_ms: float = 0.0
    vortex_run_remaining_ms: float = 0.0
    tool: WorkbenchTool | None = None
    produce_lots: list[ProduceLot] = field(default_factory=list)
    liquids: list[WorkbenchLiquid] = field(default_factory=list)
    produce_fractions: list[ProduceFraction] = field(default_factory=list)


@dataclass
class ProduceLot:
    id: str
    label: str
    produce_type: str
    total_mass_g: float
    unit_count: int | None = None


@dataclass
class Workspace:
    widgets: list[WorkspaceWidget] = field(default_factory=list)
    produce_basket_lots: list[ProduceLot] = field(default_factory=list)
    produce_basket_fractions: list[ProduceFraction] = field(default_factory=list)


@dataclass
class Experiment:
    id: str
    status: ExperimentStatus
    workbench: Workbench
    rack: Rack
    trash: Trash
    workspace: Workspace
    lims_reception: LimsReception
    last_simulation_at: datetime
    basket_tools: list[WorkbenchTool] = field(default_factory=list)
    produce_material_states: list[ProduceMaterialState] = field(default_factory=list)
    spatula: SpatulaState = field(default_factory=SpatulaState)
    analytical_balance: AnalyticalBalanceState = field(default_factory=AnalyticalBalanceState)
    lims_entries: list[LimsReception] = field(default_factory=list)
    snapshot_version: int = 0
    audit_log: list[str] = field(default_factory=list)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:8]}"
