import type { Experiment } from "@/types/experiment";
import type {
  BenchToolInstance,
  ExperimentWorkspaceWidget,
  ProduceMaterialKind,
} from "@/types/workbench";

export const CALIBRATION_SAMPLE_TUTORIAL_ID = "calibration-sample-v1";

export type TutorialChapter = {
  id: string;
  title: string;
  stepIds: string[];
};

export type TutorialStep = {
  id: string;
  chapterId: string;
  title: string;
  instruction: string;
  hint: string;
  prerequisites: string[];
  anchor: (experiment: Experiment) => string | null;
  isSatisfied: (experiment: Experiment) => boolean;
};

export type TutorialDefinition = {
  id: string;
  version: 1;
  title: string;
  chapters: TutorialChapter[];
  steps: TutorialStep[];
  isComplete: (experiment: Experiment) => boolean;
};

export type TutorialEvaluation = {
  completedStepIds: string[];
  currentChapter: TutorialChapter;
  currentStep: TutorialStep | null;
  experiment: Experiment;
  isComplete: boolean;
  progressPercent: number;
  totalStepCount: number;
};

function workspaceWidget(experiment: Experiment, id: ExperimentWorkspaceWidget["id"]) {
  return experiment.workspace.widgets.find((widget) => widget.id === id);
}

function equipmentAnchor(
  experiment: Experiment,
  widgetId: ExperimentWorkspaceWidget["id"],
  paletteItemId: string,
) {
  return workspaceWidget(experiment, widgetId)?.isPresent
    ? `widget-${widgetId}`
    : `palette-item-${paletteItemId}`;
}

function allTools(experiment: Experiment): BenchToolInstance[] {
  return [
    ...experiment.workbench.slots.flatMap((slot) => (slot.tool ? [slot.tool] : [])),
    ...experiment.rack.slots.flatMap((slot) => (slot.tool ? [slot.tool] : [])),
    ...experiment.basketTools,
    ...experiment.trash.children,
    ...experiment.workspace.widgets.flatMap((widget) => (widget.tool ? [widget.tool] : [])),
  ];
}

function hasMaterialState(experiment: Experiment, states: ProduceMaterialKind[]) {
  return (experiment.produceMaterialStates ?? []).some((state) =>
    state.materialState ? states.includes(state.materialState) : false,
  );
}

function extractionTube(experiment: Experiment) {
  return allTools(experiment).find(
    (tool) =>
      tool.toolType === "centrifuge_tube" &&
      ((tool.produceFractions ?? []).length > 0 ||
        tool.containsSlurry ||
        tool.quechersState?.phase !== "idle"),
  );
}

function preparedCalibrationVial(experiment: Experiment) {
  return allTools(experiment).find(
    (tool) =>
      tool.toolType === "sample_vial" &&
      (tool.calibrationContext?.levelNgPerMl ?? 0) > 0,
  );
}

function preparedSampleVial(experiment: Experiment) {
  return allTools(experiment).find(
    (tool) => tool.toolType === "sample_vial" && tool.injectionContext !== null && tool.injectionContext !== undefined,
  );
}

function hasAppliedLimsLabel(experiment: Experiment) {
  const sampleCode = experiment.limsReception.labSampleCode;
  if (!sampleCode) {
    return false;
  }
  return allTools(experiment).some((tool) =>
    (tool.labels ?? []).some(
      (label) => label.labelKind === "lims" && label.sampleCode === sampleCode,
    ),
  );
}

function sequenceRuns(experiment: Experiment) {
  return workspaceWidget(experiment, "instrument")?.sequenceRuns ?? [];
}

function completedCalibrationAndSampleRun(experiment: Experiment) {
  return sequenceRuns(experiment).some(
    (run) =>
      run.totalDurationS > 0 &&
      run.elapsedS >= run.totalDurationS &&
      run.injections.some((injection) => injection.status === "calibration") &&
      run.injections.some((injection) => injection.status === "ok"),
  );
}

