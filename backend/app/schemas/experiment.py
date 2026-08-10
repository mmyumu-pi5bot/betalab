from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from typing import Literal, cast

from pydantic import BaseModel, Field, computed_field

from app.domain.acquisition_methods import (
    APPLE_PESTICIDES_MRM_V1,
    APPLE_PESTICIDES_MRM_V1_ID,
)
from app.domain.centrifuge_rules import get_centrifuge_start_block_reason
from app.domain.dnd_contracts import get_dnd_contract
from app.domain.dnd_rules import (
    can_tool_be_discarded,
    can_tool_be_stored,
    can_tool_receive_contents,
    can_tool_receive_liquids,
    can_tool_receive_produce,
    can_tool_seal,
    get_lims_label_ticket_allowed_drop_targets,
    get_produce_lot_allowed_drop_targets,
    get_sample_label_allowed_drop_targets,
    get_tool_allowed_drop_targets,
)
from app.domain.grinder_rules import (
    get_grinder_display_mode,
    get_grinder_start_block_reason,
)
from app.domain.rules import can_workspace_widget_be_stored, can_workspace_widget_store_now
from app.domain.spatula_rules import (
    SPATULA_CLICK_INCREMENT_MU_G,
    SPATULA_CLICK_INCREMENT_SIGMA_G,
    SPATULA_HOLD_INITIAL_RATE_G,
    SPATULA_HOLD_INTERVAL_MS,
    SPATULA_HOLD_LIFT_RATE_G_PER_PX,
    SPATULA_HOLD_MAX_RATE_G,
    SPATULA_HOLD_THRESHOLD_MS,
    SPATULA_LOAD_SOURCE_TOOL_TYPES,
    SPATULA_POUR_TARGET_TOOL_TYPES,
)
from app.schemas.acquisition_method import AcquisitionMethodSchema, MrmTransitionSchema


class WorkbenchLiquidSchema(BaseModel):
    id: str
    liquid_id: str
    name: str
    volume_ml: float
    accent: str
    true_volume_ml: float | None = Field(default=None, exclude=True)


class QuechersStateSchema(BaseModel):
    salts_added: bool = False
    phase: str = "idle"
    temperature_c: float = 20.0
    cementation_progress: float = 0.0
    thermal_degradation_progress: float = 0.0
    reaction_elapsed_seconds: float = 0.0
    separation_progress: float = 0.0
    faults: list[str] = Field(default_factory=list)

    @computed_field
    def is_usable(self) -> bool:
        return self.phase not in {"cemented", "contaminated"}


class QuechersExtractionResultSchema(BaseModel):
    extraction_manip_factor: float
    istd_manip_factor: float | None = None
    istd_phase: str | None = None
    sampling_representativeness: float | None = Field(default=None, exclude=True)


class CalibrationContextSchema(BaseModel):
    level_ng_per_ml: float
    compound_ids: list[str] = Field(default_factory=list)
    true_level_ng_per_ml: float | None = Field(default=None, exclude=True)


class InjectionContextSchema(BaseModel):
    source_tube_id: str
    sample_mass_g: float
    extract_volume_ml: float
    effective_residues_ug_per_kg: dict[str, float] = Field(default_factory=dict)
    sample_true_mass_g: float | None = Field(default=None, exclude=True)
    extraction_result: QuechersExtractionResultSchema | None = None
    istd_volume_ml: float | None = None
    istd_reference_conc_ng_per_ml: float = 100.0
    foreign_matter_mass_mg: float = 0.0
    extract_true_volume_ml: float | None = Field(default=None, exclude=True)
    istd_true_volume_ml: float | None = Field(default=None, exclude=True)


class TraceAcquisitionMetadataSchema(BaseModel):
    run_duration_s: float
    point_count: int
    sampling_interval_s: float
    dwell_time_ms: float
    polarity: str
    matched_reference_transition: bool
    acquired_in_retention_window: bool


