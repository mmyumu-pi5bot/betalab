import { translateNow, type MessageKey, type MessageParams } from "@/lib/i18n";
import { enMessages } from "@/lib/i18n/messages/en";
import type { Experiment } from "@/types/experiment";
import type {
  BenchToolInstance,
  ExperimentWorkspaceWidget,
  ProduceMaterialKind,
} from "@/types/workbench";

export const CALIBRATION_SAMPLE_TUTORIAL_ID = "calibration-sample-v1";

/** A message the tutorial shows, named by catalogue key and resolved on display. */
export type TutorialText = MessageKey | { key: MessageKey; params: MessageParams };

function textKey(text: TutorialText): MessageKey {
  return typeof text === "string" ? text : text.key;
}

export function resolveTutorialText(text: TutorialText): string {
  return typeof text === "string" ? translateNow(text) : translateNow(text.key, text.params);
}

export type TutorialChapter = {
  id: string;
  title: MessageKey;
  stepIds: string[];
};

export type TutorialStep = {
  id: string;
  chapterId: string;
  // Catalogue references, not text: the steps are built once at module load,
  // while the language can change at any point afterwards.
  title: TutorialText;
  instruction: TutorialText;
  hint: TutorialText;
  prerequisites: string[];
  anchor: (experiment: Experiment) => string | null;
  dropAnchor?: (experiment: Experiment) => string | null;
  // The amount the dosing dialog this step opens is waiting for, when the step
  // asks for one. It is what lets the coach tell a half-typed box from a box the
  // learner can send.
  expectedQuantity?: (experiment: Experiment) => TutorialQuantity | null;
  isSatisfied: (experiment: Experiment) => boolean;
  // A step the learner may have to redo. Completion is otherwise permanent — it is
  // persisted across reloads, and several steps stop being satisfied by design once
  // the learner moves on — so a step that can be undone by an accident has to say so
  // itself, or the tutorial strands on a step nothing can satisfy any more.
  isInvalidated?: (experiment: Experiment) => boolean;
  presentation?: (experiment: Experiment) => Partial<TutorialStepPresentation>;
};

// A step that ends in a drag has two places to point at: the item to pick up and
// the place to release it. Both come out of the same branching resolver so the
// highlighted source and destination can never describe different sub-steps.
type TutorialTarget = {
  anchor: string;
  dropAnchor?: string | null;
  expectedQuantity?: TutorialQuantity | null;
};

function fromTarget(resolve: (experiment: Experiment) => TutorialTarget) {
  return {
    anchor: (experiment: Experiment) => resolve(experiment).anchor,
    dropAnchor: (experiment: Experiment) => resolve(experiment).dropAnchor ?? null,
    expectedQuantity: (experiment: Experiment) => resolve(experiment).expectedQuantity ?? null,
  };
}

export type TutorialStepPresentation = {
  title: string;
  instruction: string;
  hint: string;
  action?: TutorialAction;
  // A hard time limit the simulation starts enforcing the moment this step's action
  // lands. Carried apart from the instruction because a deadline buried in a
  // paragraph reads as decoration until it has already run out.
  deadline?: string;
};

// Mirrors quechers_cementation_seconds in the backend physical simulation.
const cementationWindowSeconds = 15;

export type TutorialCountdown = {
  label: string;
  remainingSeconds: number;
  totalSeconds: number;
};

// Nothing on the bench states how much of the reaction window is left, and the
// learner has no reason yet to suspect there is one. A real analyst would be watching
// their own clock, so the tutorial lends one: it makes the deadline legible without
// making it any softer.
export function getTutorialCountdown(experiment: Experiment): TutorialCountdown | null {
  const reactingTube = allTools(experiment).find(
    (tool) =>
      tool.toolType === "centrifuge_tube" && tool.quechersState?.phase === "reacting",
  );
  if (!reactingTube) {
    return null;
  }
  const progress = Math.min(
    Math.max(reactingTube.quechersState?.cementationProgress ?? 0, 0),
    1,
  );
  return {
    label: translateNow("tutorial.gettutorialcountdown.label"),
    remainingSeconds: Math.max((1 - progress) * cementationWindowSeconds, 0),
    totalSeconds: cementationWindowSeconds,
  };
}

export type TutorialAction = {
  kind: "click" | "drag" | "inspect" | "keyboard" | "type" | "wait";
  label: string;
};

/**
 * An amount a dosing dialog is waiting for. A drop that opens such a dialog is
 * really two gestures — type the value, then send it — and rolling them into one
 * instruction hides the only moment where a wrong amount can still be caught.
 */
export type TutorialQuantity = {
  amount: number;
  unitLabel: string;
};

/** Which half of an open dosing dialog the learner still has to do. */
export type DropDraftStage = "amount" | "confirm";

// The dialog sends exactly what the box holds, so there is no band of "close
// enough" to honour: the tolerance only absorbs the float error of parsing a
// value like 0.005 back out of the input.
const quantityTolerance = 1e-9;

function formatTutorialQuantity(quantity: TutorialQuantity) {
  return `${quantity.amount} ${quantity.unitLabel}`;
}

/**
 * Null when the step never named an amount: the coach then leaves the dialog
 * alone and keeps showing the step's own wording, as it did before amounts were
 * spelled out.
 */
export function resolveDropDraftStage(
  typedAmount: number | null,
  expected: TutorialQuantity | null,
): DropDraftStage | null {
  if (!expected) {
    return null;
  }
  return typedAmount !== null && Math.abs(typedAmount - expected.amount) <= quantityTolerance
    ? "confirm"
    : "amount";
}

export function getDropDraftPresentation(
  stage: DropDraftStage,
  expected: TutorialQuantity,
  confirmLabel: string,
): TutorialStepPresentation {
  const amount = formatTutorialQuantity(expected);
  if (stage === "confirm") {
    return {
      title: translateNow("coach.dropDraft.confirm.title"),
      instruction: translateNow("coach.dropDraft.confirm.instruction", { p0: amount, p1: confirmLabel }),
      hint: translateNow("coach.dropDraft.confirm.hint"),
      action: { kind: "click", label: translateNow("coach.dropDraft.confirm.label", { p0: confirmLabel }) },
    };
  }
  return {
    title: translateNow("coach.dropDraft.amount.title"),
    instruction: translateNow("coach.dropDraft.amount.instruction", { p0: amount, p1: confirmLabel }),
    hint: translateNow("coach.dropDraft.amount.hint"),
    action: { kind: "type", label: translateNow("coach.dropDraft.amount.label", { p0: amount }) },
  };
}

export type LimsTutorialField =
  | "mass-summary"
  | "orchard"
  | "harvest-date"
  | "indicative-mass"
  | "create-record";

export type TutorialActionTool = "knife" | "pipette" | "spatula";

const tutorialActionTools: Record<TutorialActionTool, { key: string; nameKey: MessageKey }> = {
  knife: { key: "K", nameKey: "tutorial.tool.knife" },
  pipette: { key: "P", nameKey: "tutorial.tool.pipette" },
  spatula: { key: "S", nameKey: "tutorial.tool.spatula" },
};

export function isTutorialActionTool(value: string): value is TutorialActionTool {
  return Object.hasOwn(tutorialActionTools, value);
}

export function getTutorialActionToolPresentation(
  tool: TutorialActionTool,
): TutorialStepPresentation {
  const { key, nameKey } = tutorialActionTools[tool];
  const name = translateNow(nameKey);
  return {
    title: translateNow("tutorial.gettutorialactiontoolpresentation.title", { p0: name }),
    instruction: translateNow("tutorial.gettutorialactiontoolpresentation.instruction", { p0: name, p1: name, p2: key }),
    hint: translateNow("tutorial.gettutorialactiontoolpresentation.hint"),
    action: { kind: "click", label: translateNow("tutorial.gettutorialactiontoolpresentation.label", { p0: key }) },
  };
}

// A tool that is put down still loaded reads as a dead end: the step points at the
// container to pour into, and nothing happens on click. Naming the pickup first is
// the same move as asking for a tool to be put away before a drag.
export function getTutorialActionToolPickupPresentation(
  tool: TutorialActionTool,
): TutorialStepPresentation {
  const { key, nameKey } = tutorialActionTools[tool];
  const name = translateNow(nameKey);
  return {
    title: translateNow("tutorial.gettutorialactiontoolpickuppresentation.title", { p0: name }),
    instruction: translateNow("tutorial.gettutorialactiontoolpickuppresentation.instruction", { p0: name, p1: name, p2: key }),
    hint: translateNow("tutorial.gettutorialactiontoolpickuppresentation.hint", { p0: name }),
    action: { kind: "click", label: translateNow("tutorial.gettutorialactiontoolpickuppresentation.label", { p0: key }) },
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
    title: translateNow("tutorial.gettutorialinventorycategorypresentation.title", { p0: label }),
    instruction: translateNow("tutorial.gettutorialinventorycategorypresentation.instruction", { p0: label }),
    hint: translateNow("tutorial.gettutorialinventorycategorypresentation.hint"),
    action: { kind: "click", label: translateNow("tutorial.gettutorialinventorycategorypresentation.label", { p0: label }) },
  };
}

type LimsTutorialValues = {
  orchardName: string;
  harvestDate: string;
  indicativeMassG: number;
  measuredGrossMassG: number | null;
  measuredNetMassG: number | null;
  packagingTareMassG: number;
};

