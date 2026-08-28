// Journal wording, keyed by the event code the backend records next to each
// entry. English entries are rendered by the backend and read straight off
// `message`; this catalogue is what every other language is built from.
export const enJournal = {
  "journal.analytical_balance_tared": "Analytical balance tared at {mass} g.",
  "journal.analytical_sample_mass_recorded": "Analytical sample mass recorded at {mass} g.",
  "journal.calibration_standard_taken":
    "Calibration standard {level} ng/mL taken from the shelf.",
  "journal.centrifuge_completed": "{tool} separated in {widget}.",
  "journal.centrifuge_started": "{widget} started with {tool} at {rpm} rpm.",
  "journal.centrifuged_unsealed":
    "{tool} was centrifuged without being sealed; most of the extract sprayed out and the result will be badly compromised.",
  "journal.debug_calibration_added":
    "Debug calibration standard {level} ng/mL added to {tool} on {location}.",
  "journal.debug_extract_added": "Debug apple extract added to {tool} on {location}.",
  "journal.debug_produce_spawned_in": "Debug preset {produce} spawned in {target}.",
  "journal.debug_produce_spawned_on": "Debug preset {produce} spawned on {target}.",
  "journal.debug_slurry_added": "Debug {preset} added to {tool} on {location}.",
  "journal.experiment_created": "Experiment created",
  "journal.experiment_duplicated": "Duplicated from {source_id}.",
  "journal.experiment_first_step":
    "Receive the grower bag, weigh it, then register it in the LIMS.",
  "journal.extract_poured":
    "Extract poured from {source} into {target} ({mass} g sample, {compound_count} compound(s), ISTD {istd_volume} mL).",
  "journal.extract_poured_no_istd":
    "Extract poured from {source} into {target} ({mass} g sample, {compound_count} compound(s), no ISTD).",
  "journal.grinder_jammed": "{produce} jammed {widget} motor and became waste.",
  "journal.grinding_completed": "{produce} ground in {widget}.",
  "journal.grinding_started": "{produce} grinding started in {widget}.",
  "journal.gross_offset_set": "Gross balance container offset set to {offset} g.",
  "journal.gross_weight_recorded": "Gross reception weight recorded at {mass} g.",
  "journal.label_discarded": "Label discarded from {source}.",
  "journal.label_moved": "Label moved from {source} to {target}.",
  "journal.label_restored_from_trash": "Label restored from trash to {target}.",
  "journal.lims_label_applied": "LIMS label {sample_code} applied to {tool}.",
  "journal.lims_label_discarded": "LIMS label {sample_code} discarded from terminal.",
  "journal.lims_label_printed": "LIMS label printed for {sample_code}.",
  "journal.lims_mass_check_confirmed": "Reception mass check confirmed at {mass} g net.",
  "journal.lims_reception_created": "LIMS reception created for {sample_code}.",
  "journal.lims_reception_updated": "LIMS reception updated for {sample_code}.",
  "journal.liquid_added": "{liquid} added to {target}.",
  "journal.liquid_added_partial":
    "{liquid} added to {target} at {volume} mL (remaining capacity).",
  "journal.liquid_adjusted": "{liquid} adjusted to {volume} mL in {target}.",
  "journal.liquid_increased": "{liquid} increased to {volume} mL in {target}.",
  "journal.liquid_increased_partial":
    "{liquid} increased to {volume} mL in {target} (remaining capacity).",
  "journal.liquid_removed": "{liquid} removed from {target}.",
  "journal.manual_label_applied": "Manual label applied to {tool} on {location}.",
  "journal.pipette_aspirated": "Pipette aspirated {volume} mL from {source}.",
  "journal.pipette_dispensed": "Pipette dispensed {volume} mL into {target}.",
  "journal.produce_added": "{produce} added to {target}.",
  "journal.produce_added_contaminated":
    "{produce} added from {source} to {target} and marked contaminated.",
  "journal.produce_cut": "{produce} cut on {location}.",
  "journal.produce_discarded": "{produce} discarded from {source}.",
  "journal.produce_lot_created_in_bag": "{produce} created in a received sampling bag.",
  "journal.produce_lot_created_in_basket": "{produce} created in Produce basket.",
  "journal.produce_moved": "{produce} moved from {source} to {target}.",
  "journal.produce_moved_contaminated":
    "{produce} moved from {source} to {target} and marked contaminated.",
  "journal.produce_moved_from_trash_contaminated":
    "{produce} restored from trash from {source} to {target} and marked contaminated.",
  "journal.produce_placed_contaminated":
    "{produce} placed directly on {target} and marked contaminated.",
  "journal.produce_restored_from_trash": "{produce} restored from trash to {target}.",
  "journal.rack_loaded": "Autosampler rack loaded into the LC-MS/MS.",
  "journal.rack_unloaded": "Autosampler rack unloaded from the LC-MS/MS.",
  "journal.received_bag_moved_from_basket":
    "Received sampling bag moved from basket to {target}.",
  "journal.salts_cemented_on_contact":
    "Dry QuEChERS salts in {tool} cemented instantly when wetted; the container is unusable.",
  "journal.sample_label_cleared": "Sample label cleared on {tool}.",
  "journal.sample_label_cleared_at": "Sample label cleared on {tool} on {location}.",
  "journal.sample_label_updated": "Sample label updated to {text} on {tool}.",
  "journal.sample_label_updated_at": "Sample label updated to {text} on {tool} on {location}.",
  "journal.sequence_completed":
    "LC-MS/MS sequence run {run_id} completed: {injection_count} injection(s), {ready_count} with extract context.",
  "journal.sequence_started":
    "LC-MS/MS sequence run {run_id} started: {injection_count} injection(s), {duration} s of acquisition.",
  "journal.spatula_discarded": "Spatula discarded ({mass} g).",
  "journal.spatula_loaded": "Spatula loaded from {source}.",
  "journal.spatula_loaded_at": "Spatula loaded from {source} on {location}.",
  "journal.spatula_poured": "Powder transferred into {target}.",
  "journal.spatula_poured_at": "Powder transferred into {target} on {location}.",
  "journal.station_added": "Station {index} added to workbench.",
  "journal.station_removed": "{slot} removed from workbench.",
  "journal.tool_discarded": "{tool} discarded from {source}.",
  "journal.tool_moved": "{tool} moved from {source} to {target}.",
  "journal.tool_moved_to_equipment": "{tool} moved to {widget}.",
  "journal.tool_opened": "{tool} opened on {location}.",
  "journal.tool_opened_in": "{tool} opened in {location}.",
  "journal.tool_placed": "{tool} placed on {target}.",
  "journal.tool_placed_in_equipment": "{tool} placed in {widget}.",
  "journal.tool_placed_in_slot": "{tool} placed in {target}.",
  "journal.tool_placed_on_equipment": "{tool} placed on {widget}.",
  "journal.tool_popped_open":
    "{tool} popped open on {location} at {pressure} bar; {lost_mass} g of {produce} was lost.",
  "journal.tool_restored_from_trash": "{tool} restored from trash to {target}.",
  "journal.tool_restored_onto_equipment": "{tool} restored onto {widget}.",
  "journal.tool_restored_to_equipment": "{tool} restored to {widget}.",
  "journal.tool_sealed": "{tool} sealed on {location}.",
  "journal.tool_sealed_in": "{tool} sealed in {location}.",
  "journal.tool_stored": "{tool} stored in inventory.",
  "journal.tool_vented":
    "{tool} vented at {pressure} bar on {location}; {lost_mass} g of powder was lost.",
  "journal.tool_vented_in":
    "{tool} vented at {pressure} bar in {location}; {lost_mass} g of powder was lost.",
  "journal.vortex_completed": "{tool} successfully vortexed on {widget}.",
  "journal.vortex_started": "Vortex mixer started with {tool}.",
  "journal.vortexed_unsealed":
    "{tool} was vortexed without being sealed; its contents spilled and it is unusable.",
  "journal.vortexed_without_salts":
    "{tool} was vortexed without QuEChERS salts; its walls are contaminated and it is unusable.",
  "journal.widget_added": "{widget} added to workspace.",
  "journal.widget_liquid_added": "{liquid} added to {widget}.",
  "journal.widget_liquid_adjusted": "{liquid} adjusted to {mass} g in {widget}.",
  "journal.widget_liquid_increased": "{liquid} increased in {widget}.",
  "journal.widget_liquid_removed": "{liquid} removed from {widget}.",
  "journal.widget_moved": "{widget} moved in workspace.",
  "journal.widget_repositioned": "{widget} repositioned in workspace.",
  "journal.widget_restored_to_inventory": "{widget} moved from trash to inventory.",
  "journal.widget_stored": "{widget} stored in inventory.",
} as const;
