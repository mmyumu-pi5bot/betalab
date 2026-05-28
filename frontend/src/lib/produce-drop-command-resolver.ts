import type {
  MoveObjectPayload,
} from "@/types/api-payloads";
import type { ProduceDragPayload } from "@/types/workbench";
import { resolveProduceMoveObjectPayload } from "@/lib/produce-dnd-object-command";

type ProduceDropTarget =
  | { kind: "gross_balance" }
  | { kind: "workbench_tool"; slotId: string }
  | { kind: "workspace_widget"; widgetId: "grinder" };

export type ProduceDropCommand =
  | { kind: "create_debug_produce_lot_on_workbench"; payload: { presetId: string; targetSlotId: string } }
  | { kind: "create_debug_produce_lot_to_widget"; payload: { presetId: string; widgetId: "gross_balance" | "grinder" } }
  | { kind: "move_object"; payload: MoveObjectPayload };

function resolveMoveObjectCommand(
  payload: ProduceDragPayload,
  target: ProduceDropTarget,
): ProduceDropCommand | null {
  const movePayload = resolveProduceMoveObjectPayload(payload, target);

  return movePayload === null ? null : { kind: "move_object", payload: movePayload };
}

export function resolveProduceDropCommand(
  payload: ProduceDragPayload,
  target: ProduceDropTarget,
): ProduceDropCommand | null {
  if (target.kind === "workbench_tool") {
    if (payload.sourceKind === "debug_palette" && payload.debugProducePresetId) {
      return {
        kind: "create_debug_produce_lot_on_workbench",
        payload: {
          presetId: payload.debugProducePresetId,
          targetSlotId: target.slotId,
        },
      };
    }
    return resolveMoveObjectCommand(payload, target);
  }

  if (target.kind === "gross_balance") {
    if (payload.sourceKind === "debug_palette" && payload.debugProducePresetId) {
      return {
        kind: "create_debug_produce_lot_to_widget",
        payload: {
          presetId: payload.debugProducePresetId,
          widgetId: "gross_balance",
        },
      };
    }
    return resolveMoveObjectCommand(payload, target);
  }

  if (target.widgetId === "grinder") {
    if (payload.sourceKind === "debug_palette" && payload.debugProducePresetId) {
      return {
        kind: "create_debug_produce_lot_to_widget",
        payload: {
          presetId: payload.debugProducePresetId,
          widgetId: "grinder",
        },
      };
    }
    return resolveMoveObjectCommand(payload, target);
  }

  return null;
}
