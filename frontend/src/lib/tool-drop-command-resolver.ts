import type { MoveToolPayload, PlaceToolFromPalettePayload } from "@/types/api-payloads";
import type {
  AnalyticalBalanceToolDragPayload,
  BasketToolDragPayload,
  BenchToolDragPayload,
  GrossBalanceToolDragPayload,
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
  | GrossBalanceToolDragPayload
  | RackToolDragPayload
  | ToolbarToolDragPayload
  | TrashToolDragPayload
  | VortexToolDragPayload;

type ToolDropTarget =
  | { kind: "analytical_balance" }
  | { kind: "gross_balance" }
  | { kind: "rack_slot"; rackSlotId: string }
  | { kind: "trash_bin" }
  | { kind: "vortex" }
  | { kind: "workbench_slot"; slotId: string };

export type ToolDropCommand =
  | { kind: "move_tool"; payload: MoveToolPayload }
  | { kind: "place_tool_from_palette"; payload: PlaceToolFromPalettePayload };

function isToolbarToolPayload(payload: SupportedToolDropPayload): payload is ToolbarToolDragPayload {
  return "itemType" in payload && payload.itemType === "tool";
}

function isSampleVialTool(payload: SupportedToolDropPayload) {
  return ("toolType" in payload && payload.toolType === "sample_vial") ||
    (isToolbarToolPayload(payload) && payload.toolType === "sample_vial");
}

function isVortexCompatibleTool(payload: SupportedToolDropPayload) {
  return ("toolType" in payload && ["centrifuge_tube", "cleanup_tube"].includes(payload.toolType)) ||
    (isToolbarToolPayload(payload) && ["centrifuge_tube", "cleanup_tube"].includes(payload.toolType));
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

export function resolveToolDropCommand(
  payload: SupportedToolDropPayload,
  target: ToolDropTarget,
): ToolDropCommand | null {
  if (target.kind === "rack_slot" && !isSampleVialTool(payload)) {
    return null;
  }
  if (target.kind === "vortex" && !isVortexCompatibleTool(payload)) {
    return null;
  }
  if (
    !isToolbarToolPayload(payload) &&
    ((target.kind === "workbench_slot" && "sourceSlotId" in payload && payload.sourceSlotId === target.slotId) ||
      (target.kind === "rack_slot" && "rackSlotId" in payload && payload.rackSlotId === target.rackSlotId) ||
      (target.kind === "gross_balance" && payload.sourceKind === "gross_balance") ||
      (target.kind === "analytical_balance" && payload.sourceKind === "analytical_balance") ||
      (target.kind === "trash_bin" && payload.sourceKind === "trash"))
  ) {
    return null;
  }

  if (isToolbarToolPayload(payload)) {
    return {
      kind: "place_tool_from_palette",
      payload: {
        tool_id: payload.itemId,
        destination_kind: target.kind,
        destination_id: getTargetId(target),
      },
    };
  }

  return {
    kind: "move_tool",
    payload: {
      source_kind: payload.sourceKind,
      source_id: getSourceId(payload),
      destination_kind: target.kind,
      destination_id: getTargetId(target),
    },
  };
}
