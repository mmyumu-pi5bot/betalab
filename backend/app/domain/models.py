from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Generic, Literal, TypeVar
from uuid import uuid4

from app.domain.acquisition_methods import (
    APPLE_PESTICIDES_MRM_V1,
    APPLE_PESTICIDES_MRM_V1_ID,
    AcquisitionMethod,
    MrmTransition,
)
from app.domain.rules import can_workspace_widget_store_now

T = TypeVar("T")
SAMPLE_BAG_TARE_MASS_G = 36.0


@dataclass
class Container(Generic[T]):
    children: list[T] = field(default_factory=list)


@dataclass
class SingleContainer(Container[T]):
    pass


class ExperimentStatus(StrEnum):
    PREPARING = "preparing"


class JournalEventCategory(StrEnum):
    SYSTEM = "system"
    MANIPULATION = "manipulation"
    SIMULATION = "simulation"
    LAYOUT = "layout"


class JournalEventSeverity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


@dataclass(frozen=True, slots=True)
class JournalEvent:
    id: str
    occurred_at: datetime
    category: JournalEventCategory
    severity: JournalEventSeverity
    #: English wording, kept for the audit log and for clients that do not know
    #: the code.
    message: str
    #: What happened, and the entities it happened to. A client renders the
    #: sentence in its own language from these rather than from `message`.
    code: str | None = None
    params: dict[str, object] = field(default_factory=dict)


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
    packaging_tare_mass_g: float = SAMPLE_BAG_TARE_MASS_G
    gross_mass_offset_g: int = 0
    measured_sample_mass_g: float | None = None
    lab_sample_code: str | None = None
    status: str = "awaiting_reception"
    printed_label_ticket: PrintedLabelTicket | None = None
    # Net mass the operator confirmed having checked. Stored as the reviewed *value*
    # rather than a flag, so a later weighing or a different bag tare invalidates the
    # acknowledgement on its own: what was vouched for no longer matches what is shown.
    acknowledged_net_mass_g: float | None = None


@dataclass
class WorkbenchLiquid:
    id: str
    liquid_id: str
    name: str
    volume_ml: float
    accent: str
    true_volume_ml: float | None = None  # hidden actual delivered volume; None -> defaults to volume_ml
    #: Solvent carries its own heat. Without this it was read at whatever
    #: surrounded the tube, so a third of a tube's thermal mass teleported to the
    #: new temperature the instant the tube was picked up and moved.
    temperature_c: float = 20.0

    def __post_init__(self) -> None:
        if self.true_volume_ml is None:
            self.true_volume_ml = self.volume_ml


@dataclass
class QuechersState:
    salts_added: bool = False
    phase: str = "idle"
    temperature_c: float = 20.0
    #: Temperature of the mixture at the moment the salts went in. The exotherm
    #: releases a fixed amount of heat, so this is what decides how high the
    #: reaction climbs -- and therefore whether it ever reaches the threshold
    #: where thermolabile residues start to break down.
    start_temperature_c: float = 20.0
    cementation_progress: float = 0.0
    thermal_degradation_progress: float = 0.0
    reaction_elapsed_seconds: float = 0.0
    separation_progress: float = 0.0
    faults: list[str] = field(default_factory=list)

    @property
    def is_usable(self) -> bool:
        return self.phase not in {"cemented", "contaminated"}


@dataclass
class QuechersExtractionResult:
    """Variance factors generated when QuEChERS extraction completes.

    extraction_manip_factor is a single ε_manip draw shared by all substances
    that were co-located in the tube during extraction.  istd_manip_factor is
    the same value when ISTD was added at the right time, or an independent
    draw when ISTD was added too late — meaning the ratio will be biased.
    """

    extraction_manip_factor: float
    istd_manip_factor: float | None
    istd_phase: str | None  # "pre_solvent" | "pre_salts" | "post_salts" | None
    # How well the weighed aliquot represents the lot it was taken from. Drawn
    # once per tube from the grind homogeneity, so every vial poured from the
    # same extract carries the same bias. The ISTD enters the tube afterwards
    # and therefore does not share it: unlike extraction losses, a sampling
    # error is never corrected by the analyte/ISTD ratio.
    sampling_representativeness: float | None = None


