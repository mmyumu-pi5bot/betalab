import type { enLcms } from "../en/lcms";

export const frLcms: Record<keyof typeof enLcms, string> = {

  // Acquisition method loading
  "lcms.methodLoadError": "Échec du chargement de la méthode.",


  // Method viewer
  "method.loading": "Chargement de la méthode…",
  "method.details": "Détail de la méthode d'acquisition",
  "method.educational": "Pédagogique",
  "method.builtInReadOnly": "Intégrée · lecture seule",
  "method.runDuration": "Durée d'analyse",
  "method.compounds": "Composés",
  "method.transitions": "Transitions",
  "method.liquidChromatography": "Chromatographie liquide",
  "method.column": "Colonne",
  "method.oven": "Four",
  "method.flow": "Débit",
  "method.phaseA": "Phase A",
  "method.phaseB": "Phase B",
  "method.gradient": "Gradient",
  "method.ionSource": "Source d'ions",
  "method.source": "Source",
  "method.sprayVoltage": "Tension de spray",
  "method.temperature": "Température",
  "method.nebulizerGas": "Gaz de nébulisation",
  "method.heaterGas": "Gaz de chauffage",
  "method.curtainGas": "Gaz rideau",
  "method.compound": "Composé",
  "method.role": "Rôle",
  "method.polarityShort": "Pol.",
  "method.collisionEnergyShort": "CE (V)",
  "method.dwellShort": "Dwell (ms)",
  "method.retentionShort": "RT",
  "method.quantifier": "Quantifieur",
  "method.qualifier": "Qualifieur",
  "method.readingThisMethod": "Lire cette méthode",
  "glossary.q1.term": "Q1",
  "glossary.q1.explanation":
    "Premier quadripôle. Il filtre l'ion précurseur — la molécule intacte à sa sortie de la source — et ne laisse passer que le m/z sélectionné.",
  "glossary.q3.term": "Q3",
  "glossary.q3.explanation":
    "Troisième quadripôle. Il filtre un ion produit, fragment formé dans la cellule de collision. C'est le couple Q1 → Q3 qui rend une transition spécifique.",
  "glossary.collisionEnergy.term": "Énergie de collision",
  "glossary.collisionEnergy.explanation":
    "Tension accélérant le précurseur dans le gaz de collision. Trop faible, la molécule ne se fragmente pas ; trop forte, le fragment choisi est détruit à son tour.",
  "glossary.dwellTime.term": "Temps de mesure (dwell)",
  "glossary.dwellTime.explanation":
    "Temps passé à mesurer une transition par cycle. Un dwell plus long améliore le rapport signal/bruit, mais réduit le nombre de points par pic chromatographique.",
  "glossary.quantifier.term": "Quantifieur",
  "glossary.quantifier.explanation":
    "La transition la plus intense d'un composé. C'est son aire qui sert à calculer la concentration.",
  "glossary.qualifier.term": "Qualifieur",
  "glossary.qualifier.explanation":
    "Une seconde transition du même composé. Elle ne sert pas à quantifier : son rapport au quantifieur confirme l'identité et révèle les interférences.",


  // Acquisition console
  "console.validation.noVial": "La séquence a besoin d'au moins un vial dans le rack.",
  "console.validation.duplicatePosition":
    "Chaque position occupée du rack doit apparaître exactement une fois.",
  "console.validation.missingSampleName": "Chaque ligne doit porter un nom d'échantillon.",
  "console.validation.injectionVolume":
    "Le volume d'injection doit être compris entre 0 et 100 µL.",
  "console.validation.repetitions": "Le nombre de répétitions doit être compris entre 1 et 10.",
  "console.validation.filenameExtension":
    "Chaque nom de fichier de sortie doit se terminer par .mzML.",
  "console.validation.filenameUnique": "Les noms de fichiers de sortie doivent être uniques.",
  "console.title": "Console d'acquisition LC-MS/MS",
  "console.eyebrow": "Console d'acquisition",
  "console.sequenceSetup": "Configuration de la séquence",
  "console.acquisitionMethod": "Méthode d'acquisition",
  "console.noMethodLoaded": "Aucune méthode chargée.",
  "console.builtIn": "Intégrée",
  "console.methodSummary":
    "{compounds} composés · {transitions} transitions · {runtime} d'analyse",
  "console.manageMethods": "Gérer les méthodes",
  "console.position": "Position {position}",
  "console.sampleName": "Nom de l'échantillon",
  "console.injectionVolume": "Volume d'injection (µL)",
  "console.repetitions": "Répétitions",
  "console.outputFilename": "Nom du fichier de sortie",
  "console.ready.one": "Séquence prête : {count} ligne d'injection.",
  "console.ready.other": "Séquence prête : {count} lignes d'injection.",
  "console.launch": "Lancer l'acquisition",


  // Method validation
  "methodError.missingName": "Une méthode doit porter un nom.",
  "methodError.missingVersion": "Une méthode doit porter une version.",
  "methodError.runtimePositive": "La durée d'analyse doit être strictement positive.",
  "methodError.noTransition": "Une méthode doit comporter au moins une transition.",
  "methodError.transitionIdentifier": "Chaque transition doit porter un identifiant.",
  "methodError.mzPositive":
    "Transition « {id} » : les valeurs de m/z doivent être strictement positives.",
  "methodError.dwellPositive":
    "Transition « {id} » : le temps de mesure doit être strictement positif.",
  "methodError.windowPositive":
    "Transition « {id} » : la fenêtre de rétention doit être strictement positive.",
  "methodError.duplicateIdentifier": "Identifiant de transition « {id} » en double.",
  "methodError.noQuantifier": "Le composé « {compound} » n'a pas de transition quantifieur.",


  // Method editor
  "editor.title": "Éditeur de méthode d'acquisition",
  "editor.builtInNotice":
    "{name} est une méthode intégrée et ne peut pas être modifiée. Utilisez Dupliquer la méthode dans la bibliothèque pour en obtenir une copie modifiable, modifiez la copie, puis enregistrez-la comme nouvelle version.",
  "editor.editMethod": "Modifier la méthode",
  "editor.simple": "Simple",
  "editor.advanced": "Avancé",
  "editor.methodName": "Nom de la méthode",
  "editor.version": "Version",
  "editor.calibrationLevels": "Niveaux d'étalonnage (ng/mL)",
  "editor.calibrationLevelsPlaceholder": "ex. 1, 2, 5, 10, 20",
  "editor.calibrationLevelsHint":
    "Facultatif. Le fichier de méthode exporté comporte une colonne de concentration par niveau, dans cet ordre. Laissez vide pour n'exporter aucune colonne de concentration et les remplir vous-même. Rien ne vérifie ces valeurs par rapport aux étalons réellement présents dans le rack.",
  "editor.calibrationLevelsError":
    "Les niveaux d'étalonnage doivent être une liste de nombres strictement positifs, séparés par des virgules.",
  "editor.pickCompounds":
    "Choisissez les composés à cibler. Le catalogue propose leurs transitions connues.",
  "editor.removeTransition": "Supprimer la transition",
  "editor.q1": "Q1 (m/z)",
  "editor.q3": "Q3 (m/z)",
  "editor.collisionEnergy": "CE (V)",
  "editor.dwell": "Dwell (ms)",
  "editor.retentionTime": "RT (s)",
  "editor.retentionWindow": "Fenêtre (s)",
  "editor.polarity": "Polarité",
  "editor.polarityPositive": "positive",
  "editor.polarityNegative": "négative",
  "editor.warningSuffix":
    "{message} L'enregistrement reste possible — lancez la séquence et regardez le tracé.",
  "editor.save": "Enregistrer comme nouvelle version",
  "editor.saved":
    "Enregistrée en v{version}. Sélectionnez-la comme méthode d'acquisition dans la console.",
  "editor.proposeError": "Échec de la proposition de transitions.",
  "editor.saveError": "Échec de l'enregistrement de la méthode.",


  // Method manager
  "manager.title": "Gestionnaire de méthodes d'acquisition",
  "manager.heading": "Gestionnaire de méthodes",
  "manager.close": "Fermer le gestionnaire de méthodes",
  "manager.library": "Bibliothèque de méthodes",
  "manager.user": "Utilisateur",
  "manager.entrySummary": "{origin} · {count} transitions",
  "manager.inUse": "Utilisée",
  "manager.confirmDelete": "Confirmer la suppression de {name}",
  "manager.delete": "Supprimer {name}",
  "manager.newMethod": "Nouvelle méthode",
  "manager.newMethodHint":
    "Les méthodes se créent en dupliquant une méthode existante, puis en modifiant la copie.",
  "manager.copyName": "Nom de la copie",
  "manager.copyPlaceholder": "{name} (copie)",
  "manager.methodNamePlaceholder": "Nom de la méthode",
  "manager.duplicate": "Dupliquer la méthode",
  "manager.methodView": "Vue de la méthode",
  "manager.tabDetails": "Détails",
  "manager.tabEdit": "Modifier",
  "manager.selectedNote": "C'est cette méthode que la séquence exécutera.",
  "manager.previewNote": "Prévisualiser une méthode ne change rien à la séquence.",
  "manager.useForSequence": "Utiliser pour cette séquence",
  "manager.duplicateError": "Échec de la duplication de la méthode.",
  "manager.deleteError": "Échec de la suppression de la méthode.",


  // Run results
  "results.injectionHeader":
    "{name} · position {slot} · {volume} µL · rép. {replicate} · {filename}",
  "results.pending": "En attente dans la file d'attente de l'autosampler.",
  "results.recording": "Enregistrement · {elapsed} sur {total}",
  "results.insufficientVolume":
    "L'aiguille n'a pas pu atteindre assez d'échantillon : les injections précédentes ont vidé ce vial jusqu'à son volume mort. Toutes les voies n'ont enregistré que la ligne de base.",
  "results.noExtractContext":
    "Ce vial ne contenait rien d'injectable — toutes les voies n'ont enregistré que la ligne de base.",
  "results.noTrace": "Aucun tracé enregistré pour cette injection.",
  "results.summary.one": "Séquence {id} · {count} injection · {method} v{version}",
  "results.summary.other": "Séquence {id} · {count} injections · {method} v{version}",
  "results.downloadTitle":
    "Le fichier de méthode plus un fichier de chromatogramme par injection que l'instrument a fini d'enregistrer.",
  "results.download": "Télécharger les résultats",
  "results.acquiring": "Acquisition · {elapsed} sur {total}",
  "results.skipToEnd": "Passer à la fin",
  "results.monitor": "Moniteur d'acquisition",
  "results.closeViewer": "Fermer la visionneuse",
  "results.openViewer": "Ouvrir la visionneuse",
  "results.shownInViewer": "Cette séquence est affichée dans la visionneuse.",
  "results.viewer": "Visionneuse de données d'acquisition",

  "results.noRunYet":
    "Aucune séquence n'a encore été lancée — chargez le rack et démarrez une acquisition.",

};