function hasTestPortion(experiment: Experiment) {
  const tube = extractionTube(experiment);
  const mass =
    tube?.powderMassG ??
    (tube?.produceFractions ?? []).reduce((total, fraction) => total + fraction.massG, 0);
  return mass >= 9.5;
}

function hasPreparedExtraction(experiment: Experiment) {
  const tube = extractionTube(experiment);
  const liquids = tube?.liquids ?? [];
  return (
    liquids.some((liquid) => liquid.liquidId === "istd_solution") &&
    liquids.some(
      (liquid) =>
        liquid.liquidId === "acetonitrile_extraction" && liquid.volume_ml >= 9.5,
    ) &&
    Boolean(tube?.quechersState?.saltsAdded)
  );
}

function hasVortexedExtraction(experiment: Experiment) {
  const phase = extractionTube(experiment)?.quechersState?.phase;
  return phase === "mixed" || phase === "separating" || phase === "separated";
}

function hasSeparatedExtraction(experiment: Experiment) {
  return extractionTube(experiment)?.quechersState?.phase === "separated";
}

function completedRunAndStoredAcquisitionEquipment(experiment: Experiment) {
  return (
    completedCalibrationAndSampleRun(experiment) &&
    !workspaceWidget(experiment, "rack")?.isPresent &&
    !workspaceWidget(experiment, "instrument")?.isPresent
  );
}

function step(
  value: Omit<TutorialStep, "prerequisites"> & { prerequisites?: string[] },
): TutorialStep {
  return { ...value, prerequisites: value.prerequisites ?? [] };
}

