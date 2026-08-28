from __future__ import annotations

from app.domain.journal_codes import JournalCode

#: The English wording of every journal event. This is the only place the
#: audit log's phrasing lives; other languages are rendered by the client from
#: the code and its parameters.
JOURNAL_TEMPLATES: dict[JournalCode, str] = {
    JournalCode.EXPERIMENT_CREATED: "Experiment created",
    JournalCode.EXPERIMENT_DUPLICATED: "Duplicated from {source_id}.",

    JournalCode.TOOL_PLACED: "{tool} placed on {target}.",
    JournalCode.TOOL_MOVED: "{tool} moved from {source} to {target}.",
    JournalCode.TOOL_RESTORED_FROM_TRASH: "{tool} restored from trash to {target}.",
    JournalCode.TOOL_DISCARDED: "{tool} discarded from {source}.",
    JournalCode.TOOL_STORED: "{tool} stored in inventory.",
    JournalCode.PRODUCE_ADDED: "{produce} added to {target}.",
    JournalCode.PRODUCE_MOVED: "{produce} moved from {source} to {target}.",
    JournalCode.PRODUCE_RESTORED_FROM_TRASH: "{produce} restored from trash to {target}.",
    JournalCode.PRODUCE_DISCARDED: "{produce} discarded from {source}.",
    JournalCode.PRODUCE_PLACED_CONTAMINATED: (
        "{produce} placed directly on {target} and marked contaminated."
    ),
    JournalCode.PRODUCE_MOVED_CONTAMINATED: (
        "{produce} moved from {source} to {target} and marked contaminated."
    ),
    JournalCode.LABEL_MOVED: "Label moved from {source} to {target}.",
    JournalCode.LABEL_RESTORED_FROM_TRASH: "Label restored from trash to {target}.",
    JournalCode.LABEL_DISCARDED: "Label discarded from {source}.",

    JournalCode.STATION_ADDED: "Station {index} added to workbench.",
    JournalCode.STATION_REMOVED: "{slot} removed from workbench.",
    JournalCode.MANUAL_LABEL_APPLIED: "Manual label applied to {tool} on {location}.",
    JournalCode.SAMPLE_LABEL_UPDATED: "Sample label updated to {text} on {tool}.",
    JournalCode.SAMPLE_LABEL_CLEARED: "Sample label cleared on {tool}.",
    JournalCode.PRODUCE_CUT: "{produce} cut on {location}.",

    JournalCode.TOOL_SEALED: "{tool} sealed on {location}.",
    JournalCode.TOOL_OPENED: "{tool} opened on {location}.",
    JournalCode.TOOL_VENTED: (
        "{tool} vented at {pressure} bar on {location}; {lost_mass} g of powder was lost."
    ),
    JournalCode.TOOL_POPPED_OPEN: (
        "{tool} popped open on {location} at {pressure} bar; "
        "{lost_mass} g of {produce} was lost."
    ),

    JournalCode.LIQUID_ADDED: "{liquid} added to {target}.",
    JournalCode.LIQUID_ADDED_PARTIAL: (
        "{liquid} added to {target} at {volume} mL (remaining capacity)."
    ),
    JournalCode.LIQUID_INCREASED: "{liquid} increased to {volume} mL in {target}.",
    JournalCode.LIQUID_INCREASED_PARTIAL: (
        "{liquid} increased to {volume} mL in {target} (remaining capacity)."
    ),
    JournalCode.LIQUID_ADJUSTED: "{liquid} adjusted to {volume} mL in {target}.",
    JournalCode.LIQUID_REMOVED: "{liquid} removed from {target}.",
    JournalCode.SALTS_CEMENTED_ON_CONTACT: (
        "Dry QuEChERS salts in {tool} cemented instantly when wetted; "
        "the container is unusable."
    ),

    JournalCode.SPATULA_LOADED: "Spatula loaded from {source}.",
    JournalCode.SPATULA_POURED: "Powder transferred into {target}.",
    JournalCode.SPATULA_DISCARDED: "Spatula discarded ({mass} g).",
    JournalCode.PIPETTE_ASPIRATED: "Pipette aspirated {volume} mL from {source}.",
    JournalCode.PIPETTE_DISPENSED: "Pipette dispensed {volume} mL into {target}.",

    JournalCode.WIDGET_ADDED: "{widget} added to workspace.",
    JournalCode.WIDGET_REPOSITIONED: "{widget} repositioned in workspace.",
    JournalCode.WIDGET_MOVED: "{widget} moved in workspace.",
    JournalCode.WIDGET_RESTORED_TO_INVENTORY: "{widget} moved from trash to inventory.",
    JournalCode.WIDGET_STORED: "{widget} stored in inventory.",
    JournalCode.WIDGET_LIQUID_ADDED: "{liquid} added to {widget}.",
    JournalCode.WIDGET_LIQUID_INCREASED: "{liquid} increased in {widget}.",
    JournalCode.WIDGET_LIQUID_ADJUSTED: "{liquid} adjusted to {mass} g in {widget}.",
    JournalCode.WIDGET_LIQUID_REMOVED: "{liquid} removed from {widget}.",

    JournalCode.PRODUCE_LOT_CREATED_IN_BASKET: "{produce} created in Produce basket.",
    JournalCode.PRODUCE_LOT_CREATED_IN_BAG: "{produce} created in a received sampling bag.",
    JournalCode.RECEIVED_BAG_MOVED_FROM_BASKET: (
        "Received sampling bag moved from basket to {target}."
    ),

    JournalCode.GRINDING_STARTED: "{produce} grinding started in {widget}.",
    JournalCode.GRINDING_COMPLETED: "{produce} ground in {widget}.",
    JournalCode.GRINDER_JAMMED: "{produce} jammed {widget} motor and became waste.",

    JournalCode.VORTEX_STARTED: "Vortex mixer started with {tool}.",
    JournalCode.VORTEX_COMPLETED: "{tool} successfully vortexed on {widget}.",
    JournalCode.VORTEXED_UNSEALED: (
        "{tool} was vortexed without being sealed; its contents spilled and it is unusable."
    ),
    JournalCode.VORTEXED_WITHOUT_SALTS: (
        "{tool} was vortexed without QuEChERS salts; "
        "its walls are contaminated and it is unusable."
    ),

    JournalCode.CENTRIFUGE_STARTED: "{widget} started with {tool} at {rpm} rpm.",
    JournalCode.CENTRIFUGE_COMPLETED: "{tool} separated in {widget}.",
    JournalCode.CENTRIFUGED_UNSEALED: (
        "{tool} was centrifuged without being sealed; "
        "most of the extract sprayed out and the result will be badly compromised."
    ),

    JournalCode.GROSS_WEIGHT_RECORDED: "Gross reception weight recorded at {mass} g.",
    JournalCode.GROSS_OFFSET_SET: "Gross balance container offset set to {offset} g.",
    JournalCode.ANALYTICAL_BALANCE_TARED: "Analytical balance tared at {mass} g.",
    JournalCode.ANALYTICAL_SAMPLE_MASS_RECORDED: (
        "Analytical sample mass recorded at {mass} g."
    ),

    JournalCode.LIMS_RECEPTION_CREATED: "LIMS reception created for {sample_code}.",
    JournalCode.LIMS_RECEPTION_UPDATED: "LIMS reception updated for {sample_code}.",
    JournalCode.LIMS_MASS_CHECK_CONFIRMED: (
        "Reception mass check confirmed at {mass} g net."
    ),
    JournalCode.LIMS_LABEL_PRINTED: "LIMS label printed for {sample_code}.",
    JournalCode.LIMS_LABEL_DISCARDED: "LIMS label {sample_code} discarded from terminal.",
    JournalCode.LIMS_LABEL_APPLIED: "LIMS label {sample_code} applied to {tool}.",

    JournalCode.EXTRACT_POURED: (
        "Extract poured from {source} into {target} "
        "({mass} g sample, {compound_count} compound(s), ISTD {istd_volume} mL)."
    ),
    JournalCode.EXTRACT_POURED_NO_ISTD: (
        "Extract poured from {source} into {target} "
        "({mass} g sample, {compound_count} compound(s), no ISTD)."
    ),
    JournalCode.RACK_LOADED: "Autosampler rack loaded into the LC-MS/MS.",
    JournalCode.RACK_UNLOADED: "Autosampler rack unloaded from the LC-MS/MS.",
    JournalCode.SEQUENCE_STARTED: (
        "LC-MS/MS sequence run {run_id} started: "
        "{injection_count} injection(s), {duration} s of acquisition."
    ),
    JournalCode.SEQUENCE_COMPLETED: (
        "LC-MS/MS sequence run {run_id} completed: "
        "{injection_count} injection(s), {ready_count} with extract context."
    ),
    JournalCode.CALIBRATION_STANDARD_TAKEN: (
        "Calibration standard {level} ng/mL taken from the shelf."
    ),

    JournalCode.DEBUG_PRODUCE_SPAWNED_ON: "Debug preset {produce} spawned on {target}.",
    JournalCode.DEBUG_PRODUCE_SPAWNED_IN: "Debug preset {produce} spawned in {target}.",
    JournalCode.DEBUG_SLURRY_ADDED: "Debug {preset} added to {tool} on {location}.",
    JournalCode.DEBUG_CALIBRATION_ADDED: (
        "Debug calibration standard {level} ng/mL added to {tool} on {location}."
    ),
    JournalCode.DEBUG_EXTRACT_ADDED: "Debug apple extract added to {tool} on {location}.",
    # Equipment placement variants
    JournalCode.TOOL_PLACED_ON_EQUIPMENT: "{tool} placed on {widget}.",
    JournalCode.TOOL_PLACED_IN_EQUIPMENT: "{tool} placed in {widget}.",
    JournalCode.TOOL_MOVED_TO_EQUIPMENT: "{tool} moved to {widget}.",
    JournalCode.TOOL_RESTORED_TO_EQUIPMENT: "{tool} restored to {widget}.",
    JournalCode.TOOL_RESTORED_ONTO_EQUIPMENT: "{tool} restored onto {widget}.",
    JournalCode.TOOL_SEALED_IN: "{tool} sealed in {location}.",
    JournalCode.TOOL_OPENED_IN: "{tool} opened in {location}.",
    JournalCode.TOOL_VENTED_IN: (
        "{tool} vented at {pressure} bar in {location}; {lost_mass} g of powder was lost."
    ),
    JournalCode.SAMPLE_LABEL_UPDATED_AT: (
        "Sample label updated to {text} on {tool} on {location}."
    ),
    JournalCode.SAMPLE_LABEL_CLEARED_AT: "Sample label cleared on {tool} on {location}.",
    JournalCode.SPATULA_LOADED_AT: "Spatula loaded from {source} on {location}.",
    JournalCode.SPATULA_POURED_AT: "Powder transferred into {target} on {location}.",
    JournalCode.TOOL_PLACED_IN_SLOT: "{tool} placed in {target}.",
    # Contaminated placement variants
    JournalCode.PRODUCE_ADDED_CONTAMINATED: (
        "{produce} added from {source} to {target} and marked contaminated."
    ),
    JournalCode.PRODUCE_MOVED_FROM_TRASH_CONTAMINATED: (
        "{produce} restored from trash from {source} to {target} and marked contaminated."
    ),
    # Onboarding
    JournalCode.EXPERIMENT_FIRST_STEP: (
        "Receive the grower bag, weigh it, then register it in the LIMS."
    ),
}


def render_journal_message(code: JournalCode, params: dict[str, object]) -> str:
    try:
        return JOURNAL_TEMPLATES[code].format(**params)
    except KeyError as exc:
        raise ValueError(f"Journal message {code} is missing parameter {exc}") from exc
