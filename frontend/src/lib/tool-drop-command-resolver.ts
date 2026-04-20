import type {
  BasketToolReferencePayload,
  DiscardRackToolPayload,
  DiscardToolFromPalettePayload,
  DiscardWorkbenchToolPayload,
  MoveAnalyticalBalanceToolToWorkbenchPayload,
  MoveGrossBalanceToolToRackPayload,
  MoveGrossBalanceToolToWorkbenchPayload,
  MoveRackToolBetweenSlotsPayload,
  MoveRackToolToAnalyticalBalancePayload,
  MoveRackToolToGrossBalancePayload,
  MoveRackToolToVortexPayload,
  MoveVortexToolToWorkbenchPayload,
  MoveWorkbenchToolToAnalyticalBalancePayload,
  MoveWorkbenchToolToGrossBalancePayload,
  MoveWorkbenchToolToVortexPayload,
  PlaceToolOnVortexPayload,
  MoveToolBetweenWorkbenchSlotsPayload,
  PlaceReceivedBagOnWorkbenchPayload,
  PlaceToolInRackSlotPayload,
  PlaceToolOnAnalyticalBalancePayload,
  PlaceToolOnGrossBalancePayload,
  RestoreTrashedToolToAnalyticalBalancePayload,
  RestoreTrashedToolToGrossBalancePayload,
  RestoreTrashedToolToRackSlotPayload,
  RestoreTrashedToolToVortexPayload,
  RestoreTrashedToolToWorkbenchSlotPayload,
} from "@/types/api-payloads";
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

type SupportedToolDropPayload =
  | AnalyticalBalanceToolDragPayload
  | BasketToolDragPayload
  | BenchToolDragPayload
  | GrossBalanceToolDragPayload
  | RackToolDragPayload
  | ToolbarDragPayload
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
  | { kind: "discard_analytical_balance_tool" }
  | { kind: "discard_basket_tool"; payload: BasketToolReferencePayload }
  | { kind: "discard_gross_balance_tool" }
  | { kind: "discard_rack_tool"; payload: DiscardRackToolPayload }
  | { kind: "discard_tool_from_palette"; payload: DiscardToolFromPalettePayload }
  | { kind: "discard_workbench_tool"; payload: DiscardWorkbenchToolPayload }
  | { kind: "move_analytical_balance_tool_to_gross_balance" }
  | { kind: "move_analytical_balance_tool_to_workbench"; payload: MoveAnalyticalBalanceToolToWorkbenchPayload }
  | { kind: "move_basket_tool_to_gross_balance"; payload: BasketToolReferencePayload }
  | { kind: "move_gross_balance_tool_to_analytical_balance" }
  | { kind: "move_gross_balance_tool_to_rack"; payload: MoveGrossBalanceToolToRackPayload }
  | { kind: "move_gross_balance_tool_to_workbench"; payload: MoveGrossBalanceToolToWorkbenchPayload }
  | { kind: "move_rack_tool_between_slots"; payload: MoveRackToolBetweenSlotsPayload }
  | { kind: "move_rack_tool_to_analytical_balance"; payload: MoveRackToolToAnalyticalBalancePayload }
  | { kind: "move_rack_tool_to_gross_balance"; payload: MoveRackToolToGrossBalancePayload }
  | { kind: "move_rack_tool_to_workbench"; payload: { rack_slot_id: string; target_slot_id: string } }
  | { kind: "move_workbench_tool_to_analytical_balance"; payload: MoveWorkbenchToolToAnalyticalBalancePayload }
  | { kind: "move_workbench_tool_to_gross_balance"; payload: MoveWorkbenchToolToGrossBalancePayload }
  | { kind: "move_workbench_tool_to_workbench"; payload: MoveToolBetweenWorkbenchSlotsPayload }
  | { kind: "place_workbench_tool_in_rack_slot"; payload: { source_slot_id: string; rack_slot_id: string } }
  | { kind: "place_received_bag_on_workbench"; payload: PlaceReceivedBagOnWorkbenchPayload }
  | { kind: "place_tool_in_rack_slot"; payload: PlaceToolInRackSlotPayload }
  | { kind: "place_tool_on_analytical_balance"; payload: PlaceToolOnAnalyticalBalancePayload }
  | { kind: "place_tool_on_gross_balance"; payload: PlaceToolOnGrossBalancePayload }
  | { kind: "restore_trashed_tool_to_analytical_balance"; payload: RestoreTrashedToolToAnalyticalBalancePayload }
  | { kind: "restore_trashed_tool_to_gross_balance"; payload: RestoreTrashedToolToGrossBalancePayload }
  | { kind: "restore_trashed_tool_to_rack_slot"; payload: RestoreTrashedToolToRackSlotPayload }
  | { kind: "restore_trashed_tool_to_workbench"; payload: RestoreTrashedToolToWorkbenchSlotPayload }
  | { kind: "discard_vortex_tool" }
  | { kind: "move_vortex_tool_to_workbench"; payload: MoveVortexToolToWorkbenchPayload }
  | { kind: "move_workbench_tool_to_vortex"; payload: MoveWorkbenchToolToVortexPayload }
  | { kind: "move_rack_tool_to_vortex"; payload: MoveRackToolToVortexPayload }
  | { kind: "place_tool_on_vortex"; payload: PlaceToolOnVortexPayload }
  | { kind: "restore_trashed_tool_to_vortex"; payload: RestoreTrashedToolToVortexPayload };