type TutorialDefinition = {
  id: string;
  version: 1;
  title: MessageKey;
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

// A tube the simulation will never let the learner finish: the QuEChERS salts have
// set hard, or the contents spilled during an unsealed vortex cycle. The backend
// refuses every remaining operation on it, so the tutorial drops it from its working
// set — the only thing left to do with it is to throw it away.
function isSpentExtractionTube(tool: BenchToolInstance) {
  const phase = tool.quechersState?.phase;
  return (
    tool.toolType === "centrifuge_tube" &&
    (phase === "cemented" || phase === "contaminated")
  );
}

// A tube still carrying the test portion, whatever stage it has reached: dry powder
// before the solvent, slurry once the extraction is under way. Wetting the sample
// turns the ground powder into slurry and drops its powder mass to zero, so mass
// alone stops describing the line the moment the chapter starts moving.
function carriesTestPortion(tool: BenchToolInstance) {
  return (
    tool.toolType === "centrifuge_tube" &&
    !isSpentExtractionTube(tool) &&
    (toolPowderMassG(tool) >= 9.5 ||
      tool.containsSlurry === true ||
      (tool.produceFractions ?? []).length > 0)
  );
}

// The chapter is walked back only while the ruined tube leaves the learner with no
// line at all. As soon as a replacement carries the test portion the tutorial runs
// forward again — the trash keeps the ruined tube for good, so a predicate that only
// asked whether one exists would rewind the chapter every time a later step legitimately
// stopped being satisfied.
function extractionLineIsLost(experiment: Experiment) {
  const trashedToolIds = new Set(experiment.trash.children.map((tool) => tool.id));
  return (
    allTools(experiment).some(isSpentExtractionTube) &&
    !allTools(experiment).some(
      (tool) => carriesTestPortion(tool) && !trashedToolIds.has(tool.id),
    )
  );
}

// The reagent step is walked back one stage later: a replacement tube may already
// carry the test portion and still owe its ISTD, solvent and salts. The salts are the
// marker because they are irreversible — asking whether the preparation is merely
// incomplete would also be true late in the run, once extract has been drawn off the
// prepared tube and its solvent volume has dropped.
function extractionRestartAwaitsReagents(experiment: Experiment) {
  return (
    allTools(experiment).some(isSpentExtractionTube) &&
    !(extractionTube(experiment)?.quechersState?.saltsAdded ?? false)
  );
}

// The tube still has to be reachable while it awaits the trash, so the coach can
// point at it. Once discarded it drops out of sight for good.
function spentExtractionTubeToDiscard(experiment: Experiment) {
  const trashedToolIds = new Set(experiment.trash.children.map((tool) => tool.id));
  return allTools(experiment).find(
    (tool) => isSpentExtractionTube(tool) && !trashedToolIds.has(tool.id),
  );
}

function extractionTube(experiment: Experiment) {
  const isExtractionTube = (tool: BenchToolInstance) =>
    tool.toolType === "centrifuge_tube" &&
    !isSpentExtractionTube(tool) &&
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

// A real batch runs a full ladder: one point forces the curve through the origin
// and the result is only as good as that assumption. But preparing five standards
// is the same five gestures repeated, and repeating them is not what the tutorial
// teaches — what it teaches is that a standard is taken labelled, spiked with the
// same ISTD dose as the sample, capped and declared. One point carries all of that,
// and free mode is where a learner builds the series out to as many rungs as they
// want. Everything that branches on the ladder reads this array rather than
// counting to five, so lengthening it is a one-line change — only the wording
// that names the rungs lives in the tutorial catalog.
//
// The rung is the top of the range rather than the middle. The residues a lot can
// carry span three decades — chlorpyrifos-methyl sits near 1 ug/kg, captan can reach
// 1500 — so a single point at 500 still leaves a compound above it in roughly two
// lots out of three: meeting a result outside the calibrated range stays the normal
// case rather than a rarity, which is the situation a dilution answers.
export const CALIBRATION_LADDER_NG_PER_ML: readonly number[] = [500];

function calibrationVials(experiment: Experiment) {
  return allTools(experiment).filter(
    (tool) =>
      tool.toolType === "sample_vial" &&
      (tool.calibrationContext?.levelNgPerMl ?? 0) > 0,
  );
}

function preparedCalibrationVial(experiment: Experiment, levelNgPerMl: number) {
  return calibrationVials(experiment).find(
    (tool) => tool.calibrationContext?.levelNgPerMl === levelNgPerMl,
  );
}

/** The rung the learner still has to prepare, or undefined once the ladder is complete. */
function nextCalibrationLevel(experiment: Experiment): number | undefined {
  return CALIBRATION_LADDER_NG_PER_ML.find((level) => !spikedCalibrationVial(experiment, level));
}

function calibrationLevelsOf(tools: readonly BenchToolInstance[]): number[] {
  const levels = tools
    .map((tool) => tool.calibrationContext?.levelNgPerMl ?? 0)
    .filter((level) => level > 0);
  // Two vials at the same level are two injections of one point, not two points:
  // the method declares one concentration column per level, not per vial.
  return [...new Set(levels)].sort((left, right) => left - right);
}

/**
 * The rungs the run will actually carry, ascending.
 *
 * The rack is what answers this once the batch is staged: those are the vials the
 * needle will draw from, and the method has to declare them and nothing else. A
 * standard that was taken off the shelf and then discarded — the wrong level
 * picked by mistake — is not part of the curve, so reading the bench at large
 * would declare a rung that was never injected and rescale every result computed
 * against it. Before staging there is no rack to read, so the vials on hand
 * answer instead, and an empty bench falls back to the ladder the tutorial is
 * about to walk.
 */
function preparedLadderLevels(experiment: Experiment): readonly number[] {
  const staged = calibrationLevelsOf(
    experiment.rack.slots.flatMap((slot) => (slot.tool ? [slot.tool] : [])),
  );
  if (staged.length > 0) {
    return staged;
  }
  const discardedIds = new Set(experiment.trash.children.map((tool) => tool.id));
  const onHand = calibrationLevelsOf(
    calibrationVials(experiment).filter((vial) => !discardedIds.has(vial.id)),
  );
  return onHand.length > 0 ? onHand : CALIBRATION_LADDER_NG_PER_ML;
}

/** The ladder as the learner has to retype it into the method editor. */
function preparedLadderText(experiment: Experiment): string {
  return preparedLadderLevels(experiment).join(", ");
}

// The field is free text — "1, 10, 50, 200, 500", "1 10 50 200 500", a stray
// trailing comma — so it is read as the numbers it contains rather than compared
// as a string.
function parseDeclaredLevels(text: string): number[] {
  return text
    .split(/[,;\s]+/)
    .filter((token) => token.length > 0)
    .map((token) => Number.parseFloat(token))
    .filter((level) => Number.isFinite(level));
}

/**
 * Whether a declared ladder describes the standards actually in the rack. The
 * order is not part of the answer: the method file numbers its concentration
 * columns in the order given, but what makes the curve right is which
 * concentrations are in it. A wrong or missing rung is what silently rescales
 * every result computed against the run.
 */
export function methodLevelsMatchLadder(experiment: Experiment, declared: string): boolean {
  const expected = preparedLadderLevels(experiment);
  const typed = parseDeclaredLevels(declared).sort((left, right) => left - right);
  return (
    typed.length === expected.length &&
    typed.every((level, index) => Math.abs(level - expected[index]) <= 1e-9)
  );
}

// A standard the internal standard never reached cannot correct anything: the
// ratio needs the ISTD on both injections, so an unspiked standard silently
// demotes the whole run to external calibration. Spiking it is therefore part of
// preparing the standard, not an optional extra.
//
// What the standard needs is the same ISTD *concentration* as the sample, and the
// sample's is fixed by the extraction — 0.05 mL of stock in 10 mL of solvent. The
// calibration vial holds 1 mL, so it takes a tenth of the tube's dose. Copying the
// tube's volume instead puts ten times too much in the standard and biases every
// ratio drawn against it by that factor, which reads as a clean run with wrong
// numbers. The dialog offers the tube's 0.05 mL, so this has to be typed.
const calibrationIstdVolumeMl = 0.005;

function spikedCalibrationVial(experiment: Experiment, levelNgPerMl: number) {
  const vial = preparedCalibrationVial(experiment, levelNgPerMl);
  return vial?.liquids.some((liquid) => liquid.liquidId === "istd_solution")
    ? vial
    : undefined;
}

/** Every rung prepared *and* spiked: an unspiked standard breaks the ISTD ratio. */
function spikedCalibrationLadder(experiment: Experiment) {
  return CALIBRATION_LADDER_NG_PER_ML.map((level) => spikedCalibrationVial(experiment, level));
}

function hasCompleteCalibrationLadder(experiment: Experiment) {
  return spikedCalibrationLadder(experiment).every(Boolean);
}

// The autosampler needle cannot reach the last 0.05 mL of a vial, so an aliquot at or
// below that draws nothing and every channel records baseline. The floor sits well
// clear of it rather than at the exact millilitre: the aspiration is a press-and-hold
// counting up in 0.05 mL steps, and demanding a precise volume would fail honest runs.
const vialDeadVolumeMl = 0.05;
const minimumInjectableAliquotMl = vialDeadVolumeMl * 4;

function toolLiquidVolumeMl(tool: BenchToolInstance) {
  return (tool.liquids ?? []).reduce((total, liquid) => total + liquid.volume_ml, 0);
}

// Identity, not readiness: this stays the sample vial for the rest of the run. Every
// injection draws a few microlitres out of it, so a vial that has already been through
// the sequence can sit below the workable floor and must still answer here.
function preparedSampleVial(experiment: Experiment) {
  return allTools(experiment).find(
    (tool) =>
      tool.toolType === "sample_vial" &&
      tool.injectionContext !== null &&
      tool.injectionContext !== undefined,
  );
}

// A vial that received extract but not enough of it to survive an injection. It is
// not a fresh vial and not a finished one, and the tutorial has to name that state:
// left alone it produces a run of flat traces with nothing explaining them.
function underfilledSampleVial(experiment: Experiment) {
  const vial = preparedSampleVial(experiment);
  return vial !== undefined && toolLiquidVolumeMl(vial) < minimumInjectableAliquotMl
    ? vial
    : undefined;
}

function hasInjectableSampleVial(experiment: Experiment) {
  const vial = preparedSampleVial(experiment);
  return vial !== undefined && toolLiquidVolumeMl(vial) >= minimumInjectableAliquotMl;
}

// What the vial would hold if the pipette were emptied into it now. Judging the
// aliquot only once it has landed makes the learner dispense, be told it fell short,
// and start over — the shortfall is knowable while the pipette is still in hand.
function pendingSampleAliquotMl(experiment: Experiment) {
  const vial = preparedSampleVial(experiment);
  return (vial ? toolLiquidVolumeMl(vial) : 0) + experiment.pipette.volumeMl;
}

// A vial is only identified once the reception label is physically on it. Printing
// the ticket is not enough: a ticket left in the terminal identifies nothing, and a
// rack of unlabelled look-alike vials is exactly what the label exists to prevent.
function toolCarriesReceptionLabel(experiment: Experiment, tool: BenchToolInstance | undefined) {
  const sampleCode = experiment.limsReception.labSampleCode;
  if (!tool || !sampleCode) {
    return false;
  }
  return (tool.labels ?? []).some(
    (label) => label.labelKind === "lims" && label.sampleCode === sampleCode,
  );
}

function hasLabelledSampleVial(experiment: Experiment) {
  return toolCarriesReceptionLabel(experiment, preparedSampleVial(experiment));
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

/** Where the learner stands inside the method manager, read from its own DOM. */
export type MethodWalkStage =
  | "duplicate"
  | "edit-tab"
  | "levels"
  | "levels-mismatch"
  | "reopen-levels"
  | "save"
  | "close-manager"
  | "launch";

export function getMethodWalkPresentation(
  experiment: Experiment,
  stage: MethodWalkStage,
): TutorialStepPresentation {
  if (stage === "edit-tab") {
    return {
      title: translateNow("tutorial.getmethodwalkpresentation.title"),
      instruction: translateNow("tutorial.getmethodwalkpresentation.instruction"),
      hint: translateNow("tutorial.getmethodwalkpresentation.hint"),
      action: { kind: "click", label: translateNow("tutorial.getmethodwalkpresentation.label") },
    };
  }
  if (stage === "duplicate") {
    return {
      title: translateNow("tutorial.getmethodwalkpresentation.title2"),
      instruction: translateNow("tutorial.getmethodwalkpresentation.instruction2"),
      hint: translateNow("tutorial.getmethodwalkpresentation.hint2"),
      action: { kind: "click", label: translateNow("tutorial.getmethodwalkpresentation.label2") },
    };
  }
  if (stage === "save") {
    return {
      title: translateNow("tutorial.getmethodwalkpresentation.title3"),
      instruction: translateNow("tutorial.getmethodwalkpresentation.instruction3"),
      hint: translateNow("tutorial.getmethodwalkpresentation.hint3"),
      action: { kind: "click", label: translateNow("tutorial.getmethodwalkpresentation.label3") },
    };
  }
  if (stage === "close-manager") {
    return {
      title: translateNow("tutorial.getmethodwalkpresentation.title4"),
      instruction: translateNow("tutorial.getmethodwalkpresentation.instruction4"),
      hint: translateNow("tutorial.getmethodwalkpresentation.hint4"),
      action: { kind: "click", label: translateNow("tutorial.getmethodwalkpresentation.label4") },
    };
  }
  if (stage === "launch") {
    return {
      title: translateNow("tutorial.getmethodwalkpresentation.title5"),
      instruction: translateNow("tutorial.getmethodwalkpresentation.instruction5"),
      hint: translateNow("tutorial.getmethodwalkpresentation.hint5"),
      action: { kind: "click", label: translateNow("tutorial.getmethodwalkpresentation.label5") },
    };
  }
  const levelText = preparedLadderText(experiment);
  if (stage === "levels-mismatch") {
    return {
      title: translateNow("tutorial.getmethodwalkpresentation.title7"),
      instruction: translateNow("tutorial.getmethodwalkpresentation.instruction7", { p0: levelText }),
      hint: translateNow("tutorial.getmethodwalkpresentation.hint7", { p0: levelText }),
      action: { kind: "type", label: translateNow("tutorial.getmethodwalkpresentation.label7", { p0: levelText }) },
    };
  }
  if (stage === "reopen-levels") {
    return {
      title: translateNow("tutorial.getmethodwalkpresentation.title8"),
      instruction: translateNow("tutorial.getmethodwalkpresentation.instruction8", { p0: levelText }),
      hint: translateNow("tutorial.getmethodwalkpresentation.hint8"),
      action: { kind: "click", label: translateNow("tutorial.getmethodwalkpresentation.label8") },
    };
  }
  return {
    title: translateNow("tutorial.getmethodwalkpresentation.title6"),
    instruction: translateNow("tutorial.getmethodwalkpresentation.instruction6", { p0: levelText }),
    hint: translateNow("tutorial.getmethodwalkpresentation.hint6", { p0: levelText }),
    action: { kind: "type", label: translateNow("tutorial.getmethodwalkpresentation.label6", { p0: levelText }) },
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
      title: translateNow("tutorial.getlimstutorialfieldpresentation.title"),
      instruction: translateNow("tutorial.getlimstutorialfieldpresentation.instruction", { p0: grossMass, p1: packagingTareMass, p2: netMass }),
      hint: translateNow("tutorial.getlimstutorialfieldpresentation.hint", { p0: values.indicativeMassG, p1: netMass }),
      action: { kind: "click", label: translateNow("tutorial.getlimstutorialfieldpresentation.label") },
    };
  }
  if (field === "orchard") {
    return {
      title: translateNow("tutorial.getlimstutorialfieldpresentation.title2"),
      instruction: translateNow("tutorial.getlimstutorialfieldpresentation.instruction2", { p0: values.orchardName }),
      hint: translateNow("tutorial.getlimstutorialfieldpresentation.hint2", { p0: grossMass }),
      action: { kind: "type", label: translateNow("tutorial.getlimstutorialfieldpresentation.label2", { p0: values.orchardName }) },
    };
  }
  if (field === "harvest-date") {
    return {
      title: translateNow("tutorial.getlimstutorialfieldpresentation.title3"),
      instruction: translateNow("tutorial.getlimstutorialfieldpresentation.instruction3", { p0: values.harvestDate }),
      hint: translateNow("tutorial.getlimstutorialfieldpresentation.hint3"),
      action: { kind: "type", label: translateNow("tutorial.getlimstutorialfieldpresentation.label3", { p0: values.harvestDate }) },
    };
  }
  if (field === "indicative-mass") {
    return {
      title: translateNow("tutorial.getlimstutorialfieldpresentation.title4"),
      instruction: translateNow("tutorial.getlimstutorialfieldpresentation.instruction4", { p0: values.indicativeMassG }),
      hint: translateNow("tutorial.getlimstutorialfieldpresentation.hint4", { p0: grossMass, p1: netMass }),
      action: { kind: "type", label: translateNow("tutorial.getlimstutorialfieldpresentation.label4", { p0: values.indicativeMassG }) },
    };
  }
  return {
    title: translateNow("tutorial.getlimstutorialfieldpresentation.title5"),
    instruction: translateNow("tutorial.getlimstutorialfieldpresentation.instruction5"),
    hint: translateNow("tutorial.getlimstutorialfieldpresentation.hint5", { p0: grossMass, p1: packagingTareMass, p2: netMass }),
    action: { kind: "click", label: translateNow("tutorial.getlimstutorialfieldpresentation.label5") },
  };
}

function registerSamplePresentation(experiment: Experiment): TutorialStepPresentation {
  if (!workspaceWidget(experiment, "lims")?.isPresent) {
    return {
      title: translateNow("tutorial.registersamplepresentation.title"),
      instruction: translateNow("tutorial.registersamplepresentation.instruction"),
      hint: hasSampleBagOnGrossBalance(experiment)
        ? "Keep the bag on the balance while you deploy and complete the LIMS terminal."
        : "After deploying the terminal, return the sample bag to the Gross balance before entering the LIMS data.",
      action: { kind: "drag", label: translateNow("tutorial.registersamplepresentation.label") },
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
      title: translateNow("tutorial.registersamplepresentation.title2"),
      instruction: sourceInstruction,
      hint: translateNow("tutorial.registersamplepresentation.hint"),
      action: { kind: "drag", label: translateNow("tutorial.registersamplepresentation.label2") },
    };
  }

  if (!experiment.limsReception.labSampleCode) {
    const values = getLimsTutorialValues(experiment);
    return {
      title: translateNow("tutorial.registersamplepresentation.title3"),
      instruction: translateNow("tutorial.registersamplepresentation.instruction2", { p0: values.orchardName, p1: values.harvestDate, p2: values.indicativeMassG }),
      hint: translateNow("tutorial.registersamplepresentation.hint2", { p0: values.measuredGrossMassG?.toFixed(1) ?? "current", p1: values.measuredNetMassG?.toFixed(1) ?? "the net mass", p2: values.packagingTareMassG.toFixed(1) }),
      action: { kind: "type", label: translateNow("tutorial.registersamplepresentation.label3") },
    };
  }

  if (!experiment.limsReception.printedLabelTicket) {
    return {
      title: translateNow("tutorial.registersamplepresentation.title4"),
      instruction: translateNow("tutorial.registersamplepresentation.instruction3"),
      hint: translateNow("tutorial.registersamplepresentation.hint3"),
      action: { kind: "click", label: translateNow("tutorial.registersamplepresentation.label4") },
    };
  }

  return {
    title: translateNow("tutorial.registersamplepresentation.title5"),
    instruction: translateNow("tutorial.registersamplepresentation.instruction4"),
    hint: translateNow("tutorial.registersamplepresentation.hint4"),
    action: { kind: "drag", label: translateNow("tutorial.registersamplepresentation.label5") },
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
      title: translateNow("tutorial.extractionequipmentpresentation.title", { p0: equipmentName }),
      instruction: translateNow("tutorial.extractionequipmentpresentation.instruction", { p0: equipmentName }),
    };
  }
  const tube = extractionTube(experiment);
  if (!toolIsInWidget(experiment, widgetId, tube)) {
    return {
      title: translateNow("tutorial.extractionequipmentpresentation.title2", { p0: equipmentName }),
      instruction: translateNow("tutorial.extractionequipmentpresentation.instruction2", { p0: equipmentName }),
      hint: translateNow("tutorial.extractionequipmentpresentation.hint"),
    };
  }
  const widget = workspaceWidget(experiment, widgetId);
  if (
    (widgetId === "vortex" && (widget?.vortexRunRemainingMs ?? 0) > 0) ||
    (widgetId === "centrifuge" && (widget?.centrifugeRunRemainingMs ?? 0) > 0)
  ) {
    return {
      title: widgetId === "vortex" ? "Wait for vortex mixing" : "Wait for phase separation",
      instruction: translateNow("tutorial.extractionequipmentpresentation.instruction3"),
      action: { kind: "wait", label: translateNow("tutorial.extractionequipmentpresentation.label") },
    };
  }
  return widgetId === "vortex"
    ? {
        title: tube?.isSealed ? "Start the vortex cycle" : "Seal the extraction tube",
        instruction: tube?.isSealed
          ? "Click the highlighted Start vortex button."
          : "Click the highlighted Close button on the extraction tube before starting the mixer.",
        action: tube?.isSealed
          ? { kind: "click", label: translateNow("tutorial.extractionequipmentpresentation.label2") }
          : { kind: "click", label: translateNow("tutorial.extractionequipmentpresentation.label3") },
      }
    : {
        title: translateNow("tutorial.extractionequipmentpresentation.title3"),
        instruction: translateNow("tutorial.extractionequipmentpresentation.instruction4"),
        action: { kind: "click", label: translateNow("tutorial.extractionequipmentpresentation.label4") },
      };
}

function sampleVialTarget(experiment: Experiment): TutorialTarget {
  // A vial short of a workable aliquot is topped up rather than replaced, so it takes
  // the place a fresh vial would have held for the rest of this step.
  const vial = plainSampleVial(experiment) ?? underfilledSampleVial(experiment);
  if (!vial) {
    return workbenchPlacementTarget(experiment, "palette-item-sample_vial_lcms");
  }
  if (
    experiment.pipette.volumeMl > 0 &&
    pendingSampleAliquotMl(experiment) >= minimumInjectableAliquotMl
  ) {
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
  const shortVial = underfilledSampleVial(experiment);
  const vial = plainSampleVial(experiment) ?? shortVial;
  if (vial && experiment.pipette.volumeMl <= 0) {
    const tube = extractionTube(experiment);
    if (toolIsInWidget(experiment, "centrifuge", tube)) {
      return workbenchPlacementPresentation(experiment, "tutorial.item.extractionTube", {
        title: translateNow("tutorial.samplevialpresentation.title"),
        instruction: translateNow("tutorial.samplevialpresentation.instruction"),
        hint: translateNow("tutorial.samplevialpresentation.hint"),
        action: { kind: "drag", label: translateNow("tutorial.samplevialpresentation.label") },
      });
    }
    if (tube?.isSealed) {
      return {
        title: translateNow("tutorial.samplevialpresentation.title2"),
        instruction: translateNow("tutorial.samplevialpresentation.instruction2"),
        hint: translateNow("tutorial.samplevialpresentation.hint2"),
        action: { kind: "click", label: translateNow("tutorial.samplevialpresentation.label2") },
      };
    }
  }
  if (vial) {
    // Aspirating and dispensing are both press-and-hold, counting up in 0.05 mL steps.
    // A quick click commits a single step, which is why the volume has to be spelled
    // out as a target rather than implied by the gesture.
    if (experiment.pipette.volumeMl > 0) {
      if (pendingSampleAliquotMl(experiment) < minimumInjectableAliquotMl) {
        return {
          title: translateNow("tutorial.samplevialpresentation.title3"),
          instruction: translateNow("tutorial.samplevialpresentation.instruction3", { p0: experiment.pipette.volumeMl.toFixed(2) }),
          hint: translateNow("tutorial.samplevialpresentation.hint3"),
          action: { kind: "click", label: translateNow("tutorial.samplevialpresentation.label3") },
        };
      }
      return {
        title: shortVial ? "Add more extract to the vial" : "Transfer extract into the Autosampler vial",
        instruction: translateNow("tutorial.samplevialpresentation.instruction4"),
        hint: translateNow("tutorial.samplevialpresentation.hint4"),
        action: { kind: "click", label: translateNow("tutorial.samplevialpresentation.label4") },
      };
    }
    return {
      title: shortVial ? "Add more extract to the vial" : "Transfer extract into the Autosampler vial",
      instruction: shortVial
        ? "The vial holds too little to be injected: the autosampler needle cannot reach " +
          "the last 0.05 mL, so the run would record a flat baseline. Select the " +
          "Micropipette again, then press and hold on the extraction tube to draw about " +
          "1.00 mL, and dispense it into the same vial."
        : "Click Micropipette in Actions, or press P. Then press and hold on the separated " +
          "extraction tube until the pipette reads about 1.00 mL, and release.",
      hint: translateNow("tutorial.samplevialpresentation.hint5"),
      action: shortVial
        ? { kind: "click", label: translateNow("tutorial.samplevialpresentation.label5") }
        : { kind: "keyboard", label: translateNow("tutorial.samplevialpresentation.label6") },
    };
  }
  return workbenchPlacementPresentation(experiment, "tutorial.item.autosamplerVial", {
    title: translateNow("tutorial.samplevialpresentation.title4"),
    instruction: translateNow("tutorial.samplevialpresentation.instruction5"),
    hint: translateNow("tutorial.samplevialpresentation.hint6"),
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
  const ladder = spikedCalibrationLadder(experiment);
  const calibrationVial = ladder.find((vial) => !toolIsInRack(experiment, vial));
  if (calibrationVial) {
    return calibrationVial.isSealed
      ? {
          anchor: toolSourceAnchor(experiment, (tool) => tool.id === calibrationVial.id),
          dropAnchor: "widget-rack",
        }
      : { anchor: `seal-tool-${calibrationVial.id}` };
  }
  const openRackVial = [sampleVial, ...ladder].find((tool) => !tool?.isSealed);
  if (openRackVial) {
    return { anchor: `seal-tool-${openRackVial.id}` };
  }
  return { anchor: "widget-rack" };
}

function stageVialsPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  if (!workspaceWidget(experiment, "rack")?.isPresent) {
    return {
      title: translateNow("tutorial.stagevialspresentation.title"),
      instruction: translateNow("tutorial.stagevialspresentation.instruction"),
    };
  }
  const vials = [
    { tool: preparedSampleVial(experiment), name: translateNow("tutorial.item.sampleVial") },
    ...CALIBRATION_LADDER_NG_PER_ML.map((level) => ({
      tool: spikedCalibrationVial(experiment, level),
      name: translateNow("tutorial.item.standardAtLevel", { p0: level }),
    })),
  ];
  const missing = vials.find(({ tool }) => !toolIsInRack(experiment, tool));
  if (missing) {
    return missing.tool?.isSealed
      ? {
          title: translateNow("tutorial.stagevialspresentation.title2", { p0: missing.name }),
          instruction: translateNow("tutorial.stagevialspresentation.instruction2", { p0: missing.name }),
        }
      : {
          title: translateNow("tutorial.stagevialspresentation.title3", { p0: missing.name }),
          instruction: translateNow("tutorial.stagevialspresentation.instruction3", { p0: missing.name }),
        };
  }
  return {
    title: translateNow("tutorial.stagevialspresentation.title4"),
    instruction: translateNow("tutorial.stagevialspresentation.instruction4"),
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
      title: translateNow("tutorial.weighreceptionpresentation.title"),
      instruction: translateNow("tutorial.weighreceptionpresentation.instruction"),
      action: { kind: "drag", label: translateNow("tutorial.weighreceptionpresentation.label") },
    };
  }
  if (!hasSampleBagOnGrossBalance(experiment)) {
    return {
      title: translateNow("tutorial.weighreceptionpresentation.title2"),
      instruction: translateNow("tutorial.weighreceptionpresentation.instruction2"),
      action: { kind: "drag", label: translateNow("tutorial.weighreceptionpresentation.label2") },
    };
  }
  return {
    title: translateNow("tutorial.weighreceptionpresentation.title3"),
    instruction: translateNow("tutorial.weighreceptionpresentation.instruction3"),
    action: { kind: "wait", label: translateNow("tutorial.weighreceptionpresentation.label3") },
  };
}

// Grind quality is scored on the average temperature held across the 30 s
// cycle, and friction adds back about 10 °C over that cycle. Starting at
// −70 °C lands the average around −65 °C, inside the fine-powder band, which
// is what makes a 10 g test portion representative of the lot: the sampling
// spread it leaves is roughly ±5 %, against ±20 % when the cycle is started at
// −45 °C. Waiting costs about 40 s of simulated time at a 1:1 dry-ice ratio.
const grinderReadyTemperatureC = -70;

// A 1:1 ratio is a target, not a specification: rounding to the nearest 100 g
// keeps the value the learner has to type readable.
function grinderDryIceMassG(grinder: ExperimentWorkspaceWidget | undefined): number {
  const appleMassG = (grinder?.produceLots ?? []).reduce(
    (total, produceLot) => total + produceLot.totalMassG,
    0,
  );
  return Math.max(100, Math.round(appleMassG / 100) * 100);
}

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
    return {
      anchor: "palette-item-dry_ice_pellets",
      dropAnchor: "widget-grinder",
      expectedQuantity: { amount: grinderDryIceMassG(grinder), unitLabel: "g" },
    };
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
      title: translateNow("tutorial.grindsamplepresentation.title"),
      instruction: translateNow("tutorial.grindsamplepresentation.instruction"),
      action: { kind: "drag", label: translateNow("tutorial.grindsamplepresentation.label") },
    };
  }
  if (!(grinder.produceLots ?? []).length) {
    return {
      title: translateNow("tutorial.grindsamplepresentation.title2"),
      instruction: translateNow("tutorial.grindsamplepresentation.instruction2"),
      action: { kind: "drag", label: translateNow("tutorial.grindsamplepresentation.label2") },
    };
  }
  if (!(grinder.liquids ?? []).some((liquid) => liquid.liquidId === "dry_ice_pellets")) {
    const formattedDryIceMassG = grinderDryIceMassG(grinder).toFixed(0);
    return {
      title: translateNow("tutorial.grindsamplepresentation.title3"),
      instruction: translateNow("tutorial.grindsamplepresentation.instruction3", { p0: formattedDryIceMassG }),
      hint: translateNow("tutorial.grindsamplepresentation.hint", { p0: Math.abs(grinderReadyTemperatureC) }),
      action: { kind: "drag", label: translateNow("tutorial.grindsamplepresentation.label3", { p0: formattedDryIceMassG }) },
    };
  }
  if ((grinder.grinderRunRemainingMs ?? 0) > 0) {
    return {
      title: translateNow("tutorial.grindsamplepresentation.title4"),
      instruction: translateNow("tutorial.grindsamplepresentation.instruction4"),
      hint: translateNow("tutorial.grindsamplepresentation.hint2"),
      action: { kind: "wait", label: translateNow("tutorial.grindsamplepresentation.label4") },
    };
  }
  const lot = grinder.produceLots?.[0];
  if ((lot?.temperatureC ?? 20) > grinderReadyTemperatureC) {
    return {
      title: translateNow("tutorial.grindsamplepresentation.title5"),
      instruction: translateNow("tutorial.grindsamplepresentation.instruction5", { p0: Math.abs(grinderReadyTemperatureC) }),
      hint: translateNow("tutorial.grindsamplepresentation.hint3"),
      action: { kind: "wait", label: translateNow("tutorial.grindsamplepresentation.label5", { p0: Math.abs(grinderReadyTemperatureC) }) },
    };
  }
  return {
    title: translateNow("tutorial.grindsamplepresentation.title6"),
    instruction: translateNow("tutorial.grindsamplepresentation.instruction6"),
    hint: translateNow("tutorial.grindsamplepresentation.hint4"),
    action: { kind: "click", label: translateNow("tutorial.grindsamplepresentation.label6") },
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
      !isSpentExtractionTube(tool) &&
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

// The learner reaches this branch straight after the vortex refused to start, with
// nothing on screen accounting for it: a tube turning grey states that something is
// wrong now, never what happened to it. The coach names the mechanism before it asks
// for anything, then walks the chapter back to a fresh test portion.
function spentExtractionTubePresentation(
  tube: BenchToolInstance,
): Partial<TutorialStepPresentation> {
  const faults = tube.quechersState?.faults ?? [];
  const hint =
    "Only this tube is lost. The ground sample is still in the storage jar, so a new " +
    "10 g test portion is all it takes to start the extraction over.";
  const action: TutorialAction = { kind: "drag", label: translateNow("tutorial.spentextractiontubepresentation.label") };

  if (faults.includes("vortexed_open")) {
    return {
      title: translateNow("tutorial.spentextractiontubepresentation.title"),
      instruction: translateNow("tutorial.spentextractiontubepresentation.instruction"),
      hint,
      action,
    };
  }
  if (faults.includes("vortexed_without_salts")) {
    return {
      title: translateNow("tutorial.spentextractiontubepresentation.title2"),
      instruction: translateNow("tutorial.spentextractiontubepresentation.instruction2"),
      hint,
      action,
    };
  }
  if (faults.includes("dry_salts_wetted")) {
    return {
      title: translateNow("tutorial.spentextractiontubepresentation.title3"),
      instruction: translateNow("tutorial.spentextractiontubepresentation.instruction3"),
      hint,
      action,
    };
  }
  return {
    title: translateNow("tutorial.spentextractiontubepresentation.title4"),
    instruction: translateNow("tutorial.spentextractiontubepresentation.instruction4"),
    hint,
    action,
  };
}

function analyticalWeighingTarget(experiment: Experiment): TutorialTarget {
  const spentTube = spentExtractionTubeToDiscard(experiment);
  if (spentTube) {
    return {
      anchor: toolSourceAnchor(experiment, (tool) => tool.id === spentTube.id),
      dropAnchor: trashAnchor,
    };
  }
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
    // Pouring stops the moment the learner lets go, so the spatula keeps what is
    // left in it and can be put down still loaded. Dosing needs it back in hand.
    return { anchor: "spatula-dose:widget-analytical_balance" };
  }
  const powderJar = storageContainer(experiment);
  return {
    anchor: powderJar
      ? `spatula-load-powder:${toolSourceAnchor(experiment, (tool) => tool.id === powderJar.id)}`
      : "action-spatula",
  };
}

function analyticalWeighingPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  const spentTube = spentExtractionTubeToDiscard(experiment);
  if (spentTube) {
    return spentExtractionTubePresentation(spentTube);
  }
  if (!workspaceWidget(experiment, "analytical_balance")?.isPresent) {
    return {
      title: translateNow("tutorial.analyticalweighingpresentation.title"),
      instruction: translateNow("tutorial.analyticalweighingpresentation.instruction"),
    };
  }
  const tubeOnPan = analyticalBalanceTubeOnPan(experiment);
  if (
    tubeOnPan &&
    toolPowderMassG(tubeOnPan) > 0 &&
    !analyticalTubeTareIsValid(experiment)
  ) {
    return {
      title: translateNow("tutorial.analyticalweighingpresentation.title2"),
      instruction: translateNow("tutorial.analyticalweighingpresentation.instruction2"),
      hint: translateNow("tutorial.analyticalweighingpresentation.hint"),
      action: { kind: "drag", label: translateNow("tutorial.analyticalweighingpresentation.label") },
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
      title: translateNow("tutorial.analyticalweighingpresentation.title3"),
      instruction: translateNow("tutorial.analyticalweighingpresentation.instruction3"),
    };
  }
  if (!analyticalTubeTareIsValid(experiment)) {
    return {
      title: hasCompromisedAnalyticalTube(experiment)
        ? "Tare the replacement tube"
        : "Tare the tube",
      instruction: translateNow("tutorial.analyticalweighingpresentation.instruction4"),
      action: { kind: "click", label: translateNow("tutorial.analyticalweighingpresentation.label2") },
    };
  }
  return {
    title: translateNow("tutorial.analyticalweighingpresentation.title4"),
    instruction: experiment.spatula.isLoaded
      ? "The spatula contains powder. Click and hold the tube on the Analytical balance until Net reaches about 10.000 g; release before 10.2 g."
      : "Click the highlighted Powder spatula in Actions, or press S. Then click the powder in the HDPE container to load it.",
    action: experiment.spatula.isLoaded
      ? { kind: "click", label: translateNow("tutorial.analyticalweighingpresentation.label3") }
      : { kind: "keyboard", label: translateNow("tutorial.analyticalweighingpresentation.label4") },
  };
}

