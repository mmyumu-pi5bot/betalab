import { describe, expect, it, vi } from "vitest";

import { executeToolDropCommand } from "@/lib/tool-drop-command-executor";

describe("tool-drop-command-executor", () => {
  it("dispatches move commands", () => {
    const api = {
      moveTool: vi.fn(),
      placeToolFromPalette: vi.fn(),
    };

    expect(executeToolDropCommand({
      kind: "move_tool",
      payload: {
        source_kind: "rack",
        source_id: "rack_a1",
        destination_kind: "workbench_slot",
        destination_id: "station_1",
      },
    }, api)).toBe(true);

    expect(api.moveTool).toHaveBeenCalledWith({
      source_kind: "rack",
      source_id: "rack_a1",
      destination_kind: "workbench_slot",
      destination_id: "station_1",
    });
  });

  it("dispatches palette commands", () => {
    const api = {
      moveTool: vi.fn(),
      placeToolFromPalette: vi.fn(),
    };

    expect(executeToolDropCommand({
      kind: "place_tool_from_palette",
      payload: {
        tool_id: "sample_vial_lcms",
        destination_kind: "rack_slot",
        destination_id: "rack_a1",
      },
    }, api)).toBe(true);

    expect(api.placeToolFromPalette).toHaveBeenCalledWith({
      tool_id: "sample_vial_lcms",
      destination_kind: "rack_slot",
      destination_id: "rack_a1",
    });
  });
});
