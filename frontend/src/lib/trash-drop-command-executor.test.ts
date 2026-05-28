import { describe, expect, it, vi } from "vitest";

import { executeTrashDropCommand } from "@/lib/trash-drop-command-executor";

describe("trash-drop-command-executor", () => {
  it("dispatches workspace liquid and produce trash commands", () => {
    const api = {
      discardPrintedLimsLabel: vi.fn(),
      discardSampleLabelFromPalette: vi.fn(),
      moveObject: vi.fn(),
      removeLiquidFromWorkspaceWidget: vi.fn(),
    };

    expect(executeTrashDropCommand({
      kind: "remove_liquid_from_workspace_widget",
      payload: { liquid_entry_id: "liquid_1", widget_id: "grinder" },
    }, api)).toBe(true);
    expect(api.removeLiquidFromWorkspaceWidget).toHaveBeenCalledWith({
      liquid_entry_id: "liquid_1",
      widget_id: "grinder",
    });

    expect(executeTrashDropCommand({
      kind: "move_object",
      payload: {
        entity: { kind: "produce_lot", id: "produce_1" },
        source: { kind: "workbench", id: "station_1" },
        destination: { kind: "trash_bin", id: "trash_bin" },
      },
    }, api)).toBe(true);
    expect(api.moveObject).toHaveBeenCalledWith({
      entity: { kind: "produce_lot", id: "produce_1" },
      source: { kind: "workbench", id: "station_1" },
      destination: { kind: "trash_bin", id: "trash_bin" },
    });
  });

  it("dispatches label trash commands and rejects unrelated commands", () => {
    const api = {
      discardPrintedLimsLabel: vi.fn(),
      discardSampleLabelFromPalette: vi.fn(),
      moveObject: vi.fn(),
      removeLiquidFromWorkspaceWidget: vi.fn(),
    };

    expect(executeTrashDropCommand({
      kind: "discard_printed_lims_label",
    }, api)).toBe(true);
    expect(api.discardPrintedLimsLabel).toHaveBeenCalled();

    expect(executeTrashDropCommand({
      kind: "apply_sample_label_to_gross_balance_tool",
    }, api)).toBe(false);
  });
});
