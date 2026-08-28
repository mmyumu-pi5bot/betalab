from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from app.domain.models import JournalEventCategory, JournalEventSeverity


class JournalCode(StrEnum):
    """Every event the journal can record.

    The code is what a client localises; the English wording lives in
    `app.services.journal_messages` and is what the audit log keeps.
    """

    # Experiment lifecycle
    EXPERIMENT_CREATED = "experiment_created"
    EXPERIMENT_DUPLICATED = "experiment_duplicated"

    # Generic object movement
    TOOL_PLACED = "tool_placed"
    TOOL_MOVED = "tool_moved"
    TOOL_RESTORED_FROM_TRASH = "tool_restored_from_trash"
    TOOL_DISCARDED = "tool_discarded"
    TOOL_STORED = "tool_stored"
    PRODUCE_ADDED = "produce_added"
    PRODUCE_MOVED = "produce_moved"
    PRODUCE_RESTORED_FROM_TRASH = "produce_restored_from_trash"
    PRODUCE_DISCARDED = "produce_discarded"
    PRODUCE_PLACED_CONTAMINATED = "produce_placed_contaminated"
    PRODUCE_MOVED_CONTAMINATED = "produce_moved_contaminated"
    LABEL_MOVED = "label_moved"
    LABEL_RESTORED_FROM_TRASH = "label_restored_from_trash"
    LABEL_DISCARDED = "label_discarded"

    # Workbench
    STATION_ADDED = "station_added"
    STATION_REMOVED = "station_removed"
    MANUAL_LABEL_APPLIED = "manual_label_applied"
    SAMPLE_LABEL_UPDATED = "sample_label_updated"
    SAMPLE_LABEL_CLEARED = "sample_label_cleared"
    PRODUCE_CUT = "produce_cut"

    # Containers
    TOOL_SEALED = "tool_sealed"
    TOOL_OPENED = "tool_opened"
    TOOL_VENTED = "tool_vented"
    TOOL_POPPED_OPEN = "tool_popped_open"

    # Liquids
    LIQUID_ADDED = "liquid_added"
    LIQUID_ADDED_PARTIAL = "liquid_added_partial"
    LIQUID_INCREASED = "liquid_increased"
    LIQUID_INCREASED_PARTIAL = "liquid_increased_partial"
    LIQUID_ADJUSTED = "liquid_adjusted"
    LIQUID_REMOVED = "liquid_removed"
    SALTS_CEMENTED_ON_CONTACT = "salts_cemented_on_contact"

    # Spatula and pipette
    SPATULA_LOADED = "spatula_loaded"
    SPATULA_POURED = "spatula_poured"
    SPATULA_DISCARDED = "spatula_discarded"
    PIPETTE_ASPIRATED = "pipette_aspirated"
    PIPETTE_DISPENSED = "pipette_dispensed"

    # Workspace equipment
    WIDGET_ADDED = "widget_added"
    WIDGET_REPOSITIONED = "widget_repositioned"
    WIDGET_MOVED = "widget_moved"
    WIDGET_RESTORED_TO_INVENTORY = "widget_restored_to_inventory"
    WIDGET_STORED = "widget_stored"
    WIDGET_LIQUID_ADDED = "widget_liquid_added"
    WIDGET_LIQUID_INCREASED = "widget_liquid_increased"
    WIDGET_LIQUID_ADJUSTED = "widget_liquid_adjusted"
    WIDGET_LIQUID_REMOVED = "widget_liquid_removed"

    # Produce lots
    PRODUCE_LOT_CREATED_IN_BASKET = "produce_lot_created_in_basket"
    PRODUCE_LOT_CREATED_IN_BAG = "produce_lot_created_in_bag"
    RECEIVED_BAG_MOVED_FROM_BASKET = "received_bag_moved_from_basket"

    # Grinder
    GRINDING_STARTED = "grinding_started"
    GRINDING_COMPLETED = "grinding_completed"
    GRINDER_JAMMED = "grinder_jammed"

    # Vortex
    VORTEX_STARTED = "vortex_started"
    VORTEX_COMPLETED = "vortex_completed"
    VORTEXED_UNSEALED = "vortexed_unsealed"
    VORTEXED_WITHOUT_SALTS = "vortexed_without_salts"

    # Centrifuge
    CENTRIFUGE_STARTED = "centrifuge_started"
    CENTRIFUGE_COMPLETED = "centrifuge_completed"
    CENTRIFUGED_UNSEALED = "centrifuged_unsealed"

    # Balances
    GROSS_WEIGHT_RECORDED = "gross_weight_recorded"
    GROSS_OFFSET_SET = "gross_offset_set"
    ANALYTICAL_BALANCE_TARED = "analytical_balance_tared"
    ANALYTICAL_SAMPLE_MASS_RECORDED = "analytical_sample_mass_recorded"

    # LIMS
    LIMS_RECEPTION_CREATED = "lims_reception_created"
    LIMS_RECEPTION_UPDATED = "lims_reception_updated"
    LIMS_MASS_CHECK_CONFIRMED = "lims_mass_check_confirmed"
    LIMS_LABEL_PRINTED = "lims_label_printed"
    LIMS_LABEL_DISCARDED = "lims_label_discarded"
    LIMS_LABEL_APPLIED = "lims_label_applied"

    # LC-MS/MS
    EXTRACT_POURED = "extract_poured"
    EXTRACT_POURED_NO_ISTD = "extract_poured_no_istd"
    RACK_LOADED = "rack_loaded"
    RACK_UNLOADED = "rack_unloaded"
    SEQUENCE_STARTED = "sequence_started"
    SEQUENCE_COMPLETED = "sequence_completed"
    CALIBRATION_STANDARD_TAKEN = "calibration_standard_taken"

    # Debug palette
    DEBUG_PRODUCE_SPAWNED_ON = "debug_produce_spawned_on"
    DEBUG_PRODUCE_SPAWNED_IN = "debug_produce_spawned_in"
    DEBUG_SLURRY_ADDED = "debug_slurry_added"
    DEBUG_CALIBRATION_ADDED = "debug_calibration_added"
    DEBUG_EXTRACT_ADDED = "debug_extract_added"

    # Equipment placement variants
    TOOL_PLACED_ON_EQUIPMENT = "tool_placed_on_equipment"
    TOOL_PLACED_IN_EQUIPMENT = "tool_placed_in_equipment"
    TOOL_MOVED_TO_EQUIPMENT = "tool_moved_to_equipment"
    TOOL_RESTORED_TO_EQUIPMENT = "tool_restored_to_equipment"
    TOOL_RESTORED_ONTO_EQUIPMENT = "tool_restored_onto_equipment"
    TOOL_SEALED_IN = "tool_sealed_in"
    TOOL_OPENED_IN = "tool_opened_in"
    TOOL_VENTED_IN = "tool_vented_in"
    SAMPLE_LABEL_UPDATED_AT = "sample_label_updated_at"
    SAMPLE_LABEL_CLEARED_AT = "sample_label_cleared_at"
    SPATULA_LOADED_AT = "spatula_loaded_at"
    SPATULA_POURED_AT = "spatula_poured_at"
    TOOL_PLACED_IN_SLOT = "tool_placed_in_slot"
    # Contaminated placement variants
    PRODUCE_ADDED_CONTAMINATED = "produce_added_contaminated"
    PRODUCE_MOVED_FROM_TRASH_CONTAMINATED = "produce_moved_from_trash_contaminated"
    # Onboarding
    EXPERIMENT_FIRST_STEP = "experiment_first_step"

