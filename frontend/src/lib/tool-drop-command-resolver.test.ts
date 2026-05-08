import { describe, expect, it } from "vitest";

import { resolveToolDropCommand } from "@/lib/tool-drop-command-resolver";
import type {
  BasketToolDragPayload,
  BenchToolDragPayload,
  RackToolDragPayload,
  ToolbarDragPayload,
  TrashToolDragPayload,
  VortexToolDragPayload,
} from "@/types/workbench";

function createToolbarToolPayload(
  overrides: Partial<ToolbarDragPayload & { itemType: "tool" }> = {},
): ToolbarDragPayload & { itemType: "tool" } {
  return {
    allowedDropTargets: ["workbench_slot", "trash_bin", "gross_balance_widget", "analytical_balance_widget"],
    entityKind: "tool",
    itemId: "centrifuge_tube_50ml",
    itemType: "tool",
    sourceId: "centrifuge_tube_50ml",
    sourceKind: "palette",
    toolType: "centrifuge_tube",
    ...overrides,
  };
}

function createWorkbenchToolPayload(overrides: Partial<BenchToolDragPayload> = {}): BenchToolDragPayload {
  return {
    allowedDropTargets: ["workbench_slot", "trash_bin", "gross_balance_widget", "analytical_balance_widget"],
    entityKind: "tool",
    sourceId: "station_1",
    sourceKind: "workbench",
    sourceSlotId: "station_1",
    toolId: "tool_1",
    toolType: "centrifuge_tube",
    ...overrides,
  };
}

function createBasketToolPayload(overrides: Partial<BasketToolDragPayload> = {}): BasketToolDragPayload {
  return {
    allowedDropTargets: ["workbench_slot", "trash_bin", "gross_balance_widget"],
    entityKind: "tool",
    sourceId: "received_bag_1",
    sourceKind: "basket",
    toolId: "received_bag_1",
    toolType: "sample_bag",
    ...overrides,
  };
}

function createRackToolPayload(overrides: Partial<RackToolDragPayload> = {}): RackToolDragPayload {
  return {
    allowedDropTargets: ["workbench_slot", "rack_slot", "trash_bin", "gross_balance_widget", "analytical_balance_widget"],
    entityKind: "tool",
    rackSlotId: "rack_a1",
    sourceId: "rack_a1",
    sourceKind: "rack",
    toolId: "tool_1",
    toolType: "sample_vial",
    ...overrides,
  };
}

function createTrashToolPayload(overrides: Partial<TrashToolDragPayload> = {}): TrashToolDragPayload {
  return {
    allowedDropTargets: ["workbench_slot", "rack_slot", "gross_balance_widget", "analytical_balance_widget"],
    entityKind: "tool",
    sourceId: "trash_tool_1",
    sourceKind: "trash",
    toolId: "tool_1",
    toolType: "sample_vial",
    trashToolId: "trash_tool_1",
    ...overrides,
  };
}

function createVortexToolPayload(overrides: Partial<VortexToolDragPayload> = {}): VortexToolDragPayload {
  return {
    allowedDropTargets: ["workbench_slot", "trash_bin", "gross_balance_widget", "analytical_balance_widget"],
    entityKind: "tool",
    sourceId: "vortex",
    sourceKind: "vortex",
    toolId: "tool_1",
    toolType: "centrifuge_tube",
    ...overrides,
  };
}

describe("resolveToolDropCommand", () => {
  it("maps non-palette moves to the generic move payload", () => {
    expect(resolveToolDropCommand(createWorkbenchToolPayload(), { kind: "gross_balance" })).toEqual({
      kind: "move_tool",
      payload: {
        source_kind: "workbench",
        source_id: "station_1",
        destination_kind: "gross_balance",
        destination_id: "gross_balance",
      },
    });

    expect(resolveToolDropCommand(createRackToolPayload(), { kind: "workbench_slot", slotId: "station_2" })).toEqual({
      kind: "move_tool",
      payload: {
        source_kind: "rack",
        source_id: "rack_a1",
        destination_kind: "workbench_slot",
        destination_id: "station_2",
      },
    });

    expect(resolveToolDropCommand(createTrashToolPayload(), { kind: "analytical_balance" })).toEqual({
      kind: "move_tool",
      payload: {
        source_kind: "trash",
        source_id: "trash_tool_1",
        destination_kind: "analytical_balance",
        destination_id: "analytical_balance",
      },
    });
  });

  it("maps palette drops to the generic palette payload", () => {
    expect(resolveToolDropCommand(createToolbarToolPayload(), { kind: "workbench_slot", slotId: "station_2" })).toEqual({
      kind: "place_tool_from_palette",
      payload: {
        tool_id: "centrifuge_tube_50ml",
        destination_kind: "workbench_slot",
        destination_id: "station_2",
      },
    });

    expect(resolveToolDropCommand(createToolbarToolPayload(), { kind: "trash_bin" })).toEqual({
      kind: "place_tool_from_palette",
      payload: {
        tool_id: "centrifuge_tube_50ml",
        destination_kind: "trash_bin",
        destination_id: "trash_bin",
      },
    });
  });

  it("rejects same-origin moves but leaves target compatibility to backend-authored target state", () => {
    expect(resolveToolDropCommand(createWorkbenchToolPayload(), { kind: "workbench_slot", slotId: "station_1" })).toBeNull();
    expect(resolveToolDropCommand(createRackToolPayload(), { kind: "rack_slot", rackSlotId: "rack_a1" })).toBeNull();

    expect(resolveToolDropCommand(
      createToolbarToolPayload({ itemId: "beaker_250ml", toolType: "beaker" }),
      { kind: "rack_slot", rackSlotId: "rack_b2" },
    )).toEqual({
      kind: "place_tool_from_palette",
      payload: {
        tool_id: "beaker_250ml",
        destination_kind: "rack_slot",
        destination_id: "rack_b2",
      },
    });

    expect(resolveToolDropCommand(
      createToolbarToolPayload({ itemId: "beaker_250ml", toolType: "beaker" }),
      { kind: "vortex" },
    )).toEqual({
      kind: "place_tool_from_palette",
      payload: {
        tool_id: "beaker_250ml",
        destination_kind: "vortex",
        destination_id: "vortex",
      },
    });

    expect(resolveToolDropCommand(createVortexToolPayload(), { kind: "vortex" })).toEqual({
      kind: "move_tool",
      payload: {
        source_kind: "vortex",
        source_id: "vortex",
        destination_kind: "vortex",
        destination_id: "vortex",
      },
    });
  });

  it("keeps basket provenance in the generic move payload", () => {
    expect(resolveToolDropCommand(createBasketToolPayload(), { kind: "workbench_slot", slotId: "station_2" })).toEqual({
      kind: "move_tool",
      payload: {
        source_kind: "basket",
        source_id: "received_bag_1",
        destination_kind: "workbench_slot",
        destination_id: "station_2",
      },
    });

    expect(resolveToolDropCommand(createBasketToolPayload(), { kind: "gross_balance" })).toEqual({
      kind: "move_tool",
      payload: {
        source_kind: "basket",
        source_id: "received_bag_1",
        destination_kind: "gross_balance",
        destination_id: "gross_balance",
      },
    });
  });
});