const steps: TutorialStep[] = [
  step({
    id: "weigh-received-sample",
    chapterId: "reception",
    title: "Weigh the received sample bag",
    instruction:
      "In Inventory, open Workspace equipment. Drag the highlighted Gross balance and drop it onto the central workspace. Then open the Produce basket, drag the sample bag, and drop it onto the balance.",
    hint: "Dropping the bag onto the balance automatically records its gross mass.",
    anchor: (experiment) =>
      equipmentAnchor(experiment, "gross_balance", "gross_balance_widget"),
    isSatisfied: (experiment) => (experiment.limsReception.measuredGrossMassG ?? 0) > 0,
  }),
  step({
    id: "register-and-label-sample",
    chapterId: "reception",
    title: "Register and identify the sample",
    instruction:
      "Fill in the LIMS form, click Create LIMS record, and then click Print label.",
    hint: "Drag the printed LIMS label and drop it directly onto the sample bag.",
    prerequisites: ["weigh-received-sample"],
    anchor: () => "widget-lims",
    isSatisfied: (experiment) => hasAppliedLimsLabel(experiment),
  }),
  step({
    id: "store-gross-balance",
    chapterId: "reception",
    title: "Store the receiving balance",
    instruction:
      "Drag the sample bag off the balance and drop it onto an empty workbench station. Then click Store in inventory in the balance header.",
    hint: "The Store in inventory button becomes available once the weighing pan is empty.",
    prerequisites: ["register-and-label-sample"],
    anchor: () => "widget-gross_balance",
    isSatisfied: (experiment) =>
      hasAppliedLimsLabel(experiment) &&
      !workspaceWidget(experiment, "gross_balance")?.isPresent,
  }),
  step({
    id: "cut-sample",
    chapterId: "sample-preparation",
    title: "Cut the apples",
    instruction:
      "Drag a Cutting board from Inventory and drop it onto an empty workbench station. Drag the apples from the sample bag onto the board, click Stainless steel knife in Actions, and then click the apples.",
    hint: "Clicking the apples while the knife is active changes their material state to cut.",
    prerequisites: ["store-gross-balance"],
    anchor: () => "widget-workbench",
    isSatisfied: (experiment) => hasMaterialState(experiment, ["cut", "ground", "slurry"]),
  }),
  step({
    id: "grind-sample",
    chapterId: "sample-preparation",
    title: "Cryogenically homogenize the sample",
    instruction:
      "Drag the highlighted Cryogenic grinder from Inventory and drop it onto the central workspace. Then drag the cut apples and Dry ice pellets into the grinder and click Start grinder.",
    hint: "Wait for the cycle to finish and for the material state to become ground.",
    prerequisites: ["cut-sample"],
    anchor: (experiment) =>
      equipmentAnchor(experiment, "grinder", "cryogenic_grinder_widget"),
    isSatisfied: (experiment) => hasMaterialState(experiment, ["ground", "slurry"]),
  }),
  step({
    id: "store-grinder",
    chapterId: "sample-preparation",
    title: "Empty and store the grinder",
    instruction:
      "Drag an HDPE storage container from Inventory onto an empty workbench station. Transfer the ground powder into it, then click Store in inventory in the grinder header.",
    hint: "The grinder must be empty before Store in inventory becomes available.",
    prerequisites: ["grind-sample"],
    anchor: () => "widget-grinder",
    isSatisfied: (experiment) =>
      hasMaterialState(experiment, ["ground", "slurry"]) &&
      !workspaceWidget(experiment, "grinder")?.isPresent,
  }),
  step({
    id: "weigh-test-portion",
    chapterId: "sample-preparation",
    title: "Prepare the test portion",
    instruction:
      "Drag the highlighted Analytical balance from Inventory and drop it onto the central workspace. Place a 50 mL tube on it, click Tare, then use the Powder spatula action to add approximately 10.000 g of powder.",
    hint: "The total mass shown for the tube must reach at least 9.5 g.",
    prerequisites: ["store-grinder"],
    anchor: (experiment) =>
      equipmentAnchor(experiment, "analytical_balance", "analytical_balance_widget"),
    isSatisfied: hasTestPortion,
  }),
  step({
    id: "store-analytical-balance",
    chapterId: "sample-preparation",
    title: "Store the analytical balance",
    instruction:
      "Drag the weighed tube off the analytical balance and drop it onto an empty workbench station. Then click Store in inventory in the balance header.",
    hint: "The test portion remains in the tube; only the empty balance is stored.",
    prerequisites: ["weigh-test-portion"],
    anchor: () => "widget-analytical_balance",
    isSatisfied: (experiment) =>
      hasTestPortion(experiment) &&
      !workspaceWidget(experiment, "analytical_balance")?.isPresent,
  }),
  step({
    id: "prepare-extraction",
    chapterId: "extraction",
    title: "Prepare the QuEChERS extraction",
    instruction:
      "Drag the ISTD solution onto the tube and confirm the volume. Repeat with acetonitrile to add 10 mL, then drag the QuEChERS salt packet onto the same tube.",
    hint: "Add the ISTD before the solvent to preserve the correct analytical provenance.",
    prerequisites: ["store-analytical-balance"],
    anchor: () => "widget-workbench",
    isSatisfied: hasPreparedExtraction,
  }),
  step({
    id: "vortex-extract",
    chapterId: "extraction",
    title: "Vortex the extraction",
    instruction:
      "Drag the highlighted Vortex mixer from Inventory and drop it onto the central workspace. Seal the extraction tube, drag it into the mixer, and click Start vortex.",
    hint: "Wait until the vortex cycle is complete before removing the tube.",
    prerequisites: ["prepare-extraction"],
    anchor: (experiment) =>
      equipmentAnchor(experiment, "vortex", "vortex_mixer_widget"),
    isSatisfied: hasVortexedExtraction,
  }),
  step({
    id: "store-vortex",
    chapterId: "extraction",
    title: "Store the vortex mixer",
    instruction: "Drag the mixed tube out of the vortex mixer and drop it onto an empty workbench station. Then click Store in inventory in the mixer header.",
    hint: "The centrifuge takes over in the next step, so the vortex mixer is no longer needed.",
    prerequisites: ["vortex-extract"],
    anchor: () => "widget-vortex",
    isSatisfied: (experiment) =>
      hasVortexedExtraction(experiment) && !workspaceWidget(experiment, "vortex")?.isPresent,
  }),
  step({
    id: "separate-extract",
    chapterId: "extraction",
    title: "Centrifuge the extract",
    instruction:
      "Drag the highlighted Centrifuge from Inventory and drop it onto the central workspace. Drag the vortexed tube into the centrifuge and click Start the centrifuge.",
    hint: "Wait for the cycle to finish and for the extract phase to become separated.",
    prerequisites: ["store-vortex"],
    anchor: (experiment) =>
      equipmentAnchor(experiment, "centrifuge", "centrifuge_widget"),
    isSatisfied: hasSeparatedExtraction,
  }),
  step({
    id: "prepare-sample-vial",
    chapterId: "vials",
    title: "Prepare the sample vial",
    instruction:
      "Drag an Autosampler vial from Inventory onto an empty workbench station. Select Micropipette in Actions, click the separated tube to aspirate, then click the vial to dispense.",
    hint: "The vial becomes a sample vial when it receives extract from the separated tube.",
    prerequisites: ["separate-extract"],
    anchor: () => "widget-workbench",
    isSatisfied: (experiment) => Boolean(preparedSampleVial(experiment)),
  }),
  step({
    id: "store-centrifuge",
    chapterId: "vials",
    title: "Store the centrifuge",
    instruction:
      "Drag the tube out of the centrifuge and drop it onto an empty workbench station. Then click Store in inventory in the centrifuge header.",
    hint: "The prepared sample vial retains the extract needed for the remaining steps.",
    prerequisites: ["prepare-sample-vial"],
    anchor: () => "widget-centrifuge",
    isSatisfied: (experiment) =>
      Boolean(preparedSampleVial(experiment)) &&
      !workspaceWidget(experiment, "centrifuge")?.isPresent,
  }),
  step({
    id: "prepare-calibration-vial",
    chapterId: "vials",
    title: "Prepare a calibration point",
    instruction:
      "Drag a second Autosampler vial onto the workbench. Then drag the Multi-residue stock solution onto it, enter a concentration greater than zero, and confirm.",
    hint: "You may choose any positive level; this tutorial requires a single calibration point.",
    prerequisites: ["store-centrifuge"],
    anchor: () => "palette-item-calibration_solution",
    isSatisfied: (experiment) => Boolean(preparedCalibrationVial(experiment)),
  }),
  step({
    id: "stage-vials",
    chapterId: "acquisition",
    title: "Stage both vials for the sequence",
    instruction:
      "Drag the highlighted Autosampler rack from Inventory and drop it onto the central workspace. Seal both vials, then drag and drop each vial into an empty rack position.",
    hint: "The physical provenance of each vial allows the system to distinguish the sample from the calibration point.",
    prerequisites: ["prepare-calibration-vial"],
    anchor: (experiment) =>
      equipmentAnchor(experiment, "rack", "autosampler_rack_widget"),
    isSatisfied: (experiment) => {
      const rackTools = experiment.rack.slots.flatMap((slot) => (slot.tool ? [slot.tool] : []));
      return (
        rackTools.some((tool) => Boolean(tool.injectionContext) && Boolean(tool.isSealed)) &&
        rackTools.some((tool) => Boolean(tool.calibrationContext) && Boolean(tool.isSealed))
      );
    },
  }),
  step({
    id: "launch-sequence",
    chapterId: "acquisition",
    title: "Load and start the sequence",
    instruction:
      "Drag the highlighted LC-MS/MS from Inventory and drop it onto the central workspace. Drag and drop the loaded rack into the instrument, open the console, check both rows, and click Launch acquisition.",
    hint: "The sequence must contain one calibration injection and one sample injection.",
    prerequisites: ["stage-vials"],
    anchor: (experiment) =>
      equipmentAnchor(experiment, "instrument", "lc_msms_instrument_widget"),
    isSatisfied: (experiment) => sequenceRuns(experiment).length > 0,
  }),
  step({
    id: "review-results",
    chapterId: "acquisition",
    title: "Review the results",
    instruction:
      "Wait for both injections to finish, then compare the calibration point and sample results.",
    hint: "You can follow the active injection directly on the instrument illustration.",
    prerequisites: ["launch-sequence"],
    anchor: () => "widget-instrument",
    isSatisfied: completedCalibrationAndSampleRun,
  }),
  step({
    id: "store-acquisition-equipment",
    chapterId: "acquisition",
    title: "Clear the acquisition workspace",
    instruction:
      "Click Unload rack from LC-MS/MS, drag both vials out of the rack, and place them on the workbench or in the trash. Then click Store in inventory for the empty rack and the LC-MS/MS.",
    hint: "The results remain available after the equipment is stored.",
    prerequisites: ["review-results"],
    anchor: (experiment) =>
      workspaceWidget(experiment, "rack")?.isPresent ? "widget-rack" : "widget-instrument",
    isSatisfied: completedRunAndStoredAcquisitionEquipment,
  }),
];