@dataclass(frozen=True, slots=True)
class JournalRef:
    """An entity named inside a journal message.

    Carries the stable id next to the English text so a client can render the
    sentence in its own language without parsing the label back out of it.
    Formats as its English text, which is what the audit log keeps.
    """

    kind: str
    id: str
    text: str
    #: Set for entities whose name is numbered rather than fixed — "Apple lot 2".
    index: int | None = None

    def __format__(self, format_spec: str) -> str:
        return format(self.text, format_spec)

    def __str__(self) -> str:
        return self.text


#: Events whose category is not the default MANIPULATION.
_CATEGORIES: dict[JournalCode, JournalEventCategory] = {
    JournalCode.EXPERIMENT_CREATED: JournalEventCategory.SYSTEM,
    JournalCode.EXPERIMENT_DUPLICATED: JournalEventCategory.SYSTEM,
    JournalCode.EXPERIMENT_FIRST_STEP: JournalEventCategory.SYSTEM,
    JournalCode.PRODUCE_LOT_CREATED_IN_BAG: JournalEventCategory.SYSTEM,
    JournalCode.WIDGET_REPOSITIONED: JournalEventCategory.LAYOUT,
    JournalCode.WIDGET_MOVED: JournalEventCategory.LAYOUT,
    JournalCode.GRINDING_STARTED: JournalEventCategory.SIMULATION,
    JournalCode.GRINDING_COMPLETED: JournalEventCategory.SIMULATION,
    JournalCode.GRINDER_JAMMED: JournalEventCategory.SIMULATION,
    JournalCode.VORTEX_STARTED: JournalEventCategory.SIMULATION,
    JournalCode.VORTEX_COMPLETED: JournalEventCategory.SIMULATION,
    JournalCode.VORTEXED_UNSEALED: JournalEventCategory.SIMULATION,
    JournalCode.VORTEXED_WITHOUT_SALTS: JournalEventCategory.SIMULATION,
    JournalCode.CENTRIFUGE_STARTED: JournalEventCategory.SIMULATION,
    JournalCode.CENTRIFUGE_COMPLETED: JournalEventCategory.SIMULATION,
    JournalCode.CENTRIFUGED_UNSEALED: JournalEventCategory.SIMULATION,
    JournalCode.SEQUENCE_STARTED: JournalEventCategory.SIMULATION,
    JournalCode.SEQUENCE_COMPLETED: JournalEventCategory.SIMULATION,
    JournalCode.TOOL_VENTED: JournalEventCategory.SIMULATION,
    JournalCode.TOOL_POPPED_OPEN: JournalEventCategory.SIMULATION,
    JournalCode.SALTS_CEMENTED_ON_CONTACT: JournalEventCategory.SIMULATION,
}

