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
    entityId: "bench_tool_1",
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
    entityId: "received_bag_1",
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
    entityId: "rack_tool_1",
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
    entityId: "trash_tool_1",
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
    entityId: "vortex_tool_1",
    entityKind: "tool",
    sourceId: "vortex",
    sourceKind: "vortex",
    toolId: "tool_1",
    toolType: "centrifuge_tube",
    ...overrides,
  };
}

describe("resolveToolDropCommand", () => {
  it("maps all tool drops to the generic move-object command", () => {
    expect(resolveToolDropCommand(createWorkbenchToolPayload(), { kind: "gross_balance" })).toEqual({
      kind: "move_object",
      payload: {
        entity: { kind: "tool", id: "bench_tool_1" },
        source: { kind: "workbench", id: "station_1" },
        destination: { kind: "gross_balance", id: "gross_balance" },
      },
    });

    expect(resolveToolDropCommand(createRackToolPayload(), { kind: "workbench_slot", slotId: "station_2" })).toEqual({
      kind: "move_object",
      payload: {
        entity: { kind: "tool", id: "rack_tool_1" },
        source: { kind: "rack", id: "rack_a1" },
        destination: { kind: "workbench_slot", id: "station_2" },
      },
    });

    expect(resolveToolDropCommand(createTrashToolPayload(), { kind: "analytical_balance" })).toEqual({
      kind: "move_object",
      payload: {
        entity: { kind: "tool", id: "trash_tool_1" },
        source: { kind: "trash", id: "trash_tool_1" },
        destination: { kind: "analytical_balance", id: "analytical_balance" },
      },
    });
  });

  it("keeps palette provenance in the generic move-object command", () => {
    expect(resolveToolDropCommand(createToolbarToolPayload(), { kind: "workbench_slot", slotId: "station_2" })).toEqual({
      kind: "move_object",
      payload: {
        entity: { kind: "tool", id: "centrifuge_tube_50ml" },
        source: { kind: "palette", id: "centrifuge_tube_50ml" },
        destination: { kind: "workbench_slot", id: "station_2" },
      },
    });
  });

  it("rejects same-origin moves but leaves target compatibility to the backend contract", () => {
    expect(resolveToolDropCommand(createWorkbenchToolPayload(), { kind: "workbench_slot", slotId: "station_1" })).toBeNull();
    expect(resolveToolDropCommand(createRackToolPayload(), { kind: "rack_slot", rackSlotId: "rack_a1" })).toBeNull();

    expect(resolveToolDropCommand(createToolbarToolPayload({ itemId: "beaker_250ml", toolType: "beaker" }), { kind: "rack_slot", rackSlotId: "rack_b2" })).toEqual({
      kind: "move_object",
      payload: {
        entity: { kind: "tool", id: "beaker_250ml" },
        source: { kind: "palette", id: "beaker_250ml" },
        destination: { kind: "rack_slot", id: "rack_b2" },
      },
    });

    expect(resolveToolDropCommand(createVortexToolPayload(), { kind: "vortex" })).toBeNull();
  });

  it("keeps basket provenance in the generic move-object command", () => {
    expect(resolveToolDropCommand(createBasketToolPayload(), { kind: "workbench_slot", slotId: "station_2" })).toEqual({
      kind: "move_object",
      payload: {
        entity: { kind: "tool", id: "received_bag_1" },
        source: { kind: "basket", id: "received_bag_1" },
        destination: { kind: "workbench_slot", id: "station_2" },
      },
    });
  });
});