export const calibrationSampleTutorial: TutorialDefinition = {
  id: CALIBRATION_SAMPLE_TUTORIAL_ID,
  version: 1,
  title: "1 calibration point + 1 sample",
  chapters: [
    {
      id: "reception",
      title: "Sample reception",
      stepIds: [
        "weigh-received-sample",
        "register-and-label-sample",
        "store-gross-balance",
      ],
    },
    {
      id: "sample-preparation",
      title: "Sample preparation",
      stepIds: [
        "cut-sample",
        "grind-sample",
        "store-grinder",
        "weigh-test-portion",
        "store-analytical-balance",
      ],
    },
    {
      id: "extraction",
      title: "QuEChERS extraction",
      stepIds: [
        "prepare-extraction",
        "vortex-extract",
        "store-vortex",
        "separate-extract",
      ],
    },
    {
      id: "vials",
      title: "Vial preparation",
      stepIds: [
        "prepare-sample-vial",
        "store-centrifuge",
        "prepare-calibration-vial",
      ],
    },
    {
      id: "acquisition",
      title: "Rack and acquisition",
      stepIds: [
        "stage-vials",
        "launch-sequence",
        "review-results",
        "store-acquisition-equipment",
      ],
    },
  ],
  steps,
  isComplete: completedRunAndStoredAcquisitionEquipment,
};

