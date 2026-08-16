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
  dropAnchor?: (experiment: Experiment) => string | null;
  isSatisfied: (experiment: Experiment) => boolean;
  presentation?: (experiment: Experiment) => Partial<TutorialStepPresentation>;
};

// A step that ends in a drag has two places to point at: the item to pick up and
// the place to release it. Both come out of the same branching resolver so the
// highlighted source and destination can never describe different sub-steps.
export type TutorialTarget = {
  anchor: string;
  dropAnchor?: string | null;
};

function fromTarget(resolve: (experiment: Experiment) => TutorialTarget) {
  return {
    anchor: (experiment: Experiment) => resolve(experiment).anchor,
    dropAnchor: (experiment: Experiment) => resolve(experiment).dropAnchor ?? null,
  };
}

export type TutorialStepPresentation = Pick<
  TutorialStep,
  "title" | "instruction" | "hint"
> & {
  action?: TutorialAction;
};

export type TutorialAction = {
  kind: "click" | "drag" | "inspect" | "keyboard" | "type" | "wait";
  label: string;
};

export type LimsTutorialField =
  | "mass-summary"
  | "orchard"
  | "harvest-date"
  | "indicative-mass"
  | "create-record";

export type TutorialActionTool = "knife" | "pipette" | "spatula";

const tutorialActionTools: Record<TutorialActionTool, { key: string; name: string }> = {
  knife: { key: "K", name: "Stainless steel knife" },
  pipette: { key: "P", name: "Micropipette" },
  spatula: { key: "S", name: "Powder spatula" },
};

export function isTutorialActionTool(value: string): value is TutorialActionTool {
  return Object.hasOwn(tutorialActionTools, value);
}

export function getTutorialActionToolPresentation(
  tool: TutorialActionTool,
): TutorialStepPresentation {
  const { key, name } = tutorialActionTools[tool];
  return {
    title: `Put the ${name} away`,
    instruction:
      `The ${name} is still in hand, and drag and drop stays disabled while a tool is selected. ` +
      `Click the highlighted ${name} in Actions, or press ${key}, to put it away.`,
    hint: "As soon as no tool is selected, the tutorial highlights what to drag for this step.",
    action: { kind: "click", label: `Click it again or press ${key}` },
  };
}

// Inventory sections start collapsed, so the item a step asks for is regularly out
// of reach. Rather than opening the section behind the learner's back, the coach
// inserts this sub-step: the learner opens it themselves and learns where the
// equipment lives.
export function getTutorialInventoryCategoryPresentation(
  label: string,
): TutorialStepPresentation {
  return {
    title: `Open the ${label} section`,
    instruction:
      `The item for this step is in the ${label} section of the Inventory, and that section ` +
      "is collapsed. Click the highlighted header to expand it.",
    hint: "The tutorial will highlight the item to use as soon as the section is open.",
    action: { kind: "click", label: `Click the highlighted ${label} header` },
  };
}

