import type { LabelDropCommand } from "@/lib/label-drop-command-resolver";
import type { MoveObjectPayload } from "@/types/api-payloads";

type WorkbenchLabelDropApi = {
  applyPrintedLimsLabel: (payload: { slot_id: string }) => void;
  applySampleLabelToWorkbenchTool: (payload: { slot_id: string }) => void;
  moveObject: (payload: MoveObjectPayload) => void;
};

type GrossBalanceLabelDropApi = {
  applyPrintedLimsLabelToGrossBalanceBag: () => void;
  applySampleLabelToGrossBalanceTool: () => void;
  moveObject: (payload: MoveObjectPayload) => void;
};

type AnalyticalBalanceLabelDropApi = {
  applyPrintedLimsLabelToAnalyticalBalanceTool: () => void;
  applySampleLabelToAnalyticalBalanceTool: () => void;
  moveObject: (payload: MoveObjectPayload) => void;
};

type TrashLabelDropApi = {
  discardPrintedLimsLabel: () => void;
  discardSampleLabelFromPalette: () => void;
  moveObject: (payload: MoveObjectPayload) => void;
};

export function executeWorkbenchLabelDropCommand(command: LabelDropCommand, api: WorkbenchLabelDropApi): boolean {
  if (command.kind === "apply_printed_lims_label") {
    void api.applyPrintedLimsLabel(command.payload);
    return true;
  }
  if (command.kind === "apply_sample_label_to_workbench_tool") {
    void api.applySampleLabelToWorkbenchTool(command.payload);
    return true;
  }
  if (command.kind === "move_object") {
    void api.moveObject(command.payload);
    return true;
  }
  return false;
}

export function executeGrossBalanceLabelDropCommand(command: LabelDropCommand, api: GrossBalanceLabelDropApi): boolean {
  if (command.kind === "apply_printed_lims_label_to_gross_balance_bag") {
    void api.applyPrintedLimsLabelToGrossBalanceBag();
    return true;
  }
  if (command.kind === "apply_sample_label_to_gross_balance_tool") {
    void api.applySampleLabelToGrossBalanceTool();
    return true;
  }
  if (command.kind === "move_object") {
    void api.moveObject(command.payload);
    return true;
  }
  return false;
}

export function executeAnalyticalBalanceLabelDropCommand(
  command: LabelDropCommand,
  api: AnalyticalBalanceLabelDropApi,
): boolean {
  if (command.kind === "apply_printed_lims_label_to_analytical_balance_tool") {
    void api.applyPrintedLimsLabelToAnalyticalBalanceTool();
    return true;
  }
  if (command.kind === "apply_sample_label_to_analytical_balance_tool") {
    void api.applySampleLabelToAnalyticalBalanceTool();
    return true;
  }
  if (command.kind === "move_object") {
    void api.moveObject(command.payload);
    return true;
  }
  return false;
}

export function executeTrashLabelDropCommand(command: LabelDropCommand, api: TrashLabelDropApi): boolean {
  if (command.kind === "discard_sample_label_from_palette") {
    void api.discardSampleLabelFromPalette();
    return true;
  }
  if (command.kind === "move_object") {
    void api.moveObject(command.payload);
    return true;
  }
  if (command.kind === "discard_printed_lims_label") {
    void api.discardPrintedLimsLabel();
    return true;
  }
  return false;
}