class TransitionTraceSchema(BaseModel):
    injection_id: str
    transition: MrmTransitionSchema
    times_s: list[float] = Field(default_factory=list)
    intensities: list[float] = Field(default_factory=list)
    acquisition: TraceAcquisitionMetadataSchema


class InjectionMeasurementSchema(BaseModel):
    id: str = ""
    vial_id: str
    vial_label: str
    rack_slot_id: str
    status: str
    traces: list[TransitionTraceSchema] = Field(default_factory=list)
    sample_name: str = ""
    injection_volume_ul: float = 5.0
    replicate_index: int = 1
    output_filename: str = ""
    start_offset_s: float = 0.0


class SequenceRunSchema(BaseModel):
    id: str
    injections: list[InjectionMeasurementSchema] = Field(default_factory=list)
    method_id: str = APPLE_PESTICIDES_MRM_V1_ID
    method_snapshot: AcquisitionMethodSchema = Field(
        default_factory=lambda: AcquisitionMethodSchema.model_validate(
            asdict(APPLE_PESTICIDES_MRM_V1)
        )
    )
    total_duration_s: float = 0.0
    elapsed_s: float = 0.0


class ProduceMaterialStateSchema(BaseModel):
    id: str
    produce_lot_id: str
    material_state: str = "whole"
    temperature_c: float = 20.0
    grind_quality_label: str | None = None
    homogeneity_score: float | None = Field(default=None, exclude=True)
    residual_co2_mass_g: float = 0.0
    grinding_elapsed_seconds: float = 0.0
    grinding_temperature_integral: float = 0.0
    pesticide_degradation_factors: dict[str, float] = Field(default_factory=dict)


class ProduceFractionSchema(BaseModel):
    id: str
    produce_lot_id: str
    produce_material_state_id: str
    mass_g: float
    true_mass_g: float | None = Field(default=None, exclude=True)
    unit_count: int | None = None
    is_mixed: bool = Field(default=False, exclude=True)
    is_contaminated: bool = False
    impurity_mass_mg: float = 0.0
    exposure_container_ids: list[str] = Field(default_factory=list)
    location_kind: str | None = None
    location_id: str | None = None
    container_id: str | None = None
    container_label: str | None = None


class ContainedEntitySchema(BaseModel):
    entity_kind: str
    id: str
    tool_type: str | None = None
    liquid_type: str | None = None
    produce_type: str | None = None


class ContainmentRuleSchema(BaseModel):
    entity_kind: str
    tool_type: str | None = None
    liquid_type: str | None = None


class ContainmentSchema(BaseModel):
    children: list[ContainedEntitySchema] = Field(default_factory=list)
    capacity: int
    remaining_capacity: int
    accepts: list[ContainmentRuleSchema] = Field(default_factory=list)
    can_receive: bool
    blocked_reason: str | None = None


def _tool_entity(tool: WorkbenchToolSchema) -> ContainedEntitySchema:
    return ContainedEntitySchema(entity_kind="tool", id=tool.id, tool_type=tool.tool_type)


def _produce_lot_entity(lot: ProduceLotSchema) -> ContainedEntitySchema:
    return ContainedEntitySchema(entity_kind="produce", id=lot.id, produce_type=lot.produce_type)


def _produce_fraction_entity(fraction: ProduceFractionSchema) -> ContainedEntitySchema:
    return ContainedEntitySchema(entity_kind="produce", id=fraction.id)


def _liquid_entity(liquid: WorkbenchLiquidSchema) -> ContainedEntitySchema:
    return ContainedEntitySchema(entity_kind="liquid", id=liquid.id, liquid_type=liquid.liquid_id)


def _sample_label_entity(label: ContainerLabelSchema) -> ContainedEntitySchema:
    return ContainedEntitySchema(entity_kind="sample_label", id=label.id)