export type LimsTutorialValues = {
  orchardName: string;
  harvestDate: string;
  indicativeMassG: number;
  measuredGrossMassG: number | null;
  measuredNetMassG: number | null;
  packagingTareMassG: number;
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

function allTools(experiment: Experiment): BenchToolInstance[] {
  return [
    ...experiment.workbench.slots.flatMap((slot) => (slot.tool ? [slot.tool] : [])),
    ...experiment.rack.slots.flatMap((slot) => (slot.tool ? [slot.tool] : [])),
    ...experiment.basketTools,
    ...experiment.trash.children,
    ...experiment.workspace.widgets.flatMap((widget) => (widget.tool ? [widget.tool] : [])),
  ];
}

function toolSourceAnchor(
  experiment: Experiment,
  predicate: (tool: BenchToolInstance) => boolean,
) {
  const workbenchTool = experiment.workbench.slots.find(
    (slot) => slot.tool && predicate(slot.tool),
  )?.tool;
  if (workbenchTool) {
    return `bench-tool-card-${workbenchTool.id}`;
  }
  const rackIndex = experiment.rack.slots.findIndex(
    (slot) => slot.tool && predicate(slot.tool),
  );
  if (rackIndex >= 0) {
    return `rack-slot-tool-${rackIndex + 1}`;
  }
  const basketTool = experiment.basketTools.find(predicate);
  if (basketTool) {
    return basketTool.toolType === "sample_bag" ? "basket-received-bag" : "widget-basket";
  }
  const trashTool = experiment.trash.children.find(predicate);
  if (trashTool) {
    return `trash-tool-${trashTool.id}`;
  }
  const containingWidget = experiment.workspace.widgets.find(
    (widget) => widget.tool && predicate(widget.tool),
  );
  return containingWidget ? `widget-${containingWidget.id}` : "workspace";
}

function toolIsInWidget(
  experiment: Experiment,
  widgetId: ExperimentWorkspaceWidget["id"],
  tool: BenchToolInstance | undefined,
) {
  return Boolean(tool && workspaceWidget(experiment, widgetId)?.tool?.id === tool.id);
}

function plainSampleVial(experiment: Experiment) {
  return allTools(experiment).find(
    (tool) =>
      tool.toolType === "sample_vial" &&
      !tool.injectionContext &&
      !tool.calibrationContext,
  );
}

function toolIsInRack(experiment: Experiment, tool: BenchToolInstance | undefined) {
  return Boolean(
    tool && experiment.rack.slots.some((slot) => slot.tool?.id === tool.id),
  );
}

function hasMaterialState(experiment: Experiment, states: ProduceMaterialKind[]) {
  return (experiment.produceMaterialStates ?? []).some((state) =>
    state.materialState ? states.includes(state.materialState) : false,
  );
}

function materialStateForLot(experiment: Experiment, lotId: string) {
  return experiment.produceMaterialStates?.find((state) => state.produceLotId === lotId)
    ?.materialState;
}

function produceSourceAnchor(experiment: Experiment, states: ProduceMaterialKind[]) {
  const matches = (lot: { id: string; materialState?: ProduceMaterialKind }) =>
    states.includes(lot.materialState ?? materialStateForLot(experiment, lot.id) ?? "whole");
  for (const slot of experiment.workbench.slots) {
    const surfaceLot = (slot.surfaceProduceLots ?? []).find(matches);
    if (surfaceLot) {
      return `bench-surface-produce-lot-${surfaceLot.id}`;
    }
    const containedLot = (slot.tool?.produceLots ?? []).find(matches);
    if (containedLot) {
      return `bench-produce-lot-${containedLot.id}`;
    }
  }
  const basketLot = experiment.workspace.produceBasketLots.find(matches);
  if (basketLot) {
    return `basket-produce-${basketLot.id}`;
  }
  const trashLot = experiment.trash.produceLots.find((entry) => matches(entry.produceLot));
  if (trashLot) {
    return `trash-produce-lot-${trashLot.id}`;
  }
  const containingWidget = experiment.workspace.widgets.find((widget) =>
    (widget.produceLots ?? []).some(matches),
  );
  return containingWidget ? `widget-${containingWidget.id}` : "widget-workbench";
}

function extractionTube(experiment: Experiment) {
  const isExtractionTube = (tool: BenchToolInstance) =>
    tool.toolType === "centrifuge_tube" &&
    ((tool.produceFractions ?? []).length > 0 ||
      tool.containsSlurry ||
      tool.quechersState?.phase !== "idle");
  const tubeOnBalance = workspaceWidget(experiment, "analytical_balance")?.tool;
  if (tubeOnBalance && isExtractionTube(tubeOnBalance)) {
    return tubeOnBalance;
  }
  const trashedToolIds = new Set(experiment.trash.children.map((tool) => tool.id));
  const candidates = allTools(experiment).filter(isExtractionTube);
  return candidates.find((tool) => !trashedToolIds.has(tool.id)) ?? candidates[0];
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

function hasSampleBagOnGrossBalance(experiment: Experiment) {
  return workspaceWidget(experiment, "gross_balance")?.tool?.toolType === "sample_bag";
}

function sampleBagSourceAnchor(experiment: Experiment) {
  const workbenchBag = experiment.workbench.slots.find(
    (slot) => slot.tool?.toolType === "sample_bag",
  )?.tool;
  if (workbenchBag) {
    return `bench-tool-card-${workbenchBag.id}`;
  }
  if (experiment.basketTools.some((tool) => tool.toolType === "sample_bag")) {
    return "basket-received-bag";
  }
  const trashBag = experiment.trash.children.find((tool) => tool.toolType === "sample_bag");
  if (trashBag) {
    return `trash-tool-${trashBag.id}`;
  }
  return "workspace";
}

function sampleBagContainingWholeProduce(experiment: Experiment) {
  return allTools(experiment).find(
    (tool) =>
      tool.toolType === "sample_bag" &&
      (tool.produceLots ?? []).some(
        (lot) =>
          (lot.materialState ?? materialStateForLot(experiment, lot.id)) === "whole",
      ),
  );
}

export function getLimsTutorialValues(experiment: Experiment): LimsTutorialValues {
  const bag = workspaceWidget(experiment, "gross_balance")?.tool;
  const measuredGrossMassG = experiment.limsReception.measuredGrossMassG;
  const packagingTareMassG = experiment.limsReception.packagingTareMassG;
  const measuredNetMassG =
    measuredGrossMassG === null
      ? null
      : Math.max(0, measuredGrossMassG - packagingTareMassG);
  const labelMatch = bag?.fieldLabelText?.match(
    /^(.*?) • Harvest (\d{4}-\d{2}-\d{2}) • Approx\. ([\d.]+) kg$/,
  );
  if (labelMatch) {
    return {
      orchardName: labelMatch[1],
      harvestDate: labelMatch[2],
      indicativeMassG: Number(labelMatch[3]) * 1000,
      measuredGrossMassG,
      measuredNetMassG,
      packagingTareMassG,
    };
  }

  const referenceDate = new Date(experiment.last_simulation_at);
  referenceDate.setUTCDate(referenceDate.getUTCDate() - 1);
  return {
    orchardName: "Tutorial Orchard",
    harvestDate: referenceDate.toISOString().slice(0, 10),
    indicativeMassG: Math.max(
      0,
      Math.round(measuredNetMassG ?? 2500),
    ),
    measuredGrossMassG,
    measuredNetMassG,
    packagingTareMassG,
  };
}

export function getLimsTutorialFieldPresentation(
  experiment: Experiment,
  field: LimsTutorialField,
): TutorialStepPresentation {
  const values = getLimsTutorialValues(experiment);
  const grossMass = values.measuredGrossMassG?.toFixed(1) ?? "the current";
  const packagingTareMass = values.packagingTareMassG.toFixed(1);
  const netMass = values.measuredNetMassG?.toFixed(1) ?? "the calculated";
  if (field === "mass-summary") {
    return {
      title: "Review the reception weighing",
      instruction:
        `Click the highlighted mass summary and review the calculation: ${grossMass} g − ${packagingTareMass} g = ${netMass} g. ` +
        "The balance measured the sealed bag; subtracting the known bag tare gives the actual mass received.",
      hint: `The declared mass on the field label is ${values.indicativeMassG} g. It is a reference value and may differ slightly from the measured net mass of ${netMass} g.`,
      action: { kind: "click", label: "Review the mass calculation" },
    };
  }
  if (field === "orchard") {
    return {
      title: "Enter the orchard / producer",
      instruction: `Click the highlighted field and enter exactly: ${values.orchardName}. This value comes from the field label on the sample bag.`,
      hint: `The Gross balance currently reads ${grossMass} g. Keep the bag on it while completing the LIMS record.`,
      action: { kind: "type", label: `Type ${values.orchardName}` },
    };
  }
  if (field === "harvest-date") {
    return {
      title: "Enter the harvest date",
      instruction: `Click the highlighted date field and enter ${values.harvestDate}, as printed on the sample bag label.`,
      hint: "Use the field-label date, not today's date or the experiment creation date.",
      action: { kind: "type", label: `Enter ${values.harvestDate}` },
    };
  }
  if (field === "indicative-mass") {
    return {
      title: "Enter the declared mass",
      instruction: `Click the highlighted field and enter ${values.indicativeMassG} g. This is the approximate net mass declared on the bag label.`,
      hint: `Do not copy the ${grossMass} g gross reading or the ${netMass} g calculated net mass here. This field preserves what the sender declared.`,
      action: { kind: "type", label: `Type ${values.indicativeMassG}` },
    };
  }
  return {
    title: "Create the LIMS record",
    instruction:
      "Leave Sample mass empty for now, then click the highlighted Create LIMS record button.",
    hint: `The LIMS keeps the ${grossMass} g measured gross mass, the ${packagingTareMass} g bag tare, and the ${netMass} g calculated received net mass. Sample mass will be measured later on the Analytical balance.`,
    action: { kind: "click", label: "Click Create LIMS record" },
  };
}

function registerSamplePresentation(experiment: Experiment): TutorialStepPresentation {
  if (!workspaceWidget(experiment, "lims")?.isPresent) {
    return {
      title: "Deploy the LIMS terminal",
      instruction:
        "In Inventory, open Workspace equipment. Drag the highlighted LIMS terminal and drop it onto the central workspace.",
      hint: hasSampleBagOnGrossBalance(experiment)
        ? "Keep the bag on the balance while you deploy and complete the LIMS terminal."
        : "After deploying the terminal, return the sample bag to the Gross balance before entering the LIMS data.",
      action: { kind: "drag", label: "Drag to workspace" },
    };
  }

  if (!hasSampleBagOnGrossBalance(experiment)) {
    const bagAnchor = sampleBagSourceAnchor(experiment);
    const sourceInstruction =
      bagAnchor === "basket-received-bag"
        ? "Open the Produce basket, then drag the sample bag and drop it onto the Gross balance."
        : bagAnchor.startsWith("trash-tool-")
          ? "Open the Trash, then drag the sample bag and drop it onto the Gross balance."
          : bagAnchor.startsWith("bench-tool-card-")
            ? "Drag the sample bag from its workbench station and drop it onto the Gross balance."
            : "Locate the sample bag, then drag it and drop it onto the Gross balance.";
    return {
      title: "Return the sample bag to the Gross balance",
      instruction: sourceInstruction,
      hint: "Keep the bag on the balance until the LIMS record is complete and its printed label has been applied.",
      action: { kind: "drag", label: "Drag onto the balance" },
    };
  }

  if (!experiment.limsReception.labSampleCode) {
    const values = getLimsTutorialValues(experiment);
    return {
      title: "Create the LIMS record",
      instruction:
        `Review the reception mass calculation. Then enter Orchard / producer: ${values.orchardName}. Enter Harvest date: ${values.harvestDate}. Enter Declared mass from bag label: ${values.indicativeMassG} g. Leave Sample mass empty for now. Then click Create LIMS record.`,
      hint: `The LIMS automatically keeps the ${values.measuredGrossMassG?.toFixed(1) ?? "current"} g gross reading and calculates ${values.measuredNetMassG?.toFixed(1) ?? "the net mass"} g after subtracting the ${values.packagingTareMassG.toFixed(1)} g bag tare.`,
      action: { kind: "type", label: "Enter the values, then click" },
    };
  }

  if (!experiment.limsReception.printedLabelTicket) {
    return {
      title: "Print the LIMS label",
      instruction: "In the LIMS terminal, click Print label.",
      hint: "The printed label will appear in the LIMS terminal and can then be dragged.",
      action: { kind: "click", label: "Click Print label" },
    };
  }

  return {
    title: "Apply the LIMS label",
    instruction:
      "Drag the printed LIMS label from the terminal and drop it directly onto the sample bag on the Gross balance.",
    hint: "Once the label is attached, you can move the bag away and store the balance.",
    action: { kind: "drag", label: "Drag label onto bag" },
  };
}

function extractionEquipmentTarget(
  experiment: Experiment,
  widgetId: "vortex" | "centrifuge",
  paletteItemId: string,
): TutorialTarget {
  if (!workspaceWidget(experiment, widgetId)?.isPresent) {
    return {
      anchor: `palette-item-${paletteItemId}`,
      dropAnchor: workspaceCanvasAnchor,
    };
  }
  const tube = extractionTube(experiment);
  if (!toolIsInWidget(experiment, widgetId, tube)) {
    return {
      anchor: toolSourceAnchor(experiment, (tool) => tool.id === tube?.id),
      dropAnchor: `widget-${widgetId}`,
    };
  }
  const widget = workspaceWidget(experiment, widgetId);
  if (widgetId === "vortex") {
    if ((widget?.vortexRunRemainingMs ?? 0) > 0) {
      return { anchor: "vortex-progress-bar" };
    }
    return {
      anchor: tube?.isSealed ? "vortex-start-button" : `seal-tool-${tube?.id}`,
    };
  }
  return {
    anchor: (widget?.centrifugeRunRemainingMs ?? 0) > 0
      ? "centrifuge-progress-bar"
      : "centrifuge-start-button",
  };
}

function extractionEquipmentPresentation(
  experiment: Experiment,
  widgetId: "vortex" | "centrifuge",
  equipmentName: "Vortex mixer" | "Centrifuge",
): Partial<TutorialStepPresentation> {
  if (!workspaceWidget(experiment, widgetId)?.isPresent) {
    return {
      title: `Deploy the ${equipmentName}`,
      instruction: `In Inventory, open Workspace equipment. Drag the highlighted ${equipmentName} and drop it onto the central workspace.`,
    };
  }
  const tube = extractionTube(experiment);
  if (!toolIsInWidget(experiment, widgetId, tube)) {
    return {
      title: `Return the extraction tube to the ${equipmentName}`,
      instruction: `Locate the extraction tube at the highlighted location, then drag it and drop it into the ${equipmentName}.`,
      hint: "Moving a required item away does not reset progress; the tutorial will keep pointing to its current location.",
    };
  }
  const widget = workspaceWidget(experiment, widgetId);
  if (
    (widgetId === "vortex" && (widget?.vortexRunRemainingMs ?? 0) > 0) ||
    (widgetId === "centrifuge" && (widget?.centrifugeRunRemainingMs ?? 0) > 0)
  ) {
    return {
      title: widgetId === "vortex" ? "Wait for vortex mixing" : "Wait for phase separation",
      instruction: "Watch the highlighted progress bar. Leave the extraction tube inside until it reaches 100%.",
      action: { kind: "wait", label: "Wait for 100%" },
    };
  }
  return widgetId === "vortex"
    ? {
        title: tube?.isSealed ? "Start the vortex cycle" : "Seal the extraction tube",
        instruction: tube?.isSealed
          ? "Click the highlighted Start vortex button."
          : "Click the highlighted Close button on the extraction tube before starting the mixer.",
        action: tube?.isSealed
          ? { kind: "click", label: "Click Start vortex" }
          : { kind: "click", label: "Click Close" },
      }
    : {
        title: "Start the centrifuge cycle",
        instruction: "Click the highlighted Start the centrifuge button.",
        action: { kind: "click", label: "Click Start centrifuge" },
      };
}

function sampleVialTarget(experiment: Experiment): TutorialTarget {
  const vial = plainSampleVial(experiment);
  if (!vial) {
    return workbenchPlacementTarget(experiment, "palette-item-sample_vial_lcms");
  }
  if (experiment.pipette.volumeMl > 0) {
    return { anchor: "tool-type-sample_vial" };
  }
  // Aspirating happens at the bench, and never through a sealed cap.
  const tube = extractionTube(experiment);
  if (toolIsInWidget(experiment, "centrifuge", tube)) {
    return workbenchPlacementTarget(experiment, "widget-centrifuge");
  }
  if (tube?.isSealed) {
    return { anchor: `seal-tool-${tube.id}` };
  }
  return { anchor: "pipette-aspirate" };
}

function sampleVialPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  const vial = plainSampleVial(experiment);
  if (vial && experiment.pipette.volumeMl <= 0) {
    const tube = extractionTube(experiment);
    if (toolIsInWidget(experiment, "centrifuge", tube)) {
      return workbenchPlacementPresentation(experiment, "extraction tube", {
        title: "Take the tube out of the centrifuge",
        instruction:
          "Drag the separated extraction tube out of the Centrifuge and drop it onto an empty workbench station. Pipetting is done at the bench, not inside the instrument.",
        hint: "The separated phases stay in place as long as the tube is moved gently.",
        action: { kind: "drag", label: "Drag the tube to the bench" },
      });
    }
    if (tube?.isSealed) {
      return {
        title: "Open the extraction tube",
        instruction:
          "Click the highlighted Open button on the extraction tube. The micropipette cannot aspirate through a sealed cap.",
        hint: "Only the supernatant is drawn; the settled pellet stays at the bottom of the tube.",
        action: { kind: "click", label: "Click Open" },
      };
    }
  }
  return vial
    ? {
        title: "Transfer extract into the Autosampler vial",
        instruction: experiment.pipette.volumeMl > 0
          ? "The micropipette now contains extract. Click the highlighted empty Autosampler vial to dispense it."
          : "Click Micropipette in Actions, or press P. Then click the separated extraction tube once to aspirate 1.00 mL.",
        hint: "The micropipette icon shows whether liquid is currently loaded.",
        action: experiment.pipette.volumeMl > 0
          ? { kind: "click", label: "Click vial to dispense" }
          : { kind: "keyboard", label: "Click pipette or press P" },
      }
    : workbenchPlacementPresentation(experiment, "Autosampler vial", {
        title: "Deploy an Autosampler vial",
        instruction:
          "In Inventory, open Containers. Drag an Autosampler vial and drop it onto an empty workbench station.",
        hint: "After placing the vial, use the Micropipette to transfer the separated extract into it.",
      });
}

function stageVialsTarget(experiment: Experiment): TutorialTarget {
  if (!workspaceWidget(experiment, "rack")?.isPresent) {
    return {
      anchor: "palette-item-autosampler_rack_widget",
      dropAnchor: workspaceCanvasAnchor,
    };
  }
  const sampleVial = preparedSampleVial(experiment);
  if (!toolIsInRack(experiment, sampleVial)) {
    return sampleVial?.isSealed
      ? {
          anchor: toolSourceAnchor(experiment, (tool) => tool.id === sampleVial.id),
          dropAnchor: "widget-rack",
        }
      : { anchor: `seal-tool-${sampleVial?.id}` };
  }
  const calibrationVial = preparedCalibrationVial(experiment);
  if (!toolIsInRack(experiment, calibrationVial)) {
    return calibrationVial?.isSealed
      ? {
          anchor: toolSourceAnchor(experiment, (tool) => tool.id === calibrationVial.id),
          dropAnchor: "widget-rack",
        }
      : { anchor: `seal-tool-${calibrationVial?.id}` };
  }
  const openRackVial = [sampleVial, calibrationVial].find((tool) => !tool?.isSealed);
  if (openRackVial) {
    return { anchor: `seal-tool-${openRackVial.id}` };
  }
  return { anchor: "widget-rack" };
}

function stageVialsPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  if (!workspaceWidget(experiment, "rack")?.isPresent) {
    return {
      title: "Deploy the Autosampler rack",
      instruction:
        "In Inventory, open Workspace equipment. Drag the Autosampler rack and drop it onto the central workspace.",
    };
  }
  const vials = [
    { tool: preparedSampleVial(experiment), name: "sample vial" },
    { tool: preparedCalibrationVial(experiment), name: "calibration vial" },
  ];
  const missing = vials.find(({ tool }) => !toolIsInRack(experiment, tool));
  if (missing) {
    return missing.tool?.isSealed
      ? {
          title: `Return the ${missing.name} to the rack`,
          instruction: `Drag the highlighted ${missing.name} and drop it into an empty rack position.`,
        }
      : {
          title: `Seal and stage the ${missing.name}`,
          instruction: `At the highlighted location, click Close on the ${missing.name}. Then drag it into an empty rack position.`,
        };
  }
  return {
    title: "Check both staged vials",
    instruction: "Make sure both rack vials are sealed. Close any vial that is still open.",
  };
}

