import { describe, expect, it, vi } from "vitest";

import {
  executeAnalyticalBalanceLabelDropCommand,
  executeGrossBalanceLabelDropCommand,
  executeTrashLabelDropCommand,
  executeWorkbenchLabelDropCommand,
} from "@/lib/label-drop-command-executor";

describe("label-drop-command-executor", () => {
  it("dispatches workbench label commands", () => {
    const api = {
      applyPrintedLimsLabel: vi.fn(),
      applySampleLabelToWorkbenchTool: vi.fn(),
      moveObject: vi.fn(),
    };

    expect(executeWorkbenchLabelDropCommand({
      kind: "move_object",
      payload: {
        destination: { kind: "workbench_tool", id: "station_2" },
        entity: { kind: "sample_label", id: "label_1" },
        source: { kind: "workbench", id: "station_1" },
      },
    }, api)).toBe(true);
    expect(api.moveObject).toHaveBeenCalledWith({
      destination: { kind: "workbench_tool", id: "station_2" },
      entity: { kind: "sample_label", id: "label_1" },
      source: { kind: "workbench", id: "station_1" },
    });
  });

  it("dispatches balance and trash label commands", () => {
    const grossApi = {
      applyPrintedLimsLabelToGrossBalanceBag: vi.fn(),
      applySampleLabelToGrossBalanceTool: vi.fn(),
      moveObject: vi.fn(),
    };
    const analyticalApi = {
      applyPrintedLimsLabelToAnalyticalBalanceTool: vi.fn(),
      applySampleLabelToAnalyticalBalanceTool: vi.fn(),
      moveObject: vi.fn(),
    };
    const trashApi = {
      discardPrintedLimsLabel: vi.fn(),
      discardSampleLabelFromPalette: vi.fn(),
      moveObject: vi.fn(),
    };

    expect(executeGrossBalanceLabelDropCommand({
      kind: "apply_printed_lims_label_to_gross_balance_bag",
    }, grossApi)).toBe(true);
    expect(grossApi.applyPrintedLimsLabelToGrossBalanceBag).toHaveBeenCalled();

    expect(executeAnalyticalBalanceLabelDropCommand({
      kind: "move_object",
      payload: {
        destination: { kind: "analytical_balance", id: "analytical_balance" },
        entity: { kind: "sample_label", id: "label_1" },
        source: { kind: "trash", id: "trash_1" },
      },
    }, analyticalApi)).toBe(true);
    expect(analyticalApi.moveObject).toHaveBeenCalledWith({
      destination: { kind: "analytical_balance", id: "analytical_balance" },
      entity: { kind: "sample_label", id: "label_1" },
      source: { kind: "trash", id: "trash_1" },
    });

    expect(executeTrashLabelDropCommand({
      kind: "discard_sample_label_from_palette",
    }, trashApi)).toBe(true);
    expect(trashApi.discardSampleLabelFromPalette).toHaveBeenCalled();
  });
});