@dataclass
class InjectionContext:
    """Extraction metadata snapshotted when extract is poured from a centrifuge tube to a vial.

    Carries everything the LC-MS/MS calculation needs: the true pesticide concentrations
    (post-degradation), the shared ε_manip factors from QuEChERS, and the ISTD amount.
    """

    source_tube_id: str
    sample_mass_g: float  # g of apple powder extracted
    extract_volume_ml: float  # mL of acetonitrile used (sets the dilution)
    # True residues after thermal degradation at extraction time, per compound (µg/kg)
    effective_residues_ug_per_kg: dict[str, float]
    sample_true_mass_g: float | None = None  # hidden sampled mass; None -> sample_mass_g
    extraction_result: QuechersExtractionResult | None = None
    istd_volume_ml: float | None = None  # mL of ISTD solution added to the tube
    istd_reference_conc_ng_per_ml: float = 100.0  # ng/mL in the ISTD stock (catalog value)
    # Foreign matter carried into the tube: measured container-contact impurities
    # plus a nominal credit for fractions left on a dirty bench. It raises the
    # detector background without competing for charge.
    foreign_matter_mass_mg: float = 0.0
    extract_true_volume_ml: float | None = None   # hidden true acetonitrile volume; None -> falls back to extract_volume_ml
    istd_true_volume_ml: float | None = None       # hidden true ISTD volume; None -> falls back to istd_volume_ml


@dataclass
class CalibrationContext:
    """Marks a vial as a multi-residue calibration standard at a known concentration."""

    level_ng_per_ml: float
    compound_ids: list[str]
    true_level_ng_per_ml: float | None = None  # hidden actual prepared concentration; None -> defaults to level_ng_per_ml

    def __post_init__(self) -> None:
        if self.true_level_ng_per_ml is None:
            self.true_level_ng_per_ml = self.level_ng_per_ml


@dataclass(frozen=True, slots=True)
class TraceAcquisitionMetadata:
    """How one MRM channel was acquired, and whether it could see anything."""

    run_duration_s: float
    point_count: int
    sampling_interval_s: float
    dwell_time_ms: float
    polarity: str
    #: The declared (Q1, Q3) pair addresses a real reference channel.
    matched_reference_transition: bool
    #: The declared retention window covers the moment the compound truly elutes.
    acquired_in_retention_window: bool


@dataclass
class TransitionTrace:
    """Raw chromatogram recorded on one MRM channel of one injection.

    This is instrumental output only: a time axis, an intensity axis, and the
    frozen declaration of the channel that produced them. No peak integration,
    no calibration curve and no concentration — those belong to the downstream
    analysis application.
    """

    injection_id: str
    transition: MrmTransition
    times_s: list[float]
    intensities: list[float]
    acquisition: TraceAcquisitionMetadata


@dataclass
class InjectionMeasurement:
    """Per-vial result within a sequence run."""

    id: str
    vial_id: str
    vial_label: str
    rack_slot_id: str
    status: str  # "ok" | "no_extract_context" | "calibration" | "insufficient_volume"
    traces: list[TransitionTrace]
    sample_name: str = ""
    injection_volume_ul: float = 5.0
    replicate_index: int = 1
    output_filename: str = ""
    #: When this injection starts, in instrument seconds since the sequence began.
    start_offset_s: float = 0.0


@dataclass
class SequenceRun:
    """One LC-MS/MS sequence run; stored on the instrument workspace widget.

    A run is not instantaneous. The traces are generated in full when the
    sequence starts — the seeded generator is consumed once, so the run stays
    reproducible — and ``elapsed_s`` then says how much of them the instrument
    has actually recorded so far. Readers reveal each trace up to that point.
    """

    id: str
    injections: list[InjectionMeasurement]
    method_id: str = APPLE_PESTICIDES_MRM_V1_ID
    # Immutable copy of the method as it was when the run started. A later
    # version published under the same id must never change how a past run reads.
    method_snapshot: AcquisitionMethod = APPLE_PESTICIDES_MRM_V1
    #: Instrument seconds the whole sequence takes: one run duration per injection.
    total_duration_s: float = 0.0
    #: Instrument seconds recorded so far. Equal to total_duration_s once done.
    elapsed_s: float = 0.0


