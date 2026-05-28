import type { TrashDropCommand } from "@/lib/trash-drop-command-resolver";

type TrashDropApi = {
  discardPrintedLimsLabel: () => void;
  discardSampleLabelFromPalette: () => void;
  moveObject: (payload: Extract<TrashDropCommand, { kind: "move_object" }>["payload"]) => void;
  removeLiquidFromWorkspaceWidget: (payload: { liquid_entry_id: string; widget_id: string }) => void;
};

export function executeTrashDropCommand(command: TrashDropCommand, api: TrashDropApi): boolean {
  if (command.kind === "discard_sample_label_from_palette") {
    void api.discardSampleLabelFromPalette();
    return true;
  }
  if (command.kind === "discard_printed_lims_label") {
    void api.discardPrintedLimsLabel();
    return true;
  }
  if (command.kind === "remove_liquid_from_workspace_widget") {
    void api.removeLiquidFromWorkspaceWidget(command.payload);
    return true;
  }
  if (command.kind === "move_object") {
    void api.moveObject(command.payload);
    return true;
  }
  return false;
}