function weighReceptionTarget(experiment: Experiment): TutorialTarget {
  if (!workspaceWidget(experiment, "gross_balance")?.isPresent) {
    return {
      anchor: "palette-item-gross_balance_widget",
      dropAnchor: workspaceCanvasAnchor,
    };
  }
  const sourceAnchor = sampleBagSourceAnchor(experiment);
  if (hasSampleBagOnGrossBalance(experiment) || sourceAnchor === "workspace") {
    return { anchor: "widget-gross_balance" };
  }
  return { anchor: sourceAnchor, dropAnchor: "widget-gross_balance" };
}

function registerSampleTarget(experiment: Experiment): TutorialTarget {
  if (!workspaceWidget(experiment, "lims")?.isPresent) {
    return {
      anchor: "palette-item-lims_terminal_widget",
      dropAnchor: workspaceCanvasAnchor,
    };
  }
  if (!hasSampleBagOnGrossBalance(experiment)) {
    return {
      anchor: sampleBagSourceAnchor(experiment),
      dropAnchor: "widget-gross_balance",
    };
  }
  if (!experiment.limsReception.labSampleCode) {
    return { anchor: "lims-form-next-field" };
  }
  if (!experiment.limsReception.printedLabelTicket) {
    return { anchor: "lims-print-label" };
  }
  // The printed label is dropped onto the bag, which is still on the balance.
  return { anchor: "lims-printed-ticket", dropAnchor: "widget-gross_balance" };
}