#: Events whose severity is not the default INFO.
_SEVERITIES: dict[JournalCode, JournalEventSeverity] = {
    JournalCode.PRODUCE_PLACED_CONTAMINATED: JournalEventSeverity.WARNING,
    JournalCode.PRODUCE_MOVED_CONTAMINATED: JournalEventSeverity.WARNING,
    JournalCode.TOOL_VENTED: JournalEventSeverity.WARNING,
    JournalCode.TOOL_POPPED_OPEN: JournalEventSeverity.WARNING,
    JournalCode.SALTS_CEMENTED_ON_CONTACT: JournalEventSeverity.WARNING,
    JournalCode.VORTEXED_UNSEALED: JournalEventSeverity.WARNING,
    JournalCode.VORTEXED_WITHOUT_SALTS: JournalEventSeverity.WARNING,
    JournalCode.CENTRIFUGED_UNSEALED: JournalEventSeverity.WARNING,
    JournalCode.GRINDER_JAMMED: JournalEventSeverity.WARNING,
}


def journal_category(code: JournalCode) -> JournalEventCategory:
    return _CATEGORIES.get(code, JournalEventCategory.MANIPULATION)


def journal_severity(code: JournalCode) -> JournalEventSeverity:
    return _SEVERITIES.get(code, JournalEventSeverity.INFO)
