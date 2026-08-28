import type { enJournal } from "../en/journal";

// Journal wording, keyed by the event code the backend records next to each
// entry. English entries are rendered by the backend and read straight off
// `message`; this catalogue is what every other language is built from.
export const frJournal: Record<keyof typeof enJournal, string> = {
  "journal.analytical_balance_tared": "Balance analytique tarée à {mass} g.",
  "journal.analytical_sample_mass_recorded": "Masse de prise d'essai relevée à {mass} g.",
  "journal.calibration_standard_taken": "Étalon à {level} ng/mL pris sur l'étagère.",
  "journal.centrifuge_completed": "{tool} séparé dans {widget}.",
  "journal.centrifuge_started": "{widget} démarrée avec {tool} à {rpm} tr/min.",
  "journal.centrifuged_unsealed":
    "{tool} a été centrifugé sans avoir été fermé ; l'essentiel de l'extrait a giclé et le résultat sera très compromis.",
  "journal.debug_calibration_added":
    "Débogage : étalon à {level} ng/mL ajouté à {tool}, sur {location}.",
  "journal.debug_extract_added": "Débogage : extrait de pomme ajouté à {tool}, sur {location}.",
  "journal.debug_produce_spawned_in": "Préréglage de débogage {produce} créé dans {target}.",
  "journal.debug_produce_spawned_on": "Préréglage de débogage {produce} créé sur {target}.",
  "journal.debug_slurry_added": "Débogage : {preset} ajouté à {tool}, sur {location}.",
  "journal.experiment_created": "Expérience créée",
  "journal.experiment_duplicated": "Dupliquée depuis {source_id}.",
  "journal.experiment_first_step":
    "Réceptionnez le sachet du producteur, pesez-le, puis enregistrez-le dans le LIMS.",
  "journal.extract_poured":
    "Extrait transféré de {source} vers {target} (prise d'essai de {mass} g, {compound_count} composé(s), étalon interne {istd_volume} mL).",
  "journal.extract_poured_no_istd":
    "Extrait transféré de {source} vers {target} (prise d'essai de {mass} g, {compound_count} composé(s), sans étalon interne).",
  "journal.grinder_jammed": "{produce} a bloqué le moteur de {widget} et est devenu un déchet.",
  "journal.grinding_completed": "{produce} broyé dans {widget}.",
  "journal.grinding_started": "Broyage de {produce} démarré dans {widget}.",
  "journal.gross_offset_set":
    "Décalage du contenant sur la balance de réception réglé à {offset} g.",
  "journal.gross_weight_recorded": "Masse brute à réception relevée à {mass} g.",
  "journal.label_discarded": "Étiquette jetée depuis {source}.",
  "journal.label_moved": "Étiquette déplacée de {source} vers {target}.",
  "journal.label_restored_from_trash": "Étiquette récupérée de la poubelle vers {target}.",
  "journal.lims_label_applied": "Étiquette LIMS {sample_code} apposée sur {tool}.",
  "journal.lims_label_discarded": "Étiquette LIMS {sample_code} jetée depuis le terminal.",
  "journal.lims_label_printed": "Étiquette LIMS imprimée pour {sample_code}.",
  "journal.lims_mass_check_confirmed":
    "Vérification de la masse à réception confirmée à {mass} g net.",
  "journal.lims_reception_created": "Fiche de réception LIMS créée pour {sample_code}.",
  "journal.lims_reception_updated": "Fiche de réception LIMS mise à jour pour {sample_code}.",
  "journal.liquid_added": "{liquid} ajouté à {target}.",
  "journal.liquid_added_partial":
    "{liquid} ajouté à {target} à hauteur de {volume} mL (capacité restante).",
  "journal.liquid_adjusted": "{liquid} ajusté à {volume} mL dans {target}.",
  "journal.liquid_increased": "{liquid} porté à {volume} mL dans {target}.",
  "journal.liquid_increased_partial":
    "{liquid} porté à {volume} mL dans {target} (capacité restante).",
  "journal.liquid_removed": "{liquid} retiré de {target}.",
  "journal.manual_label_applied": "Étiquette manuelle apposée sur {tool}, sur {location}.",
  "journal.pipette_aspirated": "Pipette : {volume} mL aspirés depuis {source}.",
  "journal.pipette_dispensed": "Pipette : {volume} mL distribués dans {target}.",
  "journal.produce_added": "{produce} ajouté à {target}.",
  "journal.produce_added_contaminated":
    "{produce} ajouté de {source} vers {target} et marqué contaminé.",
  "journal.produce_cut": "{produce} découpé sur {location}.",
  "journal.produce_discarded": "{produce} jeté depuis {source}.",
  "journal.produce_lot_created_in_bag": "{produce} créé dans un sachet d'échantillonnage reçu.",
  "journal.produce_lot_created_in_basket": "{produce} créé dans le panier de fruits.",
  "journal.produce_moved": "{produce} déplacé de {source} vers {target}.",
  "journal.produce_moved_contaminated":
    "{produce} déplacé de {source} vers {target} et marqué contaminé.",
  "journal.produce_moved_from_trash_contaminated":
    "{produce} récupéré de la poubelle, de {source} vers {target}, et marqué contaminé.",
  "journal.produce_placed_contaminated":
    "{produce} posé directement sur {target} et marqué contaminé.",
  "journal.produce_restored_from_trash": "{produce} récupéré de la poubelle vers {target}.",
  "journal.rack_loaded": "Rack autosampler chargé dans le LC-MS/MS.",
  "journal.rack_unloaded": "Rack autosampler déchargé du LC-MS/MS.",
  "journal.received_bag_moved_from_basket":
    "Sachet d'échantillonnage reçu déplacé du panier vers {target}.",
  "journal.salts_cemented_on_contact":
    "Les sels QuEChERS secs présents dans {tool} ont pris en masse dès l'humidification ; le contenant est inutilisable.",
  "journal.sample_label_cleared": "Étiquette d'échantillon effacée sur {tool}.",
  "journal.sample_label_cleared_at":
    "Étiquette d'échantillon effacée sur {tool}, sur {location}.",
  "journal.sample_label_updated": "Étiquette d'échantillon mise à jour en {text} sur {tool}.",
  "journal.sample_label_updated_at":
    "Étiquette d'échantillon mise à jour en {text} sur {tool}, sur {location}.",
  "journal.sequence_completed":
    "Séquence LC-MS/MS {run_id} terminée : {injection_count} injection(s), dont {ready_count} avec contexte d'extrait.",
  "journal.sequence_started":
    "Séquence LC-MS/MS {run_id} démarrée : {injection_count} injection(s), {duration} s d'acquisition.",
  "journal.spatula_discarded": "Spatule vidée ({mass} g).",
  "journal.spatula_loaded": "Spatule chargée depuis {source}.",
  "journal.spatula_loaded_at": "Spatule chargée depuis {source}, sur {location}.",
  "journal.spatula_poured": "Poudre transférée dans {target}.",
  "journal.spatula_poured_at": "Poudre transférée dans {target}, sur {location}.",
  "journal.station_added": "Poste {index} ajouté à la paillasse.",
  "journal.station_removed": "{slot} retiré de la paillasse.",
  "journal.tool_discarded": "{tool} jeté depuis {source}.",
  "journal.tool_moved": "{tool} déplacé de {source} vers {target}.",
  "journal.tool_moved_to_equipment": "{tool} déplacé vers {widget}.",
  "journal.tool_opened": "{tool} ouvert sur {location}.",
  "journal.tool_opened_in": "{tool} ouvert dans {location}.",
  "journal.tool_placed": "{tool} posé sur {target}.",
  "journal.tool_placed_in_equipment": "{tool} placé dans {widget}.",
  "journal.tool_placed_in_slot": "{tool} placé dans {target}.",
  "journal.tool_placed_on_equipment": "{tool} posé sur {widget}.",
  "journal.tool_popped_open":
    "{tool} s'est ouvert sous la pression sur {location} à {pressure} bar ; {lost_mass} g de {produce} ont été perdus.",
  "journal.tool_restored_from_trash": "{tool} récupéré de la poubelle vers {target}.",
  "journal.tool_restored_onto_equipment": "{tool} récupéré sur {widget}.",
  "journal.tool_restored_to_equipment": "{tool} récupéré vers {widget}.",
  "journal.tool_sealed": "{tool} fermé sur {location}.",
  "journal.tool_sealed_in": "{tool} fermé dans {location}.",
  "journal.tool_stored": "{tool} rangé dans l'inventaire.",
  "journal.tool_vented":
    "{tool} a relâché sa pression à {pressure} bar sur {location} ; {lost_mass} g de poudre ont été perdus.",
  "journal.tool_vented_in":
    "{tool} a relâché sa pression à {pressure} bar dans {location} ; {lost_mass} g de poudre ont été perdus.",
  "journal.vortex_completed": "{tool} vortexé avec succès sur {widget}.",
  "journal.vortex_started": "Agitateur vortex démarré avec {tool}.",
  "journal.vortexed_unsealed":
    "{tool} a été vortexé sans avoir été fermé ; son contenu s'est répandu et il est inutilisable.",
  "journal.vortexed_without_salts":
    "{tool} a été vortexé sans sels QuEChERS ; ses parois sont contaminées et il est inutilisable.",
  "journal.widget_added": "{widget} posé sur le plan de travail.",
  "journal.widget_liquid_added": "{liquid} ajouté dans {widget}.",
  "journal.widget_liquid_adjusted": "{liquid} ajusté à {mass} g dans {widget}.",
  "journal.widget_liquid_increased": "{liquid} augmenté dans {widget}.",
  "journal.widget_liquid_removed": "{liquid} retiré de {widget}.",
  "journal.widget_moved": "{widget} déplacé sur le plan de travail.",
  "journal.widget_repositioned": "{widget} repositionné sur le plan de travail.",
  "journal.widget_restored_to_inventory": "{widget} récupéré de la poubelle vers l'inventaire.",
  "journal.widget_stored": "{widget} rangé dans l'inventaire.",
};
