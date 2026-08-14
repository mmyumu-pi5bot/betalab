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
    actionLabel: "Use the highlighted Cutting board",
    anchor: cuttingBoard
      ? `bench-tool-card-${cuttingBoard.id}`
      : "palette-item-cutting_board_hdpe",
    continueLabel: "Continue tutorial",
    title: "Contamination prevented",
    instruction:
      "Do not place the apples directly on the workbench. Contact with the bare surface would irreversibly contaminate the sample. Drop them onto the highlighted Cutting board instead.",
    hint: cuttingBoard
      ? "The attempted drop was cancelled: the apples are still in their original container."
      : "First deploy a Cutting board from Inventory, then transfer the apples onto it.",
    leaveLabel: "Leave tutorial and place anyway",
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
    actionLabel: "Do not tare again",
    anchor: "analytical-balance-tare",
    continueLabel: "Keep the empty-tube tare",
    title: "Tare protected",
    instruction:
      "The tube already contains powder. Taring again would hide that mass from the Net display, so the tutorial cancelled the action. Keep the tare measured with the empty tube and continue dosing until Net reaches about 10.000 g.",
    hint: "Nothing changed on the balance: the original empty-tube tare and the current Net value were preserved.",
    leaveLabel: "Leave tutorial and tare anyway",
  };
}