// Whatever is left on the spatula once the portion is dosed is waste: powder never
// goes back into the stock jar, and a tool held full blocks every drag that comes
// next while the coach stays quiet about it — a loaded tool reads as mid-transfer.
// The dosing has happened as soon as a tube carries the portion, and it stays
// happened once that tube has moved on — wetted into slurry, salted, cemented or
// thrown away. Read this way the step can be re-derived from a late experiment
// instead of coming back to ask for an emptying nothing can perform any more.
function testPortionHasBeenDosed(experiment: Experiment) {
  return allTools(experiment).some(
    (tool) =>
      carriesTestPortion(tool) ||
      isSpentExtractionTube(tool) ||
      (tool.toolType === "centrifuge_tube" && tool.quechersState != null),
  );
}

function putSpatulaAwayTarget(): TutorialTarget {
  return { anchor: `spatula-discard:${trashAnchor}` };
}

function putSpatulaAwayPresentation(): Partial<TutorialStepPresentation> {
  return {
    title: translateNow("tutorial.putspatulaawaypresentation.title"),
    instruction: translateNow("tutorial.putspatulaawaypresentation.instruction"),
    hint: translateNow("tutorial.putspatulaawaypresentation.hint"),
    action: { kind: "click", label: translateNow("tutorial.putspatulaawaypresentation.label") },
  };
}