@dataclass
class ProduceMaterialState:
    id: str
    produce_lot_id: str
    material_state: str = "whole"
    grind_quality_label: str | None = None
    homogeneity_score: float | None = None
    residual_co2_mass_g: float = 0.0
    grinding_elapsed_seconds: float = 0.0
    grinding_temperature_integral: float = 0.0
    # Degradation factor per compound in [0, 1]; 1.0 = intact, 0.0 = fully degraded.
    # Keys match ProduceLot.pesticide_residues for the same lot.
    pesticide_degradation_factors: dict[str, float] = field(default_factory=dict)


ProduceFractionLocationKind = Literal[
    "basket_tool",
    "pipette",
    "produce_basket",
    "rack_tool",
    "spatula",
    "trash",
    "workbench_surface",
    "workbench_tool",
    "workspace_widget",
    "workspace_widget_tool",
]


@dataclass
class ProduceFraction:
    id: str
    produce_lot_id: str
    produce_material_state_id: str
    mass_g: float
    #: This body of material's own temperature. It belongs here rather than on the
    #: material state because the state is shared by lot: a jar of powder and the
    #: portion weighed out of it are the same material in two places, and they do
    #: not have the same temperature once one of them is standing in ice water.
    temperature_c: float = 20.0
    true_mass_g: float | None = None
    unit_count: int | None = None
    is_mixed: bool = False
    is_contaminated: bool = False
    impurity_mass_mg: float = 0.0
    exposure_container_ids: list[str] = field(default_factory=list)
    # Invariant: location_kind and location_id are always set together (or both None).
    # container_id and container_label are set for tool fractions; container_id may be
    # None for surface fractions while container_label carries the display name.
    location_kind: ProduceFractionLocationKind | None = None
    location_id: str | None = None
    container_id: str | None = None
    container_label: str | None = None

    def __post_init__(self) -> None:
        if self.true_mass_g is None:
            self.true_mass_g = self.mass_g
        if self.true_mass_g < 0:
            raise ValueError("true_mass_g must be non-negative")
        if (self.location_kind is None) != (self.location_id is None):
            raise ValueError("location_kind and location_id must both be set or both be None")


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
    contents_homogeneity: float = 0.0
    is_sealed: bool = False
    closure_fault: str | None = None

    def __post_init__(self) -> None:
        if not 0.0 <= self.contents_homogeneity <= 1.0:
            raise ValueError("contents_homogeneity must be between zero and one")
        if self.closure_fault is not None and self.closure_fault != "pressure_pop" and not self.is_sealed:
            raise ValueError("closure_fault must be None when is_sealed=False unless the tool popped open")

    internal_pressure_bar: float = 1.0
    trapped_co2_mass_g: float = 0.0  # Non-zero only for sealed containers with CO2 inside
    #: The container wall itself. Polypropylene is not a thermometer: a tube taken
    #: out of ice water keeps some of that cold, and a warm tube gives heat back
    #: to cryogenic powder poured into it.
    body_temperature_c: float = 20.0
    field_label_text: str | None = None
    labels: list[ContainerLabel] = field(default_factory=list)
    produce_lots: list[ProduceLot] = field(default_factory=list)
    liquids: list[WorkbenchLiquid] = field(default_factory=list)
    produce_fractions: list[ProduceFraction] = field(default_factory=list)
    quechers_state: QuechersState = field(default_factory=QuechersState)
    # Phase at which ISTD was first added (set on first istd_solution liquid addition).
    istd_phase_added: Literal["pre_solvent", "pre_salts", "post_salts"] | None = None
    # Set when QuEChERS extraction completes; carries the shared ε_manip factors.
    quechers_extraction_result: QuechersExtractionResult | None = None
    # Set when extract is poured from this tube into a vial (on the vial, not the tube).
    injection_context: InjectionContext | None = None
    # Set when the vial is prepared as a calibration standard.
    calibration_context: CalibrationContext | None = None


@dataclass
class SpatulaState:
    is_loaded: bool = False
    produce_fractions: list[ProduceFraction] = field(default_factory=list)
    source_tool_id: str | None = None  # Set iff is_loaded=True

    def __post_init__(self) -> None:
        if self.is_loaded != (self.source_tool_id is not None):
            raise ValueError("source_tool_id must be set iff is_loaded=True")


