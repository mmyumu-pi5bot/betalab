import type { ProduceDragPayload, WorkspaceLiquidDragPayload } from "@/types/workbench";
import type { MoveObjectPayload } from "@/types/api-payloads";
import { resolveProduceMoveObjectPayload } from "@/lib/produce-dnd-object-command";

import type { LabelDragPayload } from "@/lib/label-drop-command-resolver";
import { resolveLabelDropCommand, type LabelDropCommand } from "@/lib/label-drop-command-resolver";

type TrashDropPayload = LabelDragPayload | ProduceDragPayload | WorkspaceLiquidDragPayload;

export type TrashDropCommand =
  | LabelDropCommand
  | { kind: "move_object"; payload: MoveObjectPayload }
  | {
      kind: "remove_liquid_from_workspace_widget";
      payload: { liquid_entry_id: string; widget_id: string };
    };

function isLabelDropPayload(payload: TrashDropPayload): payload is LabelDragPayload {
  return "kind" in payload;
}

function isWorkspaceLiquidDragPayload(
  payload: TrashDropPayload,
): payload is WorkspaceLiquidDragPayload {
  return "liquidEntryId" in payload;
}

export function resolveTrashDropCommand(
  payload: TrashDropPayload,
  options: { isGrinderRunning: boolean },
): TrashDropCommand | null {
  if (isLabelDropPayload(payload)) {
    return resolveLabelDropCommand(payload, { kind: "trash_bin" });
  }

  if (isWorkspaceLiquidDragPayload(payload)) {
    if (payload.sourceKind !== "grinder" || options.isGrinderRunning) {
      return null;
    }
    return {
      kind: "remove_liquid_from_workspace_widget",
      payload: {
        widget_id: payload.widgetId,
        liquid_entry_id: payload.liquidEntryId,
      },
    };
  }

  const movePayload = resolveProduceMoveObjectPayload(payload, { kind: "trash_bin" });
  if (movePayload !== null) {
    return {
      kind: "move_object",
      payload: movePayload,
    };
  }

  return null;
}