// The salts release the same fixed rise whatever the tube starts at, and residues
// begin breaking down above 30 °C. Leaving the ice from here lands the peak in the
// mid-twenties, with enough headroom that the tube can warm on the bench while the
// learner aims the salt packet and still lose nothing.
const chilledExtractionTemperatureC = 1;

// The two doses the extraction tube is built from. Both are the palette's own
// suggested volumes, so the dialog already opens on the right number — naming
// them here is what lets the coach say so instead of leaving the learner to
// guess whether the suggestion is the one the step meant.
const extractionIstdVolumeMl = 0.05;
const extractionSolventVolumeMl = 10;

function extractionTubeTemperatureC(tube: BenchToolInstance | undefined) {
  return tube?.quechersState?.temperatureC ?? 20;
}

function extractionPreparationTarget(experiment: Experiment): TutorialTarget {
  const tube = extractionTube(experiment);
  const tubeAnchor = toolSourceAnchor(experiment, (tool) => tool.id === tube?.id);
  const liquids = tube?.liquids ?? [];
  if (!liquids.some((liquid) => liquid.liquidId === "istd_solution")) {
    return {
      anchor: "palette-item-istd_solution",
      dropAnchor: tubeAnchor,
      expectedQuantity: { amount: extractionIstdVolumeMl, unitLabel: "mL" },
    };
  }
  if (!liquids.some((liquid) => liquid.liquidId === "acetonitrile_extraction" && liquid.volume_ml >= 9.5)) {
    return {
      anchor: "palette-item-acetonitrile_extraction",
      dropAnchor: tubeAnchor,
      expectedQuantity: { amount: extractionSolventVolumeMl, unitLabel: "mL" },
    };
  }
  // The salts start a 15 s countdown to cementation, so the mixer has to be standing
  // on the workspace before they go in. Fetching it from the Inventory afterwards
  // costs more than the whole window.
  return { anchor: "palette-item-vortex_mixer_widget", dropAnchor: workspaceCanvasAnchor };
}

function chillExtractionTarget(experiment: Experiment): TutorialTarget {
  const tube = extractionTube(experiment);
  if (toolIsInWidget(experiment, "ice_bath", tube)) {
    // Nothing left to drag: the step is a wait, and the only moving part is the
    // reading. Spotlighting the whole bath says "look here" without saying what
    // to look at, so the thermometer takes the light — the same way the grinder
    // step points at the lot's own reading while the dry ice does its work.
    return { anchor: tube ? `temperature-${tube.id}` : iceBathAnchor };
  }
  return workspaceWidget(experiment, "ice_bath")?.isPresent
    ? {
        anchor: toolSourceAnchor(experiment, (tool) => tool.id === tube?.id),
        dropAnchor: iceBathAnchor,
      }
    : { anchor: "palette-item-ice_bath_widget", dropAnchor: workspaceCanvasAnchor };
}

function saltExtractionTarget(experiment: Experiment): TutorialTarget {
  const tube = extractionTube(experiment);
  const tubeAnchor = toolSourceAnchor(experiment, (tool) => tool.id === tube?.id);
  if (tube?.quechersState?.saltsAdded) {
    return { anchor: tubeAnchor };
  }
  // The bath takes tools, not reagents, so the tube comes back to the bench for the
  // last drop. It leaves the ice near zero and climbs slowly, which is what buys the
  // learner the time to aim.
  if (toolIsInWidget(experiment, "ice_bath", tube)) {
    return workbenchPlacementTarget(experiment, iceBathAnchor);
  }
  return { anchor: "palette-item-quechers_salts", dropAnchor: tubeAnchor };
}

function extractionPreparationPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  const tube = extractionTube(experiment);
  const liquids = tube?.liquids ?? [];
  if (!liquids.some((liquid) => liquid.liquidId === "istd_solution")) {
    return { title: translateNow("tutorial.extractionpreparationpresentation.title"), instruction: translateNow("tutorial.extractionpreparationpresentation.instruction"), action: { kind: "drag", label: translateNow("tutorial.extractionpreparationpresentation.label") } };
  }
  if (!liquids.some((liquid) => liquid.liquidId === "acetonitrile_extraction" && liquid.volume_ml >= 9.5)) {
    return { title: translateNow("tutorial.extractionpreparationpresentation.title2"), instruction: translateNow("tutorial.extractionpreparationpresentation.instruction2"), action: { kind: "drag", label: translateNow("tutorial.extractionpreparationpresentation.label2") } };
  }
  return {
    title: translateNow("tutorial.extractionpreparationpresentation.title3"),
    instruction: translateNow("tutorial.extractionpreparationpresentation.instruction3"),
    hint: translateNow("tutorial.extractionpreparationpresentation.hint"),
    deadline: translateNow("tutorial.extractionpreparationpresentation.deadline"),
    action: { kind: "drag", label: translateNow("tutorial.extractionpreparationpresentation.label3") },
  };
}

function chillExtractionPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  const tube = extractionTube(experiment);
  if (toolIsInWidget(experiment, "ice_bath", tube)) {
    return {
      title: translateNow("tutorial.chillextractionpresentation.title"),
      instruction: translateNow("tutorial.chillextractionpresentation.instruction", { p0: chilledExtractionTemperatureC }),
      hint: translateNow("tutorial.chillextractionpresentation.hint"),
      action: { kind: "wait", label: translateNow("tutorial.chillextractionpresentation.label", { p0: chilledExtractionTemperatureC }) },
    };
  }
  if (!workspaceWidget(experiment, "ice_bath")?.isPresent) {
    return {
      title: translateNow("tutorial.chillextractionpresentation.title2"),
      instruction: translateNow("tutorial.chillextractionpresentation.instruction2"),
      hint: translateNow("tutorial.chillextractionpresentation.hint2"),
      action: { kind: "drag", label: translateNow("tutorial.chillextractionpresentation.label2") },
    };
  }
  return {
    title: translateNow("tutorial.chillextractionpresentation.title3"),
    instruction: translateNow("tutorial.chillextractionpresentation.instruction3", { p0: chilledExtractionTemperatureC }),
    hint: translateNow("tutorial.chillextractionpresentation.hint3"),
    action: { kind: "drag", label: translateNow("tutorial.chillextractionpresentation.label3") },
  };
}

function saltExtractionPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  if (toolIsInWidget(experiment, "ice_bath", extractionTube(experiment))) {
    return workbenchPlacementPresentation(experiment, "tutorial.item.chilledTube", {
      title: translateNow("tutorial.saltextractionpresentation.title"),
      instruction: translateNow("tutorial.saltextractionpresentation.instruction"),
      hint: translateNow("tutorial.saltextractionpresentation.hint"),
      action: { kind: "drag", label: translateNow("tutorial.saltextractionpresentation.label") },
    });
  }
  return {
    title: translateNow("tutorial.saltextractionpresentation.title2"),
    instruction: translateNow("tutorial.saltextractionpresentation.instruction2"),
    hint: translateNow("tutorial.saltextractionpresentation.hint2"),
    deadline: translateNow("tutorial.saltextractionpresentation.deadline"),
    action: { kind: "drag", label: translateNow("tutorial.saltextractionpresentation.label2") },
  };
}