class SpatulaStateSchema(BaseModel):
    is_loaded: bool = False
    produce_fractions: list[ProduceFractionSchema] = Field(default_factory=list)
    source_tool_id: str | None = None

    @computed_field
    def allowed_load_source_tool_types(self) -> list[str]:
        return list(SPATULA_LOAD_SOURCE_TOOL_TYPES)

    @computed_field
    def allowed_pour_target_tool_types(self) -> list[str]:
        return list(SPATULA_POUR_TARGET_TOOL_TYPES)

    @computed_field
    def can_discard(self) -> bool:
        return self.is_loaded


class PipetteStateSchema(BaseModel):
    capacity_ml: float = 1.0
    volume_ml: float = 0.0
    true_volume_ml: float | None = Field(default=None, exclude=True)
    source_tool_id: str | None = None
    injection_context: InjectionContextSchema | None = None
    calibration_context: CalibrationContextSchema | None = None
    liquids: list[WorkbenchLiquidSchema] = Field(default_factory=list)
    produce_lots: list[ProduceLotSchema] = Field(default_factory=list)
    produce_fractions: list[ProduceFractionSchema] = Field(default_factory=list)



    @computed_field
    def click_increment_mu_g(self) -> float:
        return SPATULA_CLICK_INCREMENT_MU_G

    @computed_field
    def click_increment_sigma_g(self) -> float:
        return SPATULA_CLICK_INCREMENT_SIGMA_G

    @computed_field
    def hold_threshold_ms(self) -> int:
        return SPATULA_HOLD_THRESHOLD_MS

    @computed_field
    def hold_interval_ms(self) -> int:
        return SPATULA_HOLD_INTERVAL_MS

    @computed_field
    def hold_initial_rate_g(self) -> float:
        return SPATULA_HOLD_INITIAL_RATE_G

    @computed_field
    def hold_max_rate_g(self) -> float:
        return SPATULA_HOLD_MAX_RATE_G

    @computed_field
    def hold_lift_rate_g_per_px(self) -> float:
        return SPATULA_HOLD_LIFT_RATE_G_PER_PX


class AnalyticalBalanceStateSchema(BaseModel):
    tare_mass_g: float | None = None
    tared_tool_id: str | None = None


class ProduceLotSchema(BaseModel):
    id: str
    label: str
    produce_type: str
    total_mass_g: float
    unit_count: int | None = None
    pesticide_residues: dict[str, float] = Field(default_factory=dict)

    @computed_field
    def is_draggable(self) -> bool:
        return True

    @computed_field
    def allowed_drop_targets(self) -> list[str]:
        return get_produce_lot_allowed_drop_targets()


class PrintedLabelTicketSchema(BaseModel):
    id: str
    sample_code: str
    label_text: str
    received_date: str = ""

    @computed_field
    def is_draggable(self) -> bool:
        return True

    @computed_field
    def allowed_drop_targets(self) -> list[str]:
        return get_lims_label_ticket_allowed_drop_targets()


class ContainerLabelSchema(BaseModel):
    id: str
    label_kind: str
    text: str
    sample_code: str | None = None
    received_date: str | None = None

    @computed_field
    def is_draggable(self) -> bool:
        return True

    @computed_field
    def allowed_drop_targets(self) -> list[str]:
        return get_sample_label_allowed_drop_targets()


class EntityOriginSchema(BaseModel):
    kind: str
    location_id: str | None = None
    location_label: str | None = None
    container_id: str | None = None
    container_label: str | None = None


class LimsReceptionSchema(BaseModel):
    orchard_name: str
    harvest_date: str
    indicative_mass_g: float
    id: str | None = None
    measured_gross_mass_g: float | None = None
    gross_mass_offset_g: int = 0
    measured_sample_mass_g: float | None = None
    lab_sample_code: str | None = None
    status: str
    printed_label_ticket: PrintedLabelTicketSchema | None = None