function storeGrossBalanceTarget(experiment: Experiment): TutorialTarget {
  if (workspaceWidget(experiment, "lims")?.isPresent) {
    return { anchor: "store-widget-lims" };
  }
  if (workspaceWidget(experiment, "gross_balance")?.tool) {
    return {
      anchor: "widget-gross_balance",
      dropAnchor: emptyWorkbenchStationAnchor(experiment),
    };
  }
  return { anchor: "store-widget-gross_balance" };
}

function weighReceptionPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  if (!workspaceWidget(experiment, "gross_balance")?.isPresent) {
    return {
      title: "Deploy the Gross balance",
      instruction:
        "In Inventory, open Workspace equipment. Drag the highlighted Gross balance and drop it onto the central workspace.",
      action: { kind: "drag", label: "Drag to workspace" },
    };
  }
  if (!hasSampleBagOnGrossBalance(experiment)) {
    return {
      title: "Place the sample bag on the Gross balance",
      instruction:
        "Locate the highlighted sample bag, then drag it and drop it onto the Gross balance.",
      action: { kind: "drag", label: "Drag bag onto balance" },
    };
  }
  return {
    title: "Wait for the gross mass",
    instruction: "Leave the bag on the Gross balance while its mass is recorded.",
    action: { kind: "wait", label: "Wait for the mass" },
  };
}

// Grind quality is scored on the average temperature held across the 30 s
// cycle, and friction adds back about 10 °C over that cycle. Starting at
// −70 °C lands the average around −65 °C, inside the fine-powder band, which
// is what makes a 10 g test portion representative of the lot: the sampling
// spread it leaves is roughly ±5 %, against ±20 % when the cycle is started at
// −45 °C. Waiting costs about 40 s of simulated time at a 1:1 dry-ice ratio.
const grinderReadyTemperatureC = -70;

function grindSampleTarget(experiment: Experiment): TutorialTarget {
  const grinder = workspaceWidget(experiment, "grinder");
  if (!grinder?.isPresent) {
    return {
      anchor: "palette-item-cryogenic_grinder_widget",
      dropAnchor: workspaceCanvasAnchor,
    };
  }
  if (!(grinder.produceLots ?? []).length) {
    return {
      anchor: produceSourceAnchor(experiment, ["cut"]),
      dropAnchor: "widget-grinder",
    };
  }
  if (!(grinder.liquids ?? []).some((liquid) => liquid.liquidId === "dry_ice_pellets")) {
    return { anchor: "palette-item-dry_ice_pellets", dropAnchor: "widget-grinder" };
  }
  const lot = grinder.produceLots?.[0];
  if ((grinder.grinderRunRemainingMs ?? 0) > 0) {
    return { anchor: "grinder-progress" };
  }
  if ((lot?.temperatureC ?? 20) > grinderReadyTemperatureC) {
    return { anchor: lot ? `temperature-${lot.id}` : "grinder-lcd-panel" };
  }
  return { anchor: "grinder-power-button" };
}

function grindSamplePresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  const grinder = workspaceWidget(experiment, "grinder");
  if (!grinder?.isPresent) {
    return {
      title: "Deploy the Cryogenic grinder",
      instruction:
        "In Inventory, open Workspace equipment. Drag the Cryogenic grinder and drop it onto the central workspace.",
      action: { kind: "drag", label: "Drag to workspace" },
    };
  }
  if (!(grinder.produceLots ?? []).length) {
    return {
      title: "Load the cut apples into the grinder",
      instruction:
        "Drag the cut apples from the highlighted location and drop them into the Cryogenic grinder.",
      action: { kind: "drag", label: "Drag apples into grinder" },
    };
  }
  if (!(grinder.liquids ?? []).some((liquid) => liquid.liquidId === "dry_ice_pellets")) {
    const appleMassG = (grinder.produceLots ?? []).reduce(
      (total, produceLot) => total + produceLot.totalMassG,
      0,
    );
    // A 1:1 ratio is a target, not a specification: rounding to the nearest 100 g
    // keeps the value the learner has to type readable.
    const dryIceMassG = Math.max(100, Math.round(appleMassG / 100) * 100);
    const formattedDryIceMassG = dryIceMassG.toFixed(0);
    return {
      title: "Add Dry ice pellets",
      instruction:
        `In Inventory, open Reagents & materials. Drag Dry ice pellets into the Cryogenic grinder. In the dosing dialog, enter ${formattedDryIceMassG} g—roughly the mass of the apples—then confirm.`,
      hint:
        `Using a 1:1 dry-ice-to-apple mass ratio cools the lot gradually. Do not start the grinder while the temperature is above −${Math.abs(grinderReadyTemperatureC)} °C — a warmer start grinds the apples granular instead of fine.`,
      action: { kind: "drag", label: `Add ${formattedDryIceMassG} g dry ice` },
    };
  }
  if ((grinder.grinderRunRemainingMs ?? 0) > 0) {
    return {
      title: "Wait for grinding to finish",
      instruction: "Watch the highlighted progress bar. Do not remove the apples while the grinder is running.",
      hint: "The tutorial will continue automatically when the material becomes ground.",
      action: { kind: "wait", label: "Wait for 100%" },
    };
  }
  const lot = grinder.produceLots?.[0];
  if ((lot?.temperatureC ?? 20) > grinderReadyTemperatureC) {
    return {
      title: "Wait for the apples to become cryogenic",
      instruction: `Watch the highlighted thermometer. Wait until it reads −${Math.abs(grinderReadyTemperatureC)} °C or colder before starting the grinder.`,
      hint: "The temperature falls over simulation ticks after the dry ice is added. Grinding a warmer lot leaves it granular, and a granular lot makes the weighed test portion unrepresentative.",
      action: { kind: "wait", label: `Wait until −${Math.abs(grinderReadyTemperatureC)} °C` },
    };
  }
  return {
    title: "Start the grinder cycle",
    instruction: "The apples are cold enough. Click the highlighted red power button on the grinder.",
    hint: "After clicking, watch the progress indicator and leave the contents inside the grinder.",
    action: { kind: "click", label: "Click power" },
  };
}

const tutorialCentrifugeTubeTareMassG = 12;

function toolPowderMassG(tool: BenchToolInstance) {
  return tool.powderMassG ??
    (tool.produceFractions ?? []).reduce((total, fraction) => total + fraction.massG, 0);
}

function analyticalTubeTareIsValid(experiment: Experiment) {
  return experiment.analyticalBalance.tareMassG !== null &&
    Math.abs(
      experiment.analyticalBalance.tareMassG - tutorialCentrifugeTubeTareMassG,
    ) < 0.005;
}

function analyticalBalanceTubeOnPan(experiment: Experiment) {
  const tool = workspaceWidget(experiment, "analytical_balance")?.tool;
  return tool?.toolType === "centrifuge_tube" ? tool : null;
}