function labelSampleVialTarget(experiment: Experiment): TutorialTarget {
  if (!workspaceWidget(experiment, "lims")?.isPresent) {
    return {
      anchor: "palette-item-lims_terminal_widget",
      dropAnchor: workspaceCanvasAnchor,
    };
  }
  if (!experiment.limsReception.printedLabelTicket) {
    return { anchor: "lims-print-label" };
  }
  const vial = preparedSampleVial(experiment);
  return {
    anchor: "lims-printed-ticket",
    dropAnchor: vial ? toolSourceAnchor(experiment, (tool) => tool.id === vial.id) : null,
  };
}

function labelSampleVialPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  if (!workspaceWidget(experiment, "lims")?.isPresent) {
    return {
      title: translateNow("tutorial.labelsamplevialpresentation.title"),
      instruction: translateNow("tutorial.labelsamplevialpresentation.instruction"),
      hint: translateNow("tutorial.labelsamplevialpresentation.hint"),
      action: { kind: "drag", label: translateNow("tutorial.labelsamplevialpresentation.label") },
    };
  }
  if (!experiment.limsReception.printedLabelTicket) {
    return {
      title: translateNow("tutorial.labelsamplevialpresentation.title2"),
      instruction: translateNow("tutorial.labelsamplevialpresentation.instruction2"),
      hint: translateNow("tutorial.labelsamplevialpresentation.hint2"),
      action: { kind: "click", label: translateNow("tutorial.labelsamplevialpresentation.label2") },
    };
  }
  return {
    title: translateNow("tutorial.labelsamplevialpresentation.title3"),
    instruction: translateNow("tutorial.labelsamplevialpresentation.instruction3"),
    hint: translateNow("tutorial.labelsamplevialpresentation.hint3"),
    action: { kind: "drag", label: translateNow("tutorial.labelsamplevialpresentation.label3") },
  };
}

function calibrationVialTarget(experiment: Experiment): TutorialTarget {
  const level = nextCalibrationLevel(experiment);
  if (level === undefined) {
    return workbenchPlacementTarget(experiment, "palette-item-calibration_standard_vial");
  }
  const standard = preparedCalibrationVial(experiment, level);
  if (standard) {
    return {
      anchor: "palette-item-istd_solution",
      dropAnchor: toolSourceAnchor(experiment, (tool) => tool.id === standard.id),
      expectedQuantity: { amount: calibrationIstdVolumeMl, unitLabel: "mL" },
    };
  }
  // The vial dialog opens on 10 ng/mL whichever rung is next, so every level but
  // that one has to be typed or picked before the vial can be taken.
  return {
    ...workbenchPlacementTarget(experiment, "palette-item-calibration_standard_vial"),
    expectedQuantity: { amount: level, unitLabel: "ng/mL" },
  };
}

function calibrationVialPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  const level = nextCalibrationLevel(experiment);
  if (level === undefined) {
    return {
      title: translateNow("tutorial.calibrationvialpresentation.title3"),
      instruction: translateNow("tutorial.calibrationvialpresentation.instruction3", {
        p0: preparedLadderText(experiment),
      }),
      hint: translateNow("tutorial.calibrationvialpresentation.hint3"),
    };
  }
  const done = CALIBRATION_LADDER_NG_PER_ML.indexOf(level);
  const total = CALIBRATION_LADDER_NG_PER_ML.length;
  if (preparedCalibrationVial(experiment, level)) {
    return {
      title: translateNow("tutorial.calibrationvialpresentation.title", { p0: level }),
      instruction: translateNow("tutorial.calibrationvialpresentation.instruction", { p0: calibrationIstdVolumeMl, p1: level }),
      hint: translateNow("tutorial.calibrationvialpresentation.hint"),
      action: { kind: "drag", label: translateNow("tutorial.calibrationvialpresentation.label", { p0: calibrationIstdVolumeMl }) },
    };
  }
  return workbenchPlacementPresentation(experiment, "tutorial.item.calibrationStandardVial", {
    // Counting the rungs out loud only helps while there is more than one to
    // count: "point 1 of 1" reads as a stutter, not as progress.
    title:
      total > 1
        ? translateNow("tutorial.calibrationvialpresentation.title2", { p0: done + 1, p1: total })
        : translateNow("tutorial.calibrationvialpresentation.title4", { p0: level }),
    instruction: translateNow("tutorial.calibrationvialpresentation.instruction2", { p0: level }),
    hint: translateNow("tutorial.calibrationvialpresentation.hint2", { p0: level }),
    action: { kind: "drag", label: translateNow("tutorial.calibrationvialpresentation.label2", { p0: level }) },
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
const iceBathAnchor = "widget-ice_bath";
const trashAnchor = "trash-dropzone";

// Every step that ends with an item on the bench needs a free station first,
// otherwise the learner is told to drop something with nowhere to drop it.
function workbenchPlacementTarget(experiment: Experiment, anchor: string): TutorialTarget {
  const stationAnchor = emptyWorkbenchStationAnchor(experiment);
  return stationAnchor
    ? { anchor, dropAnchor: stationAnchor }
    : { anchor: addWorkbenchStationAnchor };
}

function addWorkbenchStationPresentation(itemNameKey: MessageKey): Partial<TutorialStepPresentation> {
  return {
    title: translateNow("tutorial.addworkbenchstationpresentation.title"),
    instruction: translateNow("tutorial.addworkbenchstationpresentation.instruction", {
      p0: translateNow(itemNameKey),
    }),
    hint: translateNow("tutorial.addworkbenchstationpresentation.hint"),
    action: { kind: "click", label: translateNow("tutorial.addworkbenchstationpresentation.label") },
  };
}

function workbenchPlacementPresentation(
  experiment: Experiment,
  itemNameKey: MessageKey,
  presentation: Partial<TutorialStepPresentation>,
): Partial<TutorialStepPresentation> {
  return hasEmptyWorkbenchStation(experiment)
    ? presentation
    : addWorkbenchStationPresentation(itemNameKey);
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
  widgetId: "gross_balance" | "analytical_balance" | "vortex" | "centrifuge" | "ice_bath",
): TutorialTarget {
  return workspaceWidget(experiment, widgetId)?.tool
    ? workbenchPlacementTarget(experiment, `widget-${widgetId}`)
    : { anchor: `store-widget-${widgetId}` };
}

function storeGrinderPresentation(experiment: Experiment): Partial<TutorialStepPresentation> {
  const grinder = workspaceWidget(experiment, "grinder");
  if ((grinder?.produceLots ?? []).length > 0) {
    if (!storageContainer(experiment) && !hasEmptyWorkbenchStation(experiment)) {
      return addWorkbenchStationPresentation("tutorial.item.storageJar");
    }
    return storageContainer(experiment)
      ? {
          title: translateNow("tutorial.storegrinderpresentation.title"),
          instruction: translateNow("tutorial.storegrinderpresentation.instruction"),
        }
      : {
          title: translateNow("tutorial.storegrinderpresentation.title2"),
          instruction: translateNow("tutorial.storegrinderpresentation.instruction2"),
        };
  }
  return {
    title: translateNow("tutorial.storegrinderpresentation.title3"),
    instruction: translateNow("tutorial.storegrinderpresentation.instruction3"),
  };
}

// The bath finished its job at the same moment the mixer did: once the tube is
// spinning the residues are in the solvent and no longer care how warm it gets.
function storeExtractionEquipmentTarget(experiment: Experiment): TutorialTarget {
  return workspaceWidget(experiment, "vortex")?.isPresent
    ? storeEquipmentTarget(experiment, "vortex")
    : storeEquipmentTarget(experiment, "ice_bath");
}

function storeExtractionEquipmentPresentation(
  experiment: Experiment,
): Partial<TutorialStepPresentation> {
  return workspaceWidget(experiment, "vortex")?.isPresent
    ? storeEquipmentPresentation(
        experiment,
        "vortex",
        "widget.vortex_mixer",
        "tutorial.item.mixedExtractionTube",
      )
    : storeEquipmentPresentation(experiment, "ice_bath", "widget.ice_bath", "tutorial.item.tube");
}

function storeEquipmentPresentation(
  experiment: Experiment,
  widgetId: "gross_balance" | "analytical_balance" | "vortex" | "centrifuge" | "ice_bath",
  equipmentNameKey: MessageKey,
  itemNameKey: MessageKey,
): Partial<TutorialStepPresentation> {
  const itemName = translateNow(itemNameKey);
  const equipmentName = translateNow(equipmentNameKey);
  return workspaceWidget(experiment, widgetId)?.tool
    ? workbenchPlacementPresentation(experiment, itemNameKey, {
        title: translateNow("tutorial.storeequipmentpresentation.title", { p0: itemName }),
        instruction: translateNow("tutorial.storeequipmentpresentation.instruction", { p0: itemName, p1: equipmentName }),
        hint: translateNow("tutorial.storeequipmentpresentation.hint", { p0: equipmentName }),
        action: { kind: "drag", label: translateNow("tutorial.storeequipmentpresentation.label", { p0: itemName }) },
      })
    : {
        title: translateNow("tutorial.storeequipmentpresentation.title2", { p0: equipmentName }),
        instruction: translateNow("tutorial.storeequipmentpresentation.instruction2", { p0: equipmentName }),
        action: { kind: "click", label: translateNow("tutorial.storeequipmentpresentation.label2") },
      };
}

function inferTutorialAction(instruction: string): TutorialAction {
  const normalized = instruction.toLowerCase();
  if (normalized.includes("wait") || normalized.includes("watch")) {
    return { kind: "wait", label: translateNow("tutorial.infertutorialaction.label") };
  }
  if (normalized.includes("enter") || normalized.includes("fill")) {
    return { kind: "type", label: translateNow("tutorial.infertutorialaction.label2") };
  }
  if (normalized.includes("press ")) {
    return { kind: "keyboard", label: translateNow("tutorial.infertutorialaction.label3") };
  }
  if (normalized.includes("drag")) {
    return { kind: "drag", label: translateNow("tutorial.infertutorialaction.label4") };
  }
  if (normalized.includes("click") || normalized.includes("select")) {
    return { kind: "click", label: translateNow("tutorial.infertutorialaction.label5") };
  }
  return { kind: "inspect", label: translateNow("tutorial.infertutorialaction.label6") };
}

function declareCalibrationLevelsTarget(experiment: Experiment): TutorialTarget {
  if (!workspaceWidget(experiment, "instrument")?.isPresent) {
    return {
      anchor: "palette-item-lc_msms_instrument_widget",
      dropAnchor: workspaceCanvasAnchor,
    };
  }
  return experiment.rack.state === "loaded"
    ? { anchor: "instrument-manage-methods-next" }
    : { anchor: "widget-rack", dropAnchor: "widget-instrument" };
}

/**
 * Nothing in the experiment records the method library, so this step can only
 * confirm itself from the snapshot a run freezes. It therefore turns green at
 * the same moment as the launch that follows it — the instruction says so,
 * rather than leaving the learner waiting on a tick that cannot come earlier.
 */
function declaredCalibrationLadder(experiment: Experiment) {
  // Only the *shape* is checked here, never the values: once the sequence has run,
  // the platform records what the method claimed and nothing in it compares that
  // to the vials — a method file can claim a level that was never injected, and
  // only the reprocessing platform downstream will notice. That gap is the lesson,
  // so the tutorial closes it where a teacher would, in front of the learner:
  // the coach refuses to move past the field, or past the console, while the
  // declared ladder disagrees with the rack (see methodLevelsMatchLadder).
  return sequenceRuns(experiment).some(
    (run) =>
      (run.methodSnapshot?.calibrationLevelsNgPerMl ?? []).length >=
      CALIBRATION_LADDER_NG_PER_ML.length,
  );
}

function declareCalibrationLevelsPresentation(
  experiment: Experiment,
): Partial<TutorialStepPresentation> {
  if (!workspaceWidget(experiment, "instrument")?.isPresent) {
    return {
      title: translateNow("tutorial.declarecalibrationlevelspresentation.title"),
      instruction: translateNow("tutorial.declarecalibrationlevelspresentation.instruction"),
    };
  }
  if (experiment.rack.state !== "loaded") {
    return {
      title: translateNow("tutorial.declarecalibrationlevelspresentation.title2"),
      instruction: translateNow("tutorial.declarecalibrationlevelspresentation.instruction2"),
    };
  }
  const levelText = `${preparedLadderText(experiment)} ng/mL`;
  return {
    title: translateNow("tutorial.declarecalibrationlevelspresentation.title3"),
    instruction: translateNow("tutorial.declarecalibrationlevelspresentation.instruction3", { p0: levelText }),
    hint: translateNow("tutorial.declarecalibrationlevelspresentation.hint", { p0: levelText }),
    action: { kind: "click", label: translateNow("tutorial.declarecalibrationlevelspresentation.label") },
  };
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
      title: translateNow("tutorial.launchsequencepresentation.title"),
      instruction: translateNow("tutorial.launchsequencepresentation.instruction"),
    };
  }
  if (experiment.rack.state !== "loaded") {
    return {
      title: translateNow("tutorial.launchsequencepresentation.title2"),
      instruction: translateNow("tutorial.launchsequencepresentation.instruction2"),
    };
  }
  return {
    title: translateNow("tutorial.launchsequencepresentation.title3"),
    instruction: translateNow("tutorial.launchsequencepresentation.instruction3"),
    action: { kind: "click", label: translateNow("tutorial.launchsequencepresentation.label") },
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
      title: translateNow("tutorial.cleanupacquisitionpresentation.title"),
      instruction: translateNow("tutorial.cleanupacquisitionpresentation.instruction"),
      action: { kind: "click", label: translateNow("tutorial.cleanupacquisitionpresentation.label") },
    };
  }
  if (experiment.rack.slots.some((slot) => slot.tool)) {
    return {
      title: translateNow("tutorial.cleanupacquisitionpresentation.title2"),
      instruction: translateNow("tutorial.cleanupacquisitionpresentation.instruction2"),
    };
  }
  if (workspaceWidget(experiment, "rack")?.isPresent) {
    return {
      title: translateNow("tutorial.cleanupacquisitionpresentation.title3"),
      instruction: translateNow("tutorial.cleanupacquisitionpresentation.instruction3"),
    };
  }
  return {
    title: translateNow("tutorial.cleanupacquisitionpresentation.title4"),
    instruction: translateNow("tutorial.cleanupacquisitionpresentation.instruction4"),
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
      (tool) =>
        tool.toolType === "centrifuge_tube" &&
        !isSpentExtractionTube(tool) &&
        toolPowderMassG(tool) >= 9.5,
    )
  );
}