def build_default_lims_reception_schema() -> LimsReceptionSchema:
    return LimsReceptionSchema(
        orchard_name="",
        harvest_date="",
        indicative_mass_g=0.0,
        id=None,
        measured_gross_mass_g=None,
        gross_mass_offset_g=0,
        measured_sample_mass_g=None,
        lab_sample_code=None,
        status="awaiting_reception",
        printed_label_ticket=None,
    )


class WorkbenchToolSchema(BaseModel):
    id: str
    tool_id: str
    label: str
    subtitle: str
    accent: str
    tool_type: str
    capacity_ml: float
    contact_impurity_mg_per_g: float = 0.0
    contents_homogeneity: float = Field(default=0.0, exclude=True)
    is_sealed: bool = False
    closure_fault: str | None = None
    internal_pressure_bar: float = 1.0
    trapped_co2_mass_g: float = 0.0
    field_label_text: str | None = None
    labels: list[ContainerLabelSchema] = Field(default_factory=list)
    produce_lots: list[ProduceLotSchema] = Field(default_factory=list)
    liquids: list[WorkbenchLiquidSchema] = Field(default_factory=list)
    produce_fractions: list[ProduceFractionSchema] = Field(default_factory=list)
    quechers_state: QuechersStateSchema = Field(default_factory=QuechersStateSchema)
    istd_phase_added: str | None = None
    quechers_extraction_result: QuechersExtractionResultSchema | None = None
    injection_context: InjectionContextSchema | None = None
    calibration_context: CalibrationContextSchema | None = None

    @computed_field
    def sample_label_text(self) -> str | None:
        lims_label = next((label for label in self.labels if label.label_kind == "lims"), None)
        if lims_label is not None:
            return lims_label.text
        manual_label = next((label for label in self.labels if label.label_kind == "manual"), None)
        return manual_label.text if manual_label is not None else None

    @computed_field
    def sample_label_received_date(self) -> str | None:
        lims_label = next((label for label in self.labels if label.label_kind == "lims"), None)
        return lims_label.received_date if lims_label is not None else None

    @computed_field
    def allowed_drop_targets(self) -> list[str]:
        return get_tool_allowed_drop_targets(self.tool_type)

    @computed_field
    def is_discardable(self) -> bool:
        return can_tool_be_discarded(self.tool_type)

    @computed_field
    def is_storable(self) -> bool:
        return can_tool_be_stored(self.tool_type)

    @computed_field
    def can_store(self) -> bool:
        return self.is_storable and not self._contained_entities()

    @computed_field
    def can_seal(self) -> bool:
        return can_tool_seal(self.tool_type)

    @computed_field
    def can_receive_produce(self) -> bool:
        return can_tool_receive_produce(self.tool_type)

    @computed_field
    def can_receive_liquids(self) -> bool:
        return can_tool_receive_liquids(self.tool_type)


    def _contained_entities(self) -> list[ContainedEntitySchema]:
        return [
            *[_liquid_entity(liq) for liq in self.liquids],
            *[_produce_lot_entity(lot) for lot in self.produce_lots],
            *[_produce_fraction_entity(f) for f in self.produce_fractions],
            *[_sample_label_entity(lbl) for lbl in self.labels],
        ]

    @computed_field
    def containment(self) -> ContainmentSchema:
        accepts: list[ContainmentRuleSchema] = []
        can_receive_contents = can_tool_receive_contents(self.tool_type, self.is_sealed)
        has_produce = len(self.produce_lots) > 0 or len(self.produce_fractions) > 0
        has_lims_label = any(label.label_kind == "lims" for label in self.labels)

        if can_receive_contents and can_tool_receive_liquids(self.tool_type):
            accepts.append(ContainmentRuleSchema(entity_kind="liquid"))
        if can_receive_contents and can_tool_receive_produce(self.tool_type) and not has_produce:
            accepts.append(ContainmentRuleSchema(entity_kind="produce"))

        accepts.append(ContainmentRuleSchema(entity_kind="sample_label"))
        if not has_lims_label:
            accepts.append(ContainmentRuleSchema(entity_kind="lims_label_ticket"))

        children = self._contained_entities()
        return ContainmentSchema(
            children=children,
            capacity=max(len(children) + len(accepts), 1),
            remaining_capacity=len(accepts),
            accepts=accepts,
            can_receive=len(accepts) > 0,
            blocked_reason=None if len(accepts) > 0 else "no_accepted_entities",
        )

    @computed_field
    def is_draggable(self) -> bool:
        return len(get_tool_allowed_drop_targets(self.tool_type)) > 0


