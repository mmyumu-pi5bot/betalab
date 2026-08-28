// Vocabulary the backend addresses by stable id — catalogue entries, widget
// types, slot ids, material states. The API keeps sending its English label as
// a fallback, but every id listed here is rendered from the catalogue instead,
// so a French session never shows an English container name.
export const enDomain = {
  // Toolbar catalogue — containers
  "catalog.tool.centrifuge_tube_50ml.name": "50 mL centrifuge tube",
  "catalog.tool.centrifuge_tube_50ml.subtitle": "QuEChERS extraction",
  "catalog.tool.centrifuge_tube_50ml.description":
    "Receives apple sample and extraction solvent before salts and centrifugation.",
  "catalog.tool.sample_vial_lcms.name": "Autosampler vial",
  "catalog.tool.sample_vial_lcms.subtitle": "Injection ready",
  "catalog.tool.sample_vial_lcms.description":
    "Standard autosampler vial used to load the final extract into the chromatograph.",
  "catalog.tool.calibration_standard_vial.name": "Calibration standard vial",
  "catalog.tool.calibration_standard_vial.subtitle": "Ready to use · choose the level",
  "catalog.tool.calibration_standard_vial.description":
    "Autosampler vial of multi-residue calibration standard, prepared and labelled in advance by the standards lab. Drop it on the bench or straight into the rack and pick the level in ng/mL — the internal standard is still yours to spike.",
  "catalog.tool.hdpe_storage_jar_2l.name": "Wide-neck HDPE jar",
  "catalog.tool.hdpe_storage_jar_2l.subtitle": "Bulk powder storage",
  "catalog.tool.hdpe_storage_jar_2l.description":
    "Wide-mouth 2 L HDPE storage jar with a thick screw cap for cold, sealed bulk homogenate handling.",
  "catalog.tool.sealed_sampling_bag.name": "Sealed sampling bag",
  "catalog.tool.sealed_sampling_bag.subtitle": "Field collection",
  "catalog.tool.sealed_sampling_bag.description":
    "Tamper-evident sample collection bag for sealed produce or field intake.",
  "catalog.tool.cutting_board_hdpe.name": "Cutting board",
  "catalog.tool.cutting_board_hdpe.subtitle": "Prep surface",
  "catalog.tool.cutting_board_hdpe.description":
    "Clean prep board used to stage apples before cutting.",

  // Toolbar catalogue — reagents and materials
  "catalog.liquid.acetonitrile_extraction.name": "Acetonitrile",
  "catalog.liquid.acetonitrile_extraction.subtitle": "Extraction solvent",
  "catalog.liquid.acetonitrile_extraction.description":
    "Primary extraction solvent used in the QuEChERS workflow.",
  "catalog.liquid.apple_extract.name": "Apple extract",
  "catalog.liquid.apple_extract.subtitle": "Homogenized sample",
  "catalog.liquid.apple_extract.description":
    "Cryogenic apple homogenate represented as the incoming sample matrix.",
  "catalog.liquid.ultrapure_water_rinse.name": "Ultrapure water",
  "catalog.liquid.ultrapure_water_rinse.subtitle": "Rinse / dilution",
  "catalog.liquid.ultrapure_water_rinse.description":
    "Support liquid for rinsing or simple dilution during setup.",
  "catalog.liquid.dry_ice_pellets.name": "Dry ice pellets",
  "catalog.liquid.dry_ice_pellets.subtitle": "Cryogenic cooling",
  "catalog.liquid.dry_ice_pellets.description":
    "Solid CO2 pellets used for chilled handling and cold-chain prep in the cryogenic grinder.",
  "catalog.liquid.quechers_salts.name": "QuEChERS salts packet",
  "catalog.liquid.quechers_salts.subtitle": "Extraction salts packet",
  "catalog.liquid.quechers_salts.description":
    "Pre-portioned extraction salts that trigger the exothermic QuEChERS partitioning reaction.",
  "catalog.liquid.istd_solution.name": "ISTD solution",
  "catalog.liquid.istd_solution.subtitle":
    "100 ng/mL · atrazine-d5 / imidacloprid-d4 / deltamethrin-d6",
  "catalog.liquid.istd_solution.description":
    "Pre-mixed internal standard solution — atrazine-d5, imidacloprid-d4 and deltamethrin-d6 at 100 ng/mL each in acetonitrile. Added to the final extract before LC-MS/MS injection for matrix effect correction and analyte quantification.",
  "catalog.liquid.calibration_solution.name": "Multi-residue stock solution",
  "catalog.liquid.calibration_solution.subtitle": "All pesticides · free level (ng/mL)",
  "catalog.liquid.calibration_solution.description":
    "Multi-residue calibration stock solution containing all monitored pesticides at certified concentration in acetonitrile. Drag onto an autosampler vial and choose the calibration level in ng/mL to prepare a calibration standard.",

  // Toolbar catalogue — workspace equipment
  "catalog.widget.autosampler_rack_widget.name": "Autosampler rack",
  "catalog.widget.autosampler_rack_widget.subtitle": "Sequence staging",
  "catalog.widget.autosampler_rack_widget.description":
    "Rack widget used to organize injection-ready vials before an LC-MS/MS run.",
  "catalog.widget.lc_msms_instrument_widget.name": "LC-MS/MS",
  "catalog.widget.lc_msms_instrument_widget.subtitle": "Instrument system",
  "catalog.widget.lc_msms_instrument_widget.description":
    "Pedagogical LC-MS/MS system widget with separate LC and MS/MS visual modules.",
  "catalog.widget.cryogenic_grinder_widget.name": "Cryogenic grinder",
  "catalog.widget.cryogenic_grinder_widget.subtitle": "Cold homogenization",
  "catalog.widget.cryogenic_grinder_widget.description":
    "Benchtop grinder used to homogenize chilled produce before extraction.",
  "catalog.widget.vortex_mixer_widget.name": "Vortex mixer",
  "catalog.widget.vortex_mixer_widget.subtitle": "Tube agitation",
  "catalog.widget.vortex_mixer_widget.description":
    "Benchtop vortex used to mix centrifuge tubes.",
  "catalog.widget.centrifuge_widget.name": "Centrifuge",
  "catalog.widget.centrifuge_widget.subtitle": "Phase separation",
  "catalog.widget.centrifuge_widget.description":
    "Benchtop centrifuge used to separate the QuEChERS extract into visible phases.",
  "catalog.widget.ice_bath_widget.name": "Ice bath",
  "catalog.widget.ice_bath_widget.subtitle": "Tube chilling",
  "catalog.widget.ice_bath_widget.description":
    "Tray of ice water used to chill a tube and hold the QuEChERS exotherm down.",
  "catalog.widget.lims_terminal_widget.name": "LIMS terminal",
  "catalog.widget.lims_terminal_widget.subtitle": "Sample login",
  "catalog.widget.lims_terminal_widget.description":
    "Terminal used to register the sample and print the lab label.",
  "catalog.widget.gross_balance_widget.name": "Gross balance",
  "catalog.widget.gross_balance_widget.subtitle": "Receiving weight",
  "catalog.widget.gross_balance_widget.description":
    "Bench balance used to record the incoming bag gross mass.",
  "catalog.widget.analytical_balance_widget.name": "Analytical balance",
  "catalog.widget.analytical_balance_widget.subtitle": "Sample intake",
  "catalog.widget.analytical_balance_widget.description":
    "Precision balance used to tare the Falcon tube and capture the 10.000 g QuEChERS test portion.",

  // Toolbar catalogue — misc
  "catalog.label.sampling_bag_label.name": "Label",
  "catalog.label.sampling_bag_label.subtitle": "Free note",
  "catalog.label.sampling_bag_label.description":
    "Manual adhesive label with editable free text.",

  // Toolbar categories
  "catalog.category.prep_tools.label": "Containers",
  "catalog.category.prep_tools.description":
    "Bench containers used from extraction to cleanup before injection.",
  "catalog.category.workflow_liquids.label": "Reagents & materials",
  "catalog.category.workflow_liquids.description":
    "Reagents and supporting materials for the pesticide extraction workflow.",
  "catalog.category.workspace_equipment.label": "Workspace equipment",
  "catalog.category.workspace_equipment.description":
    "Large lab systems that can be dropped onto the open workspace canvas.",
  "catalog.category.misc.label": "MISC",
  "catalog.category.misc.description":
    "Temporary catch-all for supporting lab items not yet grouped elsewhere.",

  // Placed workspace equipment, addressed by widget type
  "widget.workbench": "Workbench",
  "widget.trash": "Trash",
  "widget.autosampler_rack": "Autosampler rack",
  "widget.lc_msms_instrument": "LC-MS/MS",
  "widget.cryogenic_grinder": "Cryogenic grinder",
  "widget.produce_basket": "Produce basket",
  "widget.lims_terminal": "LIMS terminal",
  "widget.gross_balance": "Gross balance",
  "widget.analytical_balance": "Analytical balance",
  "widget.vortex_mixer": "Vortex mixer",
  "widget.centrifuge": "Centrifuge",
  "widget.ice_bath": "Ice bath",

  // Slots
  "slot.bench": "Station {index}",
  "slot.rack": "Position {index}",

  // Produce
  "produce.appleLot": "Apple lot {index}",
  "produce.orchardAppleLot": "Orchard apple lot",
  "produce.apple": "Apple",
  "produce.applePowderLot": "Apple powder lot",
  "produce.received": "Received sampling bag",
  "produce.powderSuffix": "{label} powder",
  "produce.unitCount.one": "{count} unit",
  "produce.unitCount.other": "{count} units",
  "produce.material.whole": "Whole",
  "produce.material.cut": "Cut",
  "produce.material.ground": "Ground",
  "produce.material.slurry": "Slurry",
  "produce.material.waste": "Waste",

  // Experiment status
  "status.preparing": "Preparing",

  // Ground material naming
  "produce.powderWord": "powder",


  // Labels the backend sets outside the catalogue
  "label.receivedSamplingBag": "Received sampling bag",
  "label.fieldReception": "Field reception",

} as const;