function hasExtractionReagents(experiment: Experiment) {
  const liquids = extractionTube(experiment)?.liquids ?? [];
  return (
    liquids.some((liquid) => liquid.liquidId === "istd_solution") &&
    liquids.some(
      (liquid) =>
        liquid.liquidId === "acetonitrile_extraction" && liquid.volume_ml >= 9.5,
    )
  );
}

function hasSaltedExtraction(experiment: Experiment) {
  return Boolean(extractionTube(experiment)?.quechersState?.saltsAdded);
}

// The mixer has to be waiting before the salts go in, so deploying it belongs to the
// preparation rather than to the rush that follows.
function hasStagedExtraction(experiment: Experiment) {
  return (
    hasExtractionReagents(experiment) &&
    (Boolean(workspaceWidget(experiment, "vortex")?.isPresent) ||
      hasSaltedExtraction(experiment))
  );
}

// Completion latches, and that is the point: once the tube has been read cold the
// step stays done even though the tube starts warming again the moment it leaves the
// ice. Anything temperature-driven that did not latch would send the learner back to
// the bath forever.
function hasChilledExtraction(experiment: Experiment) {
  const tube = extractionTube(experiment);
  return (
    (toolIsInWidget(experiment, "ice_bath", tube) &&
      extractionTubeTemperatureC(tube) <= chilledExtractionTemperatureC) ||
    hasSaltedExtraction(experiment)
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
    title: "tutorial.weigh-received-sample.title",
    instruction: "tutorial.weigh-received-sample.instruction",
    hint: "tutorial.weigh-received-sample.hint",
    ...fromTarget(weighReceptionTarget),
    isSatisfied: (experiment) => (experiment.limsReception.measuredGrossMassG ?? 0) > 0,
    presentation: weighReceptionPresentation,
  }),
  step({
    id: "register-and-label-sample",
    chapterId: "reception",
    title: "tutorial.register-and-label-sample.title",
    instruction: "tutorial.register-and-label-sample.instruction",
    hint: "tutorial.register-and-label-sample.hint",
    prerequisites: ["weigh-received-sample"],
    ...fromTarget(registerSampleTarget),
    isSatisfied: (experiment) => hasAppliedLimsLabel(experiment),
    presentation: registerSamplePresentation,
  }),
  step({
    id: "store-gross-balance",
    chapterId: "reception",
    title: "tutorial.store-gross-balance.title",
    instruction: "tutorial.store-gross-balance.instruction",
    hint: "tutorial.store-gross-balance.hint",
    prerequisites: ["register-and-label-sample"],
    ...fromTarget(storeGrossBalanceTarget),
    isSatisfied: (experiment) =>
      hasAppliedLimsLabel(experiment) &&
      !workspaceWidget(experiment, "lims")?.isPresent &&
      !workspaceWidget(experiment, "gross_balance")?.isPresent,
    presentation: (experiment) =>
      workspaceWidget(experiment, "lims")?.isPresent
        ? {
            title: translateNow("tutorial.store-gross-balance.title2"),
            instruction: translateNow("tutorial.store-gross-balance.instruction2"),
            hint: translateNow("tutorial.store-gross-balance.hint2"),
            action: { kind: "click", label: translateNow("tutorial.store-gross-balance.label") },
          }
        : storeEquipmentPresentation(
            experiment,
            "gross_balance",
            "widget.gross_balance",
            "tutorial.item.sampleBag",
          ),
  }),
  step({
    id: "cut-sample",
    chapterId: "sample-preparation",
    title: "tutorial.cut-sample.title",
    instruction: "tutorial.cut-sample.instruction",
    hint: "tutorial.cut-sample.hint",
    prerequisites: ["store-gross-balance"],
    ...fromTarget(cutSampleTarget),
    isSatisfied: (experiment) => hasMaterialState(experiment, ["cut", "ground", "slurry"]),
    presentation: (experiment) => {
      const board = allTools(experiment).find((tool) => tool.toolType === "cutting_board");
      if (!board) {
        return workbenchPlacementPresentation(experiment, "tutorial.item.cuttingBoard", {
          title: translateNow("tutorial.cut-sample.title2"),
          instruction: translateNow("tutorial.cut-sample.instruction2"),
          action: { kind: "drag", label: translateNow("tutorial.cut-sample.label") },
        });
      }
      if (!(board.produceLots ?? []).some((lot) => (lot.materialState ?? materialStateForLot(experiment, lot.id)) === "whole")) {
        const bag = sampleBagContainingWholeProduce(experiment);
        if (bag?.isSealed) {
          return {
            title: translateNow("tutorial.cut-sample.title3"),
            instruction: translateNow("tutorial.cut-sample.instruction3"),
            hint: translateNow("tutorial.cut-sample.hint2"),
            action: { kind: "click", label: translateNow("tutorial.cut-sample.label2") },
          };
        }
        return {
          title: translateNow("tutorial.cut-sample.title4"),
          instruction: translateNow("tutorial.cut-sample.instruction4"),
          hint: translateNow("tutorial.cut-sample.hint3"),
          action: { kind: "drag", label: translateNow("tutorial.cut-sample.label3") },
        };
      }
      return {
        title: translateNow("tutorial.cut-sample.title5"),
        instruction: translateNow("tutorial.cut-sample.instruction5"),
        hint: translateNow("tutorial.cut-sample.hint4"),
        action: { kind: "keyboard", label: translateNow("tutorial.cut-sample.label4") },
      };
    },
  }),
  step({
    id: "grind-sample",
    chapterId: "sample-preparation",
    title: "tutorial.grind-sample.title",
    instruction: "tutorial.grind-sample.instruction",
    hint: "tutorial.grind-sample.hint",
    prerequisites: ["cut-sample"],
    ...fromTarget(grindSampleTarget),
    isSatisfied: (experiment) => hasMaterialState(experiment, ["ground", "slurry"]),
    presentation: grindSamplePresentation,
  }),
  step({
    id: "store-grinder",
    chapterId: "sample-preparation",
    title: "tutorial.store-grinder.title",
    instruction: "tutorial.store-grinder.instruction",
    hint: "tutorial.store-grinder.hint",
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
    title: "tutorial.weigh-test-portion.title",
    instruction: "tutorial.weigh-test-portion.instruction",
    hint: "tutorial.weigh-test-portion.hint",
    prerequisites: ["store-grinder"],
    ...fromTarget(analyticalWeighingTarget),
    isSatisfied: hasTestPortion,
    isInvalidated: extractionLineIsLost,
    presentation: analyticalWeighingPresentation,
  }),
  step({
    id: "put-spatula-away",
    chapterId: "sample-preparation",
    title: "tutorial.put-spatula-away.title",
    instruction: "tutorial.put-spatula-away.instruction",
    hint: "tutorial.put-spatula-away.hint",
    prerequisites: ["weigh-test-portion"],
    ...fromTarget(putSpatulaAwayTarget),
    isSatisfied: (experiment) =>
      testPortionHasBeenDosed(experiment) && !experiment.spatula.isLoaded,
    // Loading the spatula again — for a second portion, or a replacement tube —
    // puts the leftover back in the learner's hand, and the drags that follow back
    // behind it.
    isInvalidated: (experiment) => experiment.spatula.isLoaded,
    presentation: putSpatulaAwayPresentation,
  }),
  step({
    id: "store-analytical-balance",
    chapterId: "sample-preparation",
    title: "tutorial.store-analytical-balance.title",
    instruction: "tutorial.store-analytical-balance.instruction",
    hint: "tutorial.store-analytical-balance.hint",
    prerequisites: ["put-spatula-away"],
    ...fromTarget((experiment) => storeEquipmentTarget(experiment, "analytical_balance")),
    isSatisfied: (experiment) =>
      hasTestPortion(experiment) &&
      !workspaceWidget(experiment, "analytical_balance")?.isPresent,
    isInvalidated: extractionLineIsLost,
    presentation: (experiment) =>
      storeEquipmentPresentation(
        experiment,
        "analytical_balance",
        "widget.analytical_balance",
        "tutorial.item.weighedTube",
      ),
  }),
  step({
    id: "prepare-extraction",
    chapterId: "extraction",
    title: "tutorial.prepare-extraction.title",
    instruction: "tutorial.prepare-extraction.instruction",
    hint: "tutorial.prepare-extraction.hint",
    prerequisites: ["store-analytical-balance"],
    ...fromTarget(extractionPreparationTarget),
    isSatisfied: hasStagedExtraction,
    isInvalidated: extractionRestartAwaitsReagents,
    presentation: extractionPreparationPresentation,
  }),
  step({
    id: "chill-extraction",
    chapterId: "extraction",
    title: "tutorial.chill-extraction.title",
    instruction: "tutorial.chill-extraction.instruction",
    hint: "tutorial.chill-extraction.hint",
    prerequisites: ["prepare-extraction"],
    ...fromTarget(chillExtractionTarget),
    isSatisfied: hasChilledExtraction,
    isInvalidated: extractionRestartAwaitsReagents,
    presentation: chillExtractionPresentation,
  }),
  step({
    id: "salt-extraction",
    chapterId: "extraction",
    title: "tutorial.salt-extraction.title",
    instruction: "tutorial.salt-extraction.instruction",
    hint: "tutorial.salt-extraction.hint",
    prerequisites: ["chill-extraction"],
    ...fromTarget(saltExtractionTarget),
    isSatisfied: hasSaltedExtraction,
    isInvalidated: extractionRestartAwaitsReagents,
    presentation: saltExtractionPresentation,
  }),
  step({
    id: "vortex-extract",
    chapterId: "extraction",
    title: "tutorial.vortex-extract.title",
    instruction: "tutorial.vortex-extract.instruction",
    hint: "tutorial.vortex-extract.hint",
    prerequisites: ["salt-extraction"],
    ...fromTarget((experiment) =>
      extractionEquipmentTarget(experiment, "vortex", "vortex_mixer_widget")),
    isSatisfied: hasVortexedExtraction,
    presentation: (experiment) =>
      extractionEquipmentPresentation(experiment, "vortex", "Vortex mixer"),
  }),
  step({
    id: "store-vortex",
    chapterId: "extraction",
    title: "tutorial.store-vortex.title",
    instruction: "tutorial.store-vortex.instruction",
    hint: "tutorial.store-vortex.hint",
    prerequisites: ["vortex-extract"],
    ...fromTarget(storeExtractionEquipmentTarget),
    isSatisfied: (experiment) =>
      hasVortexedExtraction(experiment) &&
      !workspaceWidget(experiment, "vortex")?.isPresent &&
      !workspaceWidget(experiment, "ice_bath")?.isPresent,
    presentation: storeExtractionEquipmentPresentation,
  }),
  step({
    id: "separate-extract",
    chapterId: "extraction",
    title: "tutorial.separate-extract.title",
    instruction: "tutorial.separate-extract.instruction",
    hint: "tutorial.separate-extract.hint",
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
    title: "tutorial.prepare-sample-vial.title",
    instruction: "tutorial.prepare-sample-vial.instruction",
    hint: "tutorial.prepare-sample-vial.hint",
    prerequisites: ["separate-extract"],
    ...fromTarget(sampleVialTarget),
    isSatisfied: hasInjectableSampleVial,
    presentation: sampleVialPresentation,
  }),
  step({
    id: "label-sample-vial",
    chapterId: "vials",
    title: "tutorial.label-sample-vial.title",
    instruction: "tutorial.label-sample-vial.instruction",
    hint: "tutorial.label-sample-vial.hint",
    prerequisites: ["prepare-sample-vial"],
    ...fromTarget(labelSampleVialTarget),
    isSatisfied: hasLabelledSampleVial,
    presentation: labelSampleVialPresentation,
  }),
  step({
    id: "store-centrifuge",
    chapterId: "vials",
    title: "tutorial.store-centrifuge.title",
    instruction: "tutorial.store-centrifuge.instruction",
    hint: "tutorial.store-centrifuge.hint",
    prerequisites: ["label-sample-vial"],
    ...fromTarget((experiment) => storeEquipmentTarget(experiment, "centrifuge")),
    isSatisfied: (experiment) =>
      Boolean(preparedSampleVial(experiment)) &&
      !workspaceWidget(experiment, "centrifuge")?.isPresent,
    presentation: (experiment) =>
      storeEquipmentPresentation(
        experiment,
        "centrifuge",
        "widget.centrifuge",
        "tutorial.item.separatedExtractionTube",
      ),
  }),
  step({
    id: "prepare-calibration-vial",
    chapterId: "vials",
    title: "tutorial.prepare-calibration-vial.title",
    instruction: {
      key: "tutorial.prepare-calibration-vial.instruction",
      params: {
        p0: calibrationIstdVolumeMl,
        p1: CALIBRATION_LADDER_NG_PER_ML.join(", "),
      },
    },
    hint: "tutorial.prepare-calibration-vial.hint",
    prerequisites: ["store-centrifuge"],
    ...fromTarget(calibrationVialTarget),
    isSatisfied: hasCompleteCalibrationLadder,
    presentation: calibrationVialPresentation,
  }),
  step({
    id: "stage-vials",
    chapterId: "acquisition",
    title: "tutorial.stage-vials.title",
    instruction: "tutorial.stage-vials.instruction",
    hint: "tutorial.stage-vials.hint",
    prerequisites: ["prepare-calibration-vial"],
    ...fromTarget(stageVialsTarget),
    isSatisfied: (experiment) => {
      const rackTools = experiment.rack.slots.flatMap((slot) => (slot.tool ? [slot.tool] : []));
      const sealedLevels = new Set(
        rackTools
          .filter((tool) => Boolean(tool.calibrationContext) && Boolean(tool.isSealed))
          .map((tool) => tool.calibrationContext?.levelNgPerMl),
      );
      return (
        rackTools.some((tool) => Boolean(tool.injectionContext) && Boolean(tool.isSealed)) &&
        CALIBRATION_LADDER_NG_PER_ML.every((level) => sealedLevels.has(level))
      );
    },
    presentation: stageVialsPresentation,
  }),
  step({
    id: "declare-calibration-levels",
    chapterId: "acquisition",
    title: "tutorial.declare-calibration-levels.title",
    instruction: "tutorial.declare-calibration-levels.instruction",
    hint: "tutorial.declare-calibration-levels.hint",
    prerequisites: ["stage-vials"],
    ...fromTarget(declareCalibrationLevelsTarget),
    isSatisfied: declaredCalibrationLadder,
    presentation: declareCalibrationLevelsPresentation,
  }),
  step({
    id: "launch-sequence",
    chapterId: "acquisition",
    title: "tutorial.launch-sequence.title",
    instruction: "tutorial.launch-sequence.instruction",
    hint: "tutorial.launch-sequence.hint",
    prerequisites: ["declare-calibration-levels"],
    ...fromTarget(launchSequenceTarget),
    isSatisfied: (experiment) => sequenceRuns(experiment).length > 0,
    presentation: launchSequencePresentation,
  }),
  step({
    id: "review-results",
    chapterId: "acquisition",
    title: "tutorial.review-results.title",
    instruction: "tutorial.review-results.instruction",
    hint: "tutorial.review-results.hint",
    prerequisites: ["launch-sequence"],
    anchor: () => "instrument-screen",
    isSatisfied: completedCalibrationAndSampleRun,
    presentation: (experiment) => {
      const run = sequenceRuns(experiment).at(-1);
      const progress = run && run.totalDurationS > 0
        ? Math.round((run.elapsedS / run.totalDurationS) * 100)
        : 0;
      return {
        title: translateNow("tutorial.review-results.title2"),
        instruction: translateNow("tutorial.review-results.instruction2", { p0: progress }),
        hint: translateNow("tutorial.review-results.hint2"),
        action: { kind: "wait", label: translateNow("tutorial.review-results.label", { p0: progress }) },
      };
    },
  }),
  step({
    id: "store-acquisition-equipment",
    chapterId: "acquisition",
    title: "tutorial.store-acquisition-equipment.title",
    instruction: "tutorial.store-acquisition-equipment.instruction",
    hint: "tutorial.store-acquisition-equipment.hint",
    prerequisites: ["review-results"],
    ...fromTarget(cleanupAcquisitionTarget),
    isSatisfied: completedRunAndStoredAcquisitionEquipment,
    presentation: cleanupAcquisitionPresentation,
  }),
];