class WorkbenchSlotSchema(BaseModel):
    id: str
    label: str
    tool: WorkbenchToolSchema | None = None
    surface_produce_lots: list[ProduceLotSchema]
    surface_produce_fractions: list[ProduceFractionSchema] = Field(default_factory=list)

    @computed_field
    def drop_target_types(self) -> list[str]:
        return ["workbench_slot"]

    @computed_field
    def children(self) -> list[ContainedEntitySchema]:
        return self._contained_entities()

    def _contained_entities(self) -> list[ContainedEntitySchema]:
        return [
            *([_tool_entity(self.tool)] if self.tool is not None else []),
            *[_produce_lot_entity(lot) for lot in self.surface_produce_lots],
        ]

    @computed_field
    def containment(self) -> ContainmentSchema:
        children = self._contained_entities()
        remaining_capacity = max(1 - len(children), 0)
        return ContainmentSchema(
            children=children,
            capacity=1,
            remaining_capacity=remaining_capacity,
            accepts=[
                ContainmentRuleSchema(entity_kind="tool"),
                ContainmentRuleSchema(entity_kind="produce"),
            ],
            can_receive=remaining_capacity > 0,
            blocked_reason=None if remaining_capacity > 0 else "occupied",
        )


class WorkbenchSchema(BaseModel):
    slots: list[WorkbenchSlotSchema]


class RackSlotSchema(BaseModel):
    id: str
    label: str
    tool: WorkbenchToolSchema | None = None

    @computed_field
    def drop_target_types(self) -> list[str]:
        return ["rack_slot"]

    @computed_field
    def children(self) -> list[ContainedEntitySchema]:
        return self._contained_entities()

    def _contained_entities(self) -> list[ContainedEntitySchema]:
        return [_tool_entity(self.tool)] if self.tool is not None else []

    @computed_field
    def containment(self) -> ContainmentSchema:
        children = self._contained_entities()
        remaining_capacity = max(1 - len(children), 0)
        return ContainmentSchema(
            children=children,
            capacity=1,
            remaining_capacity=remaining_capacity,
            accepts=[ContainmentRuleSchema(entity_kind="tool", tool_type="sample_vial")],
            can_receive=remaining_capacity > 0,
            blocked_reason=None if remaining_capacity > 0 else "occupied",
        )


class RackSchema(BaseModel):
    slots: list[RackSlotSchema]
    state: Literal["available", "loaded", "locked", "completed"] = "available"

    @computed_field
    def is_draggable(self) -> bool:
        return self.state == "available"

    @computed_field
    def allowed_drop_targets(self) -> list[str]:
        if not self.is_draggable:
            return []
        return list(get_dnd_contract("rack", "autosampler_rack").allowed_drop_targets)


class TrashProduceLotEntrySchema(BaseModel):
    id: str
    origin_label: str
    produce_lot: ProduceLotSchema
    origin: EntityOriginSchema | None = None
    produce_fraction: ProduceFractionSchema | None = None


class TrashSampleLabelEntrySchema(BaseModel):
    id: str
    origin_label: str
    label: ContainerLabelSchema

    @computed_field
    def sample_label_text(self) -> str:
        return self.label.text


class TrashSchema(BaseModel):
    children: list[WorkbenchToolSchema] = Field(default_factory=list)
    discarded_from: dict[str, str] = Field(default_factory=dict)
    produce_lots: list[TrashProduceLotEntrySchema] = Field(default_factory=list)
    sample_labels: list[TrashSampleLabelEntrySchema] = Field(default_factory=list)