function analyticalWeighingTube(experiment: Experiment) {
  const tubeOnPan = analyticalBalanceTubeOnPan(experiment);
  if (tubeOnPan) {
    return tubeOnPan;
  }
  return allTools(experiment).find(
    (tool) =>
      tool.toolType === "centrifuge_tube" &&
      (toolPowderMassG(tool) <= 0 || analyticalTubeTareIsValid(experiment)),
  );
}

function hasCompromisedAnalyticalTube(experiment: Experiment) {
  return allTools(experiment).some(
    (tool) =>
      tool.toolType === "centrifuge_tube" &&
      toolPowderMassG(tool) > 0 &&
      !analyticalTubeTareIsValid(experiment),
  );
}

function analyticalWeighingTarget(experiment: Experiment): TutorialTarget {
  const balance = workspaceWidget(experiment, "analytical_balance");
  if (!balance?.isPresent) {
    return {
      anchor: "palette-item-analytical_balance_widget",
      dropAnchor: workspaceCanvasAnchor,
    };
  }
  const tubeOnPan = analyticalBalanceTubeOnPan(experiment);
  if (
    tubeOnPan &&
    toolPowderMassG(tubeOnPan) > 0 &&
    !analyticalTubeTareIsValid(experiment)
  ) {
    return { anchor: "widget-analytical_balance", dropAnchor: trashAnchor };
  }
  const tube = analyticalWeighingTube(experiment);
  if (!tube) {
    return {
      anchor: "palette-item-centrifuge_tube_50ml",
      dropAnchor: "widget-analytical_balance",
    };
  }
  if (!toolIsInWidget(experiment, "analytical_balance", tube)) {
    return {
      anchor: toolSourceAnchor(experiment, (tool) => tool.id === tube.id),
      dropAnchor: "widget-analytical_balance",
    };
  }
  if (!analyticalTubeTareIsValid(experiment)) {
    return { anchor: "analytical-balance-tare" };
  }
  if (experiment.spatula.isLoaded) {
    return { anchor: "widget-analytical_balance" };
  }
  const powderJar = storageContainer(experiment);
  return {
    anchor: powderJar
      ? `spatula-load-powder:${toolSourceAnchor(experiment, (tool) => tool.id === powderJar.id)}`
      : "action-spatula",
  };
}

function analyticalWeighingPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  if (!workspaceWidget(experiment, "analytical_balance")?.isPresent) {
    return {
      title: "Deploy the Analytical balance",
      instruction:
        "In Inventory, open Workspace equipment. Drag the Analytical balance and drop it onto the central workspace.",
    };
  }
  const tubeOnPan = analyticalBalanceTubeOnPan(experiment);
  if (
    tubeOnPan &&
    toolPowderMassG(tubeOnPan) > 0 &&
    !analyticalTubeTareIsValid(experiment)
  ) {
    return {
      title: "Replace the compromised tube",
      instruction:
        "This tube was tared after powder had already been added, so its Net reading can no longer teach the weighing correctly. Discard it, then deploy a fresh 50 mL tube from Inventory.",
      hint: "The tutorial will ignore this compromised tube after it reaches the trash and point to a replacement.",
      action: { kind: "drag", label: "Discard this tube" },
    };
  }
  const tube = analyticalWeighingTube(experiment);
  if (!tube) {
    const isReplacingCompromisedTube = hasCompromisedAnalyticalTube(experiment);
    return {
      title: isReplacingCompromisedTube
        ? "Deploy a replacement 50 mL tube"
        : "Deploy a 50 mL tube",
      instruction: isReplacingCompromisedTube
        ? "In Inventory, open Containers. Drag a fresh 50 mL centrifuge tube and drop it onto the Analytical balance. Do not recover the compromised powdered tube from the trash."
        : "In Inventory, open Containers. Drag a 50 mL centrifuge tube and drop it onto the Analytical balance.",
    };
  }
  if (!toolIsInWidget(experiment, "analytical_balance", tube)) {
    return {
      title: "Return the tube to the Analytical balance",
      instruction:
        "Drag the highlighted 50 mL tube and drop it onto the Analytical balance.",
    };
  }
  if (!analyticalTubeTareIsValid(experiment)) {
    return {
      title: hasCompromisedAnalyticalTube(experiment)
        ? "Tare the replacement tube"
        : "Tare the tube",
      instruction:
        "The replacement tube is empty. Click Tare now so Net returns to 0.000 g before adding any powder.",
      action: { kind: "click", label: "Click Tare" },
    };
  }
  return {
    title: "Add the test portion",
    instruction: experiment.spatula.isLoaded
      ? "The spatula contains powder. Click and hold the tube on the Analytical balance until Net reaches about 10.000 g; release before 10.2 g."
      : "Click the highlighted Powder spatula in Actions, or press S. Then click the powder in the HDPE container to load it.",
    action: experiment.spatula.isLoaded
      ? { kind: "click", label: "Hold to dose about 10.000 g" }
      : { kind: "keyboard", label: "Click spatula or press S" },
  };
}

function extractionPreparationTarget(experiment: Experiment): TutorialTarget {
  const tube = extractionTube(experiment);
  const tubeAnchor = toolSourceAnchor(experiment, (tool) => tool.id === tube?.id);
  const liquids = tube?.liquids ?? [];
  if (!liquids.some((liquid) => liquid.liquidId === "istd_solution")) {
    return { anchor: "palette-item-istd_solution", dropAnchor: tubeAnchor };
  }
  if (!liquids.some((liquid) => liquid.liquidId === "acetonitrile_extraction" && liquid.volume_ml >= 9.5)) {
    return { anchor: "palette-item-acetonitrile_extraction", dropAnchor: tubeAnchor };
  }
  return tube?.quechersState?.saltsAdded
    ? { anchor: tubeAnchor }
    : { anchor: "palette-item-quechers_salts", dropAnchor: tubeAnchor };
}

function extractionPreparationPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  const tube = extractionTube(experiment);
  const liquids = tube?.liquids ?? [];
  if (!liquids.some((liquid) => liquid.liquidId === "istd_solution")) {
    return { title: "Add the ISTD solution", instruction: "Drag the highlighted ISTD solution onto the extraction tube. Keep 0.05 mL in the dialog, then click Confirm.", action: { kind: "drag", label: "Add 0.05 mL ISTD" } };
  }
  if (!liquids.some((liquid) => liquid.liquidId === "acetonitrile_extraction" && liquid.volume_ml >= 9.5)) {
    return { title: "Add the extraction solvent", instruction: "Drag the highlighted Acetonitrile onto the same tube. Enter 10 mL in the dialog, then click Confirm.", action: { kind: "drag", label: "Add 10 mL acetonitrile" } };
  }
  return { title: "Add the QuEChERS salts", instruction: "Drag the highlighted QuEChERS salts packet onto the extraction tube and confirm the addition.", action: { kind: "drag", label: "Add the salts packet" } };
}

function calibrationVialTarget(experiment: Experiment): TutorialTarget {
  const vial = plainSampleVial(experiment);
  return vial
    ? {
        anchor: "palette-item-calibration_solution",
        dropAnchor: toolSourceAnchor(experiment, (tool) => tool.id === vial.id),
      }
    : workbenchPlacementTarget(experiment, "palette-item-sample_vial_lcms");
}

function calibrationVialPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  return plainSampleVial(experiment)
    ? {
        title: "Prepare the calibration vial",
        instruction:
          "Drag the highlighted Multi-residue stock solution onto the empty Autosampler vial. Enter 10 ng/mL, then click Confirm.",
        action: { kind: "drag", label: "Prepare 10 ng/mL" },
      }
    : workbenchPlacementPresentation(experiment, "Autosampler vial", {
        title: "Deploy a second Autosampler vial",
        instruction:
          "In Inventory, open Containers. Drag another Autosampler vial and drop it onto an empty workbench station.",
      });
}

function storageContainer(experiment: Experiment) {
  return allTools(experiment).find((tool) => tool.toolType === "storage_jar");
}

function emptyWorkbenchStationAnchor(experiment: Experiment) {
  const emptySlot = experiment.workbench.slots.find(
    (slot) => !slot.tool && (slot.surfaceProduceLots ?? []).length === 0,
  );
  return emptySlot ? `bench-slot-${emptySlot.id}` : null;
}