export const calibrationSampleTutorial: TutorialDefinition = {
  id: CALIBRATION_SAMPLE_TUTORIAL_ID,
  version: 1,
  title: "tutorial.definition.title",
  chapters: [
    {
      id: "reception",
      title: "tutorial.reception.title",
      stepIds: [
        "weigh-received-sample",
        "register-and-label-sample",
        "store-gross-balance",
      ],
    },
    {
      id: "sample-preparation",
      title: "tutorial.sample-preparation.title",
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
      title: "tutorial.extraction.title",
      stepIds: [
        "prepare-extraction",
        "chill-extraction",
        "salt-extraction",
        "vortex-extract",
        "store-vortex",
        "separate-extract",
      ],
    },
    {
      id: "vials",
      title: "tutorial.vials.title",
      stepIds: [
        "prepare-sample-vial",
        "label-sample-vial",
        "store-centrifuge",
        "prepare-calibration-vial",
      ],
    },
    {
      id: "acquisition",
      title: "tutorial.acquisition.title",
      stepIds: [
        "stage-vials",
        "declare-calibration-levels",
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
  const instruction = dynamicPresentation?.instruction ?? resolveTutorialText(tutorialStep.instruction);
  return {
    title: resolveTutorialText(tutorialStep.title),
    instruction,
    hint: resolveTutorialText(tutorialStep.hint),
    // Inferred from the English wording so the guessed action stays the same in
    // every language; a presentation that needs another action states it itself.
    action: inferTutorialAction(enMessages[textKey(tutorialStep.instruction)]),
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
  // Only a step that is currently unsatisfied can be walked back. The trash retains
  // everything it is given, so the ruined tube that triggered the rewind stays in the
  // experiment for good; without this guard it would invalidate its chapter forever
  // and turn the recovery into the very dead end it exists to undo.
  for (const entry of definition.steps) {
    if (entry.isInvalidated?.(experiment) && !entry.isSatisfied(experiment)) {
      completed.delete(entry.id);
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
