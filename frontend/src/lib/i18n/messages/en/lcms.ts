export const enLcms = {

  // Acquisition method loading
  "lcms.methodLoadError": "Failed to load the method.",


  // Method viewer
  "method.loading": "Loading the method…",
  "method.details": "Acquisition method details",
  "method.educational": "Educational",
  "method.builtInReadOnly": "Built-in · read-only",
  "method.runDuration": "Run duration",
  "method.compounds": "Compounds",
  "method.transitions": "Transitions",
  "method.liquidChromatography": "Liquid chromatography",
  "method.column": "Column",
  "method.oven": "Oven",
  "method.flow": "Flow",
  "method.phaseA": "Phase A",
  "method.phaseB": "Phase B",
  "method.gradient": "Gradient",
  "method.ionSource": "Ion source",
  "method.source": "Source",
  "method.sprayVoltage": "Spray voltage",
  "method.temperature": "Temperature",
  "method.nebulizerGas": "Nebulizer gas",
  "method.heaterGas": "Heater gas",
  "method.curtainGas": "Curtain gas",
  "method.compound": "Compound",
  "method.role": "Role",
  "method.polarityShort": "Pol.",
  "method.collisionEnergyShort": "CE (V)",
  "method.dwellShort": "Dwell (ms)",
  "method.retentionShort": "RT",
  "method.quantifier": "Quantifier",
  "method.qualifier": "Qualifier",
  "method.readingThisMethod": "Reading this method",
  "glossary.q1.term": "Q1",
  "glossary.q1.explanation":
    "First quadrupole. It filters the precursor ion — the intact molecule as it leaves the source — and lets through only the selected m/z.",
  "glossary.q3.term": "Q3",
  "glossary.q3.explanation":
    "Third quadrupole. It filters one product ion, a fragment produced in the collision cell. The Q1 → Q3 pair is what makes a transition specific.",
  "glossary.collisionEnergy.term": "Collision energy",
  "glossary.collisionEnergy.explanation":
    "Voltage accelerating the precursor into the collision gas. Too low and the molecule does not fragment; too high and the chosen fragment is destroyed in turn.",
  "glossary.dwellTime.term": "Dwell time",
  "glossary.dwellTime.explanation":
    "Time spent measuring one transition per cycle. Longer dwell means a better signal-to-noise ratio, but fewer points across each chromatographic peak.",
  "glossary.quantifier.term": "Quantifier",
  "glossary.quantifier.explanation":
    "The most intense transition of a compound. Its area is the one used to compute the concentration.",
  "glossary.qualifier.term": "Qualifier",
  "glossary.qualifier.explanation":
    "A second transition of the same compound. It is not used to quantify: its ratio to the quantifier confirms the identity and exposes interferences.",


  // Acquisition console
  "console.validation.noVial": "The sequence needs at least one vial in the rack.",
  "console.validation.duplicatePosition": "Each occupied rack position must appear exactly once.",
  "console.validation.missingSampleName": "Every line needs a sample name.",
  "console.validation.injectionVolume": "Injection volume must be between 0 and 100 µL.",
  "console.validation.repetitions": "Repetitions must be between 1 and 10.",
  "console.validation.filenameExtension": "Every output filename must end with .mzML.",
  "console.validation.filenameUnique": "Output filenames must be unique.",
  "console.title": "LC-MS/MS acquisition console",
  "console.eyebrow": "Acquisition console",
  "console.sequenceSetup": "Sequence setup",
  "console.acquisitionMethod": "Acquisition method",
  "console.noMethodLoaded": "No method loaded.",
  "console.builtIn": "Built-in",
  "console.methodSummary": "{compounds} compounds · {transitions} transitions · {runtime} run",
  "console.manageMethods": "Manage methods",
  "console.position": "Position {position}",
  "console.sampleName": "Sample name",
  "console.injectionVolume": "Injection volume (µL)",
  "console.repetitions": "Repetitions",
  "console.outputFilename": "Output filename",
  "console.ready.one": "Sequence ready: {count} injection line.",
  "console.ready.other": "Sequence ready: {count} injection lines.",
  "console.launch": "Launch acquisition",


  // Method validation
  "methodError.missingName": "A method needs a name.",
  "methodError.missingVersion": "A method needs a version.",
  "methodError.runtimePositive": "Run duration must be positive.",
  "methodError.noTransition": "A method needs at least one transition.",
  "methodError.transitionIdentifier": "Every transition needs an identifier.",
  "methodError.mzPositive": "Transition '{id}': m/z values must be positive.",
  "methodError.dwellPositive": "Transition '{id}': dwell time must be positive.",
  "methodError.windowPositive": "Transition '{id}': retention window must be positive.",
  "methodError.duplicateIdentifier": "Duplicate transition identifier '{id}'.",
  "methodError.noQuantifier": "Compound '{compound}' has no quantifier transition.",


  // Method editor
  "editor.title": "Acquisition method editor",
  "editor.builtInNotice":
    "{name} is a built-in method and cannot be edited. Use Duplicate method in the library to obtain an editable copy, change the copy, then save it as a new version.",
  "editor.editMethod": "Edit method",
  "editor.simple": "Simple",
  "editor.advanced": "Advanced",
  "editor.methodName": "Method name",
  "editor.version": "Version",
  "editor.calibrationLevels": "Calibration levels (ng/mL)",
  "editor.calibrationLevelsPlaceholder": "e.g. 1, 2, 5, 10, 20",
  "editor.calibrationLevelsHint":
    "Optional. The exported method file gets one concentration column per level, in this order. Leave empty to export no concentration column and fill them in yourself. Nothing checks these against the standards actually in the rack.",
  "editor.calibrationLevelsError":
    "Calibration levels must be a list of positive numbers, separated by commas.",
  "editor.pickCompounds":
    "Pick the compounds to target. The catalog proposes their known transitions.",
  "editor.removeTransition": "Remove transition",
  "editor.q1": "Q1 (m/z)",
  "editor.q3": "Q3 (m/z)",
  "editor.collisionEnergy": "CE (V)",
  "editor.dwell": "Dwell (ms)",
  "editor.retentionTime": "RT (s)",
  "editor.retentionWindow": "Window (s)",
  "editor.polarity": "Polarity",
  "editor.polarityPositive": "positive",
  "editor.polarityNegative": "negative",
  "editor.warningSuffix": "{message} Saving is still allowed — run it and look at the trace.",
  "editor.save": "Save as new version",
  "editor.saved": "Saved as v{version}. Select it as the acquisition method in the console.",
  "editor.proposeError": "Failed to propose transitions.",
  "editor.saveError": "Failed to save the method.",


  // Method manager
  "manager.title": "Acquisition method manager",
  "manager.heading": "Method manager",
  "manager.close": "Close method manager",
  "manager.library": "Method library",
  "manager.user": "User",
  "manager.entrySummary": "{origin} · {count} transitions",
  "manager.inUse": "In use",
  "manager.confirmDelete": "Confirm deleting {name}",
  "manager.delete": "Delete {name}",
  "manager.newMethod": "New method",
  "manager.newMethodHint":
    "Methods are created by duplicating an existing one, then editing the copy.",
  "manager.copyName": "Copy name",
  "manager.copyPlaceholder": "{name} (copy)",
  "manager.methodNamePlaceholder": "Method name",
  "manager.duplicate": "Duplicate method",
  "manager.methodView": "Method view",
  "manager.tabDetails": "Details",
  "manager.tabEdit": "Edit",
  "manager.selectedNote": "This method is the one the sequence will run.",
  "manager.previewNote": "Previewing a method does not change the sequence.",
  "manager.useForSequence": "Use for this sequence",
  "manager.duplicateError": "Failed to duplicate the method.",
  "manager.deleteError": "Failed to delete the method.",


  // Run results
  "results.injectionHeader": "{name} · slot {slot} · {volume} µL · rep {replicate} · {filename}",
  "results.pending": "Waiting in the autosampler queue.",
  "results.recording": "Recording · {elapsed} of {total}",
  "results.insufficientVolume":
    "The needle could not reach enough sample: earlier injections drained this vial down to its dead volume. Every channel recorded baseline.",
  "results.noExtractContext":
    "This vial held no injectable content — every channel recorded baseline.",
  "results.noTrace": "No trace recorded for this injection.",
  "results.summary.one": "Sequence {id} · {count} injection · {method} v{version}",
  "results.summary.other": "Sequence {id} · {count} injections · {method} v{version}",
  "results.downloadTitle":
    "Method file plus one chromatogram file per injection the instrument has finished recording.",
  "results.download": "Download results",
  "results.acquiring": "Acquiring · {elapsed} of {total}",
  "results.skipToEnd": "Skip to end",
  "results.monitor": "Acquisition monitor",
  "results.closeViewer": "Close data viewer",
  "results.openViewer": "Open data viewer",
  "results.shownInViewer": "Showing this run in the data viewer.",
  "results.viewer": "Acquisition data viewer",

  "results.noRunYet":
    "No sequence has been run yet — load the rack and launch an acquisition.",

} as const;
