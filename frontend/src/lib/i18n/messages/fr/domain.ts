import type { enDomain } from "../en/domain";

export const frDomain: Record<keyof typeof enDomain, string> = {
  // Catalogue de la barre d'outils — contenants
  "catalog.tool.centrifuge_tube_50ml.name": "Tube à centrifuger 50 mL",
  "catalog.tool.centrifuge_tube_50ml.subtitle": "Extraction QuEChERS",
  "catalog.tool.centrifuge_tube_50ml.description":
    "Reçoit la prise d'essai de pomme et le solvant d'extraction avant les sels et la centrifugation.",
  "catalog.tool.sample_vial_lcms.name": "Vial autosampler",
  "catalog.tool.sample_vial_lcms.subtitle": "Prêt à injecter",
  "catalog.tool.sample_vial_lcms.description":
    "Vial autosampler standard servant à charger l'extrait final dans le chromatographe.",
  "catalog.tool.calibration_standard_vial.name": "Vial d'étalon",
  "catalog.tool.calibration_standard_vial.subtitle": "Prêt à l'emploi · choisissez le niveau",
  "catalog.tool.calibration_standard_vial.description":
    "Vial autosampler d'étalon multirésidus, préparé et étiqueté à l'avance par le laboratoire des étalons. Posez-le sur la paillasse ou directement dans le rack et choisissez le niveau en ng/mL — l'étalon interne reste à votre charge.",
  "catalog.tool.hdpe_storage_jar_2l.name": "Bocal PEHD col large",
  "catalog.tool.hdpe_storage_jar_2l.subtitle": "Stockage de poudre en vrac",
  "catalog.tool.hdpe_storage_jar_2l.description":
    "Bocal de stockage PEHD de 2 L à col large et bouchon à vis épais, pour manipuler l'homogénat en vrac au froid et hermétiquement.",
  "catalog.tool.sealed_sampling_bag.name": "Sachet d'échantillonnage scellé",
  "catalog.tool.sealed_sampling_bag.subtitle": "Prélèvement terrain",
  "catalog.tool.sealed_sampling_bag.description":
    "Sachet de prélèvement inviolable pour des fruits scellés ou une réception terrain.",
  "catalog.tool.cutting_board_hdpe.name": "Planche à découper",
  "catalog.tool.cutting_board_hdpe.subtitle": "Surface de préparation",
  "catalog.tool.cutting_board_hdpe.description":
    "Planche de préparation propre servant à disposer les pommes avant la découpe.",

  // Catalogue de la barre d'outils — réactifs et matières
  "catalog.liquid.acetonitrile_extraction.name": "Acétonitrile",
  "catalog.liquid.acetonitrile_extraction.subtitle": "Solvant d'extraction",
  "catalog.liquid.acetonitrile_extraction.description":
    "Solvant d'extraction principal du protocole QuEChERS.",
  "catalog.liquid.apple_extract.name": "Extrait de pomme",
  "catalog.liquid.apple_extract.subtitle": "Échantillon homogénéisé",
  "catalog.liquid.apple_extract.description":
    "Homogénat de pomme cryogénique représentant la matrice de l'échantillon entrant.",
  "catalog.liquid.ultrapure_water_rinse.name": "Eau ultrapure",
  "catalog.liquid.ultrapure_water_rinse.subtitle": "Rinçage / dilution",
  "catalog.liquid.ultrapure_water_rinse.description":
    "Liquide d'appoint pour rincer ou diluer simplement pendant la mise en place.",
  "catalog.liquid.dry_ice_pellets.name": "Pastilles de carboglace",
  "catalog.liquid.dry_ice_pellets.subtitle": "Refroidissement cryogénique",
  "catalog.liquid.dry_ice_pellets.description":
    "Pastilles de CO2 solide utilisées pour manipuler au froid et préparer la chaîne du froid dans le broyeur cryogénique.",
  "catalog.liquid.quechers_salts.name": "Sachet de sels QuEChERS",
  "catalog.liquid.quechers_salts.subtitle": "Sachet de sels d'extraction",
  "catalog.liquid.quechers_salts.description":
    "Sels d'extraction pré-dosés qui déclenchent la réaction de partition QuEChERS, exothermique.",
  "catalog.liquid.istd_solution.name": "Solution d'étalon interne",
  "catalog.liquid.istd_solution.subtitle":
    "100 ng/mL · atrazine-d5 / imidaclopride-d4 / deltaméthrine-d6",
  "catalog.liquid.istd_solution.description":
    "Solution d'étalon interne prémélangée — atrazine-d5, imidaclopride-d4 et deltaméthrine-d6 à 100 ng/mL chacun dans l'acétonitrile. Ajoutée à l'extrait final avant l'injection LC-MS/MS pour corriger l'effet de matrice et quantifier les analytes.",
  "catalog.liquid.calibration_solution.name": "Solution mère multirésidus",
  "catalog.liquid.calibration_solution.subtitle": "Tous les pesticides · niveau libre (ng/mL)",
  "catalog.liquid.calibration_solution.description":
    "Solution mère d'étalonnage multirésidus contenant tous les pesticides suivis à concentration certifiée dans l'acétonitrile. Glissez-la sur un vial autosampler et choisissez le niveau d'étalonnage en ng/mL pour préparer un étalon.",

  // Catalogue de la barre d'outils — équipements de paillasse
  "catalog.widget.autosampler_rack_widget.name": "Rack autosampler",
  "catalog.widget.autosampler_rack_widget.subtitle": "Préparation de séquence",
  "catalog.widget.autosampler_rack_widget.description":
    "Rack servant à organiser les vials prêts à injecter avant une séquence LC-MS/MS.",
  "catalog.widget.lc_msms_instrument_widget.name": "LC-MS/MS",
  "catalog.widget.lc_msms_instrument_widget.subtitle": "Système instrumental",
  "catalog.widget.lc_msms_instrument_widget.description":
    "Système LC-MS/MS pédagogique, avec des modules visuels LC et MS/MS distincts.",
  "catalog.widget.cryogenic_grinder_widget.name": "Broyeur cryogénique",
  "catalog.widget.cryogenic_grinder_widget.subtitle": "Homogénéisation à froid",
  "catalog.widget.cryogenic_grinder_widget.description":
    "Broyeur de paillasse servant à homogénéiser les fruits refroidis avant l'extraction.",
  "catalog.widget.vortex_mixer_widget.name": "Agitateur vortex",
  "catalog.widget.vortex_mixer_widget.subtitle": "Agitation des tubes",
  "catalog.widget.vortex_mixer_widget.description":
    "Vortex de paillasse servant à mélanger les tubes à centrifuger.",
  "catalog.widget.centrifuge_widget.name": "Centrifugeuse",
  "catalog.widget.centrifuge_widget.subtitle": "Séparation des phases",
  "catalog.widget.centrifuge_widget.description":
    "Centrifugeuse de paillasse servant à séparer l'extrait QuEChERS en phases visibles.",
  "catalog.widget.ice_bath_widget.name": "Bain de glace",
  "catalog.widget.ice_bath_widget.subtitle": "Refroidissement des tubes",
  "catalog.widget.ice_bath_widget.description":
    "Bac d'eau glacée servant à refroidir un tube et à contenir l'exotherme QuEChERS.",
  "catalog.widget.lims_terminal_widget.name": "Terminal LIMS",
  "catalog.widget.lims_terminal_widget.subtitle": "Enregistrement de l'échantillon",
  "catalog.widget.lims_terminal_widget.description":
    "Terminal servant à enregistrer l'échantillon et à imprimer l'étiquette du laboratoire.",
  "catalog.widget.gross_balance_widget.name": "Balance de réception",
  "catalog.widget.gross_balance_widget.subtitle": "Pesée à réception",
  "catalog.widget.gross_balance_widget.description":
    "Balance de paillasse servant à relever la masse brute du sachet entrant.",
  "catalog.widget.analytical_balance_widget.name": "Balance analytique",
  "catalog.widget.analytical_balance_widget.subtitle": "Prise d'essai",
  "catalog.widget.analytical_balance_widget.description":
    "Balance de précision servant à tarer le tube Falcon et à peser la prise d'essai QuEChERS de 10,000 g.",

  // Catalogue de la barre d'outils — divers
  "catalog.label.sampling_bag_label.name": "Étiquette",
  "catalog.label.sampling_bag_label.subtitle": "Note libre",
  "catalog.label.sampling_bag_label.description":
    "Étiquette adhésive manuelle, au texte libre modifiable.",

  // Catégories de la barre d'outils
  "catalog.category.prep_tools.label": "Contenants",
  "catalog.category.prep_tools.description":
    "Contenants de paillasse utilisés de l'extraction à la purification, avant injection.",
  "catalog.category.workflow_liquids.label": "Réactifs & matières",
  "catalog.category.workflow_liquids.description":
    "Réactifs et matières d'appoint du protocole d'extraction des pesticides.",
  "catalog.category.workspace_equipment.label": "Équipements de paillasse",
  "catalog.category.workspace_equipment.description":
    "Grands systèmes de laboratoire que l'on peut poser sur le plan de travail.",
  "catalog.category.misc.label": "DIVERS",
  "catalog.category.misc.description":
    "Fourre-tout temporaire pour les objets de laboratoire pas encore rangés ailleurs.",

  // Équipements posés sur le plan de travail, adressés par type
  "widget.workbench": "Paillasse",
  "widget.trash": "Poubelle",
  "widget.autosampler_rack": "Rack autosampler",
  "widget.lc_msms_instrument": "LC-MS/MS",
  "widget.cryogenic_grinder": "Broyeur cryogénique",
  "widget.produce_basket": "Panier de fruits",
  "widget.lims_terminal": "Terminal LIMS",
  "widget.gross_balance": "Balance de réception",
  "widget.analytical_balance": "Balance analytique",
  "widget.vortex_mixer": "Agitateur vortex",
  "widget.centrifuge": "Centrifugeuse",
  "widget.ice_bath": "Bain de glace",

  // Emplacements
  "slot.bench": "Poste {index}",
  "slot.rack": "Position {index}",

  // Fruits et matières
  "produce.appleLot": "Lot de pommes {index}",
  "produce.orchardAppleLot": "Lot de pommes du verger",
  "produce.apple": "Pomme",
  "produce.applePowderLot": "Lot de poudre de pomme",
  "produce.received": "Sachet d'échantillonnage reçu",
  "produce.powderSuffix": "{label} en poudre",
  "produce.unitCount.one": "{count} unité",
  "produce.unitCount.other": "{count} unités",
  "produce.material.whole": "Entier",
  "produce.material.cut": "Découpé",
  "produce.material.ground": "Broyé",
  "produce.material.slurry": "Suspension",
  "produce.material.waste": "Déchet",

  // Statut de l'expérience
  "status.preparing": "En préparation",

  // Ground material naming
  "produce.powderWord": "poudre",


  // Labels the backend sets outside the catalogue
  "label.receivedSamplingBag": "Sachet d'échantillonnage reçu",
  "label.fieldReception": "Réception terrain",

};