class WorkspaceWidgetSchema(BaseModel):
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
    tool: WorkbenchToolSchema | None = None
    produce_lots: list[ProduceLotSchema] = Field(default_factory=list)
    liquids: list[WorkbenchLiquidSchema] = Field(default_factory=list)
    sequence_runs: list[SequenceRunSchema] = Field(default_factory=list)
    store_allowed_override: bool | None = Field(default=None, exclude=True)
    produce_material_states: list[ProduceMaterialStateSchema] = Field(default_factory=list, exclude=True)

    @computed_field
    def drop_target_types(self) -> list[str]:
        targets: list[str] = []
        if self.widget_type == "cryogenic_grinder":
            targets.append("grinder_widget")
        if self.widget_type == "gross_balance":
            targets.append("gross_balance_widget")
        if self.widget_type == "analytical_balance":
            targets.append("analytical_balance_widget")
        if self.widget_type == "vortex_mixer":
            targets.append("vortex_widget")
        if self.widget_type == "centrifuge":
            targets.append("centrifuge_widget")
        return targets

    @computed_field
    def is_draggable(self) -> bool:
        return self._can_store()

    @computed_field
    def allowed_drop_targets(self) -> list[str]:
        return ["workspace_canvas"] if self.is_draggable else []

    @computed_field
    def is_storable(self) -> bool:
        return can_workspace_widget_be_stored(self.id)

    @computed_field
    def can_store(self) -> bool:
        return self._can_store()

    @computed_field
    def children(self) -> list[ContainedEntitySchema]:
        return self._contained_entities()

    def _contained_entities(self) -> list[ContainedEntitySchema]:
        return [
            *([_tool_entity(self.tool)] if self.tool is not None else []),
            *[_produce_lot_entity(lot) for lot in self.produce_lots],
            *[_liquid_entity(liq) for liq in self.liquids],
        ]

    @computed_field
    def containment(self) -> ContainmentSchema | None:
        children = self._contained_entities()
        if self.widget_type == "cryogenic_grinder":
            produce_count = len(self.produce_lots)
            remaining_capacity = max(1 - produce_count, 0)
            return ContainmentSchema(
                children=children,
                capacity=1,
                remaining_capacity=remaining_capacity,
                accepts=[
                    ContainmentRuleSchema(entity_kind="produce"),
                    ContainmentRuleSchema(entity_kind="liquid", liquid_type="dry_ice_pellets"),
                ],
                can_receive=remaining_capacity > 0,
                blocked_reason=None if remaining_capacity > 0 else "occupied",
            )
        if self.widget_type in {"gross_balance", "analytical_balance", "vortex_mixer", "centrifuge"}:
            remaining_capacity = max(1 - (1 if self.tool is not None else 0), 0)
            return ContainmentSchema(
                children=children,
                capacity=1,
                remaining_capacity=remaining_capacity,
                accepts=[ContainmentRuleSchema(entity_kind="tool")],
                can_receive=remaining_capacity > 0,
                blocked_reason=None if remaining_capacity > 0 else "occupied",
            )
        return None

    @computed_field
    def grinder_can_start(self) -> bool:
        if self.widget_type != "cryogenic_grinder" or self.id != "grinder":
            return False
        return self.grinder_start_block_reason is None

    @computed_field
    def centrifuge_can_start(self) -> bool:
        return self.centrifuge_start_block_reason is None

    @computed_field
    def centrifuge_start_block_reason(self) -> str | None:
        return get_centrifuge_start_block_reason(
            widget_type=self.widget_type,
            has_tool=self.tool is not None,
            run_remaining_ms=self.centrifuge_run_remaining_ms,
        )

    @computed_field
    def grinder_start_block_reason(self) -> str | None:
        if self.widget_type != "cryogenic_grinder" or self.id != "grinder":
            return "not_grinder"
        return get_grinder_start_block_reason(
            produce_lot_ids=[lot.id for lot in self.produce_lots],
            material_states=self._produce_material_states_map(),
            temperatures=self._produce_temperatures_map(),
            grinder_run_remaining_ms=self.grinder_run_remaining_ms,
        )

    @computed_field
    def grinder_display_mode(self) -> str | None:
        if self.widget_type != "cryogenic_grinder" or self.id != "grinder":
            return None
        return get_grinder_display_mode(
            produce_lot_ids=[lot.id for lot in self.produce_lots],
            material_states=self._produce_material_states_map(),
            temperatures=self._produce_temperatures_map(),
            grinder_run_remaining_ms=self.grinder_run_remaining_ms,
            grinder_fault=self.grinder_fault,
            grinder_can_start=cast(bool, self.grinder_can_start),
            grinder_start_block_reason=cast(str | None, self.grinder_start_block_reason),
        )

    def _produce_material_states_map(self) -> dict[str, str]:
        return {s.produce_lot_id: s.material_state for s in self.produce_material_states}

    def _produce_temperatures_map(self) -> dict[str, float]:
        return {s.produce_lot_id: s.temperature_c for s in self.produce_material_states}

    def _can_store(self) -> bool:
        if self.store_allowed_override is not None:
            return self.store_allowed_override
        return can_workspace_widget_store_now(
            self.id,
            is_trashed=self.is_trashed,
            has_tool=self.tool is not None,
            has_produce=len(self.produce_lots) > 0,
            has_liquids=len(self.liquids) > 0,
        )

    produce_fractions: list[ProduceFractionSchema] = Field(default_factory=list)