@dataclass
class PipetteState:
    capacity_ml: float = 1.0
    volume_ml: float = 0.0
    true_volume_ml: float | None = None
    source_tool_id: str | None = None
    injection_context: InjectionContext | None = None
    calibration_context: CalibrationContext | None = None
    liquids: list[WorkbenchLiquid] = field(default_factory=list)
    produce_lots: list[ProduceLot] = field(default_factory=list)
    produce_fractions: list[ProduceFraction] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.true_volume_ml is None:
            self.true_volume_ml = self.volume_ml
        if self.true_volume_ml < 0:
            raise ValueError("pipette true volume must be non-negative")
        if not 0 <= self.volume_ml <= self.capacity_ml:
            raise ValueError("pipette volume must be between zero and capacity")
        if (self.volume_ml > 0) != (self.source_tool_id is not None):
            raise ValueError("source_tool_id must be set iff the pipette contains liquid")
        if (self.volume_ml > 0) != bool(self.liquids or self.produce_fractions):
            raise ValueError("pipette contents must be set iff the pipette has volume")


@dataclass
class AnalyticalBalanceState:
    # Invariant: tare_mass_g and tared_tool_id are both set or both None.
    tare_mass_g: float | None = None
    tared_tool_id: str | None = None

    def __post_init__(self) -> None:
        if (self.tare_mass_g is None) != (self.tared_tool_id is None):
            raise ValueError("tare_mass_g and tared_tool_id must both be set or both be None")


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
    state: Literal["available", "loaded", "locked", "completed"] = "available"


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
    centrifuge_run_duration_ms: float = 0.0
    centrifuge_run_remaining_ms: float = 0.0
    centrifuge_speed_rpm: int = 0
    tool: WorkbenchTool | None = None
    produce_lots: list[ProduceLot] = field(default_factory=list)
    liquids: list[WorkbenchLiquid] = field(default_factory=list)
    produce_fractions: list[ProduceFraction] = field(default_factory=list)
    sequence_runs: list[SequenceRun] = field(default_factory=list)

    def can_store(self, rack_has_tools: bool = False) -> bool:
        return can_workspace_widget_store_now(
            self.id,
            is_trashed=self.is_trashed,
            has_tool=(self.tool is not None) or (self.id == "rack" and rack_has_tools),
            has_produce=bool(self.produce_lots),
            has_liquids=bool(self.liquids),
        )


@dataclass
class ProduceLot:
    id: str
    label: str
    produce_type: str
    total_mass_g: float
    unit_count: int | None = None
    #: How the label was built, so a client can render it in its own language.
    #: `label` stays the English rendering for logs and for clients that do not
    #: know the code.
    label_code: str | None = None
    label_index: int | None = None
    # Immutable residue profile set at lot creation (µg/kg per compound).
    pesticide_residues: dict[str, float] = field(default_factory=dict)


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
    name: str = "Untitled experiment"
    # Position of this experiment on the platform, handed out once by the store that
    # knows every experiment and never reused — a deleted experiment's samples may
    # already be sitting downstream under codes built from it. 0 means unnumbered,
    # which only legacy rows saved before numbering existed should ever be.
    sequence_number: int = 0
    basket_tools: list[WorkbenchTool] = field(default_factory=list)
    produce_material_states: list[ProduceMaterialState] = field(default_factory=list)
    spatula: SpatulaState = field(default_factory=SpatulaState)
    pipette: PipetteState = field(default_factory=PipetteState)
    analytical_balance: AnalyticalBalanceState = field(default_factory=AnalyticalBalanceState)
    lims_entries: list[LimsReception] = field(default_factory=list)
    snapshot_version: int = 0
    audit_log: list[str] = field(default_factory=list)
    #: Structured counterparts of audit entries not yet mirrored into the
    #: journal, each paired with the audit index it belongs to. Drained by
    #: `synchronize_journal_entries`, so it is always empty when persisted.
    pending_journal_records: list[tuple[int, str, dict[str, object]]] = field(default_factory=list)
    journal_entries: list[JournalEvent] = field(default_factory=list)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:8]}"
