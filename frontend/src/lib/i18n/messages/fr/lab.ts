import type { enLab } from "../en/lab";

export const frLab: Record<keyof typeof enLab, string> = {

  // Experiment header and journal drawer
  "header.backToExperiments": "Retour aux expériences",
  "header.experiments": "Expériences",
  "header.workspace": "Plan de travail du laboratoire",
  "header.experimentName": "Nom de l'expérience",
  "header.renameExperiment": "Renommer l'expérience",
  "header.syncing": "Synchronisation...",
  "header.saved": "Enregistré",
  "header.loadError": "Impossible de charger la paillasse",
  "header.mutationError": "L'action sur l'expérience a échoué",
  "header.renameError": "Impossible de renommer l'expérience",
  "journal.open": "Ouvrir le journal de l'expérience",
  "journal.title": "Journal de l'expérience",
  "journal.short": "Journal",
  "journal.history": "Historique",
  "journal.subtitle": "Actions métier, événements de simulation et alertes.",
  "journal.close": "Fermer le journal",
  "journal.empty": "Aucune entrée de journal pour l'instant",
  "journal.emptyHint": "Les actions marquantes de l'expérience apparaîtront ici.",
  "journal.category.system": "Système",
  "journal.category.manipulation": "Manipulation",
  "journal.category.simulation": "Simulation",
  "journal.category.layout": "Disposition",


  // Produce lot card
  "produceCard.jammed": "Bourré",


  // Produce basket widget
  "basket.title": "Panier de fruits",
  "basket.open.one": "Ouvrir le panier de fruits ({count} élément)",
  "basket.open.other": "Ouvrir le panier de fruits ({count} éléments)",
  "basket.createBag": "Créer un sachet de pommes reçu",
  "basket.createBagHint":
    "Ajouter un nouveau sachet d'échantillon entrant avec les informations de l'étiquette terrain.",
  "basket.contents": "Contenu du panier",
  "basket.fieldLabelAttached": "Étiquette terrain apposée",
  "basket.receivedBag": "Sachet d'échantillonnage reçu",
  "basket.empty": "Aucun lot de fruits créé pour l'instant.",


  // Trash widget
  "trash.title": "Poubelle",
  "trash.workspaceWidget": "Équipement de paillasse",
  "trash.untitledLabel": "Étiquette sans texte",
  "trash.empty": "La poubelle est vide.",


  // Workbench, rack and equipment widgets
  "workbench.addStation": "Ajouter un poste de paillasse",
  "workbench.removeStation": "Retirer {slot}",
  "workbench.readyForOperations": "Prêt pour les manipulations.",
  "workbench.produceOnStation": "Des fruits reposent directement sur le poste.",
  "workbench.waitingForTool": "En attente d'un premier outil.",
  "workbench.stationSurface": "Surface du poste",
  "workbench.emptyStation": "Poste vide",
  "rack.dragToInstrument": "Glissez le rack dans le LC-MS/MS",
  "rack.noVialStaged": "Aucun vial préparé pour l'instant.",
  "tool.knife": "Couteau en acier inoxydable",
  "tool.spatula": "Spatule à poudre",
  "tool.pipette": "Micropipette",
  "actionBar.title": "Outils",
  "grossBalance.gross": "Brut",
  "grossBalance.decreaseOffset": "Diminuer le décalage de la balance de réception",
  "grossBalance.increaseOffset": "Augmenter le décalage de la balance de réception",
  "centrifuge.running": "Centrifugation…",
  "centrifuge.start": "Démarrer la centrifugeuse",
  "centrifuge.separating": "Séparation",
  "vortex.running": "Vortex en marche",
  "vortex.start": "Démarrer le vortex",
  "vortex.mixing": "Mélange",
  "vortex.systemReady": "Système prêt",
  "vortex.awaitingTube": "En attente d'un tube",
  "equipment.ready": "Prêt",
  "equipment.idle": "À l'arrêt",
  "iceBath.chilling":
    "Refroidissement en cours. Les sels libèrent la même chaleur quelle que soit la température de départ du tube : partir froid fait donc culminer l'exotherme plus bas.",
  "iceBath.idle":
    "Posez un tube ici pour le refroidir avant d'ajouter les sels, ou pour faire redescendre un tube en pleine réaction.",


  // Action bar
  "actionBar.actions": "Actions",


  // Bench tool card
  "toolCard.popped": "Ouvert sous pression",
  "toolCard.sealed": "Fermé",
  "toolCard.openState": "Ouvert",
  "toolCard.store": "Ranger {tool} dans l'inventaire",
  "toolCard.storeShort": "Ranger dans l'inventaire",
  "toolCard.emptyBeforeStoring": "Videz cet outil avant de le ranger",
  "toolCard.open": "Ouvrir",
  "toolCard.close": "Fermer",
  "toolCard.openTool": "Ouvrir {tool}",
  "toolCard.closeTool": "Fermer {tool}",
  "toolCard.readyForProduceIntake": "Prêt à recevoir un lot de fruits",
  "toolCard.readyForProduceStaging": "Prêt à accueillir des fruits",
  "toolCard.powderReservoirLoaded": "Réservoir de poudre chargé",
  "toolCard.readyForSpatulaLoading": "Prêt pour un prélèvement à la spatule",
  "toolCard.slurryPresent": "Suspension présente",
  "toolCard.powderDepositPresent": "Dépôt de poudre présent",
  "toolCard.readyForPowderDosing": "Prêt pour le dosage de poudre",
  "toolCard.readyForLiquids": "Prêt pour l'ajout de liquides",
  "toolCard.sampleLabelText": "Texte de l'étiquette d'échantillon",
  "toolCard.writeNote": "Écrivez une note",
  "toolCard.declaredContents": "Contenu déclaré",
  "toolCard.separatedPhases": "Phases séparées",
  "toolCard.supernatant": "Surnageant",
  "toolCard.pellet": "Culot",
  "toolbar.inventory": "Inventaire",
  "toolbar.samplingLabel": "Étiquette d'échantillonnage",
  "grinder.running": "Broyeur en marche",
  "grinder.start": "Démarrer le broyeur",
  "grinder.wholeFruitDetected": "Fruit entier détecté",
  "grinder.discardJammedWaste": "Évacuer le déchet coincé",
  "grinder.productNotColdEnough": "Produit pas assez froid",
  "grinder.highTorque": "Couple élevé détecté",
  "grinder.unloadGroundProduct": "Décharger le produit broyé",
  "grinder.systemReady": "Système prêt",
  "grinder.awaitingLoad": "En attente de chargement",
  "grinder.groundProduct": "Produit broyé",
  "grinder.groundProductWithMetadata": "Produit broyé • {metadata}",
  "grinder.jammedWaste": "Déchet coincé",
  "grinder.jammedWasteWithMetadata": "Déchet coincé • {metadata}",
  "grinder.coolingMedium": "Agent de refroidissement",
  "degassing.indicator": "Indicateur de dégazage",
  "degassing.tooltip": "Dégazage",
  "pipette.loaded": "Pipette chargée",
  "pipette.empty": "Pipette vide",


  // Grinder readouts, spatula and pipette hints
  "grinder.progress": "Avancement {percent} %",
  "grinder.torqueHigh": "Couple élevé",
  "grinder.cycle30s": "Cycle 30 s",
  "grinder.loadNominal": "Charge nominale",
  "grinder.jamRisk": "Risque de bourrage",
  "grinder.loadReady": "Charge prête",
  "grinder.rotorStopped": "Rotor à l'arrêt",
  "grinder.loadTooHigh": "Charge trop élevée",
  "grinder.startLock": "Démarrage verrouillé",
  "grinder.cryoMode": "Mode cryo",
  "grinder.preCoolNow": "Pré-refroidir",
  "grinder.cryoArmed": "Cryo armé",
  "grinder.unloadLot": "Décharger le lot",
  "grinder.cutFirst": "Découper d'abord",
  "grinder.preCool": "Pré-refroidissement",
  "grinder.cycleReady": "Cycle prêt",
  "grinder.noSample": "Aucun échantillon",
  "grinder.dryIceDraftMass": "Masse de carboglace à doser",
  "draft.dose": "Doser {liquid}",
  "draft.volume": "Volume",
  "draft.liquidDraftVolume": "Volume de {liquid} à doser",
  "draft.liquidFallback": "Liquide",
  "draft.spawn": "Créer",
  "draft.configureApplePowder": "Configurer la poudre de pomme",
  "draft.configureAppleSlurry": "Configurer la suspension de pomme",
  "draft.configurePreset": "Configurer {preset}",
  "draft.takeVial": "Prendre le vial",
  "draft.pickCalibrationLevel": "Choisir le niveau d'étalonnage",
  "spatula.pourHint": "Cliquez pour verser un peu · Maintenez et soulevez pour verser plus vite.",
  "spatula.loadHint":
    "Cliquez sur un contenant ouvert contenant de la poudre pour charger la spatule.",
  "spatula.emptyHint": "La spatule est vide. Chargez-la d'abord depuis un contenant ouvert.",
  "spatula.pouring": "Versement en cours...",
  "spatula.loading": "Chargement de la spatule...",
  "pipetteHint.loaded":
    "Pipette chargée à {volume} / {capacity} mL · Maintenez au-dessus d'un contenant pour distribuer.",
  "pipetteHint.empty": "Pipette vide · Maintenez au-dessus d'un liquide pour aspirer.",
  "pipetteHint.chooseTarget":
    "La pipette est chargée : choisissez un contenant ouvert capable de recevoir du liquide.",
  "pipetteHint.chooseSource":
    "La pipette est vide : choisissez un contenant ouvert contenant du liquide.",
  "pipetteHint.aspirating": "Aspiration… relâchez au volume voulu.",
  "pipetteHint.dispensing": "Distribution… relâchez au volume voulu.",
  "temperature.cryogenic": "Cryogénique",
  "temperature.coolingFast": "Refroidissement rapide",
  "temperature.nearAmbient": "Proche de l'ambiante",
  "debug.objectFallback": "Objet",


  // Draft form labels
  "draft.mass": "Masse",
  "draft.dryIceFallback": "Pastilles de carboglace",


  // Temperature status
  "temperature.hot": "Chaud",
  "temperature.warm": "Tiède",


  // Workspace canvas
  "workspace.storeInInventory": "Ranger dans l'inventaire",
  "workspace.emptyBeforeStoring": "Videz cet équipement avant de le ranger",
  "instrument.footer.completed":
    "Acquisition terminée. Les résultats de l'instrument sont disponibles ci-dessous.",
  "instrument.footer.running":
    "Acquisition en cours. Le rack reste verrouillé jusqu'à l'enregistrement de la dernière injection.",
  "instrument.footer.ready":
    "Rack chargé. La séquence d'acquisition peut maintenant être configurée et lancée.",
  "instrument.footer.dragRack":
    "Glissez le rack préparé sur le LC-MS/MS pour le charger dans l'autosampler.",
  "instrument.footer.emptyRack":
    "Placez au moins un vial autosampler dans le rack avant de le charger.",
  "instrument.startRun": "Lancer la séquence d'acquisition",
  "instrument.closeConsole": "Fermer la console d'acquisition",
  "instrument.openConsole": "Ouvrir la console d'acquisition",
  "centrifuge.addTube": "Ajoutez un tube à centrifuger.",


  // Lab scene shell and tutorial restart
  "lab.restartTutorialConfirm": "Redémarrer le tutoriel et supprimer cette expérience dédiée ?",
  "lab.restartTutorialError": "Impossible de redémarrer le tutoriel pour le moment.",
  "lab.brand": "Betalab",
  "lab.workspace": "Plan de travail du laboratoire",
  "lab.creating": "Création de la paillasse pesticides depuis le backend...",
  "lab.calibrationLevelAria": "Niveau d'étalonnage en ng/mL",
  "lab.calibrationLevelLabel": "Niveau",
  "draft.add": "Ajouter",


  // Lab scene error state
  "lab.backendError": "Erreur de connexion au backend",
  "lab.retry": "Réessayer",


  // Debug palette presets and draft fields
  "debug.preset.applePowderLot": "Lot de poudre de pomme",
  "debug.preset.appleSlurryTube.name": "Tube de suspension de pomme",
  "debug.preset.appleSlurryTube.description":
    "Tube de débogage prérempli de suspension de pomme.",
  "debug.preset.vortexedSlurryTube.name": "Tube de suspension vortexé",
  "debug.preset.vortexedSlurryTube.description":
    "Tube de débogage dont la suspension de pomme est déjà salée, fermée et vortexée — déposez-le directement dans la centrifugeuse.",
  "debug.preset.centrifugedSlurryTube.name": "Tube de suspension centrifugé",
  "debug.preset.centrifugedSlurryTube.description":
    "Tube de débogage passé par toute la préparation QuEChERS et centrifugé — ouvert, avec un surnageant pipetable prêt à transférer dans un vial du rack.",
  "debug.preset.calibrationStockTube.name": "Tube de solution mère d'étalonnage",
  "debug.preset.calibrationStockTube.description":
    "Tube à centrifuger de débogage rempli d'un étalon multirésidus — pipetez-le vous-même dans un vial du rack ; la pipette transporte l'identité d'étalonnage.",
  "debug.preset.preparedAppleVial.name": "Vial de pomme préparé",
  "debug.preset.preparedAppleVial.subtitle": "Vial autosampler · extrait de pomme",
  "debug.preset.preparedAppleVial.description":
    "Vial autosampler de débogage contenant un extrait de pomme terminé — toute la chaîne broyage, extraction et pipetage est sautée. Déposez-le directement dans le rack et injectez.",
  "debug.preset.appleSlurry": "Suspension de pomme",
  "debug.detail.appleExtract": "1 mL d'extrait de pomme",
  "debug.detail.calibration": "Étalon à 100 ng/mL",
  "debug.detail.appleSlurry": "10 g de suspension de pomme",
  "debug.field.powderMass": "Masse de poudre (débogage)",
  "debug.field.powderTemperature": "Température de la poudre (débogage)",
  "debug.field.powderResidualCo2": "CO2 résiduel de la poudre (débogage)",
  "debug.field.slurryAppleMass": "Masse de pomme de la suspension (débogage)",
  "debug.field.slurryTemperature": "Température de la suspension (débogage)",
  "debug.field.calibrationLevel": "Niveau de la solution mère d'étalonnage (débogage)",
  "debug.field.extractAppleMass": "Masse de pomme de l'extrait (débogage)",
  "debug.field.extractSolventVolume": "Volume de solvant de l'extrait (débogage)",
  "debug.field.extractionRecovery": "Rendement d'extraction (débogage)",
  "debug.field.samplingAccuracy": "Justesse d'échantillonnage (débogage)",
  "debug.field.extractIstdVolume": "Volume d'étalon interne de l'extrait (débogage)",
  "draft.temperature": "Température",
  "draft.residualCo2": "CO2 résiduel",
  "draft.appleMass": "Masse de pomme",
  "draft.level": "Niveau",
  "draft.extractVolume": "Volume d'extrait",
  "draft.recovery": "Rendement",
  "draft.samplingAccuracy": "Justesse d'échantillonnage",
  "draft.istdVolume": "Volume d'étalon interne",


  // Debug preset subtitles
  "debug.preset.tube50": "Tube à centrifuger 50 mL",
  "debug.preset.tube50ReadyToSpin": "Tube à centrifuger 50 mL · prêt à centrifuger",
  "debug.preset.tube50ReadyToPipette": "Tube à centrifuger 50 mL · prêt à pipeter",
  "debug.preset.tube50Standard": "Tube 50 mL · étalon à 100 ng/mL",


  // LIMS terminal
  "lims.eyebrow": "LIMS",
  "lims.screen": "Écran du terminal LIMS",
  "lims.awaitingAccession": "En attente d'enregistrement",
  "lims.awaitingHint": "Pesée relevée automatiquement. Saisissez l'origine de l'échantillon.",
  "lims.orchardLine": "Verger : {value}",
  "lims.harvestDateLine": "Date de récolte : {value}",
  "lims.declaredMassLine": "Masse déclarée : {value}",
  "lims.sampleMassLine": "Masse d'échantillon : {value}",
  "lims.sampleCodeLine": "Code échantillon : {value}",
  "lims.statusLine": "Statut : {value}",
  "lims.statusWaiting": "en attente de saisie",
  "lims.receptionRecord": "Fiche de réception",
  "lims.status.awaiting_reception": "en attente de réception",
  "lims.status.awaiting_label_application": "en attente d'étiquetage",
  "lims.status.received": "reçu",
  "lims.reviewMass": "Vérifier le calcul de masse à réception",
  "lims.reviewed": "Vérifié",
  "lims.review": "Vérifier",
  "lims.declaredMass": "Masse déclarée",
  "lims.measuredGross": "Brut mesuré",
  "lims.packagingTare": "Tare de l'emballage",
  "lims.measuredNet": "Net mesuré",
  "lims.record": "Fiche",
  "lims.newEntry": "Nouvelle fiche",
  "lims.unnumberedEntry": "Fiche sans numéro",
  "lims.orchardProducer": "Verger / producteur",
  "lims.enterOrchard": "Saisissez le verger ou le producteur",
  "lims.harvestDate": "Date de récolte",
  "lims.declaredMassField": "Masse déclarée sur l'étiquette du sachet (g)",
  "lims.sampleMassField": "Masse d'échantillon (g)",
  "lims.createRecord": "Créer la fiche LIMS",
  "lims.updateRecord": "Mettre à jour la fiche LIMS",
  "lims.printLabel": "Imprimer l'étiquette",


  // API failures
  "api.inspectDebug": "Impossible d'inspecter l'état de débogage",
  "api.mutation": "Échec de l'envoi de l'action sur l'expérience",
  "api.createExperiment": "Échec de la création de l'expérience",
  "api.fetchExperiment": "Échec de la récupération de l'expérience",
  "api.fetchExperiments": "Échec de la récupération des expériences",
  "api.duplicateExperiment": "Échec de la duplication de l'expérience",
  "api.deleteExperiment": "Échec de la suppression de l'expérience",
  "api.fetchToolbar": "Échec de la récupération du catalogue d'outils",
  "api.fetchMethods": "Échec de la récupération des méthodes d'acquisition",
  "api.fetchMethod": "Échec de la récupération de la méthode d'acquisition",
  "api.fetchMrmCatalog": "Échec de la récupération du catalogue MRM de référence",
  "api.proposeTransitions": "Échec de la proposition de transitions",
  "api.duplicateMethod": "Échec de la duplication de la méthode d'acquisition",
  "api.saveMethod": "Échec de l'enregistrement de la méthode d'acquisition",
  "api.deleteMethod": "Échec de la suppression de la méthode d'acquisition",
  "api.parseStream": "Échec de l'analyse du flux de l'expérience",
  "api.untitledExperiment": "Expérience sans titre",


  // Equipment illustrations
  "illustration.appleLot": "Illustration du lot de pommes",
  "illustration.wasteBin": "Poubelle de laboratoire",
  "illustration.iceBath": "Bain de glace",
  "illustration.instrument": "Illustration de l'instrument LC-MS/MS",
  "illustration.centrifuge": "Centrifugeuse de paillasse",
  "illustration.limsPrinter": "Imprimante d'étiquettes LIMS",
  "illustration.rack": "Illustration du rack autosampler",
  "illustration.grinder": "Illustration du broyeur cryogénique",
  "illustration.vortex": "Illustration de l'agitateur vortex",

  // Libellés visibles restés en dur dans le JSX lors de la première passe
  "draft.cancel": "Annuler",
  "sampleLabel.sampleId": "Identifiant échantillon",
  "grossBalance.offset": "Décalage",
  "grossBalance.dropObject": "Déposez un objet ici",
  "analyticalBalance.mass": "Masse",
  "analyticalBalance.tare": "Tare",
  "analyticalBalance.net": "Net",
  "analyticalBalance.dropTube": "Déposez un tube de 50 mL ici",
  "lims.terminal": "Terminal LIMS",
  "lims.massCheckTitle": "Contrôle de masse à réception",
  "lims.massCheckHint":
    "La masse nette mesurée est la masse brute moins la tare connue du sachet.",
  "lims.printedTicket": "Ticket imprimé",
  "toolCard.fieldLabel": "Étiquette terrain",
  "toolCard.extract": "Extrait",
  "toolCard.pipetteDrawsThis": "Aspiré à la pipette",
  "toolCard.leftBehind": "Laissé au fond",
  "workbench.title": "Paillasse",
  "workbench.produceContaminates": "Le contact direct avec la surface contamine le lot.",
  "workbench.dropToolHint": "Déposez un outil ici pour commencer à équiper la paillasse.",
  "workspace.looseMaterialOnPan": "Matière libre sur le plateau",
  "instrument.unloadRack": "Retirer le rack du LC-MS/MS",
  "rack.loadedInInstrument": "Rack chargé dans le LC-MS/MS",
  "debug.palette": "Palette de debug",

};
