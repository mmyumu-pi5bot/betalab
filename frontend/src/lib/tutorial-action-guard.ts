import { translateNow } from "@/lib/i18n";
import type { Experiment } from "@/types/experiment";
import type { ProduceDragPayload } from "@/types/workbench";

export type TutorialIntervention = {
  actionLabel: string;
  anchor: string;
  continueLabel: string;
  hint: string;
  instruction: string;
  leaveLabel: string;
  title: string;
};

export function getTutorialProduceDropIntervention({
  experiment,
  isTutorialProtected,
  targetSlotId,
}: {
  experiment: Experiment;
  isTutorialProtected: boolean;
  payload: ProduceDragPayload;
  targetSlotId: string;
}): TutorialIntervention | null {
  if (!isTutorialProtected) {
    return null;
  }

  const targetSlot = experiment.workbench.slots.find((slot) => slot.id === targetSlotId);
  if (!targetSlot || targetSlot.tool) {
    return null;
  }

  const cuttingBoard = experiment.workbench.slots
    .flatMap((slot) => (slot.tool ? [slot.tool] : []))
    .find((tool) => tool.toolType === "cutting_board");

  return {
    actionLabel: translateNow("guard.contamination.actionLabel"),
    anchor: cuttingBoard
      ? `bench-tool-card-${cuttingBoard.id}`
      : "palette-item-cutting_board_hdpe",
    continueLabel: translateNow("guard.contamination.continueLabel"),
    title: translateNow("guard.contamination.title"),
    instruction: translateNow("guard.contamination.instruction"),
    hint: cuttingBoard
      ? translateNow("guard.contamination.hintCancelled")
      : translateNow("guard.contamination.hintDeploy"),
    leaveLabel: translateNow("guard.contamination.leaveLabel"),
  };
}

export function getTutorialTareIntervention({
  experiment,
  isTutorialProtected,
}: {
  experiment: Experiment;
  isTutorialProtected: boolean;
}): TutorialIntervention | null {
  if (!isTutorialProtected) {
    return null;
  }

  const balanceTool = experiment.workspace.widgets.find(
    (widget) => widget.id === "analytical_balance",
  )?.tool;
  const powderMassG = balanceTool
    ? balanceTool.powderMassG ??
      (balanceTool.produceFractions ?? []).reduce(
        (total, fraction) => total + fraction.massG,
        0,
      )
    : 0;
  if (powderMassG <= 0) {
    return null;
  }

  return {
    actionLabel: translateNow("guard.tare.actionLabel"),
    anchor: "analytical-balance-tare",
    continueLabel: translateNow("guard.tare.continueLabel"),
    title: translateNow("guard.tare.title"),
    instruction: translateNow("guard.tare.instruction"),
    hint: translateNow("guard.tare.hint"),
    leaveLabel: translateNow("guard.tare.leaveLabel"),
  };
}