export function getTutorialDefinition(tutorialId: string | null | undefined) {
  return tutorialId === CALIBRATION_SAMPLE_TUTORIAL_ID
    ? calibrationSampleTutorial
    : null;
}

export function evaluateTutorial(
  definition: TutorialDefinition,
  experiment: Experiment,
  persistedCompletedStepIds: readonly string[] = [],
): TutorialEvaluation {
  const knownStepIds = new Set(definition.steps.map((entry) => entry.id));
  const completed = new Set(
    persistedCompletedStepIds.filter((stepId) => knownStepIds.has(stepId)),
  );
  for (const entry of definition.steps) {
    if (entry.isSatisfied(experiment)) {
      completed.add(entry.id);
    }
  }
  if (definition.isComplete(experiment)) {
    for (const entry of definition.steps) {
      completed.add(entry.id);
    }
  }
  const completedStepIds = definition.steps
    .filter((entry) => completed.has(entry.id))
    .map((entry) => entry.id);
  const isComplete = completedStepIds.length === definition.steps.length;
  const currentStep = isComplete
    ? null
    : (definition.steps.find(
        (entry) =>
          !completed.has(entry.id) &&
          entry.prerequisites.every((prerequisite) => completed.has(prerequisite)),
      ) ?? definition.steps.find((entry) => !completed.has(entry.id)) ?? null);
  const currentChapter =
    definition.chapters.find((chapter) => chapter.id === currentStep?.chapterId) ??
    definition.chapters.at(-1)!;

  return {
    completedStepIds,
    currentChapter,
    currentStep,
    experiment,
    isComplete,
    progressPercent: Math.round((completedStepIds.length / definition.steps.length) * 100),
    totalStepCount: definition.steps.length,
  };
}