function hasEmptyWorkbenchStation(experiment: Experiment) {
  return emptyWorkbenchStationAnchor(experiment) !== null;
}

const addWorkbenchStationAnchor = "add-workbench-slot-button";
const workspaceCanvasAnchor = "workspace";
const trashAnchor = "trash-dropzone";

// Every step that ends with an item on the bench needs a free station first,
// otherwise the learner is told to drop something with nowhere to drop it.
function workbenchPlacementTarget(experiment: Experiment, anchor: string): TutorialTarget {
  const stationAnchor = emptyWorkbenchStationAnchor(experiment);
  return stationAnchor
    ? { anchor, dropAnchor: stationAnchor }
    : { anchor: addWorkbenchStationAnchor };
}

function addWorkbenchStationPresentation(itemName: string): Partial<TutorialStepPresentation> {
  return {
    title: "Add a workbench station",
    instruction:
      `There is no empty station for the ${itemName}. ` +
      "Click the highlighted + button in the Workbench header to add one.",
    hint: "Once the new station appears, the tutorial points back to the item to place.",
    action: { kind: "click", label: "Click +" },
  };
}

function workbenchPlacementPresentation(
  experiment: Experiment,
  itemName: string,
  presentation: Partial<TutorialStepPresentation>,
): Partial<TutorialStepPresentation> {
  return hasEmptyWorkbenchStation(experiment)
    ? presentation
    : addWorkbenchStationPresentation(itemName);
}

function storeGrinderTarget(experiment: Experiment): TutorialTarget {
  const grinder = workspaceWidget(experiment, "grinder");
  const storageJar = storageContainer(experiment);
  if ((grinder?.produceLots ?? []).length > 0 && !storageJar) {
    return workbenchPlacementTarget(experiment, "palette-item-hdpe_storage_jar_2l");
  }
  if ((grinder?.produceLots ?? []).length > 0) {
    return {
      anchor: `grinder-produce-${grinder?.produceLots?.[0]?.id}`,
      dropAnchor: storageJar
        ? toolSourceAnchor(experiment, (tool) => tool.id === storageJar.id)
        : null,
    };
  }
  return { anchor: "store-widget-grinder" };
}

function storeEquipmentTarget(
  experiment: Experiment,
  widgetId: "gross_balance" | "analytical_balance" | "vortex" | "centrifuge",
): TutorialTarget {
  return workspaceWidget(experiment, widgetId)?.tool
    ? workbenchPlacementTarget(experiment, `widget-${widgetId}`)
    : { anchor: `store-widget-${widgetId}` };
}

function storeGrinderPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  const grinder = workspaceWidget(experiment, "grinder");
  if ((grinder?.produceLots ?? []).length > 0) {
    if (!storageContainer(experiment) && !hasEmptyWorkbenchStation(experiment)) {
      return addWorkbenchStationPresentation("storage jar");
    }
    return storageContainer(experiment)
      ? {
          title: "Transfer the ground powder",
          instruction:
            "Drag the ground powder out of the grinder and drop it into the HDPE storage container. Then store the empty grinder.",
        }
      : {
          title: "Deploy an HDPE storage container",
          instruction:
            "In Inventory, open Containers. Drag the Wide-neck HDPE jar and drop it onto an empty workbench station.",
        };
  }
  return {
    title: "Store the empty grinder",
    instruction: "Click Store in inventory in the Cryogenic grinder header.",
  };
}

function storeEquipmentPresentation(
  experiment: Experiment,
  widgetId: "gross_balance" | "analytical_balance" | "vortex" | "centrifuge",
  equipmentName: string,
  itemName: string,
): Partial<TutorialStepPresentation> {
  return workspaceWidget(experiment, widgetId)?.tool
    ? workbenchPlacementPresentation(experiment, itemName, {
        title: `Remove the ${itemName}`,
        instruction: `Drag the ${itemName} out of the ${equipmentName} and drop it onto an empty workbench station.`,
        hint: `The ${equipmentName} can only be stored after it is empty.`,
        action: { kind: "drag", label: `Drag out the ${itemName}` },
      })
    : {
        title: `Store the ${equipmentName}`,
        instruction: `Click Store in inventory in the ${equipmentName} header.`,
        action: { kind: "click", label: "Click Store in inventory" },
      };
}

function inferTutorialAction(instruction: string): TutorialAction {
  const normalized = instruction.toLowerCase();
  if (normalized.includes("wait") || normalized.includes("watch")) {
    return { kind: "wait", label: "Wait and watch" };
  }
  if (normalized.includes("enter") || normalized.includes("fill")) {
    return { kind: "type", label: "Enter the requested values" };
  }
  if (normalized.includes("press ")) {
    return { kind: "keyboard", label: "Use the keyboard shortcut" };
  }
  if (normalized.includes("drag")) {
    return { kind: "drag", label: "Drag and drop" };
  }
  if (normalized.includes("click") || normalized.includes("select")) {
    return { kind: "click", label: "Click the highlighted control" };
  }
  return { kind: "inspect", label: "Follow the highlighted area" };
}

function launchSequenceTarget(experiment: Experiment): TutorialTarget {
  if (!workspaceWidget(experiment, "instrument")?.isPresent) {
    return {
      anchor: "palette-item-lc_msms_instrument_widget",
      dropAnchor: workspaceCanvasAnchor,
    };
  }
  return experiment.rack.state === "loaded"
    ? { anchor: "instrument-console-next" }
    : { anchor: "widget-rack", dropAnchor: "widget-instrument" };
}

function launchSequencePresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  if (!workspaceWidget(experiment, "instrument")?.isPresent) {
    return {
      title: "Deploy the LC-MS/MS",
      instruction:
        "In Inventory, open Workspace equipment. Drag the LC-MS/MS and drop it onto the central workspace.",
    };
  }
  if (experiment.rack.state !== "loaded") {
    return {
      title: "Load the rack into the LC-MS/MS",
      instruction: "Drag the highlighted loaded rack and drop it into the LC-MS/MS.",
    };
  }
  return {
    title: "Launch the acquisition",
    instruction:
      "Click Open acquisition console. Verify that one row is the calibration vial and one row is the sample vial, then click Launch acquisition.",
    action: { kind: "click", label: "Open console, then launch" },
  };
}

// A run leaves the rack "completed", still inside the instrument: anything other
// than "available" means it has to be unloaded before its vials can be taken out.
function rackIsInInstrument(experiment: Experiment) {
  return experiment.rack.state !== "available";
}

function cleanupAcquisitionPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  if (rackIsInInstrument(experiment)) {
    return {
      title: "Unload the rack",
      instruction: "In the LC-MS/MS, click Unload rack.",
      action: { kind: "click", label: "Click Unload rack" },
    };
  }
  if (experiment.rack.slots.some((slot) => slot.tool)) {
    return {
      title: "Empty the Autosampler rack",
      instruction:
        "Drag both vials out of the rack and place them on the workbench or in the trash.",
    };
  }
  if (workspaceWidget(experiment, "rack")?.isPresent) {
    return {
      title: "Store the empty rack",
      instruction: "Click Store in inventory in the Autosampler rack header.",
    };
  }
  return {
    title: "Store the LC-MS/MS",
    instruction: "Click Store in inventory in the LC-MS/MS header.",
  };
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
  // The weighed tube leaves the pan before the balance can be stored, so the test
  // portion counts wherever the tube stands afterwards.
  return (
    analyticalTubeTareIsValid(experiment) &&
    allTools(experiment).some(
      (tool) => tool.toolType === "centrifuge_tube" && toolPowderMassG(tool) >= 9.5,
    )
  );
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

