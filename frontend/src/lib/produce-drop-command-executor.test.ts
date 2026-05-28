import { describe, expect, it, vi } from "vitest";

import {
  executeGrinderProduceDropCommand,
  executeGrossBalanceProduceDropCommand,
  executeWorkbenchProduceDropCommand,
} from "@/lib/produce-drop-command-executor";

describe("produce-drop-command-executor", () => {
  it("opens the workbench draft for debug produce presets", () => {
    const setPendingDropDraft = vi.fn();
    const api = {
      moveObject: vi.fn(),
    };

    expect(executeWorkbenchProduceDropCommand({
      kind: "create_debug_produce_lot_on_workbench",
      payload: { presetId: "apple_powder_residual_co2", targetSlotId: "station_1" },
    }, api, {
      buildDebugProduceDraftFields: () => [],
      setPendingDropDraft,
    })).toBe(true);
    expect(setPendingDropDraft).toHaveBeenCalledWith(expect.objectContaining({
      commandType: "create_debug_produce_lot_on_workbench",
      targetId: "station_1",
    }));
  });

  it("dispatches gross balance and grinder produce commands", () => {
    const setPendingDropDraft = vi.fn();
    const grossApi = {
      moveObject: vi.fn(),
    };
    const grinderApi = {
      moveObject: vi.fn(),
    };

    expect(executeGrossBalanceProduceDropCommand({
      kind: "move_object",
      payload: {
        entity: { kind: "produce_lot", id: "produce_1" },
        source: { kind: "basket", id: "produce_basket" },
        destination: { kind: "gross_balance", id: "gross_balance" },
      },
    }, grossApi, {
      buildDebugProduceDraftFields: () => [],
      setPendingDropDraft,
    })).toBe(true);
    expect(grossApi.moveObject).toHaveBeenCalledWith({
      entity: { kind: "produce_lot", id: "produce_1" },
      source: { kind: "basket", id: "produce_basket" },
      destination: { kind: "gross_balance", id: "gross_balance" },
    });

    expect(executeGrinderProduceDropCommand({
      kind: "move_object",
      payload: {
        entity: { kind: "produce_lot", id: "produce_1" },
        source: { kind: "trash", id: "trash_1" },
        destination: { kind: "workspace_widget", id: "grinder" },
      },
    }, grinderApi, {
      buildDebugProduceDraftFields: () => [],
      setPendingDropDraft,
    })).toBe(true);
    expect(grinderApi.moveObject).toHaveBeenCalledWith({
      entity: { kind: "produce_lot", id: "produce_1" },
      source: { kind: "trash", id: "trash_1" },
      destination: { kind: "workspace_widget", id: "grinder" },
    });
  });
});