function isToolbarToolPayload(payload: SupportedToolDropPayload): payload is ToolbarDragPayload & { itemType: "tool" } {
  return "itemType" in payload && payload.itemType === "tool";
}

function isSampleVialTool(payload: SupportedToolDropPayload) {
  return ("toolType" in payload && payload.toolType === "sample_vial") ||
    (isToolbarToolPayload(payload) && payload.toolType === "sample_vial");
}

export function resolveToolDropCommand(
  payload: SupportedToolDropPayload,
  target: ToolDropTarget,
): ToolDropCommand | null {
  if (target.kind === "workbench_slot") {
    if (isToolbarToolPayload(payload)) {
      return null;
    }
    if (payload.sourceKind === "basket") {
      return {
        kind: "place_received_bag_on_workbench",
        payload: {
          target_slot_id: target.slotId,
          tool_id: payload.sourceId,
        },
      };
    }
    if ("sourceSlotId" in payload) {
      return payload.sourceSlotId === target.slotId
        ? null
        : {
            kind: "move_workbench_tool_to_workbench",
            payload: {
              source_slot_id: payload.sourceSlotId,
              target_slot_id: target.slotId,
            },
          };
    }
    if ("trashToolId" in payload) {
      return {
        kind: "restore_trashed_tool_to_workbench",
        payload: {
          target_slot_id: target.slotId,
          trash_tool_id: payload.trashToolId,
        },
      };
    }
    if (payload.sourceKind === "gross_balance") {
      return {
        kind: "move_gross_balance_tool_to_workbench",
        payload: { target_slot_id: target.slotId },
      };
    }
    if (payload.sourceKind === "analytical_balance") {
      return {
        kind: "move_analytical_balance_tool_to_workbench",
        payload: { target_slot_id: target.slotId },
      };
    }
    if (payload.sourceKind === "vortex") {
      return {
        kind: "move_vortex_tool_to_workbench",
        payload: { target_slot_id: target.slotId },
      };
    }
    if ("rackSlotId" in payload) {
      return {
        kind: "move_rack_tool_to_workbench",
        payload: {
          rack_slot_id: payload.rackSlotId,
          target_slot_id: target.slotId,
        },
      };
    }
    return null;
  }

  if (target.kind === "rack_slot") {
    if (!isSampleVialTool(payload)) {
      return null;
    }
    if (isToolbarToolPayload(payload)) {
      return {
        kind: "place_tool_in_rack_slot",
        payload: {
          rack_slot_id: target.rackSlotId,
          tool_id: payload.itemId,
        },
      };
    }
    if ("sourceSlotId" in payload) {
      return {
        kind: "place_workbench_tool_in_rack_slot",
        payload: {
          source_slot_id: payload.sourceSlotId,
          rack_slot_id: target.rackSlotId,
        },
      };
    }
    if ("rackSlotId" in payload) {
      return payload.rackSlotId === target.rackSlotId
        ? null
        : {
            kind: "move_rack_tool_between_slots",
            payload: {
              source_rack_slot_id: payload.rackSlotId,
              target_rack_slot_id: target.rackSlotId,
            },
          };
    }
    if ("trashToolId" in payload) {
      return {
        kind: "restore_trashed_tool_to_rack_slot",
        payload: {
          rack_slot_id: target.rackSlotId,
          trash_tool_id: payload.trashToolId,
        },
      };
    }
    if (payload.sourceKind === "gross_balance") {
      return {
        kind: "move_gross_balance_tool_to_rack",
        payload: { rack_slot_id: target.rackSlotId },
      };
    }
    return null;
  }

  if (target.kind === "gross_balance") {
    if (isToolbarToolPayload(payload)) {
      return {
        kind: "place_tool_on_gross_balance",
        payload: { tool_id: payload.itemId },
      };
    }
    if (payload.sourceKind === "basket") {
      return {
        kind: "move_basket_tool_to_gross_balance",
        payload: { tool_id: payload.sourceId },
      };
    }
    if ("sourceSlotId" in payload) {
      return {
        kind: "move_workbench_tool_to_gross_balance",
        payload: { source_slot_id: payload.sourceSlotId },
      };
    }
    if ("rackSlotId" in payload) {
      return {
        kind: "move_rack_tool_to_gross_balance",
        payload: { rack_slot_id: payload.rackSlotId },
      };
    }
    if (payload.sourceKind === "analytical_balance") {
      return { kind: "move_analytical_balance_tool_to_gross_balance" };
    }
    if ("trashToolId" in payload) {
      return {
        kind: "restore_trashed_tool_to_gross_balance",
        payload: { trash_tool_id: payload.trashToolId },
      };
    }
    return null;
  }

  if (target.kind === "analytical_balance") {
    if (isToolbarToolPayload(payload)) {
      return {
        kind: "place_tool_on_analytical_balance",
        payload: { tool_id: payload.itemId },
      };
    }
    if ("sourceSlotId" in payload) {
      return {
        kind: "move_workbench_tool_to_analytical_balance",
        payload: { source_slot_id: payload.sourceSlotId },
      };
    }
    if ("rackSlotId" in payload) {
      return {
        kind: "move_rack_tool_to_analytical_balance",
        payload: { rack_slot_id: payload.rackSlotId },
      };
    }
    if (payload.sourceKind === "gross_balance") {
      return { kind: "move_gross_balance_tool_to_analytical_balance" };
    }
    if ("trashToolId" in payload) {
      return {
        kind: "restore_trashed_tool_to_analytical_balance",
        payload: { trash_tool_id: payload.trashToolId },
      };
    }
    return null;
  }

  if (target.kind === "trash_bin") {
    if (isToolbarToolPayload(payload)) {
      return {
        kind: "discard_tool_from_palette",
        payload: { tool_id: payload.itemId },
      };
    }
    if ("sourceSlotId" in payload) {
      return {
        kind: "discard_workbench_tool",
        payload: { slot_id: payload.sourceSlotId },
      };
    }
    if (payload.sourceKind === "basket") {
      return {
        kind: "discard_basket_tool",
        payload: { tool_id: payload.sourceId },
      };
    }
    if ("rackSlotId" in payload) {
      return {
        kind: "discard_rack_tool",
        payload: { rack_slot_id: payload.rackSlotId },
      };
    }
    if (payload.sourceKind === "gross_balance") {
      return { kind: "discard_gross_balance_tool" };
    }
    if (payload.sourceKind === "analytical_balance") {
      return { kind: "discard_analytical_balance_tool" };
    }
    if (payload.sourceKind === "vortex") {
      return { kind: "discard_vortex_tool" };
    }
  }

  if (target.kind === "vortex") {
    if (isToolbarToolPayload(payload)) {
      if (payload.toolType === "centrifuge_tube" || payload.toolType === "cleanup_tube") {
        return { kind: "place_tool_on_vortex", payload: { tool_id: payload.itemId } };
      }
      return null;
    }
    if ("sourceSlotId" in payload) {
      return {
        kind: "move_workbench_tool_to_vortex",
        payload: { source_slot_id: payload.sourceSlotId },
      };
    }
    if ("rackSlotId" in payload) {
      return {
        kind: "move_rack_tool_to_vortex",
        payload: { rack_slot_id: payload.rackSlotId },
      };
    }
    if ("trashToolId" in payload) {
      return {
        kind: "restore_trashed_tool_to_vortex",
        payload: { trash_tool_id: payload.trashToolId },
      };
    }
    return null;
  }

  return null;
}