class WorkspaceSchema(BaseModel):
    widgets: list[WorkspaceWidgetSchema]
    produce_basket_lots: list[ProduceLotSchema]
    produce_basket_fractions: list[ProduceFractionSchema] = Field(default_factory=list)


class ExperimentSchema(BaseModel):
    id: str
    status: str
    last_simulation_at: datetime
    snapshot_version: int
    workbench: WorkbenchSchema
    rack: RackSchema
    trash: TrashSchema
    workspace: WorkspaceSchema
    lims_reception: LimsReceptionSchema = Field(default_factory=build_default_lims_reception_schema)
    lims_entries: list[LimsReceptionSchema] = Field(default_factory=list)
    basket_tools: list[WorkbenchToolSchema] = Field(default_factory=list)
    produce_material_states: list[ProduceMaterialStateSchema] = Field(default_factory=list)

    spatula: SpatulaStateSchema = Field(default_factory=SpatulaStateSchema)
    pipette: PipetteStateSchema = Field(default_factory=PipetteStateSchema)
    analytical_balance: AnalyticalBalanceStateSchema = Field(default_factory=AnalyticalBalanceStateSchema)
    audit_log: list[str]


class ExperimentListEntrySchema(BaseModel):
    id: str
    status: str
    last_simulation_at: datetime
    snapshot_version: int
    updated_at: datetime
    last_audit_entry: str | None = None


class ToolbarItemSchema(BaseModel):
    id: str
    item_type: str
    name: str
    subtitle: str
    description: str
    accent: str
    allowed_drop_targets: list[str]
    is_discardable: bool | None = None
    is_storable: bool | None = None
    can_receive_liquids: bool | None = None
    can_receive_produce: bool | None = None
    can_seal: bool | None = None
    tool_type: str | None = None
    capacity_ml: float | None = None
    liquid_type: str | None = None
    transfer_volume_ml: float | None = None
    widget_type: str | None = None


class ToolbarCategorySchema(BaseModel):
    id: str
    label: str
    description: str
    items: list[ToolbarItemSchema]


class LayoutPositionSchema(BaseModel):
    anchor: str
    offset_x: int
    offset_y: int


class WorkbenchToolPlacementSchema(BaseModel):
    tool_id: str


class WorkbenchSlotReferenceSchema(BaseModel):
    slot_id: str