function cutSampleTarget(experiment: Experiment): TutorialTarget {
  const board = allTools(experiment).find((tool) => tool.toolType === "cutting_board");
  if (!board) {
    return workbenchPlacementTarget(experiment, "palette-item-cutting_board_hdpe");
  }
  const isWhole = (lot: { id: string; materialState?: ProduceMaterialKind }) =>
    (lot.materialState ?? materialStateForLot(experiment, lot.id)) === "whole";
  if (!(board.produceLots ?? []).some(isWhole)) {
    const bag = sampleBagContainingWholeProduce(experiment);
    if (bag?.isSealed) {
      return { anchor: `seal-tool-${bag.id}` };
    }
    return {
      anchor: produceSourceAnchor(experiment, ["whole"]),
      dropAnchor: toolSourceAnchor(experiment, (tool) => tool.id === board.id),
    };
  }
  const wholeLot = board.produceLots?.find(isWhole);
  return { anchor: wholeLot ? `cut-apples-${wholeLot.id}` : "action-knife" };
}

function cleanupAcquisitionTarget(experiment: Experiment): TutorialTarget {
  if (rackIsInInstrument(experiment)) {
    return { anchor: "instrument-unload-rack" };
  }
  if (experiment.rack.slots.some((slot) => slot.tool)) {
    // Used vials may go to a free station or straight to the trash.
    return {
      anchor: "widget-rack",
      dropAnchor: emptyWorkbenchStationAnchor(experiment) ?? trashAnchor,
    };
  }
  return {
    anchor: workspaceWidget(experiment, "rack")?.isPresent
      ? "store-widget-rack"
      : "store-widget-instrument",
  };
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
    ...fromTarget(weighReceptionTarget),
    isSatisfied: (experiment) => (experiment.limsReception.measuredGrossMassG ?? 0) > 0,
    presentation: weighReceptionPresentation,
  }),
  step({
    id: "register-and-label-sample",
    chapterId: "reception",
    title: "Register and identify the sample",
    instruction:
      "Fill in the LIMS form, click Create LIMS record, and then click Print label.",
    hint: "Drag the printed LIMS label and drop it directly onto the sample bag.",
    prerequisites: ["weigh-received-sample"],
    ...fromTarget(registerSampleTarget),
    isSatisfied: (experiment) => hasAppliedLimsLabel(experiment),
    presentation: registerSamplePresentation,
  }),
  step({
    id: "store-gross-balance",
    chapterId: "reception",
    title: "Store the receiving balance",
    instruction:
      "Drag the sample bag off the balance and drop it onto an empty workbench station. Then click Store in inventory in the balance header.",
    hint: "The Store in inventory button becomes available once the weighing pan is empty.",
    prerequisites: ["register-and-label-sample"],
    ...fromTarget(storeGrossBalanceTarget),
    isSatisfied: (experiment) =>
      hasAppliedLimsLabel(experiment) &&
      !workspaceWidget(experiment, "lims")?.isPresent &&
      !workspaceWidget(experiment, "gross_balance")?.isPresent,
    presentation: (experiment) =>
      workspaceWidget(experiment, "lims")?.isPresent
        ? {
            title: "Store the LIMS terminal",
            instruction: "Click the highlighted Store in inventory button in the top-right corner of the LIMS terminal.",
            hint: "The LIMS record and printed label stay saved after the terminal is stored.",
            action: { kind: "click", label: "Click the top-right button" },
          }
        : storeEquipmentPresentation(
            experiment,
            "gross_balance",
            "Gross balance",
            "sample bag",
          ),
  }),
  step({
    id: "cut-sample",
    chapterId: "sample-preparation",
    title: "Cut the apples",
    instruction:
      "Drag a Cutting board from Inventory and drop it onto an empty workbench station. Drag the apples from the sample bag onto the board, click Stainless steel knife in Actions, and then click the apples.",
    hint: "Clicking the apples while the knife is active changes their material state to cut.",
    prerequisites: ["store-gross-balance"],
    ...fromTarget(cutSampleTarget),
    isSatisfied: (experiment) => hasMaterialState(experiment, ["cut", "ground", "slurry"]),
    presentation: (experiment) => {
      const board = allTools(experiment).find((tool) => tool.toolType === "cutting_board");
      if (!board) {
        return workbenchPlacementPresentation(experiment, "Cutting board", {
          title: "Deploy a Cutting board",
          instruction: "In Inventory, open MISC. Drag a Cutting board and drop it onto an empty workbench station.",
          action: { kind: "drag", label: "Drag board to workbench" },
        });
      }
      if (!(board.produceLots ?? []).some((lot) => (lot.materialState ?? materialStateForLot(experiment, lot.id)) === "whole")) {
        const bag = sampleBagContainingWholeProduce(experiment);
        if (bag?.isSealed) {
          return {
            title: "Open the sample bag",
            instruction:
              "Click the highlighted Open button on the sample bag. The apples cannot be dragged while the bag is sealed.",
            hint: "After the bag opens, the tutorial will highlight the apples inside it.",
            action: { kind: "click", label: "Click Open" },
          };
        }
        return {
          title: "Place the apples on the Cutting board",
          instruction: "Drag the highlighted apples themselves—not the bag—and drop them onto the Cutting board.",
          hint: "The sample bag stays behind. Only the apple lot moves onto the preparation board.",
          action: { kind: "drag", label: "Drag the apples" },
        };
      }
      return {
        title: "Select the Stainless steel knife",
        instruction: "Click the highlighted knife in Actions, or press K on your keyboard. Then click the apples on the Cutting board to cut them.",
        hint: "The knife button remains active until you click it again or select another action.",
        action: { kind: "keyboard", label: "Click knife or press K" },
      };
    },
  }),
  step({
    id: "grind-sample",
    chapterId: "sample-preparation",
    title: "Cryogenically homogenize the sample",
    instruction:
      "Drag the highlighted Cryogenic grinder from Inventory and drop it onto the central workspace. Then drag the cut apples and Dry ice pellets into the grinder and click Start grinder.",
    hint: "Wait for the cycle to finish and for the material state to become ground.",
    prerequisites: ["cut-sample"],
    ...fromTarget(grindSampleTarget),
    isSatisfied: (experiment) => hasMaterialState(experiment, ["ground", "slurry"]),
    presentation: grindSamplePresentation,
  }),
  step({
    id: "store-grinder",
    chapterId: "sample-preparation",
    title: "Empty and store the grinder",
    instruction:
      "Drag an HDPE storage container from Inventory onto an empty workbench station. Transfer the ground powder into it, then click Store in inventory in the grinder header.",
    hint: "The grinder must be empty before Store in inventory becomes available.",
    prerequisites: ["grind-sample"],
    ...fromTarget(storeGrinderTarget),
    isSatisfied: (experiment) =>
      hasMaterialState(experiment, ["ground", "slurry"]) &&
      !workspaceWidget(experiment, "grinder")?.isPresent,
    presentation: storeGrinderPresentation,
  }),
  step({
    id: "weigh-test-portion",
    chapterId: "sample-preparation",
    title: "Prepare the test portion",
    instruction:
      "Drag the highlighted Analytical balance from Inventory and drop it onto the central workspace. Place a 50 mL tube on it, click Tare, then use the Powder spatula action to add approximately 10.000 g of powder.",
    hint: "The total mass shown for the tube must reach at least 9.5 g.",
    prerequisites: ["store-grinder"],
    ...fromTarget(analyticalWeighingTarget),
    isSatisfied: hasTestPortion,
    presentation: analyticalWeighingPresentation,
  }),
  step({
    id: "store-analytical-balance",
    chapterId: "sample-preparation",
    title: "Store the analytical balance",
    instruction:
      "Drag the weighed tube off the analytical balance and drop it onto an empty workbench station. Then click Store in inventory in the balance header.",
    hint: "The test portion remains in the tube; only the empty balance is stored.",
    prerequisites: ["weigh-test-portion"],
    ...fromTarget((experiment) => storeEquipmentTarget(experiment, "analytical_balance")),
    isSatisfied: (experiment) =>
      hasTestPortion(experiment) &&
      !workspaceWidget(experiment, "analytical_balance")?.isPresent,
    presentation: (experiment) =>
      storeEquipmentPresentation(
        experiment,
        "analytical_balance",
        "Analytical balance",
        "weighed tube",
      ),
  }),
  step({
    id: "prepare-extraction",
    chapterId: "extraction",
    title: "Prepare the QuEChERS extraction",
    instruction:
      "Drag the ISTD solution onto the tube and confirm the volume. Repeat with acetonitrile to add 10 mL, then drag the QuEChERS salt packet onto the same tube.",
    hint: "Add the ISTD before the solvent to preserve the correct analytical provenance.",
    prerequisites: ["store-analytical-balance"],
    ...fromTarget(extractionPreparationTarget),
    isSatisfied: hasPreparedExtraction,
    presentation: extractionPreparationPresentation,
  }),
  step({
    id: "vortex-extract",
    chapterId: "extraction",
    title: "Vortex the extraction",
    instruction:
      "Drag the highlighted Vortex mixer from Inventory and drop it onto the central workspace. Seal the extraction tube, drag it into the mixer, and click Start vortex.",
    hint: "Wait until the vortex cycle is complete before removing the tube.",
    prerequisites: ["prepare-extraction"],
    ...fromTarget((experiment) =>
      extractionEquipmentTarget(experiment, "vortex", "vortex_mixer_widget")),
    isSatisfied: hasVortexedExtraction,
    presentation: (experiment) =>
      extractionEquipmentPresentation(experiment, "vortex", "Vortex mixer"),
  }),
  step({
    id: "store-vortex",
    chapterId: "extraction",
    title: "Store the vortex mixer",
    instruction: "Drag the mixed tube out of the vortex mixer and drop it onto an empty workbench station. Then click Store in inventory in the mixer header.",
    hint: "The centrifuge takes over in the next step, so the vortex mixer is no longer needed.",
    prerequisites: ["vortex-extract"],
    ...fromTarget((experiment) => storeEquipmentTarget(experiment, "vortex")),
    isSatisfied: (experiment) =>
      hasVortexedExtraction(experiment) && !workspaceWidget(experiment, "vortex")?.isPresent,
    presentation: (experiment) =>
      storeEquipmentPresentation(
        experiment,
        "vortex",
        "Vortex mixer",
        "mixed extraction tube",
      ),
  }),
  step({
    id: "separate-extract",
    chapterId: "extraction",
    title: "Centrifuge the extract",
    instruction:
      "Drag the highlighted Centrifuge from Inventory and drop it onto the central workspace. Drag the vortexed tube into the centrifuge and click Start the centrifuge.",
    hint: "Wait for the cycle to finish and for the extract phase to become separated.",
    prerequisites: ["store-vortex"],
    ...fromTarget((experiment) =>
      extractionEquipmentTarget(experiment, "centrifuge", "centrifuge_widget")),
    isSatisfied: hasSeparatedExtraction,
    presentation: (experiment) =>
      extractionEquipmentPresentation(experiment, "centrifuge", "Centrifuge"),
  }),
  step({
    id: "prepare-sample-vial",
    chapterId: "vials",
    title: "Prepare the sample vial",
    instruction:
      "Drag an Autosampler vial from Inventory onto an empty workbench station. Select Micropipette in Actions, click the separated tube to aspirate, then click the vial to dispense.",
    hint: "The vial becomes a sample vial when it receives extract from the separated tube.",
    prerequisites: ["separate-extract"],
    ...fromTarget(sampleVialTarget),
    isSatisfied: (experiment) => Boolean(preparedSampleVial(experiment)),
    presentation: sampleVialPresentation,
  }),
  step({
    id: "store-centrifuge",
    chapterId: "vials",
    title: "Store the centrifuge",
    instruction:
      "Drag the tube out of the centrifuge and drop it onto an empty workbench station. Then click Store in inventory in the centrifuge header.",
    hint: "The prepared sample vial retains the extract needed for the remaining steps.",
    prerequisites: ["prepare-sample-vial"],
    ...fromTarget((experiment) => storeEquipmentTarget(experiment, "centrifuge")),
    isSatisfied: (experiment) =>
      Boolean(preparedSampleVial(experiment)) &&
      !workspaceWidget(experiment, "centrifuge")?.isPresent,
    presentation: (experiment) =>
      storeEquipmentPresentation(
        experiment,
        "centrifuge",
        "Centrifuge",
        "separated extraction tube",
      ),
  }),
  step({
    id: "prepare-calibration-vial",
    chapterId: "vials",
    title: "Prepare a calibration point",
    instruction:
      "Drag a second Autosampler vial onto the workbench. Then drag the Multi-residue stock solution onto it, enter a concentration greater than zero, and confirm.",
    hint: "You may choose any positive level; this tutorial requires a single calibration point.",
    prerequisites: ["store-centrifuge"],
    ...fromTarget(calibrationVialTarget),
    isSatisfied: (experiment) => Boolean(preparedCalibrationVial(experiment)),
    presentation: calibrationVialPresentation,
  }),
  step({
    id: "stage-vials",
    chapterId: "acquisition",
    title: "Stage both vials for the sequence",
    instruction:
      "Drag the highlighted Autosampler rack from Inventory and drop it onto the central workspace. Seal both vials, then drag and drop each vial into an empty rack position.",
    hint: "The physical provenance of each vial allows the system to distinguish the sample from the calibration point.",
    prerequisites: ["prepare-calibration-vial"],
    ...fromTarget(stageVialsTarget),
    isSatisfied: (experiment) => {
      const rackTools = experiment.rack.slots.flatMap((slot) => (slot.tool ? [slot.tool] : []));
      return (
        rackTools.some((tool) => Boolean(tool.injectionContext) && Boolean(tool.isSealed)) &&
        rackTools.some((tool) => Boolean(tool.calibrationContext) && Boolean(tool.isSealed))
      );
    },
    presentation: stageVialsPresentation,
  }),
  step({
    id: "launch-sequence",
    chapterId: "acquisition",
    title: "Load and start the sequence",
    instruction:
      "Drag the highlighted LC-MS/MS from Inventory and drop it onto the central workspace. Drag and drop the loaded rack into the instrument, open the console, check both rows, and click Launch acquisition.",
    hint: "The sequence must contain one calibration injection and one sample injection.",
    prerequisites: ["stage-vials"],
    ...fromTarget(launchSequenceTarget),
    isSatisfied: (experiment) => sequenceRuns(experiment).length > 0,
    presentation: launchSequencePresentation,
  }),
  step({
    id: "review-results",
    chapterId: "acquisition",
    title: "Review the results",
    instruction:
      "Wait for both injections to finish, then compare the calibration point and sample results.",
    hint: "You can follow the active injection directly on the instrument illustration.",
    prerequisites: ["launch-sequence"],
    anchor: () => "instrument-screen",
    isSatisfied: completedCalibrationAndSampleRun,
    presentation: (experiment) => {
      const run = sequenceRuns(experiment).at(-1);
      const progress = run && run.totalDurationS > 0
        ? Math.round((run.elapsedS / run.totalDurationS) * 100)
        : 0;
      return {
        title: "Wait for both injections",
        instruction: `Watch the highlighted instrument screen. Acquisition is ${progress}% complete; wait until both the calibration and sample injections finish.`,
        hint: "Do not unload the rack during acquisition. Results open automatically as the injections complete.",
        action: { kind: "wait", label: `Wait — ${progress}% complete` },
      };
    },
  }),
  step({
    id: "store-acquisition-equipment",
    chapterId: "acquisition",
    title: "Clear the acquisition workspace",
    instruction:
      "Click Unload rack from LC-MS/MS, drag both vials out of the rack, and place them on the workbench or in the trash. Then click Store in inventory for the empty rack and the LC-MS/MS.",
    hint: "The results remain available after the equipment is stored.",
    prerequisites: ["review-results"],
    ...fromTarget(cleanupAcquisitionTarget),
    isSatisfied: completedRunAndStoredAcquisitionEquipment,
    presentation: cleanupAcquisitionPresentation,
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

export function getTutorialStepPresentation(
  tutorialStep: TutorialStep,
  experiment: Experiment,
): TutorialStepPresentation {
  const dynamicPresentation = tutorialStep.presentation?.(experiment);
  const instruction = dynamicPresentation?.instruction ?? tutorialStep.instruction;
  return {
    title: tutorialStep.title,
    instruction,
    hint: tutorialStep.hint,
    action: inferTutorialAction(instruction),
    ...dynamicPresentation,
  };
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
