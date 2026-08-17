import type { MoveObjectPayload } from "@/types/api-payloads";
import type {
  AnalyticalBalanceToolDragPayload,
  BasketToolDragPayload,
  BenchToolDragPayload,
  CentrifugeToolDragPayload,
  GrossBalanceToolDragPayload,
  IceBathToolDragPayload,
  RackToolDragPayload,
  ToolbarDragPayload,
  TrashToolDragPayload,
  VortexToolDragPayload,
} from "@/types/workbench";

type ToolbarToolDragPayload = Extract<ToolbarDragPayload, { itemType: "tool" }>;

type SupportedToolDropPayload =
  | AnalyticalBalanceToolDragPayload
  | BasketToolDragPayload
  | BenchToolDragPayload
  | CentrifugeToolDragPayload
  | IceBathToolDragPayload
  | GrossBalanceToolDragPayload
  | RackToolDragPayload
  | ToolbarToolDragPayload
  | TrashToolDragPayload
  | VortexToolDragPayload;

type ToolDropTarget =
  | { kind: "analytical_balance" }
  | { kind: "centrifuge" }
  | { kind: "ice_bath" }
  | { kind: "gross_balance" }
  | { kind: "rack_slot"; rackSlotId: string }
  | { kind: "trash_bin" }
  | { kind: "vortex" }
  | { kind: "workbench_slot"; slotId: string };

export type ToolDropCommand = { kind: "move_object"; payload: MoveObjectPayload };

function isToolbarToolPayload(payload: SupportedToolDropPayload): payload is ToolbarToolDragPayload {
  return "itemType" in payload && payload.itemType === "tool";
}

function getTargetId(target: ToolDropTarget): string {
  if (target.kind === "workbench_slot") {
    return target.slotId;
  }
  if (target.kind === "rack_slot") {
    return target.rackSlotId;
  }
  return target.kind;
}

function getSourceId(payload: Exclude<SupportedToolDropPayload, ToolbarToolDragPayload>): string {
  if ("sourceSlotId" in payload) {
    return payload.sourceSlotId;
  }
  if ("rackSlotId" in payload) {
    return payload.rackSlotId;
  }
  if ("trashToolId" in payload) {
    return payload.trashToolId;
  }
  return payload.sourceId;
}

function getEntityId(payload: Exclude<SupportedToolDropPayload, ToolbarToolDragPayload>): string {
  return payload.entityId;
}

export function resolveToolDropCommand(
  payload: SupportedToolDropPayload,
  target: ToolDropTarget,
): ToolDropCommand | null {
  if (
    !isToolbarToolPayload(payload) &&
    ((target.kind === "workbench_slot" && "sourceSlotId" in payload && payload.sourceSlotId === target.slotId) ||
      (target.kind === "rack_slot" && "rackSlotId" in payload && payload.rackSlotId === target.rackSlotId) ||
      (target.kind === "gross_balance" && payload.sourceKind === "gross_balance") ||
      (target.kind === "analytical_balance" && payload.sourceKind === "analytical_balance") ||
      (target.kind === "centrifuge" && payload.sourceKind === "centrifuge") ||
      (target.kind === "ice_bath" && payload.sourceKind === "ice_bath") ||
      (target.kind === "vortex" && payload.sourceKind === "vortex") ||
      (target.kind === "trash_bin" && payload.sourceKind === "trash"))
  ) {
    return null;
  }

  if (isToolbarToolPayload(payload)) {
    return {
      kind: "move_object",
      payload: {
        entity: { kind: "tool", id: payload.itemId },
        source: { kind: payload.sourceKind, id: payload.itemId },
        destination: { kind: target.kind, id: getTargetId(target) },
      },
    };
  }

  const sourceId = getSourceId(payload);
  const entityId = getEntityId(payload);
  return {
    kind: "move_object",
    payload: {
      entity: { kind: "tool", id: entityId },
      source: { kind: payload.sourceKind, id: sourceId },
      destination: { kind: target.kind, id: getTargetId(target) },
    },
  };
}