class TargetWorkbenchSlotSchema(BaseModel):
    target_slot_id: str


class WorkbenchToolMoveSchema(BaseModel):
    target_slot_id: str


class WorkbenchToolLiquidCreateSchema(BaseModel):
    liquid_id: str
    volume_ml: float | None = None


class WorkbenchToolLiquidUpdateSchema(BaseModel):
    volume_ml: float


class WorkbenchToolSampleLabelUpdateSchema(BaseModel):
    label_id: str | None = None
    sample_label_text: str


class WorkbenchToolPowderPourSchema(BaseModel):
    delta_mass_g: float


class ProduceLotReferenceSchema(BaseModel):
    produce_lot_id: str


class PaletteToolDiscardSchema(BaseModel):
    tool_id: str


class RackToolPlacementSchema(BaseModel):
    tool_id: str


class RackWorkbenchPlacementSchema(BaseModel):
    source_slot_id: str


class RackToolMoveSchema(BaseModel):
    target_rack_slot_id: str


class RackToolMoveToWorkbenchSchema(BaseModel):
    target_slot_id: str


class TrashToolRestoreToWorkbenchSchema(BaseModel):
    target_slot_id: str


class TrashToolRestoreToRackSchema(BaseModel):
    rack_slot_id: str


class RackSlotReferenceSchema(BaseModel):
    rack_slot_id: str


class DndObjectRefSchema(BaseModel):
    kind: str
    id: str


class DndMoveObjectSchema(BaseModel):
    entity: DndObjectRefSchema
    source: DndObjectRefSchema
    destination: DndObjectRefSchema


class WorkspaceWidgetCreateSchema(LayoutPositionSchema):
    widget_id: str


class WorkspaceWidgetMoveSchema(LayoutPositionSchema):
    pass


class WorkspaceWidgetLiquidCreateSchema(BaseModel):
    liquid_id: str
    volume_ml: float | None = None


class WorkspaceWidgetLiquidUpdateSchema(BaseModel):
    volume_ml: float


class WorkspaceProduceLotCreateSchema(BaseModel):
    produce_type: Literal["apple"]


class DebugProducePresetSpawnToWorkbenchSchema(BaseModel):
    target_slot_id: str
    total_mass_g: float | None = None
    temperature_c: float | None = None
    residual_co2_mass_g: float | None = None


class DebugProducePresetSpawnToWidgetSchema(BaseModel):
    widget_id: str
    total_mass_g: float | None = None
    temperature_c: float | None = None
    residual_co2_mass_g: float | None = None


class DebugToolPresetSpawnSchema(BaseModel):
    destination_kind: Literal[
        "analytical_balance",
        "gross_balance",
        "rack_slot",
        "trash_bin",
        "vortex",
        "workbench_slot",
        "workbench_tool",
    ]
    destination_id: str
    produce_mass_g: float | None = None
    temperature_c: float | None = None
    level_ng_per_ml: float | None = None
    extract_volume_ml: float | None = None
    extraction_recovery_percent: float | None = None
    sampling_accuracy_percent: float | None = None
    istd_volume_ml: float | None = None


class ReceivedBagPlacementSchema(BaseModel):
    target_slot_id: str
    tool_id: str


class BasketToolReferenceSchema(BaseModel):
    tool_id: str


class GrossWeightRecordSchema(BaseModel):
    measured_gross_mass_g: float | None = None


class GrossMassOffsetUpdateSchema(BaseModel):
    gross_mass_offset_g: int


class AnalyticalBalanceMeasuredMassSchema(BaseModel):
    measured_sample_mass_g: float


class LimsReceptionCreateSchema(BaseModel):
    entry_id: str | None = None
    orchard_name: str
    harvest_date: str
    indicative_mass_g: float
    measured_gross_mass_g: float | None = None
    measured_sample_mass_g: float | None = None


class LimsLabelPrintSchema(BaseModel):
    entry_id: str | None = None
